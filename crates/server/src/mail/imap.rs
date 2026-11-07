//! IMAP4rev1-Server (RFC 3501, dazu IDLE, UIDPLUS, MOVE, SPECIAL-USE, LITERAL+, NAMESPACE, ID, UNSELECT)
//! für Handy- und Desktop-Programme. Ordner sind fest (Posteingang, Gesendet, Entwürfe, Papierkorb, Spam, Archiv).
//! UIDs stammen aus einer globalen Sequenz → innerhalb jedes Ordners streng steigend, UIDVALIDITY bleibt 1.

use super::tls::{self, Stream};
use super::{MailUser, MAX_SIZE};
use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgPool;
use std::fmt::Write as _;
use std::net::SocketAddr;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;
use tokio::time::timeout;
use uuid::Uuid;

const AUTOLOGOUT: Duration = Duration::from_secs(30 * 60);
const UIDVALIDITY: u32 = 1;

pub async fn serve(db: PgPool, bind: String, implicit_tls: bool) {
    match TcpListener::bind(&bind).await {
        Ok(l) => {
            tracing::info!("IMAP lauscht auf {bind}{}", if implicit_tls { " (TLS)" } else { "" });
            run(db, l, implicit_tls).await
        }
        Err(e) => tracing::error!("IMAP auf {bind} nicht möglich: {e}"),
    }
}

pub async fn run(db: PgPool, listener: TcpListener, implicit_tls: bool) {
    loop {
        let Ok((sock, peer)) = listener.accept().await else { continue };
        let db = db.clone();
        tokio::spawn(async move {
            let stream = if implicit_tls {
                let Some(acc) = tls::acceptor() else { return };
                match acc.accept(sock).await {
                    Ok(t) => Stream::Tls(Box::new(t)),
                    Err(_) => return,
                }
            } else {
                Stream::Plain(sock)
            };
            if let Err(e) = session(db, stream, peer).await {
                tracing::debug!("IMAP {peer}: {e}");
            }
        });
    }
}

// ── Ordnernamen ────────────────────────────────────────────────────────

const NAMES: [(&str, &str, &str); 6] = [
    ("inbox", "INBOX", ""),
    ("sent", "Sent", "\\Sent"),
    ("drafts", "Drafts", "\\Drafts"),
    ("trash", "Trash", "\\Trash"),
    ("junk", "Junk", "\\Junk"),
    ("archive", "Archive", "\\Archive"),
];

fn folder_of(name: &str) -> Option<&'static str> {
    let n = name.trim_matches('/').to_lowercase();
    let n = n.strip_prefix("inbox/").unwrap_or(&n);
    Some(match n {
        "inbox" => "inbox",
        "sent" | "sent messages" | "sent items" | "gesendet" => "sent",
        "drafts" | "entwürfe" => "drafts",
        "trash" | "deleted messages" | "deleted items" | "papierkorb" => "trash",
        "junk" | "spam" => "junk",
        "archive" | "archiv" => "archive",
        _ => return None,
    })
}

fn imap_name(folder: &str) -> &'static str {
    NAMES.iter().find(|n| n.0 == folder).map(|n| n.1).unwrap_or("INBOX")
}

// ── Kommandozeilen lesen und zerlegen ──────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
enum Tok {
    Atom(String),
    Str(Vec<u8>),
    List(Vec<Tok>),
}

impl Tok {
    fn text(&self) -> String {
        match self {
            Tok::Atom(a) => a.clone(),
            Tok::Str(s) => String::from_utf8_lossy(s).into_owned(),
            Tok::List(_) => String::new(),
        }
    }
    fn bytes(&self) -> Vec<u8> {
        match self {
            Tok::Str(s) => s.clone(),
            Tok::Atom(a) => a.as_bytes().to_vec(),
            Tok::List(_) => vec![],
        }
    }
    fn list(&self) -> Vec<Tok> {
        match self {
            Tok::List(l) => l.clone(),
            t => vec![t.clone()],
        }
    }
}

struct Parser<'a> {
    b: &'a [u8],
    i: usize,
}

impl Parser<'_> {
    fn skip_ws(&mut self) {
        while self.i < self.b.len() && matches!(self.b[self.i], b' ' | b'\r' | b'\n') {
            self.i += 1;
        }
    }
    fn tokens(&mut self, until_paren: bool) -> Vec<Tok> {
        let mut out = vec![];
        loop {
            self.skip_ws();
            if self.i >= self.b.len() {
                return out;
            }
            match self.b[self.i] {
                b')' if until_paren => {
                    self.i += 1;
                    return out;
                }
                b')' => self.i += 1,
                b'(' => {
                    self.i += 1;
                    out.push(Tok::List(self.tokens(true)));
                }
                b'"' => {
                    self.i += 1;
                    let mut s = vec![];
                    while self.i < self.b.len() && self.b[self.i] != b'"' {
                        if self.b[self.i] == b'\\' && self.i + 1 < self.b.len() {
                            self.i += 1;
                        }
                        s.push(self.b[self.i]);
                        self.i += 1;
                    }
                    self.i += 1;
                    out.push(Tok::Str(s));
                }
                b'{' => {
                    let end =
                        self.b[self.i..].iter().position(|c| *c == b'}').map(|p| p + self.i).unwrap_or(self.b.len());
                    let n: usize =
                        String::from_utf8_lossy(&self.b[self.i + 1..end]).trim_end_matches('+').parse().unwrap_or(0);
                    self.i = (end + 1).min(self.b.len());
                    if self.b[self.i..].starts_with(b"\r\n") {
                        self.i += 2;
                    }
                    let stop = (self.i + n).min(self.b.len());
                    out.push(Tok::Str(self.b[self.i..stop].to_vec()));
                    self.i = stop;
                }
                _ => {
                    let start = self.i;
                    let mut depth = 0;
                    while self.i < self.b.len() {
                        let c = self.b[self.i];
                        if c == b'[' {
                            depth += 1;
                        } else if c == b']' {
                            depth -= 1;
                        } else if depth == 0 && matches!(c, b' ' | b'(' | b')' | b'\r' | b'\n') {
                            break;
                        }
                        self.i += 1;
                    }
                    out.push(Tok::Atom(String::from_utf8_lossy(&self.b[start..self.i]).into_owned()));
                }
            }
        }
    }
}

fn parse(b: &[u8]) -> Vec<Tok> {
    Parser { b, i: 0 }.tokens(false)
}

type Io = BufReader<Stream>;

/// Ganze Befehlszeile inkl. Literale lesen; None = Verbindung zu
async fn read_command(io: &mut Io) -> std::io::Result<Option<Vec<u8>>> {
    let mut buf = Vec::new();
    loop {
        let mut line = Vec::new();
        let n = timeout(AUTOLOGOUT, (&mut *io).take(64 * 1024).read_until(b'\n', &mut line))
            .await
            .map_err(|_| std::io::Error::new(std::io::ErrorKind::TimedOut, "Autologout"))??;
        if n == 0 {
            return Ok(None);
        }
        buf.extend_from_slice(&line);
        let t = String::from_utf8_lossy(&line);
        let t = t.trim_end();
        if let (Some(open), true) = (t.rfind('{'), t.ends_with('}')) {
            let spec = &t[open + 1..t.len() - 1];
            let plus = spec.ends_with('+');
            let Ok(n) = spec.trim_end_matches('+').parse::<usize>() else { return Ok(Some(buf)) };
            if n > MAX_SIZE || buf.len() + n > MAX_SIZE + 65536 {
                return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Literal zu groß"));
            }
            if !plus {
                io.get_mut().write_all(b"+ Bereit\r\n").await?;
                io.get_mut().flush().await?;
            }
            let mut lit = vec![0u8; n];
            timeout(AUTOLOGOUT, io.read_exact(&mut lit))
                .await
                .map_err(|_| std::io::Error::new(std::io::ErrorKind::TimedOut, "Autologout"))??;
            buf.extend_from_slice(&lit);
            continue;
        }
        return Ok(Some(buf));
    }
}

// ── Ausgabe-Hilfen ─────────────────────────────────────────────────────

/// IMAP-String: NIL, "quoted" (ASCII) oder {n}-Literal
fn nstr(out: &mut Vec<u8>, s: Option<&[u8]>) {
    match s {
        None => out.extend_from_slice(b"NIL"),
        Some(s) if s.iter().all(|c| (0x20..0x7f).contains(c)) && s.len() < 1000 => {
            out.push(b'"');
            for c in s {
                if *c == b'"' || *c == b'\\' {
                    out.push(b'\\');
                }
                out.push(*c);
            }
            out.push(b'"');
        }
        Some(s) => {
            out.extend_from_slice(format!("{{{}}}\r\n", s.len()).as_bytes());
            out.extend_from_slice(s);
        }
    }
}

fn q(s: &str) -> Vec<u8> {
    let mut v = vec![];
    nstr(&mut v, Some(s.as_bytes()));
    v
}

fn imap_date(d: DateTime<Utc>) -> String {
    d.format("%d-%b-%Y %H:%M:%S +0000").to_string()
}

fn parse_date(s: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(s.trim_matches('"'), "%d-%b-%Y").ok()
}

/// Kopfbereich und Rumpf trennen
fn split(raw: &[u8]) -> (&[u8], &[u8]) {
    match raw.windows(4).position(|w| w == b"\r\n\r\n") {
        Some(p) => (&raw[..p + 4], &raw[p + 4..]),
        None => match raw.windows(2).position(|w| w == b"\n\n") {
            Some(p) => (&raw[..p + 2], &raw[p + 2..]),
            None => (raw, &[]),
        },
    }
}

/// Kopfzeilen (entfaltet) als (Name, Rohzeilen)
fn header_lines(h: &[u8]) -> Vec<(String, Vec<u8>)> {
    let mut out: Vec<(String, Vec<u8>)> = vec![];
    for line in h.split_inclusive(|c| *c == b'\n') {
        if line == b"\r\n" || line == b"\n" {
            break;
        }
        if (line.starts_with(b" ") || line.starts_with(b"\t")) && !out.is_empty() {
            out.last_mut().unwrap().1.extend_from_slice(line);
        } else {
            let name = line
                .split(|c| *c == b':')
                .next()
                .map(|n| String::from_utf8_lossy(n).trim().to_lowercase())
                .unwrap_or_default();
            out.push((name, line.to_vec()));
        }
    }
    out
}

fn header_value(h: &[u8], name: &str) -> Option<Vec<u8>> {
    header_lines(h).into_iter().find(|(n, _)| n == name).map(|(_, l)| {
        let v = &l[l.iter().position(|c| *c == b':').map(|p| p + 1).unwrap_or(0)..];
        let s = String::from_utf8_lossy(v);
        s.split(['\r', '\n']).map(str::trim).filter(|x| !x.is_empty()).collect::<Vec<_>>().join(" ").into_bytes()
    })
}

fn addr_list(out: &mut Vec<u8>, list: Option<mail_parser::AddressList<'_>>) {
    let boxes: Vec<_> = list.map(|l| l.mailboxes().collect()).unwrap_or_default();
    if boxes.is_empty() {
        out.extend_from_slice(b"NIL");
        return;
    }
    out.push(b'(');
    for b in boxes {
        let addr = b.address().unwrap_or("");
        let (user, host) = addr.rsplit_once('@').unwrap_or((addr, ""));
        out.push(b'(');
        nstr(out, b.name().map(str::as_bytes));
        out.extend_from_slice(b" NIL ");
        nstr(out, Some(user.as_bytes()));
        out.push(b' ');
        nstr(out, Some(host.as_bytes()));
        out.push(b')');
    }
    out.push(b')');
}

fn envelope(out: &mut Vec<u8>, raw: &[u8]) {
    let (h, _) = split(raw);
    let m = mail_parser::MessageParser::default().parse(raw);
    out.push(b'(');
    nstr(out, header_value(h, "date").as_deref());
    out.push(b' ');
    nstr(out, header_value(h, "subject").as_deref());
    let from = m.as_ref().and_then(|m| m.from());
    for (i, field) in ["from", "sender", "reply-to", "to", "cc", "bcc"].iter().enumerate() {
        out.push(b' ');
        let list = m.as_ref().and_then(|m| match *field {
            "from" => m.from(),
            "to" => m.to(),
            "cc" => m.cc(),
            "bcc" => m.bcc(),
            "reply-to" => m.reply_to().or_else(|| m.from()),
            _ => m.sender().or_else(|| m.from()),
        });
        let _ = (i, &from);
        addr_list(out, list);
    }
    out.push(b' ');
    nstr(out, header_value(h, "in-reply-to").as_deref());
    out.push(b' ');
    nstr(out, header_value(h, "message-id").as_deref());
    out.push(b')');
}

fn body_structure(out: &mut Vec<u8>, part: &mail_parser::MessagePart<'_>, ext: bool) {
    if part.is_multipart() {
        out.push(b'(');
        let children: Vec<_> = part.children().collect();
        if children.is_empty() {
            out.extend_from_slice(b"(\"TEXT\" \"PLAIN\" NIL NIL NIL \"7BIT\" 0 0)");
        }
        for c in &children {
            body_structure(out, c, ext);
        }
        let sub = part.content_type().and_then(|c| c.subtype()).unwrap_or("mixed").to_uppercase();
        out.push(b' ');
        out.extend_from_slice(&q(&sub));
        if ext {
            out.push(b' ');
            params(out, part);
            out.extend_from_slice(b" NIL NIL NIL");
        }
        out.push(b')');
        return;
    }
    let ct = part.content_type();
    let ty = ct.as_ref().map(|c| c.ctype().to_uppercase()).unwrap_or_else(|| "TEXT".into());
    let sub = ct.as_ref().and_then(|c| c.subtype()).map(str::to_uppercase).unwrap_or_else(|| "PLAIN".into());
    let body = part.raw_body();
    out.push(b'(');
    out.extend_from_slice(&q(&ty));
    out.push(b' ');
    out.extend_from_slice(&q(&sub));
    out.push(b' ');
    params(out, part);
    out.push(b' ');
    nstr(out, part.content_id().map(|c| format!("<{c}>")).as_deref().map(str::as_bytes));
    out.push(b' ');
    nstr(out, part.content_description().map(str::as_bytes));
    out.push(b' ');
    out.extend_from_slice(&q(&part.content_transfer_encoding().unwrap_or("7BIT").to_uppercase()));
    let _ = write!(Vecw(out), " {}", body.len());
    let lines = body.iter().filter(|c| **c == b'\n').count();
    if let Some(nested) = part.nested() {
        out.push(b' ');
        envelope(out, nested.raw());
        out.push(b' ');
        body_structure(out, &nested.root_part(), ext);
        let _ = write!(Vecw(out), " {lines}");
    } else if ty == "TEXT" {
        let _ = write!(Vecw(out), " {lines}");
    }
    if ext {
        out.extend_from_slice(b" NIL ");
        match (part.content_disposition(), part.attachment_name()) {
            (Some(d), _) => {
                out.push(b'(');
                out.extend_from_slice(&q(&d.ctype().to_uppercase()));
                out.push(b' ');
                match part.attachment_name() {
                    Some(n) => {
                        out.extend_from_slice(b"(\"FILENAME\" ");
                        nstr(out, Some(n.as_bytes()));
                        out.push(b')');
                    }
                    None => out.extend_from_slice(b"NIL"),
                }
                out.push(b')');
            }
            _ => out.extend_from_slice(b"NIL"),
        }
        out.extend_from_slice(b" NIL NIL");
    }
    out.push(b')');
}

fn params(out: &mut Vec<u8>, part: &mail_parser::MessagePart<'_>) {
    let ps: Vec<(String, String)> = part
        .content_type()
        .map(|c| c.attributes().map(|(k, v)| (k.to_uppercase(), v.to_string())).collect())
        .unwrap_or_default();
    if ps.is_empty() {
        out.extend_from_slice(b"NIL");
        return;
    }
    out.push(b'(');
    for (i, (k, v)) in ps.iter().enumerate() {
        if i > 0 {
            out.push(b' ');
        }
        nstr(out, Some(k.as_bytes()));
        out.push(b' ');
        nstr(out, Some(v.as_bytes()));
    }
    out.push(b')');
}

struct Vecw<'a>(&'a mut Vec<u8>);
impl std::fmt::Write for Vecw<'_> {
    fn write_str(&mut self, s: &str) -> std::fmt::Result {
        self.0.extend_from_slice(s.as_bytes());
        Ok(())
    }
}

/// Teil `1.2` (ggf. durch eingebettete Nachrichten hindurch) als Bytes: (Kopf, Rumpf)
fn section_part(raw: &[u8], path: &[usize]) -> Option<(Vec<u8>, Vec<u8>)> {
    let m = mail_parser::MessageParser::default().parse(raw)?;
    let mut part = m.root_part();
    for (depth, n) in path.iter().enumerate() {
        if depth > 0 {
            if let Some(nested) = part.nested() {
                part = nested.root_part();
            }
        }
        if part.is_multipart() {
            part = part.children().nth(n.checked_sub(1)?)?;
        } else if *n != 1 {
            return None;
        }
    }
    Some((part.raw_headers().to_vec(), part.raw_body().to_vec()))
}

/// BODY[...]-Inhalt
fn section(raw: &[u8], spec: &str) -> Vec<u8> {
    let spec = spec.trim();
    let upper = spec.to_uppercase();
    let (h, b) = split(raw);
    if spec.is_empty() {
        return raw.to_vec();
    }
    if upper == "HEADER" {
        return h.to_vec();
    }
    if upper == "TEXT" {
        return b.to_vec();
    }
    if let Some(rest) = upper.strip_prefix("HEADER.FIELDS") {
        let not = rest.starts_with(".NOT");
        let names: Vec<String> = rest
            .trim_start_matches(".NOT")
            .trim()
            .trim_matches(|c| c == '(' || c == ')')
            .split_whitespace()
            .map(|s| s.trim_matches('"').to_lowercase())
            .collect();
        let mut out = vec![];
        for (n, line) in header_lines(h) {
            if names.contains(&n) != not {
                out.extend_from_slice(&line);
            }
        }
        out.extend_from_slice(b"\r\n");
        return out;
    }
    // Teilnummern: 1.2[.MIME|.HEADER|.TEXT]
    let mut nums = vec![];
    let mut tail = "";
    for p in upper.split('.') {
        match p.parse::<usize>() {
            Ok(n) if tail.is_empty() => nums.push(n),
            _ => {
                tail = p;
                break;
            }
        }
    }
    match section_part(raw, &nums) {
        Some((ph, pb)) => match tail {
            "MIME" => {
                let mut v = ph;
                if !v.ends_with(b"\r\n\r\n") {
                    v.extend_from_slice(b"\r\n");
                }
                v
            }
            "HEADER" => split(&pb).0.to_vec(),
            "TEXT" => split(&pb).1.to_vec(),
            _ => pb,
        },
        None => vec![],
    }
}

// ── Sitzung ────────────────────────────────────────────────────────────

struct Selected {
    folder: &'static str,
    read_only: bool,
    uids: Vec<i64>,
}

struct Sess {
    db: PgPool,
    user: Option<MailUser>,
    sel: Option<Selected>,
}

async fn send(io: &mut Io, data: &[u8]) -> std::io::Result<()> {
    io.get_mut().write_all(data).await?;
    io.get_mut().flush().await
}

fn caps(tls_on: bool) -> String {
    let mut c = String::from("IMAP4rev1 LITERAL+ IDLE NAMESPACE UIDPLUS MOVE ID UNSELECT SPECIAL-USE ENABLE CHILDREN");
    if !tls_on && tls::acceptor().is_some() {
        c.push_str(" STARTTLS");
    }
    if tls_on || tls::plain_auth_allowed() {
        c.push_str(" AUTH=PLAIN");
    } else {
        c.push_str(" LOGINDISABLED");
    }
    c
}

async fn session(db: PgPool, stream: Stream, _peer: SocketAddr) -> std::io::Result<()> {
    let mut io = BufReader::new(stream);
    let mut s = Sess { db, user: None, sel: None };
    let tls_on = io.get_ref().is_tls();
    send(&mut io, format!("* OK [CAPABILITY {}] KM Code Craft IMAP bereit\r\n", caps(tls_on)).as_bytes()).await?;
    let mut bad = 0;
    loop {
        let Some(line) = read_command(&mut io).await? else { return Ok(()) };
        let toks = parse(&line);
        let (Some(tag), Some(cmd)) = (toks.first().map(Tok::text), toks.get(1).map(|t| t.text().to_uppercase())) else {
            send(&mut io, b"* BAD Leere Zeile\r\n").await?;
            continue;
        };
        let (uid, cmd, args) = if cmd == "UID" {
            (
                true,
                toks.get(2).map(|t| t.text().to_uppercase()).unwrap_or_default(),
                toks.get(3..).unwrap_or(&[]).to_vec(),
            )
        } else {
            (false, cmd, toks[2..].to_vec())
        };
        let tls_on = io.get_ref().is_tls();
        let can_auth = tls_on || tls::plain_auth_allowed();
        let result: Result<String, String> = match (cmd.as_str(), s.user.is_some()) {
            ("CAPABILITY", _) => {
                send(&mut io, format!("* CAPABILITY {}\r\n", caps(tls_on)).as_bytes()).await?;
                Ok("CAPABILITY erledigt".into())
            }
            ("NOOP", _) | ("CHECK", true) => {
                sync(&mut s, &mut io).await?;
                Ok("NOOP erledigt".into())
            }
            ("LOGOUT", _) => {
                send(&mut io, format!("* BYE Auf Wiedersehen\r\n{tag} OK LOGOUT erledigt\r\n").as_bytes()).await?;
                return Ok(());
            }
            ("ID", _) => {
                send(&mut io, b"* ID (\"name\" \"KM Code Craft\" \"vendor\" \"KM Code Craft\")\r\n").await?;
                Ok("ID erledigt".into())
            }
            ("ENABLE", true) => {
                send(&mut io, b"* ENABLED\r\n").await?;
                Ok("ENABLE erledigt".into())
            }
            ("STARTTLS", false) if !tls_on => match tls::acceptor() {
                Some(acc) => {
                    send(&mut io, format!("{tag} OK TLS starten\r\n").as_bytes()).await?;
                    io = BufReader::new(io.into_inner().upgrade(&acc).await?);
                    continue;
                }
                None => Err("TLS nicht verfügbar".into()),
            },
            ("LOGIN", false) if can_auth => {
                let (l, p) =
                    (args.first().map(Tok::text).unwrap_or_default(), args.get(1).map(Tok::text).unwrap_or_default());
                login(&mut s, &l, &p).await
            }
            ("AUTHENTICATE", false) if can_auth => {
                let mech = args.first().map(|t| t.text().to_uppercase()).unwrap_or_default();
                if mech != "PLAIN" {
                    Err("Nur AUTHENTICATE PLAIN".into())
                } else {
                    let b64 = match args.get(1) {
                        Some(t) => t.text(),
                        None => {
                            send(&mut io, b"+ \r\n").await?;
                            let l = read_command(&mut io).await?.unwrap_or_default();
                            String::from_utf8_lossy(&l).trim().to_string()
                        }
                    };
                    use base64::Engine;
                    let dec = base64::engine::general_purpose::STANDARD.decode(b64.trim()).unwrap_or_default();
                    let mut f = dec.split(|c| *c == 0).skip(1);
                    let l = f.next().map(|x| String::from_utf8_lossy(x).into_owned()).unwrap_or_default();
                    let p = f.next().map(|x| String::from_utf8_lossy(x).into_owned()).unwrap_or_default();
                    login(&mut s, &l, &p).await
                }
            }
            ("LOGIN" | "AUTHENTICATE", false) => Err("[PRIVACYREQUIRED] Bitte zuerst STARTTLS".into()),
            (_, false) => Err("Bitte zuerst anmelden".into()),
            ("NAMESPACE", true) => {
                send(&mut io, b"* NAMESPACE ((\"\" \"/\")) NIL NIL\r\n").await?;
                Ok("NAMESPACE erledigt".into())
            }
            ("LIST" | "LSUB", true) => {
                let args: Vec<Tok> = args.into_iter().filter(|t| !matches!(t, Tok::List(_))).collect();
                let pattern = args.get(1).map(Tok::text).unwrap_or_default();
                let mut out = Vec::new();
                if pattern.is_empty() {
                    out.extend_from_slice(format!("* {cmd} (\\Noselect) \"/\" \"\"\r\n").as_bytes());
                } else {
                    for (_, name, attr) in NAMES {
                        if wildcard(&pattern, name) {
                            out.extend_from_slice(
                                format!(
                                    "* {cmd} (\\HasNoChildren{}{attr}) \"/\" {}\r\n",
                                    if attr.is_empty() { "" } else { " " },
                                    String::from_utf8_lossy(&q(name))
                                )
                                .as_bytes(),
                            );
                        }
                    }
                }
                send(&mut io, &out).await?;
                Ok(format!("{cmd} erledigt"))
            }
            ("SUBSCRIBE" | "UNSUBSCRIBE", true) => Ok("erledigt".into()),
            ("CREATE" | "DELETE" | "RENAME", true) => Err("[CANNOT] Ordner sind fest vorgegeben".into()),
            ("STATUS", true) => status(&mut s, &mut io, &args).await,
            ("SELECT" | "EXAMINE", true) => select(&mut s, &mut io, &args, cmd == "EXAMINE").await,
            ("APPEND", true) => append(&mut s, &args).await,
            ("CLOSE", true) | ("UNSELECT", true) => {
                if cmd == "CLOSE" {
                    if let Some(sel) = &s.sel {
                        if !sel.read_only {
                            let user = s.user.as_ref().unwrap();
                            sqlx::query("DELETE FROM mail_messages WHERE mailbox_id = $1 AND folder = $2 AND deleted")
                                .bind(user.mailbox_id)
                                .bind(sel.folder)
                                .execute(&s.db)
                                .await
                                .map_err(io_err)?;
                        }
                    }
                }
                s.sel = None;
                Ok(format!("{cmd} erledigt"))
            }
            ("IDLE", true) => {
                send(&mut io, b"+ warte\r\n").await?;
                let started = std::time::Instant::now();
                loop {
                    match timeout(Duration::from_secs(5), io.fill_buf()).await {
                        Ok(Ok([])) => return Ok(()),
                        Ok(Ok(_)) => {
                            let l = read_command(&mut io).await?.unwrap_or_default();
                            if String::from_utf8_lossy(&l).trim().eq_ignore_ascii_case("DONE") {
                                break;
                            }
                        }
                        Ok(Err(e)) => return Err(e),
                        Err(_) => {
                            sync(&mut s, &mut io).await?;
                            if started.elapsed() > AUTOLOGOUT {
                                break;
                            }
                        }
                    }
                }
                Ok("IDLE beendet".into())
            }
            (c, true) if s.sel.is_none() && matches!(c, "FETCH" | "STORE" | "SEARCH" | "COPY" | "MOVE" | "EXPUNGE") => {
                Err("Kein Ordner ausgewählt".into())
            }
            ("FETCH", true) => fetch(&mut s, &mut io, &args, uid).await,
            ("STORE", true) => store(&mut s, &mut io, &args, uid).await,
            ("SEARCH", true) => search(&mut s, &mut io, &args, uid).await,
            ("COPY" | "MOVE", true) => copy(&mut s, &mut io, &args, uid, cmd == "MOVE").await,
            ("EXPUNGE", true) => expunge(&mut s, &mut io, if uid { args.first().map(Tok::text) } else { None }).await,
            _ => {
                bad += 1;
                send(&mut io, format!("{tag} BAD Unbekannter Befehl\r\n").as_bytes()).await?;
                if bad > 20 {
                    return Ok(());
                }
                continue;
            }
        };
        match result {
            Ok(t) => send(&mut io, format!("{tag} OK {t}\r\n").as_bytes()).await?,
            Err(t) => send(&mut io, format!("{tag} NO {t}\r\n").as_bytes()).await?,
        }
    }
}

fn io_err(e: sqlx::Error) -> std::io::Error {
    std::io::Error::other(e)
}

fn wildcard(pattern: &str, name: &str) -> bool {
    fn m(p: &[u8], n: &[u8]) -> bool {
        match (p.first(), n.first()) {
            (None, None) => true,
            (Some(b'*'), _) => m(&p[1..], n) || (!n.is_empty() && m(p, &n[1..])),
            (Some(b'%'), _) => m(&p[1..], n) || (!n.is_empty() && n[0] != b'/' && m(p, &n[1..])),
            (Some(a), Some(b)) => a.eq_ignore_ascii_case(b) && m(&p[1..], &n[1..]),
            _ => false,
        }
    }
    m(pattern.as_bytes(), name.as_bytes())
}

async fn login(s: &mut Sess, l: &str, p: &str) -> Result<String, String> {
    match super::authenticate(&s.db, l, p).await {
        Some(u) => {
            s.user = Some(u);
            Ok(format!("[CAPABILITY {}] Angemeldet", caps(true)))
        }
        None => {
            tokio::time::sleep(Duration::from_secs(2)).await;
            Err("[AUTHENTICATIONFAILED] Anmeldung fehlgeschlagen".into())
        }
    }
}

async fn uids_of(s: &Sess, folder: &str) -> Result<Vec<i64>, sqlx::Error> {
    sqlx::query_scalar("SELECT uid FROM mail_messages WHERE mailbox_id = $1 AND folder = $2 ORDER BY uid")
        .bind(s.user.as_ref().unwrap().mailbox_id)
        .bind(folder)
        .fetch_all(&s.db)
        .await
}

async fn uid_next(s: &Sess) -> i64 {
    sqlx::query_scalar::<_, i64>("SELECT last_value + 1 FROM mail_uid_seq").fetch_one(&s.db).await.unwrap_or(1)
}

/// Änderungen seit dem letzten Stand melden (EXPUNGE / EXISTS)
async fn sync(s: &mut Sess, io: &mut Io) -> std::io::Result<()> {
    let Some(folder) = s.sel.as_ref().map(|x| x.folder) else { return Ok(()) };
    let now = uids_of(s, folder).await.map_err(io_err)?;
    let sel = s.sel.as_mut().unwrap();
    let mut out = String::new();
    let mut i = sel.uids.len();
    while i > 0 {
        i -= 1;
        if now.binary_search(&sel.uids[i]).is_err() {
            let _ = write!(out, "* {} EXPUNGE\r\n", i + 1);
            sel.uids.remove(i);
        }
    }
    let last = sel.uids.last().copied().unwrap_or(0);
    let added: Vec<i64> = now.iter().copied().filter(|u| *u > last).collect();
    if !added.is_empty() {
        sel.uids.extend(added);
        let _ = write!(out, "* {} EXISTS\r\n", sel.uids.len());
    }
    if !out.is_empty() {
        send(io, out.as_bytes()).await?;
    }
    Ok(())
}

async fn select(s: &mut Sess, io: &mut Io, args: &[Tok], read_only: bool) -> Result<String, String> {
    s.sel = None;
    let name = args.first().map(Tok::text).unwrap_or_default();
    let folder = folder_of(&name).ok_or("[NONEXISTENT] Ordner unbekannt")?;
    let uids = uids_of(s, folder).await.map_err(|e| e.to_string())?;
    let unseen: Option<i64> =
        sqlx::query_scalar("SELECT min(uid) FROM mail_messages WHERE mailbox_id = $1 AND folder = $2 AND NOT seen")
            .bind(s.user.as_ref().unwrap().mailbox_id)
            .bind(folder)
            .fetch_one(&s.db)
            .await
            .map_err(|e| e.to_string())?;
    let mut out = format!(
        "* FLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft)\r\n* OK [PERMANENTFLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft)] Flags\r\n* {} EXISTS\r\n* 0 RECENT\r\n* OK [UIDVALIDITY {UIDVALIDITY}] UIDs gültig\r\n* OK [UIDNEXT {}] Nächste UID\r\n",
        uids.len(),
        uid_next(s).await
    );
    if let Some(u) = unseen {
        if let Ok(pos) = uids.binary_search(&u) {
            let _ = write!(out, "* OK [UNSEEN {}] Erste ungelesene\r\n", pos + 1);
        }
    }
    send(io, out.as_bytes()).await.map_err(|e| e.to_string())?;
    s.sel = Some(Selected { folder, read_only, uids });
    Ok(format!("[{}] Ordner geöffnet", if read_only { "READ-ONLY" } else { "READ-WRITE" }))
}

async fn status(s: &mut Sess, io: &mut Io, args: &[Tok]) -> Result<String, String> {
    let name = args.first().map(Tok::text).unwrap_or_default();
    let folder = folder_of(&name).ok_or("[NONEXISTENT] Ordner unbekannt")?;
    let (total, unseen): (i64, i64) = sqlx::query_as(
        "SELECT count(*), count(*) FILTER (WHERE NOT seen) FROM mail_messages WHERE mailbox_id = $1 AND folder = $2",
    )
    .bind(s.user.as_ref().unwrap().mailbox_id)
    .bind(folder)
    .fetch_one(&s.db)
    .await
    .map_err(|e| e.to_string())?;
    let next = uid_next(s).await;
    let items: Vec<String> =
        args.get(1).map(|t| t.list().iter().map(|x| x.text().to_uppercase()).collect()).unwrap_or_default();
    let vals: Vec<String> = items
        .iter()
        .filter_map(|i| match i.as_str() {
            "MESSAGES" => Some(format!("MESSAGES {total}")),
            "RECENT" => Some("RECENT 0".into()),
            "UIDNEXT" => Some(format!("UIDNEXT {next}")),
            "UIDVALIDITY" => Some(format!("UIDVALIDITY {UIDVALIDITY}")),
            "UNSEEN" => Some(format!("UNSEEN {unseen}")),
            _ => None,
        })
        .collect();
    send(
        io,
        format!("* STATUS {} ({})\r\n", String::from_utf8_lossy(&q(imap_name(folder))), vals.join(" ")).as_bytes(),
    )
    .await
    .map_err(|e| e.to_string())?;
    Ok("STATUS erledigt".into())
}

/// Sequenz-/UID-Menge → Indizes in `uids`
fn resolve(set: &str, uid: bool, uids: &[i64]) -> Vec<usize> {
    let max = if uid { uids.last().copied().unwrap_or(0) } else { uids.len() as i64 };
    let num = |x: &str| if x == "*" { Some(max) } else { x.parse::<i64>().ok() };
    let mut ranges = vec![];
    for part in set.split(',') {
        let (a, b) = part.split_once(':').unwrap_or((part, part));
        if let (Some(a), Some(b)) = (num(a), num(b)) {
            ranges.push((a.min(b), a.max(b)));
        }
    }
    let inside = |v: i64| ranges.iter().any(|(a, b)| v >= *a && v <= *b);
    (0..uids.len()).filter(|i| if uid { inside(uids[*i]) } else { inside(*i as i64 + 1) }).collect()
}

type Row = (Uuid, i64, bool, bool, bool, bool, String, DateTime<Utc>, i32, Option<Vec<u8>>);

async fn rows(s: &Sess, uids: &[i64], with_raw: bool) -> Result<Vec<Row>, sqlx::Error> {
    let sel = s.sel.as_ref().unwrap();
    sqlx::query_as(
        "SELECT id, uid, seen, flagged, answered, deleted, folder, received_at, size, CASE WHEN $4 THEN raw END
           FROM mail_messages WHERE mailbox_id = $1 AND folder = $2 AND uid = ANY($3) ORDER BY uid",
    )
    .bind(s.user.as_ref().unwrap().mailbox_id)
    .bind(sel.folder)
    .bind(uids)
    .bind(with_raw)
    .fetch_all(&s.db)
    .await
}

fn flags(r: &Row) -> String {
    let mut f = vec![];
    if r.2 {
        f.push("\\Seen");
    }
    if r.3 {
        f.push("\\Flagged");
    }
    if r.4 {
        f.push("\\Answered");
    }
    if r.5 {
        f.push("\\Deleted");
    }
    if r.6 == "drafts" {
        f.push("\\Draft");
    }
    format!("({})", f.join(" "))
}

async fn fetch(s: &mut Sess, io: &mut Io, args: &[Tok], uid: bool) -> Result<String, String> {
    let set = args.first().map(Tok::text).unwrap_or_default();
    let mut items: Vec<String> = args.get(1..).unwrap_or(&[]).iter().flat_map(|t| t.list()).map(|t| t.text()).collect();
    if items.len() == 1 {
        match items[0].to_uppercase().as_str() {
            "ALL" => items = vec!["FLAGS".into(), "INTERNALDATE".into(), "RFC822.SIZE".into(), "ENVELOPE".into()],
            "FAST" => items = vec!["FLAGS".into(), "INTERNALDATE".into(), "RFC822.SIZE".into()],
            "FULL" => {
                items =
                    vec!["FLAGS".into(), "INTERNALDATE".into(), "RFC822.SIZE".into(), "ENVELOPE".into(), "BODY".into()]
            }
            _ => {}
        }
    }
    if uid && !items.iter().any(|i| i.eq_ignore_ascii_case("UID")) {
        items.insert(0, "UID".into());
    }
    let upper: Vec<String> = items.iter().map(|i| i.to_uppercase()).collect();
    let need_raw =
        upper.iter().any(|i| i.starts_with("BODY") || i.starts_with("RFC822") && i != "RFC822.SIZE" || i == "ENVELOPE");
    let marks_seen = upper
        .iter()
        .any(|i| (i.starts_with("BODY[") || i == "RFC822" || i == "RFC822.TEXT") && !i.starts_with("BODY.PEEK"));
    let sel = s.sel.as_ref().unwrap();
    let idx = resolve(&set, uid, &sel.uids);
    let read_only = sel.read_only;
    let index_of: std::collections::HashMap<i64, usize> =
        sel.uids.iter().enumerate().map(|(i, u)| (*u, i + 1)).collect();
    let wanted: Vec<i64> = idx.iter().map(|i| sel.uids[*i]).collect();
    for chunk in wanted.chunks(if need_raw { 50 } else { 2000 }) {
        let rows = rows(s, chunk, need_raw).await.map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for mut r in rows {
            let Some(seq) = index_of.get(&r.1) else { continue };
            let mut set_seen = false;
            if marks_seen && !r.2 && !read_only {
                r.2 = true;
                set_seen = true;
                let _ =
                    sqlx::query("UPDATE mail_messages SET seen = true WHERE id = $1").bind(r.0).execute(&s.db).await;
            }
            let raw = r.9.clone().unwrap_or_default();
            let parsed = if upper.iter().any(|i| i == "BODYSTRUCTURE" || i == "BODY") {
                mail_parser::MessageParser::default().parse(&raw)
            } else {
                None
            };
            let _ = write!(Vecw(&mut out), "* {seq} FETCH (");
            let mut first = true;
            let mut flags_sent = false;
            for (item, up) in items.iter().zip(&upper) {
                if !first {
                    out.push(b' ');
                }
                first = false;
                match up.as_str() {
                    "UID" => {
                        let _ = write!(Vecw(&mut out), "UID {}", r.1);
                    }
                    "FLAGS" => {
                        flags_sent = true;
                        let _ = write!(Vecw(&mut out), "FLAGS {}", flags(&r));
                    }
                    "INTERNALDATE" => {
                        let _ = write!(Vecw(&mut out), "INTERNALDATE \"{}\"", imap_date(r.7));
                    }
                    "RFC822.SIZE" => {
                        let _ = write!(Vecw(&mut out), "RFC822.SIZE {}", raw.len().max(r.8 as usize));
                    }
                    "ENVELOPE" => {
                        out.extend_from_slice(b"ENVELOPE ");
                        envelope(&mut out, &raw);
                    }
                    "BODYSTRUCTURE" | "BODY" => {
                        out.extend_from_slice(up.as_bytes());
                        out.push(b' ');
                        match &parsed {
                            Some(m) => body_structure(&mut out, &m.root_part(), up == "BODYSTRUCTURE"),
                            None => out.extend_from_slice(b"(\"TEXT\" \"PLAIN\" NIL NIL NIL \"7BIT\" 0 0)"),
                        }
                    }
                    "RFC822" | "RFC822.HEADER" | "RFC822.TEXT" => {
                        let data = match up.as_str() {
                            "RFC822" => raw.clone(),
                            "RFC822.HEADER" => split(&raw).0.to_vec(),
                            _ => split(&raw).1.to_vec(),
                        };
                        let _ = write!(Vecw(&mut out), "{up} {{{}}}\r\n", data.len());
                        out.extend_from_slice(&data);
                    }
                    _ if up.starts_with("BODY[") || up.starts_with("BODY.PEEK[") => {
                        let open = item.find('[').unwrap_or(0);
                        let close = item.rfind(']').unwrap_or(item.len());
                        let spec = &item[open + 1..close];
                        let mut data = section(&raw, spec);
                        let mut label = format!("BODY[{spec}]");
                        if let Some(p) = item[close..].strip_prefix("]<").and_then(|x| x.strip_suffix('>')) {
                            let (a, b) = p.split_once('.').unwrap_or((p, ""));
                            let start: usize = a.parse().unwrap_or(0);
                            let len: usize = b.parse().unwrap_or(usize::MAX);
                            let st = start.min(data.len());
                            data = data[st..st.saturating_add(len).min(data.len())].to_vec();
                            label = format!("BODY[{spec}]<{start}>");
                        }
                        let _ = write!(Vecw(&mut out), "{label} {{{}}}\r\n", data.len());
                        out.extend_from_slice(&data);
                    }
                    _ => {
                        first = true;
                        out.pop();
                    }
                }
            }
            if set_seen && !flags_sent {
                let _ = write!(Vecw(&mut out), " FLAGS {}", flags(&r));
            }
            out.extend_from_slice(b")\r\n");
            if out.len() > 1 << 20 {
                send(io, &out).await.map_err(|e| e.to_string())?;
                out.clear();
            }
        }
        send(io, &out).await.map_err(|e| e.to_string())?;
    }
    Ok("FETCH erledigt".into())
}

async fn store(s: &mut Sess, io: &mut Io, args: &[Tok], uid: bool) -> Result<String, String> {
    let sel = s.sel.as_ref().unwrap();
    if sel.read_only {
        return Err("Ordner nur lesbar".into());
    }
    let set = args.first().map(Tok::text).unwrap_or_default();
    let op = args.get(1).map(|t| t.text().to_uppercase()).unwrap_or_default();
    let silent = op.ends_with(".SILENT");
    let list: Vec<String> =
        args.get(2..).unwrap_or(&[]).iter().flat_map(|t| t.list()).map(|t| t.text().to_lowercase()).collect();
    let has = |f: &str| list.iter().any(|x| x == f);
    let (seen, flagged, answered, deleted) = (has("\\seen"), has("\\flagged"), has("\\answered"), has("\\deleted"));
    let wanted: Vec<i64> = resolve(&set, uid, &sel.uids).iter().map(|i| sel.uids[*i]).collect();
    let mailbox = s.user.as_ref().unwrap().mailbox_id;
    let sql = if op.starts_with("+FLAGS") {
        "UPDATE mail_messages SET seen = seen OR $4, flagged = flagged OR $5, answered = answered OR $6, deleted = deleted OR $7"
    } else if op.starts_with("-FLAGS") {
        "UPDATE mail_messages SET seen = seen AND NOT $4, flagged = flagged AND NOT $5, answered = answered AND NOT $6, deleted = deleted AND NOT $7"
    } else if op.starts_with("FLAGS") {
        "UPDATE mail_messages SET seen = $4, flagged = $5, answered = $6, deleted = $7"
    } else {
        return Err("STORE: FLAGS, +FLAGS oder -FLAGS".into());
    };
    sqlx::query(&format!("{sql} WHERE mailbox_id = $1 AND folder = $2 AND uid = ANY($3)"))
        .bind(mailbox)
        .bind(sel.folder)
        .bind(&wanted)
        .bind(seen)
        .bind(flagged)
        .bind(answered)
        .bind(deleted)
        .execute(&s.db)
        .await
        .map_err(|e| e.to_string())?;
    if !silent {
        let index_of: std::collections::HashMap<i64, usize> =
            sel.uids.iter().enumerate().map(|(i, u)| (*u, i + 1)).collect();
        let mut out = String::new();
        for r in rows(s, &wanted, false).await.map_err(|e| e.to_string())? {
            if let Some(seq) = index_of.get(&r.1) {
                let uid_part = if uid { format!("UID {} ", r.1) } else { String::new() };
                let _ = write!(out, "* {seq} FETCH ({uid_part}FLAGS {})\r\n", flags(&r));
            }
        }
        send(io, out.as_bytes()).await.map_err(|e| e.to_string())?;
    }
    Ok("STORE erledigt".into())
}

async fn copy(s: &mut Sess, io: &mut Io, args: &[Tok], uid: bool, mv: bool) -> Result<String, String> {
    let set = args.first().map(Tok::text).unwrap_or_default();
    let target =
        folder_of(&args.get(1).map(Tok::text).unwrap_or_default()).ok_or("[TRYCREATE] Zielordner unbekannt")?;
    let sel = s.sel.as_ref().unwrap();
    if mv && sel.read_only {
        return Err("Ordner nur lesbar".into());
    }
    let idx = resolve(&set, uid, &sel.uids);
    let src: Vec<i64> = idx.iter().map(|i| sel.uids[*i]).collect();
    if src.is_empty() {
        return Ok(format!("{} erledigt", if mv { "MOVE" } else { "COPY" }));
    }
    let mailbox = s.user.as_ref().unwrap().mailbox_id;
    let new: Vec<(i64, i64)> = if mv {
        sqlx::query_as(
            "WITH src AS (SELECT id, uid AS old FROM mail_messages WHERE mailbox_id = $1 AND folder = $2 AND uid = ANY($3) ORDER BY uid)
             UPDATE mail_messages m SET folder = $4, uid = nextval('mail_uid_seq') FROM src WHERE m.id = src.id RETURNING src.old, m.uid",
        )
    } else {
        sqlx::query_as(
            "WITH src AS (SELECT * FROM mail_messages WHERE mailbox_id = $1 AND folder = $2 AND uid = ANY($3) ORDER BY uid),
                  ins AS (INSERT INTO mail_messages (id, mailbox_id, folder, message_id, in_reply_to, subject, from_addr, from_name,
                              to_addrs, cc_addrs, sent_at, received_at, size, preview, has_attachments, auth_results, seen, flagged, answered, raw)
                          SELECT gen_random_uuid(), mailbox_id, $4, message_id, in_reply_to, subject, from_addr, from_name, to_addrs, cc_addrs,
                                 sent_at, received_at, size, preview, has_attachments, auth_results, seen, flagged, answered, raw FROM src
                          RETURNING uid, message_id, sent_at)
             SELECT src.uid, ins.uid FROM src JOIN ins ON ins.message_id IS NOT DISTINCT FROM src.message_id AND ins.sent_at = src.sent_at",
        )
    }
    .bind(mailbox)
    .bind(sel.folder)
    .bind(&src)
    .bind(target)
    .fetch_all(&s.db)
    .await
    .map_err(|e| e.to_string())?;
    let mut new = new;
    new.sort();
    new.dedup_by_key(|x| x.0);
    let list = |v: Vec<i64>| v.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(",");
    let copyuid = format!(
        "COPYUID {UIDVALIDITY} {} {}",
        list(new.iter().map(|x| x.0).collect()),
        list(new.iter().map(|x| x.1).collect())
    );
    if mv {
        let mut out = format!("* OK [{copyuid}] Verschoben\r\n");
        let sel = s.sel.as_mut().unwrap();
        for i in idx.iter().rev() {
            let _ = write!(out, "* {} EXPUNGE\r\n", i + 1);
            sel.uids.remove(*i);
        }
        send(io, out.as_bytes()).await.map_err(|e| e.to_string())?;
        Ok("MOVE erledigt".into())
    } else {
        Ok(format!("[{copyuid}] COPY erledigt"))
    }
}

async fn expunge(s: &mut Sess, io: &mut Io, uid_set: Option<String>) -> Result<String, String> {
    let sel = s.sel.as_ref().unwrap();
    if sel.read_only {
        return Err("Ordner nur lesbar".into());
    }
    let limit: Option<Vec<i64>> =
        uid_set.map(|set| resolve(&set, true, &sel.uids).iter().map(|i| sel.uids[*i]).collect());
    let gone: Vec<i64> = sqlx::query_scalar(
        "DELETE FROM mail_messages WHERE mailbox_id = $1 AND folder = $2 AND deleted AND ($3::bigint[] IS NULL OR uid = ANY($3)) RETURNING uid",
    )
    .bind(s.user.as_ref().unwrap().mailbox_id)
    .bind(sel.folder)
    .bind(limit)
    .fetch_all(&s.db)
    .await
    .map_err(|e| e.to_string())?;
    let sel = s.sel.as_mut().unwrap();
    let mut out = String::new();
    let mut i = sel.uids.len();
    while i > 0 {
        i -= 1;
        if gone.contains(&sel.uids[i]) {
            let _ = write!(out, "* {} EXPUNGE\r\n", i + 1);
            sel.uids.remove(i);
        }
    }
    send(io, out.as_bytes()).await.map_err(|e| e.to_string())?;
    Ok("EXPUNGE erledigt".into())
}

async fn append(s: &mut Sess, args: &[Tok]) -> Result<String, String> {
    let folder = folder_of(&args.first().map(Tok::text).unwrap_or_default()).ok_or("[TRYCREATE] Ordner unbekannt")?;
    let flags: Vec<String> = args
        .iter()
        .skip(1)
        .find_map(|t| match t {
            Tok::List(l) => Some(l.iter().map(|x| x.text().to_lowercase()).collect()),
            _ => None,
        })
        .unwrap_or_default();
    let raw = args.last().filter(|t| matches!(t, Tok::Str(_))).map(Tok::bytes).ok_or("Nachricht fehlt")?;
    let user = s.user.as_ref().unwrap();
    let (used, quota) = super::usage(&s.db, user.mailbox_id).await.map_err(|e| e.to_string())?;
    if used + raw.len() as i64 > quota {
        return Err("[OVERQUOTA] Postfach voll".into());
    }
    let seen = flags.iter().any(|f| f == "\\seen") || folder != "inbox";
    let id = super::store(&s.db, user.mailbox_id, folder, &raw, None, seen).await.map_err(|e| e.to_string())?;
    let uid: i64 = sqlx::query_scalar(
        "UPDATE mail_messages SET seen = $2, flagged = $3, answered = $4 WHERE id = $1 RETURNING uid",
    )
    .bind(id)
    .bind(flags.iter().any(|f| f == "\\seen"))
    .bind(flags.iter().any(|f| f == "\\flagged"))
    .bind(flags.iter().any(|f| f == "\\answered"))
    .fetch_one(&s.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(format!("[APPENDUID {UIDVALIDITY} {uid}] APPEND erledigt"))
}

// ── SEARCH ─────────────────────────────────────────────────────────────

type SRow = (
    i64,
    bool,
    bool,
    bool,
    bool,
    String,
    DateTime<Utc>,
    DateTime<Utc>,
    i32,
    String,
    String,
    Option<String>,
    Vec<String>,
    Vec<String>,
);

struct Ctx<'a> {
    rows: &'a [SRow],
    raws: std::collections::HashMap<i64, Vec<u8>>,
}

fn take(args: &[Tok], i: &mut usize) -> Option<Tok> {
    let t = args.get(*i).cloned();
    *i += 1;
    t
}

fn eval(args: &[Tok], i: &mut usize, r: &SRow, seq: usize, ctx: &Ctx, uids: &[i64]) -> bool {
    let Some(t) = take(args, i) else { return true };
    if let Tok::List(l) = &t {
        let mut j = 0;
        let mut ok = true;
        while j < l.len() {
            ok &= eval(l, &mut j, r, seq, ctx, uids);
        }
        return ok;
    }
    let key = t.text().to_uppercase();
    let contains = |hay: &str, needle: &Tok| hay.to_lowercase().contains(&needle.text().to_lowercase());
    let raw = || ctx.raws.get(&r.0).map(|v| String::from_utf8_lossy(v).to_lowercase()).unwrap_or_default();
    let day = |d: DateTime<Utc>| d.date_naive();
    match key.as_str() {
        "ALL" | "UNKEYWORD" if key == "ALL" => true,
        "ANSWERED" => r.3,
        "UNANSWERED" => !r.3,
        "DELETED" => r.4,
        "UNDELETED" => !r.4,
        "FLAGGED" => r.2,
        "UNFLAGGED" => !r.2,
        "SEEN" | "OLD" => r.1,
        "UNSEEN" | "NEW" => !r.1,
        "RECENT" => false,
        "DRAFT" => r.5 == "drafts",
        "UNDRAFT" => r.5 != "drafts",
        "KEYWORD" => {
            take(args, i);
            false
        }
        "UNKEYWORD" => {
            take(args, i);
            true
        }
        "FROM" => {
            take(args, i).is_some_and(|n| contains(&format!("{} {}", r.10, r.11.clone().unwrap_or_default()), &n))
        }
        "TO" => take(args, i).is_some_and(|n| contains(&r.12.join(" "), &n)),
        "CC" => take(args, i).is_some_and(|n| contains(&r.13.join(" "), &n)),
        "BCC" => {
            take(args, i);
            false
        }
        "SUBJECT" => take(args, i).is_some_and(|n| contains(&r.9, &n)),
        "BODY" | "TEXT" => take(args, i).is_some_and(|n| raw().contains(&n.text().to_lowercase())),
        "HEADER" => {
            let name = take(args, i).map(|t| t.text().to_lowercase()).unwrap_or_default();
            let val = take(args, i).map(|t| t.text().to_lowercase()).unwrap_or_default();
            ctx.raws
                .get(&r.0)
                .and_then(|raw| header_value(split(raw).0, &name))
                .is_some_and(|v| String::from_utf8_lossy(&v).to_lowercase().contains(&val))
        }
        "BEFORE" => take(args, i).and_then(|d| parse_date(&d.text())).is_some_and(|d| day(r.7) < d),
        "ON" => take(args, i).and_then(|d| parse_date(&d.text())).is_some_and(|d| day(r.7) == d),
        "SINCE" => take(args, i).and_then(|d| parse_date(&d.text())).is_some_and(|d| day(r.7) >= d),
        "SENTBEFORE" => take(args, i).and_then(|d| parse_date(&d.text())).is_some_and(|d| day(r.6) < d),
        "SENTON" => take(args, i).and_then(|d| parse_date(&d.text())).is_some_and(|d| day(r.6) == d),
        "SENTSINCE" => take(args, i).and_then(|d| parse_date(&d.text())).is_some_and(|d| day(r.6) >= d),
        "LARGER" => take(args, i).and_then(|n| n.text().parse::<i32>().ok()).is_some_and(|n| r.8 > n),
        "SMALLER" => take(args, i).and_then(|n| n.text().parse::<i32>().ok()).is_some_and(|n| r.8 < n),
        "UID" => take(args, i).is_some_and(|set| resolve(&set.text(), true, uids).contains(&(seq - 1))),
        "NOT" => !eval(args, i, r, seq, ctx, uids),
        "OR" => {
            let a = eval(args, i, r, seq, ctx, uids);
            let b = eval(args, i, r, seq, ctx, uids);
            a || b
        }
        "CHARSET" => {
            take(args, i);
            eval(args, i, r, seq, ctx, uids)
        }
        k if k.chars().next().is_some_and(|c| c.is_ascii_digit() || c == '*') => {
            resolve(k, false, uids).contains(&(seq - 1))
        }
        _ => false,
    }
}

async fn search(s: &mut Sess, io: &mut Io, args: &[Tok], uid: bool) -> Result<String, String> {
    let sel = s.sel.as_ref().unwrap();
    let mut args = args.to_vec();
    if args.first().is_some_and(|t| t.text().eq_ignore_ascii_case("CHARSET")) {
        args.drain(..2.min(args.len()));
    }
    let rows: Vec<SRow> = sqlx::query_as(
        "SELECT uid, seen, flagged, answered, deleted, folder, sent_at, received_at, size, subject, from_addr, from_name, to_addrs, cc_addrs
           FROM mail_messages WHERE mailbox_id = $1 AND folder = $2 ORDER BY uid",
    )
    .bind(s.user.as_ref().unwrap().mailbox_id)
    .bind(sel.folder)
    .fetch_all(&s.db)
    .await
    .map_err(|e| e.to_string())?;
    let needs_raw = args.iter().any(|t| matches!(t.text().to_uppercase().as_str(), "BODY" | "TEXT" | "HEADER"))
        || args.iter().any(|t| matches!(t, Tok::List(_)));
    let mut raws = std::collections::HashMap::new();
    if needs_raw {
        let all: Vec<(i64, Vec<u8>)> =
            sqlx::query_as("SELECT uid, raw FROM mail_messages WHERE mailbox_id = $1 AND folder = $2")
                .bind(s.user.as_ref().unwrap().mailbox_id)
                .bind(sel.folder)
                .fetch_all(&s.db)
                .await
                .map_err(|e| e.to_string())?;
        raws.extend(all);
    }
    let ctx = Ctx { rows: &rows, raws };
    let mut hits = vec![];
    for (seq0, u) in sel.uids.iter().enumerate() {
        let Some(r) = ctx.rows.iter().find(|r| r.0 == *u) else { continue };
        let mut i = 0;
        let mut ok = true;
        while i < args.len() {
            ok &= eval(&args, &mut i, r, seq0 + 1, &ctx, &sel.uids);
        }
        if ok {
            hits.push(if uid { *u } else { seq0 as i64 + 1 });
        }
    }
    let list: Vec<String> = hits.iter().map(|h| h.to_string()).collect();
    send(io, format!("* SEARCH{}{}\r\n", if list.is_empty() { "" } else { " " }, list.join(" ")).as_bytes())
        .await
        .map_err(|e| e.to_string())?;
    Ok("SEARCH erledigt".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokenizes_fetch_items() {
        let t = parse(b"a1 UID FETCH 1:* (UID FLAGS BODY.PEEK[HEADER.FIELDS (From Subject)]<0.512>)\r\n");
        assert_eq!(t[0], Tok::Atom("a1".into()));
        let Tok::List(items) = &t[4] else { panic!() };
        assert_eq!(items[2], Tok::Atom("BODY.PEEK[HEADER.FIELDS (From Subject)]<0.512>".into()));
    }

    #[test]
    fn tokenizes_literals_and_quotes() {
        let t = parse(b"x LOGIN \"jana@x.de\" {5}\r\ngeh\"m\r\n");
        assert_eq!(t[2].text(), "jana@x.de");
        assert_eq!(t[3], Tok::Str(b"geh\"m".to_vec()));
    }

    #[test]
    fn resolves_sets() {
        let uids = [3, 7, 9, 20];
        assert_eq!(resolve("1:*", false, &uids), vec![0, 1, 2, 3]);
        assert_eq!(resolve("2,4", false, &uids), vec![1, 3]);
        assert_eq!(resolve("8:*", true, &uids), vec![2, 3]);
        assert_eq!(resolve("21:*", true, &uids), vec![3]);
        assert_eq!(resolve("7", true, &uids), vec![1]);
    }

    #[test]
    fn sections() {
        let raw = b"From: a@b.c\r\nSubject: Hi\r\nContent-Type: multipart/mixed; boundary=X\r\n\r\n--X\r\nContent-Type: text/plain\r\n\r\nHallo\r\n--X\r\nContent-Type: text/html\r\n\r\n<b>Hallo</b>\r\n--X--\r\n";
        assert_eq!(section(raw, "HEADER.FIELDS (SUBJECT)"), b"Subject: Hi\r\n\r\n");
        assert_eq!(String::from_utf8_lossy(&section(raw, "1")).trim(), "Hallo");
        assert_eq!(String::from_utf8_lossy(&section(raw, "2")).trim(), "<b>Hallo</b>");
        let m = mail_parser::MessageParser::default().parse(&raw[..]).unwrap();
        let mut out = vec![];
        body_structure(&mut out, &m.root_part(), false);
        let s = String::from_utf8(out).unwrap();
        assert!(s.starts_with("((\"TEXT\" \"PLAIN\""), "{s}");
        assert!(s.ends_with(" \"MIXED\")"), "{s}");
    }

    #[test]
    fn folder_names() {
        assert_eq!(folder_of("INBOX"), Some("inbox"));
        assert_eq!(folder_of("Sent Messages"), Some("sent"));
        assert_eq!(folder_of("Spam"), Some("junk"));
        assert!(wildcard("*", "Sent"));
        assert!(wildcard("S%", "Sent"));
        assert!(!wildcard("T%", "Sent"));
    }
}

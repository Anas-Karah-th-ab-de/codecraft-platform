//! Eigener Mailserver: SMTP-Empfang, Einlieferung mit Anmeldung, DKIM, Versand-Client,
//! Webmail-API und IMAP – jeweils über echte TCP-Verbindungen.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use base64::Engine;
use codecraft_server::mail::{self, outbound::Outcome, smtp::Mode};
use codecraft_server::{app, auth, AppState};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sqlx::PgPool;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tower::ServiceExt;
use uuid::Uuid;

async fn call(db: &PgPool, method: &str, uri: &str, token: &str, body: Option<Value>) -> (StatusCode, Value) {
    let mut req = Request::builder().method(method).uri(uri);
    if !token.is_empty() {
        req = req.header("authorization", format!("Bearer {token}"));
    }
    let body = match body {
        Some(b) => {
            req = req.header("content-type", "application/json");
            Body::from(b.to_string())
        }
        None => Body::empty(),
    };
    let res = app(AppState { db: db.clone() }).oneshot(req.body(body).unwrap()).await.unwrap();
    let status = res.status();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

async fn login(db: &PgPool, email: &str, pw: &str) -> String {
    let (s, v) = call(db, "POST", "/api/v1/auth/login", "", Some(json!({ "email": email, "password": pw }))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    v["token"].as_str().unwrap().to_owned()
}

/// Admin + zwei Mitarbeiter (Jana, Tom) mit Postfach
async fn setup(db: &PgPool) -> (String, String, String) {
    sqlx::query("INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, 'admin@example.org', 'Admin', 'admin', $2)")
        .bind(Uuid::now_v7())
        .bind(auth::hash_password("admin-passwort-1").unwrap())
        .execute(db)
        .await
        .unwrap();
    let admin = login(db, "admin@example.org", "admin-passwort-1").await;
    for (email, name) in [("jana@gmail.com", "Jana Müller"), ("tom@gmail.com", "Tom Weber")] {
        let (s, v) = call(
            db,
            "POST",
            "/api/v1/users",
            &admin,
            Some(json!({
                "email": email, "display_name": name, "role": "staff", "password": "sehr-geheim-123"
            })),
        )
        .await;
        assert_eq!(s, StatusCode::CREATED, "{v}");
    }
    mail::ensure_dkim(db).await.unwrap();
    mail::guard::set_key_for_tests([9; 32]);
    mail::tls::ALLOW_PLAIN_AUTH.store(true, std::sync::atomic::Ordering::Relaxed);
    (admin, login(db, "jana@gmail.com", "sehr-geheim-123").await, login(db, "tom@gmail.com", "sehr-geheim-123").await)
}

async fn start_smtp(db: &PgPool, mode: Mode) -> u16 {
    let l = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = l.local_addr().unwrap().port();
    tokio::spawn(mail::smtp::run(db.clone(), l, mode));
    port
}

async fn start_imap(db: &PgPool) -> u16 {
    let l = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = l.local_addr().unwrap().port();
    tokio::spawn(mail::imap::run(db.clone(), l, false));
    port
}

/// Einfacher Zeilen-Client
struct Client(BufReader<TcpStream>);

impl Client {
    async fn connect(port: u16) -> (Self, String) {
        let mut c = Client(BufReader::new(TcpStream::connect(("127.0.0.1", port)).await.unwrap()));
        let g = c.line().await;
        (c, g)
    }
    async fn line(&mut self) -> String {
        let mut l = String::new();
        self.0.read_line(&mut l).await.unwrap();
        l
    }
    async fn send(&mut self, s: &str) {
        self.0.get_mut().write_all(s.as_bytes()).await.unwrap();
    }
    /// SMTP: Befehl senden, mehrzeilige Antwort lesen
    async fn smtp(&mut self, cmd: &str) -> String {
        self.send(&format!("{cmd}\r\n")).await;
        let mut all = String::new();
        loop {
            let l = self.line().await;
            all.push_str(&l);
            if l.len() < 4 || l.as_bytes()[3] != b'-' {
                return all;
            }
        }
    }
    /// IMAP: Befehl senden, bis zur Antwort mit dem Kennzeichen lesen (inkl. Literale)
    async fn imap(&mut self, tag: &str, cmd: &str) -> String {
        self.send(&format!("{tag} {cmd}\r\n")).await;
        self.until(tag).await
    }
    async fn until(&mut self, tag: &str) -> String {
        let mut all = String::new();
        loop {
            let l = self.line().await;
            assert!(!l.is_empty(), "Verbindung zu: {all}");
            all.push_str(&l);
            if let Some(n) = l
                .trim_end()
                .strip_suffix('}')
                .and_then(|x| x.rsplit_once('{'))
                .and_then(|(_, n)| n.parse::<usize>().ok())
            {
                let mut buf = vec![0u8; n];
                self.0.read_exact(&mut buf).await.unwrap();
                all.push_str(&String::from_utf8_lossy(&buf));
                continue;
            }
            if l.starts_with(&format!("{tag} ")) {
                return all;
            }
        }
    }
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn smtp_inbound_submission_and_webmail(db: PgPool) {
    let (_admin, jana, tom) = setup(&db).await;

    // ── Empfang (MX) ──
    let mx = start_smtp(&db, Mode::Mx).await;
    let (mut c, greet) = Client::connect(mx).await;
    assert!(greet.starts_with("220 "), "{greet}");
    assert!(c.smtp("MAIL FROM:<x@example.org>").await.starts_with("503"), "MAIL vor EHLO");
    let ehlo = c.smtp("EHLO sender.example.org").await;
    assert!(ehlo.contains("SIZE") && !ehlo.contains("AUTH"), "{ehlo}");
    assert!(c.smtp("MAIL FROM:<x@example.org>").await.starts_with("250"));
    assert!(c.smtp("RCPT TO:<niemand@code-craft.tech>").await.starts_with("550"));
    assert!(c.smtp("RCPT TO:<Jana.Mueller+news@code-craft.tech>").await.starts_with("250"));
    assert!(c.smtp("DATA").await.starts_with("354"));
    c.send("From: Kunde <x@example.org>\r\nTo: jana.mueller@code-craft.tech\r\nSubject: Angebot\r\n\r\nHallo Jana\r\n..Punkt am Anfang\r\n.\r\n").await;
    assert!(c.line().await.starts_with("250"));
    c.smtp("QUIT").await;

    let (_, ov) = call(&db, "GET", "/api/v1/mail", &jana, None).await;
    assert_eq!(ov["address"], "jana.mueller@code-craft.tech");
    assert_eq!(ov["folders"][0]["unread"], 1, "{ov}");
    let (_, list) = call(&db, "GET", "/api/v1/mail/messages?folder=inbox", &jana, None).await;
    assert_eq!(list[0]["subject"], "Angebot");
    assert_eq!(list[0]["from_name"], "Kunde");
    let id = list[0]["id"].as_str().unwrap().to_string();
    let (_, msg) = call(&db, "GET", &format!("/api/v1/mail/messages/{id}"), &jana, None).await;
    assert!(msg["text"].as_str().unwrap().contains("\n.Punkt am Anfang"), "{msg}");
    let (_, ov) = call(&db, "GET", "/api/v1/mail", &jana, None).await;
    assert_eq!(ov["folders"][0]["unread"], 0, "beim Lesen als gelesen markiert");
    // fremde Nachricht nicht lesbar
    let (s, _) = call(&db, "GET", &format!("/api/v1/mail/messages/{id}"), &tom, None).await;
    assert_eq!(s, StatusCode::NOT_FOUND);

    // ── Einlieferung (587) mit Anmeldung ──
    let sub = start_smtp(&db, Mode::Submission).await;
    let (mut c, _) = Client::connect(sub).await;
    assert!(c.smtp("EHLO laptop").await.contains("AUTH PLAIN LOGIN"));
    assert!(c.smtp("MAIL FROM:<jana.mueller@code-craft.tech>").await.starts_with("530"), "ohne Anmeldung");
    let bad = base64::engine::general_purpose::STANDARD.encode(b"\0jana.mueller@code-craft.tech\0falsch");
    assert!(c.smtp(&format!("AUTH PLAIN {bad}")).await.starts_with("535"));
    let good = base64::engine::general_purpose::STANDARD.encode(b"\0jana.mueller@code-craft.tech\0sehr-geheim-123");
    assert!(c.smtp(&format!("AUTH PLAIN {good}")).await.starts_with("235"));
    // gefälschter Absender wird abgewiesen
    c.smtp("MAIL FROM:<jana.mueller@code-craft.tech>").await;
    c.smtp("RCPT TO:<tom.weber@code-craft.tech>").await;
    c.smtp("DATA").await;
    c.send("From: chef@code-craft.tech\r\nSubject: Fake\r\n\r\nx\r\n.\r\n").await;
    assert!(c.line().await.starts_with("553"));
    c.smtp("MAIL FROM:<jana.mueller@code-craft.tech>").await;
    c.smtp("RCPT TO:<tom.weber@code-craft.tech>").await;
    c.smtp("DATA").await;
    c.send("From: Jana <jana.mueller@code-craft.tech>\r\nTo: tom.weber@code-craft.tech\r\nSubject: Intern\r\nDate: Sat, 7 Nov 2026 10:00:00 +0000\r\n\r\nHi Tom\r\n.\r\n").await;
    assert!(c.line().await.starts_with("250"));
    let (_, list) = call(&db, "GET", "/api/v1/mail/messages", &tom, None).await;
    assert_eq!(list[0]["subject"], "Intern");
    let stored: Vec<u8> =
        sqlx::query_scalar("SELECT raw FROM mail_messages WHERE subject = 'Intern'").fetch_one(&db).await.unwrap();
    assert!(
        stored.starts_with(b"CCE1") && !String::from_utf8_lossy(&stored).contains("Hi Tom"),
        "in der DB verschlüsselt"
    );
    let raw = mail::guard::open(stored);
    // gefährlicher Anhang von außen wird abgewiesen
    let (mut c, _) = Client::connect(mx).await;
    c.smtp("EHLO evil.example").await;
    c.smtp("MAIL FROM:<x@evil.example>").await;
    c.smtp("RCPT TO:<tom.weber@code-craft.tech>").await;
    c.smtp("DATA").await;
    c.send("Subject: Rechnung\r\nContent-Type: multipart/mixed; boundary=B\r\n\r\n--B\r\nContent-Type: text/plain\r\n\r\nSiehe Anhang\r\n--B\r\nContent-Type: application/octet-stream\r\nContent-Disposition: attachment; filename=\"Rechnung.pdf.exe\"\r\nContent-Transfer-Encoding: base64\r\n\r\nTVqQAAMAAAAEAAAA\r\n--B--\r\n.\r\n").await;
    assert!(c.line().await.starts_with("552 5.7.1"));
    assert!(String::from_utf8_lossy(&raw).contains("DKIM-Signature: v=1; a=rsa-sha256"), "DKIM fehlt");

    // ── Webmail: senden (lokal + extern), Antwort, Ordner ──
    let (s, v) = call(&db, "POST", "/api/v1/mail/send", &jana, Some(json!({
        "to": ["Tom <tom.weber@code-craft.tech>", "kunde@example.net"], "subject": "Re: Angebot", "text": "Danke!",
        "reply_to_id": id,
        "attachments": [{ "name": "a.txt", "mime": "text/plain", "data_b64": base64::engine::general_purpose::STANDARD.encode(b"Anhang") }]
    }))).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    let (_, sent) = call(&db, "GET", "/api/v1/mail/messages?folder=sent", &jana, None).await;
    assert_eq!(sent[0]["subject"], "Re: Angebot");
    assert_eq!(sent[0]["has_attachments"], true);
    let (_, tl) = call(&db, "GET", "/api/v1/mail/messages?q=angebot", &tom, None).await;
    assert_eq!(tl.as_array().unwrap().len(), 1, "Suche findet Antwort");
    let tid = tl[0]["id"].as_str().unwrap();
    let (_, tm) = call(&db, "GET", &format!("/api/v1/mail/messages/{tid}"), &tom, None).await;
    assert_eq!(tm["attachments"][0]["name"], "a.txt");
    let q: (String, Vec<String>) =
        sqlx::query_as("SELECT rcpt_domain, rcpts FROM mail_queue").fetch_one(&db).await.unwrap();
    assert_eq!(q, ("example.net".into(), vec!["kunde@example.net".into()]));
    let (_, orig) = call(&db, "GET", &format!("/api/v1/mail/messages/{id}"), &jana, None).await;
    assert_eq!(orig["answered"], true);
    // Papierkorb → endgültig
    let (s, _) = call(&db, "DELETE", &format!("/api/v1/mail/messages/{id}"), &jana, None).await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (_, trash) = call(&db, "GET", "/api/v1/mail/messages?folder=trash", &jana, None).await;
    assert_eq!(trash.as_array().unwrap().len(), 1);
    call(&db, "DELETE", &format!("/api/v1/mail/messages/{id}"), &jana, None).await;
    let (s, _) = call(&db, "GET", &format!("/api/v1/mail/messages/{id}"), &jana, None).await;
    assert_eq!(s, StatusCode::NOT_FOUND);
    // Verwaltung zeigt DNS-Einträge inkl. DKIM
    let (_, adm) = call(&db, "GET", "/api/v1/mail/admin", &_admin, None).await;
    assert!(adm["domains"][0]["dns"].as_array().unwrap().iter().any(|r| r["name"] == "cc1._domainkey.code-craft.tech"));
    let (s, _) = call(&db, "GET", "/api/v1/mail/admin", &jana, None).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn outbound_client_talks_to_mx(db: PgPool) {
    setup(&db).await;
    let mx = start_smtp(&db, Mode::Mx).await;
    let raw =
        b"From: a@example.org\r\nTo: tom.weber@code-craft.tech\r\nSubject: Von aussen\r\n\r\n.Zeile mit Punkt\r\n";
    let res = mail::outbound::deliver_to(
        "127.0.0.1",
        mx,
        "a@example.org",
        &["tom.weber@code-craft.tech".into(), "weg@code-craft.tech".into()],
        raw,
    )
    .await
    .unwrap();
    assert_eq!(res[0].1, Outcome::Permanent, "{res:?}");
    assert_eq!(res[1].1, Outcome::Delivered, "{res:?}");
    let body = mail::guard::open(
        sqlx::query_scalar("SELECT raw FROM mail_messages WHERE subject = 'Von aussen'").fetch_one(&db).await.unwrap(),
    );
    assert!(String::from_utf8_lossy(&body).ends_with("\r\n.Zeile mit Punkt\r\n"));
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn imap_session(db: PgPool) {
    let (_, jana, _) = setup(&db).await;
    let mb = mail::mail_user(
        &db,
        sqlx::query_scalar("SELECT id FROM users WHERE email = 'jana@gmail.com'").fetch_one(&db).await.unwrap(),
    )
    .await
    .unwrap()
    .unwrap();
    for i in 1..=3 {
        let raw = format!("From: Kunde <k@example.org>\r\nTo: {}\r\nSubject: Nachricht {i}\r\nContent-Type: multipart/mixed; boundary=B\r\n\r\n--B\r\nContent-Type: text/plain\r\n\r\nText {i}\r\n--B\r\nContent-Type: application/pdf; name=r.pdf\r\nContent-Disposition: attachment; filename=r.pdf\r\nContent-Transfer-Encoding: base64\r\n\r\nJVBERg==\r\n--B--\r\n", mb.address);
        mail::store(&db, mb.mailbox_id, "inbox", raw.as_bytes(), None, false).await.unwrap();
    }
    let port = start_imap(&db).await;
    let (mut c, greet) = Client::connect(port).await;
    assert!(greet.starts_with("* OK") && greet.contains("IMAP4rev1"), "{greet}");
    assert!(c.imap("a1", "SELECT INBOX").await.contains("a1 NO"), "erst anmelden");
    assert!(c.imap("a2", "LOGIN jana.mueller@code-craft.tech falsch").await.contains("a2 NO"));
    assert!(c.imap("a3", "LOGIN \"jana.mueller@code-craft.tech\" \"sehr-geheim-123\"").await.contains("a3 OK"));
    let list = c.imap("a4", "LIST \"\" \"*\"").await;
    assert!(list.contains("\\Sent) \"/\" \"Sent\"") && list.contains("\"INBOX\""), "{list}");
    let sel = c.imap("a5", "SELECT INBOX").await;
    assert!(sel.contains("* 3 EXISTS") && sel.contains("[UNSEEN 1]") && sel.contains("READ-WRITE"), "{sel}");
    let f = c.imap("a6", "UID FETCH 1:* (FLAGS RFC822.SIZE BODY.PEEK[HEADER.FIELDS (SUBJECT FROM)])").await;
    assert_eq!(f.matches(" FETCH (").count(), 3, "{f}");
    assert!(f.contains("Subject: Nachricht 2") && f.contains("FLAGS ()"), "{f}");
    let bs = c.imap("a7", "FETCH 1 (BODYSTRUCTURE ENVELOPE)").await;
    assert!(
        bs.contains("(\"TEXT\" \"PLAIN\"") && bs.contains("\"APPLICATION\" \"PDF\"") && bs.contains("\"MIXED\""),
        "{bs}"
    );
    assert!(bs.contains("((\"Kunde\" NIL \"k\" \"example.org\"))"), "{bs}");
    let part = c.imap("a8", "FETCH 2 (BODY[1] BODY[2.MIME])").await;
    assert!(part.contains("Text 2") && part.contains("* 2 FETCH") && part.contains("FLAGS (\\Seen)"), "{part}");
    let s = c.imap("a9", "SEARCH UNSEEN").await;
    assert!(s.contains("* SEARCH 1 3"), "{s}");
    let s = c.imap("b1", "SEARCH OR SUBJECT \"Nachricht 3\" SEEN").await;
    assert!(s.contains("* SEARCH 2 3"), "{s}");
    let st = c.imap("b2", "STORE 1 +FLAGS (\\Flagged \\Deleted)").await;
    assert!(st.contains("FLAGS (\\Flagged \\Deleted)"), "{st}");
    let ex = c.imap("b3", "EXPUNGE").await;
    assert!(ex.contains("* 1 EXPUNGE"), "{ex}");
    let mv = c.imap("b4", "MOVE 1 Archive").await;
    assert!(mv.contains("COPYUID 1 ") && mv.contains("* 1 EXPUNGE") && mv.contains("b4 OK"), "{mv}");
    let msg = "From: jana.mueller@code-craft.tech\r\nSubject: Entwurf\r\n\r\nNoch nicht fertig\r\n";
    c.send(&format!("b5 APPEND Drafts (\\Seen) {{{}}}\r\n", msg.len())).await;
    assert!(c.line().await.starts_with("+"));
    c.send(&format!("{msg}\r\n")).await;
    let ap = c.until("b5").await;
    assert!(ap.contains("[APPENDUID 1 "), "{ap}");
    let status = c.imap("b6", "STATUS Drafts (MESSAGES UNSEEN UIDVALIDITY)").await;
    assert!(status.contains("MESSAGES 1 UNSEEN 0 UIDVALIDITY 1"), "{status}");
    // Neue Post während IDLE
    c.send("b7 IDLE\r\n").await;
    assert!(c.line().await.starts_with("+"));
    mail::store(&db, mb.mailbox_id, "inbox", b"From: x@y.de\r\nSubject: Neu\r\n\r\nx\r\n", None, false).await.unwrap();
    let ex = c.line().await;
    assert_eq!(ex.trim(), "* 2 EXISTS");
    c.send("DONE\r\n").await;
    assert!(c.until("b7").await.contains("b7 OK"));
    assert!(c.imap("b8", "LOGOUT").await.contains("* BYE"));
    // Webmail sieht die Änderungen
    let (_, ov) = call(&db, "GET", "/api/v1/mail", &jana, None).await;
    let f = |id: &str| ov["folders"].as_array().unwrap().iter().find(|x| x["id"] == id).unwrap()["total"].clone();
    assert_eq!((f("inbox"), f("archive"), f("drafts")), (json!(2), json!(1), json!(1)), "{ov}");
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn app_passwords_for_mail_programs(db: PgPool) {
    let (_, jana, _) = setup(&db).await;
    let (s, v) = call(&db, "POST", "/api/v1/account/app-passwords", &jana, Some(json!({ "name": "iPhone" }))).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    let pw = v["password"].as_str().unwrap().to_string();
    assert_eq!(pw.len(), 19);
    // 2FA aktiv → Hauptpasswort gilt für Mail-Programme nicht mehr, App-Passwort schon
    sqlx::query("UPDATE users SET totp_secret = 'JBSWY3DPEHPK3PXP' WHERE email = 'jana@gmail.com'")
        .execute(&db)
        .await
        .unwrap();
    assert!(mail::authenticate(&db, "jana.mueller@code-craft.tech", "sehr-geheim-123").await.is_none());
    assert!(mail::authenticate(&db, "jana.mueller@code-craft.tech", &pw).await.is_some());
    assert!(mail::authenticate(&db, "JANA@gmail.com", &pw.replace('-', " ")).await.is_some());
    let (_, l) = call(&db, "GET", "/api/v1/account/app-passwords", &jana, None).await;
    assert_eq!(l["items"][0]["name"], "iPhone");
    assert!(l["items"][0]["last_used_at"].is_string());
    let pid = l["items"][0]["id"].as_str().unwrap();
    call(&db, "DELETE", &format!("/api/v1/account/app-passwords/{pid}"), &jana, None).await;
    assert!(mail::authenticate(&db, "jana.mueller@code-craft.tech", &pw).await.is_none());
}

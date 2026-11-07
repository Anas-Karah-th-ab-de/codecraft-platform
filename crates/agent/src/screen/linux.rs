//! Linux (X11): Bild über GetImage, Eingaben über die XTest-Erweiterung. Reines Rust (x11rb), keine Systembibliotheken.
//! Wayland-Sitzungen werden in einer späteren Stufe über das Desktop-Portal angebunden.

use super::{key_name, to_px, Display, KeyName};
use codecraft_protocol::remote::{InputEvent, MouseButton};
use std::collections::HashMap;
use x11rb::connection::Connection;
use x11rb::protocol::xproto::{ConnectionExt as _, ImageFormat, Keycode, Keysym, Window};
use x11rb::protocol::xtest::ConnectionExt as _;
use x11rb::rust_connection::RustConnection;
use x11rb::wrapper::ConnectionExt as _;

const KEY_PRESS: u8 = 2;
const KEY_RELEASE: u8 = 3;
const BUTTON_PRESS: u8 = 4;
const BUTTON_RELEASE: u8 = 5;
const MOTION: u8 = 6;

pub struct Desktop {
    conn: RustConnection,
    root: Window,
    w: u32,
    h: u32,
    keymap: HashMap<Keysym, (Keycode, bool)>,
    /// freie Taste für beliebige Zeichen (Umlaute, Arabisch)
    spare: Option<Keycode>,
}

impl Desktop {
    pub fn open() -> Result<Self, String> {
        let (conn, screen) = RustConnection::connect(None).map_err(|e| format!("Kein X11-Bildschirm: {e}"))?;
        let s = &conn.setup().roots[screen];
        let (root, w, h) = (s.root, s.width_in_pixels as u32, s.height_in_pixels as u32);
        conn.xtest_get_version(2, 2).map_err(|e| e.to_string())?.reply().map_err(|_| "XTest fehlt".to_string())?;
        let (min_kc, max_kc) = (conn.setup().min_keycode, conn.setup().max_keycode);
        let mut d = Desktop { conn, root, w, h, keymap: HashMap::new(), spare: None };
        d.load_keymap(min_kc, max_kc)?;
        Ok(d)
    }

    fn load_keymap(&mut self, min: Keycode, max: Keycode) -> Result<(), String> {
        let r = self
            .conn
            .get_keyboard_mapping(min, max - min + 1)
            .map_err(|e| e.to_string())?
            .reply()
            .map_err(|e| e.to_string())?;
        let per = (r.keysyms_per_keycode as usize).max(1);
        for (i, syms) in r.keysyms.chunks(per).enumerate() {
            let kc = min + i as u8;
            if syms.iter().all(|s| *s == 0) && kc > min + 8 {
                self.spare = Some(kc); // letzte freie Taste
            }
            for (level, s) in syms.iter().take(2).enumerate() {
                if *s != 0 {
                    self.keymap.entry(*s).or_insert((kc, level == 1));
                }
            }
        }
        Ok(())
    }

    fn fake(&self, kind: u8, detail: u8, x: i16, y: i16) -> Result<(), String> {
        self.conn.xtest_fake_input(kind, detail, 0, self.root, x, y, 0).map_err(|e| e.to_string())?;
        Ok(())
    }

    fn tap_keysym(&mut self, sym: Keysym) -> Result<(), String> {
        if let Some((kc, shift)) = self.keymap.get(&sym).copied() {
            let shift_kc = self.keymap.get(&0xffe1).map(|k| k.0).filter(|_| shift);
            if let Some(s) = shift_kc {
                self.fake(KEY_PRESS, s, 0, 0)?;
            }
            self.fake(KEY_PRESS, kc, 0, 0)?;
            self.fake(KEY_RELEASE, kc, 0, 0)?;
            if let Some(s) = shift_kc {
                self.fake(KEY_RELEASE, s, 0, 0)?;
            }
        } else if let Some(kc) = self.spare {
            // freie Taste kurz mit dem Zeichen belegen
            self.conn.change_keyboard_mapping(1, kc, 2, &[sym, sym]).map_err(|e| e.to_string())?;
            self.conn.sync().map_err(|e| e.to_string())?;
            std::thread::sleep(std::time::Duration::from_millis(8));
            self.fake(KEY_PRESS, kc, 0, 0)?;
            self.fake(KEY_RELEASE, kc, 0, 0)?;
            self.conn.sync().map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

fn char_keysym(c: char) -> Keysym {
    let cp = c as u32;
    if (0x20..=0x7e).contains(&cp) || (0xa0..=0xff).contains(&cp) {
        cp
    } else {
        0x0100_0000 | cp
    }
}

fn name_keysym(k: KeyName) -> Keysym {
    use KeyName::*;
    match k {
        Char(c) => char_keysym(c),
        F(n) => 0xffbd + n as u32,
        Enter => 0xff0d,
        Escape => 0xff1b,
        Backspace => 0xff08,
        Tab => 0xff09,
        Left => 0xff51,
        Up => 0xff52,
        Right => 0xff53,
        Down => 0xff54,
        Home => 0xff50,
        End => 0xff57,
        PageUp => 0xff55,
        PageDown => 0xff56,
        Insert => 0xff63,
        Delete => 0xffff,
        ShiftL => 0xffe1,
        ShiftR => 0xffe2,
        CtrlL => 0xffe3,
        CtrlR => 0xffe4,
        AltL => 0xffe9,
        AltR => 0xfe03,
        Meta => 0xffeb,
        CapsLock => 0xffe5,
    }
}

impl Display for Desktop {
    fn size(&self) -> (u32, u32) {
        (self.w, self.h)
    }

    fn capture(&mut self) -> Result<Vec<u8>, String> {
        let r = self
            .conn
            .get_image(ImageFormat::Z_PIXMAP, self.root, 0, 0, self.w as u16, self.h as u16, !0)
            .map_err(|e| e.to_string())?
            .reply()
            .map_err(|e| e.to_string())?;
        if r.depth < 24 || r.data.len() < (self.w * self.h * 4) as usize {
            return Err(format!("Farbtiefe {} wird nicht unterstützt", r.depth));
        }
        Ok(r.data)
    }

    fn input(&mut self, ev: &InputEvent) -> Result<(), String> {
        match ev {
            InputEvent::Move { x, y } => self.fake(MOTION, 0, to_px(*x, self.w) as i16, to_px(*y, self.h) as i16)?,
            InputEvent::Button { button, down } => {
                let b = match button {
                    MouseButton::Left => 1,
                    MouseButton::Middle => 2,
                    MouseButton::Right => 3,
                };
                self.fake(if *down { BUTTON_PRESS } else { BUTTON_RELEASE }, b, 0, 0)?;
            }
            InputEvent::Wheel { dy } => {
                let b = if *dy < 0 { 4 } else { 5 };
                for _ in 0..dy.unsigned_abs().clamp(1, 10) {
                    self.fake(BUTTON_PRESS, b, 0, 0)?;
                    self.fake(BUTTON_RELEASE, b, 0, 0)?;
                }
            }
            InputEvent::Key { code, down } => {
                if let Some(k) = key_name(code) {
                    if let Some((kc, _)) = self.keymap.get(&name_keysym(k)).copied() {
                        self.fake(if *down { KEY_PRESS } else { KEY_RELEASE }, kc, 0, 0)?;
                    }
                }
            }
            InputEvent::Text { text } => {
                for c in text.chars().take(2000) {
                    self.tap_keysym(char_keysym(c))?;
                }
            }
        }
        self.conn.flush().map_err(|e| e.to_string())?;
        Ok(())
    }
}

/// Zustimmung des Kunden (zenity/kdialog); ohne Dialogprogramm: abgelehnt
pub fn ask_consent(operator: &str) -> bool {
    let text = format!(
        "{operator} (KM Code Craft Support) möchte Ihren Bildschirm sehen und steuern.\n\nErlauben?\n\n\
         يرغب {operator} من دعم KM Code Craft في رؤية شاشتك والتحكم بها. هل تسمح؟"
    );
    let tries: [(&str, Vec<String>); 2] = [
        (
            "zenity",
            vec![
                "--question".into(),
                "--title=Fernwartung".into(),
                format!("--text={text}"),
                "--timeout=60".into(),
                "--width=420".into(),
            ],
        ),
        ("kdialog", vec!["--title".into(), "Fernwartung".into(), "--yesno".into(), text.clone()]),
    ];
    for (prog, args) in tries {
        if let Ok(s) = std::process::Command::new(prog).args(&args).status() {
            return s.success();
        }
    }
    tracing::warn!("Kein Dialogprogramm (zenity/kdialog) – Bildschirmfreigabe abgelehnt");
    false
}

/// Hinweis auf dem Bildschirm (Sitzung aktiv/beendet)
pub fn notify(text: &str) {
    let _ =
        std::process::Command::new("notify-send").args(["-u", "critical", "KM Code Craft Fernwartung", text]).spawn();
}

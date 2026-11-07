//! Windows: Bild über GDI (BitBlt), Eingaben über SendInput, Zustimmung per MessageBox.
//! Der Agent muss in der Benutzersitzung laufen (Autostart bei Anmeldung), nicht als Dienst in Sitzung 0.

use super::{key_name, to_px, Display, KeyName};
use codecraft_protocol::remote::{InputEvent, MouseButton};
use windows::core::PCWSTR;
use windows::Win32::Graphics::Gdi::{
    BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits, ReleaseDC,
    SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, CAPTUREBLT, DIB_RGB_COLORS, SRCCOPY,
};
use windows::Win32::UI::Input::KeyboardAndMouse::*;
use windows::Win32::UI::WindowsAndMessaging::{
    GetSystemMetrics, MessageBoxW, IDYES, MB_ICONQUESTION, MB_SETFOREGROUND, MB_SYSTEMMODAL, MB_TOPMOST, MB_YESNO,
    SM_CXSCREEN, SM_CYSCREEN,
};

pub struct Desktop {
    w: u32,
    h: u32,
}

impl Desktop {
    pub fn open() -> Result<Self, String> {
        let (w, h) = unsafe { (GetSystemMetrics(SM_CXSCREEN), GetSystemMetrics(SM_CYSCREEN)) };
        if w <= 0 || h <= 0 {
            return Err("Kein Bildschirm (läuft der Agent in der Benutzersitzung?)".into());
        }
        Ok(Desktop { w: w as u32, h: h as u32 })
    }
}

fn send(inputs: &[INPUT]) {
    unsafe {
        SendInput(inputs, std::mem::size_of::<INPUT>() as i32);
    }
}

fn mouse(flags: MOUSE_EVENT_FLAGS, dx: i32, dy: i32, data: i32) -> INPUT {
    INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 {
            mi: MOUSEINPUT { dx, dy, mouseData: data as u32, dwFlags: flags, time: 0, dwExtraInfo: 0 },
        },
    }
}

fn key(vk: u16, scan: u16, flags: KEYBD_EVENT_FLAGS) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT { wVk: VIRTUAL_KEY(vk), wScan: scan, dwFlags: flags, time: 0, dwExtraInfo: 0 },
        },
    }
}

fn vk_of(k: KeyName) -> Option<u16> {
    use KeyName::*;
    Some(match k {
        Char(c) if c.is_ascii_alphanumeric() => c.to_ascii_uppercase() as u16,
        Char(' ') => 0x20,
        Char('-') => 0xBD,
        Char('=') => 0xBB,
        Char('[') => 0xDB,
        Char(']') => 0xDD,
        Char('\\') => 0xDC,
        Char(';') => 0xBA,
        Char('\'') => 0xDE,
        Char(',') => 0xBC,
        Char('.') => 0xBE,
        Char('/') => 0xBF,
        Char('`') => 0xC0,
        Char(_) => return None,
        F(n) => 0x6F + n as u16,
        Enter => 0x0D,
        Escape => 0x1B,
        Backspace => 0x08,
        Tab => 0x09,
        Left => 0x25,
        Up => 0x26,
        Right => 0x27,
        Down => 0x28,
        Home => 0x24,
        End => 0x23,
        PageUp => 0x21,
        PageDown => 0x22,
        Insert => 0x2D,
        Delete => 0x2E,
        ShiftL => 0xA0,
        ShiftR => 0xA1,
        CtrlL => 0xA2,
        CtrlR => 0xA3,
        AltL => 0xA4,
        AltR => 0xA5,
        Meta => 0x5B,
        CapsLock => 0x14,
    })
}

impl Display for Desktop {
    fn size(&self) -> (u32, u32) {
        (self.w, self.h)
    }

    fn capture(&mut self) -> Result<Vec<u8>, String> {
        let (w, h) = (self.w as i32, self.h as i32);
        unsafe {
            let screen = GetDC(None);
            let mem = CreateCompatibleDC(screen);
            let bmp = CreateCompatibleBitmap(screen, w, h);
            let old = SelectObject(mem, bmp);
            let ok = BitBlt(mem, 0, 0, w, h, screen, 0, 0, SRCCOPY | CAPTUREBLT).is_ok();
            let mut info = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: w,
                    biHeight: -h, // von oben nach unten
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0,
                    ..Default::default()
                },
                ..Default::default()
            };
            let mut buf = vec![0u8; (w * h * 4) as usize];
            let lines = GetDIBits(mem, bmp, 0, h as u32, Some(buf.as_mut_ptr() as *mut _), &mut info, DIB_RGB_COLORS);
            SelectObject(mem, old);
            let _ = DeleteObject(bmp);
            let _ = DeleteDC(mem);
            ReleaseDC(None, screen);
            if !ok || lines == 0 {
                return Err("Bildschirmaufnahme fehlgeschlagen (gesperrter Bildschirm?)".into());
            }
            Ok(buf)
        }
    }

    fn input(&mut self, ev: &InputEvent) -> Result<(), String> {
        match ev {
            InputEvent::Move { x, y } => {
                let ax = (to_px(*x, self.w) as i64 * 65535 / (self.w.max(2) as i64 - 1)) as i32;
                let ay = (to_px(*y, self.h) as i64 * 65535 / (self.h.max(2) as i64 - 1)) as i32;
                send(&[mouse(MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE, ax, ay, 0)]);
            }
            InputEvent::Button { button, down } => {
                let f = match (button, down) {
                    (MouseButton::Left, true) => MOUSEEVENTF_LEFTDOWN,
                    (MouseButton::Left, false) => MOUSEEVENTF_LEFTUP,
                    (MouseButton::Right, true) => MOUSEEVENTF_RIGHTDOWN,
                    (MouseButton::Right, false) => MOUSEEVENTF_RIGHTUP,
                    (MouseButton::Middle, true) => MOUSEEVENTF_MIDDLEDOWN,
                    (MouseButton::Middle, false) => MOUSEEVENTF_MIDDLEUP,
                };
                send(&[mouse(f, 0, 0, 0)]);
            }
            InputEvent::Wheel { dy } => send(&[mouse(MOUSEEVENTF_WHEEL, 0, 0, -(*dy as i32) * 120)]),
            InputEvent::Key { code, down } => {
                if let Some(vk) = key_name(code).and_then(vk_of) {
                    send(&[key(vk, 0, if *down { KEYBD_EVENT_FLAGS(0) } else { KEYEVENTF_KEYUP })]);
                }
            }
            InputEvent::Text { text } => {
                // Unicode direkt (Umlaute, Arabisch) als UTF-16
                let mut v = vec![];
                for u in text.encode_utf16().take(4000) {
                    v.push(key(0, u, KEYEVENTF_UNICODE));
                    v.push(key(0, u, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP));
                }
                send(&v);
            }
        }
        Ok(())
    }
}

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Zustimmung des Kunden per Systemdialog (immer im Vordergrund)
pub fn ask_consent(operator: &str) -> bool {
    let text = wide(&format!(
        "{operator} (KM Code Craft Support) möchte Ihren Bildschirm sehen und steuern.\n\nErlauben?\n\n\
         يرغب {operator} من دعم KM Code Craft في رؤية شاشتك والتحكم بها. هل تسمح؟"
    ));
    let title = wide("KM Code Craft – Fernwartung");
    unsafe {
        MessageBoxW(
            None,
            PCWSTR(text.as_ptr()),
            PCWSTR(title.as_ptr()),
            MB_YESNO | MB_ICONQUESTION | MB_TOPMOST | MB_SETFOREGROUND | MB_SYSTEMMODAL,
        ) == IDYES
    }
}

pub fn notify(text: &str) {
    tracing::info!("Fernwartung: {text}");
}

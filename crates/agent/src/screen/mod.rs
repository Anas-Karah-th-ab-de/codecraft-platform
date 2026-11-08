//! Bildschirm aufnehmen, Eingaben ausführen, Zustimmung einholen – je Betriebssystem eigene Umsetzung.

use codecraft_protocol::remote::InputEvent;

#[cfg(target_os = "android")]
mod android;
#[cfg(target_os = "linux")]
mod linux;
#[cfg(windows)]
mod windows;

#[cfg(target_os = "android")]
pub use android::{ask_consent, notify, Desktop};
#[cfg(target_os = "linux")]
pub use linux::{ask_consent, notify, Desktop};
#[cfg(windows)]
pub use windows::{ask_consent, notify, Desktop};

/// Gemeinsame Schnittstelle der Desktops
pub trait Display {
    /// Bildgröße in Pixeln
    fn size(&self) -> (u32, u32);
    /// Bild als BGRA (4 Byte je Pixel, Zeilen ohne Auffüllung)
    fn capture(&mut self) -> Result<Vec<u8>, String>;
    fn input(&mut self, ev: &InputEvent) -> Result<(), String>;
}

/// Relative Koordinate (0–10000) → Pixel
pub fn to_px(v: u16, max: u32) -> i32 {
    ((v.min(10000) as u64 * max.saturating_sub(1) as u64) / 10000) as i32
}

/// BGRA → verkleinertes RGB-JPEG
pub fn encode_jpeg(bgra: &[u8], w: u32, h: u32, max_width: u32, quality: u8) -> Result<(Vec<u8>, u32, u32), String> {
    let mut rgb = image::RgbImage::new(w, h);
    for (px, chunk) in rgb.pixels_mut().zip(bgra.chunks_exact(4)) {
        *px = image::Rgb([chunk[2], chunk[1], chunk[0]]);
    }
    let (ow, oh) =
        if w > max_width { (max_width, (h as u64 * max_width as u64 / w as u64).max(1) as u32) } else { (w, h) };
    let img = if (ow, oh) != (w, h) {
        image::imageops::resize(&rgb, ow, oh, image::imageops::FilterType::Triangle)
    } else {
        rgb
    };
    let mut out = Vec::with_capacity((ow * oh / 8) as usize);
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, quality)
        .encode(img.as_raw(), ow, oh, image::ExtendedColorType::Rgb8)
        .map_err(|e| e.to_string())?;
    Ok((out, ow, oh))
}

/// Schneller Fingerabdruck, um unveränderte Bilder nicht erneut zu senden
pub fn fingerprint(b: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for x in b.iter().step_by(61) {
        h = (h ^ *x as u64).wrapping_mul(0x0100_0000_01b3);
    }
    h ^ b.len() as u64
}

/// Web-`KeyboardEvent.code` → Bezeichnung, die beide Plattformen auflösen
pub fn key_name(code: &str) -> Option<KeyName> {
    if let Some(c) = code.strip_prefix("Key").filter(|c| c.len() == 1) {
        return Some(KeyName::Char(c.chars().next()?.to_ascii_lowercase()));
    }
    if let Some(d) = code.strip_prefix("Digit").filter(|c| c.len() == 1) {
        return Some(KeyName::Char(d.chars().next()?));
    }
    if let Some(n) = code.strip_prefix('F').and_then(|n| n.parse::<u8>().ok()).filter(|n| (1..=12).contains(n)) {
        return Some(KeyName::F(n));
    }
    use KeyName::*;
    Some(match code {
        "Enter" | "NumpadEnter" => Enter,
        "Escape" => Escape,
        "Backspace" => Backspace,
        "Tab" => Tab,
        "Space" => Char(' '),
        "ArrowLeft" => Left,
        "ArrowRight" => Right,
        "ArrowUp" => Up,
        "ArrowDown" => Down,
        "Home" => Home,
        "End" => End,
        "PageUp" => PageUp,
        "PageDown" => PageDown,
        "Insert" => Insert,
        "Delete" => Delete,
        "ShiftLeft" => ShiftL,
        "ShiftRight" => ShiftR,
        "ControlLeft" => CtrlL,
        "ControlRight" => CtrlR,
        "AltLeft" => AltL,
        "AltRight" => AltR,
        "MetaLeft" | "MetaRight" => Meta,
        "CapsLock" => CapsLock,
        "Minus" => Char('-'),
        "Equal" => Char('='),
        "BracketLeft" => Char('['),
        "BracketRight" => Char(']'),
        "Backslash" => Char('\\'),
        "Semicolon" => Char(';'),
        "Quote" => Char('\''),
        "Comma" => Char(','),
        "Period" => Char('.'),
        "Slash" => Char('/'),
        "Backquote" => Char('`'),
        _ => return None,
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyName {
    Char(char),
    F(u8),
    Enter,
    Escape,
    Backspace,
    Tab,
    Left,
    Right,
    Up,
    Down,
    Home,
    End,
    PageUp,
    PageDown,
    Insert,
    Delete,
    ShiftL,
    ShiftR,
    CtrlL,
    CtrlR,
    AltL,
    AltR,
    Meta,
    CapsLock,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_and_coords() {
        assert_eq!(key_name("KeyQ"), Some(KeyName::Char('q')));
        assert_eq!(key_name("Digit7"), Some(KeyName::Char('7')));
        assert_eq!(key_name("F11"), Some(KeyName::F(11)));
        assert_eq!(key_name("ControlLeft"), Some(KeyName::CtrlL));
        assert_eq!(key_name("Unbekannt"), None);
        assert_eq!(to_px(0, 1920), 0);
        assert_eq!(to_px(10000, 1920), 1919);
        assert_eq!(to_px(5000, 1000), 499);
    }

    #[test]
    fn jpeg_downscale() {
        let bgra = vec![128u8; 1920 * 1080 * 4];
        let (j, w, h) = encode_jpeg(&bgra, 1920, 1080, 1280, 60).unwrap();
        assert_eq!((w, h), (1280, 720));
        assert!(j.starts_with(&[0xFF, 0xD8]));
        assert_ne!(fingerprint(&bgra), fingerprint(&vec![1u8; 1920 * 1080 * 4]));
    }
}

//! Android: Bildschirm über MediaProjection, Steuerung über einen Bedienungshilfen-Dienst.
//! Beides liegt in der App (Kotlin, Klasse `tech.codecraft.portal.SupportBridge`); hier nur JNI-Aufrufe.
//!
//! Zustimmung: Die App zeigt erst die eigene Rückfrage („Techniker X möchte …“), dann die
//! System-Abfrage zur Bildschirmaufnahme. Ohne aktive Bedienungshilfe kann der Support nur zusehen.

use super::{key_name, to_px, Display, KeyName};
use codecraft_protocol::remote::{InputEvent, MouseButton};
use jni::objects::{JClass, JObject, JValue};
use jni::{JNIEnv, JavaVM};
use std::time::Instant;

const BRIDGE: &str = "tech.codecraft.portal.SupportBridge";

/// Mit angehängtem Thread und geladener Bridge-Klasse arbeiten (Klassenlader der App, nicht des Systems)
fn with_bridge<R>(f: impl FnOnce(&mut JNIEnv, &JClass) -> jni::errors::Result<R>) -> Result<R, String> {
    let ctx = ndk_context::android_context();
    let vm = unsafe { JavaVM::from_raw(ctx.vm().cast()) }.map_err(|e| e.to_string())?;
    let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
    let res = (|| {
        let activity = unsafe { JObject::from_raw(ctx.context().cast()) };
        let loader = env.call_method(&activity, "getClassLoader", "()Ljava/lang/ClassLoader;", &[])?.l()?;
        let name = env.new_string(BRIDGE)?;
        let cls = env
            .call_method(&loader, "loadClass", "(Ljava/lang/String;)Ljava/lang/Class;", &[JValue::Object(&name)])?
            .l()?;
        let cls = JClass::from(cls);
        f(&mut env, &cls)
    })();
    if env.exception_check().unwrap_or(false) {
        let _ = env.exception_describe();
        let _ = env.exception_clear();
    }
    res.map_err(|e| e.to_string())
}

fn call_bool(method: &str, sig: &str, args: &[JValue]) -> bool {
    with_bridge(|env, cls| env.call_static_method(cls, method, sig, args)?.z()).unwrap_or(false)
}

fn call_int(method: &str) -> i32 {
    with_bridge(|env, cls| env.call_static_method(cls, method, "()I", &[])?.i()).unwrap_or(0)
}

/// Rückfrage am Handy + System-Freigabe der Bildschirmaufnahme (blockiert bis zur Antwort, max. 90 s)
pub fn ask_consent(operator: &str) -> bool {
    with_bridge(|env, cls| {
        let op = env.new_string(operator)?;
        env.call_static_method(cls, "consent", "(Ljava/lang/String;)Z", &[JValue::Object(&op)])?.z()
    })
    .unwrap_or(false)
}

pub fn notify(text: &str) {
    let _ = with_bridge(|env, cls| {
        let t = env.new_string(text)?;
        env.call_static_method(cls, "notice", "(Ljava/lang/String;)V", &[JValue::Object(&t)])?.v()
    });
}

pub struct Desktop {
    w: u32,
    h: u32,
    x: i32,
    y: i32,
    down: Option<(i32, i32, Instant)>,
}

impl Desktop {
    pub fn open() -> Result<Self, String> {
        if !call_bool("isCapturing", "()Z", &[]) {
            return Err("Bildschirmfreigabe am Handy ist nicht aktiv".into());
        }
        let (w, h) = (call_int("width").max(1) as u32, call_int("height").max(1) as u32);
        Ok(Desktop { w, h, x: 0, y: 0, down: None })
    }

    fn gesture(&self, x1: i32, y1: i32, x2: i32, y2: i32, ms: i64) {
        let _ = with_bridge(|env, cls| {
            env.call_static_method(
                cls,
                "gesture",
                "(IIIIJ)Z",
                &[JValue::Int(x1), JValue::Int(y1), JValue::Int(x2), JValue::Int(y2), JValue::Long(ms)],
            )?
            .z()
        });
    }

    fn global(&self, action: &str) {
        let _ = with_bridge(|env, cls| {
            let a = env.new_string(action)?;
            env.call_static_method(cls, "action", "(Ljava/lang/String;)Z", &[JValue::Object(&a)])?.z()
        });
    }
}

impl Display for Desktop {
    fn size(&self) -> (u32, u32) {
        (self.w, self.h)
    }

    /// RGBA aus der App → BGRA (wie die anderen Plattformen)
    fn capture(&mut self) -> Result<Vec<u8>, String> {
        let frame = with_bridge(|env, cls| {
            let w = env.call_static_method(cls, "width", "()I", &[])?.i()?;
            let h = env.call_static_method(cls, "height", "()I", &[])?.i()?;
            let arr = env.call_static_method(cls, "frame", "()[B", &[])?.l()?;
            if arr.is_null() {
                return Ok(None);
            }
            let arr = jni::objects::JByteArray::from(arr);
            let bytes = env.convert_byte_array(&arr)?;
            Ok(Some((w, h, bytes)))
        })?;
        let Some((w, h, mut px)) = frame else {
            if !call_bool("isCapturing", "()Z", &[]) {
                return Err("Bildschirmfreigabe wurde am Handy beendet".into());
            }
            // noch kein Bild: schwarzes Bild in bekannter Größe
            return Ok(vec![0u8; (self.w * self.h * 4) as usize]);
        };
        let (w, h) = (w.max(1) as u32, h.max(1) as u32);
        if px.len() != (w * h * 4) as usize {
            return Err("Bildgröße passt nicht".into());
        }
        (self.w, self.h) = (w, h);
        for p in px.chunks_exact_mut(4) {
            p.swap(0, 2);
        }
        Ok(px)
    }

    /// Maus → Antippen/Wischen; rechts = Zurück, Mitte = Startbildschirm; Rad = Scrollen
    fn input(&mut self, ev: &InputEvent) -> Result<(), String> {
        match ev {
            InputEvent::Move { x, y } => {
                self.x = to_px(*x, self.w);
                self.y = to_px(*y, self.h);
            }
            InputEvent::Button { button: MouseButton::Left, down: true } => {
                self.down = Some((self.x, self.y, Instant::now()))
            }
            InputEvent::Button { button: MouseButton::Left, down: false } => {
                if let Some((x0, y0, t0)) = self.down.take() {
                    let ms = t0.elapsed().as_millis().clamp(40, 3000) as i64;
                    let moved = (self.x - x0).abs() + (self.y - y0).abs() > 12;
                    if moved {
                        self.gesture(x0, y0, self.x, self.y, ms.max(120));
                    } else {
                        // langes Halten = langes Drücken
                        self.gesture(x0, y0, x0, y0, if ms > 600 { 800 } else { 60 });
                    }
                }
            }
            InputEvent::Button { button: MouseButton::Right, down: true } => self.global("back"),
            InputEvent::Button { button: MouseButton::Middle, down: true } => self.global("home"),
            InputEvent::Button { .. } => {}
            InputEvent::Wheel { dy } => {
                let dist = (*dy as i32).clamp(-10, 10) * (self.h as i32 / 12);
                let (x, y) = (self.x.max(1), (self.h as i32 / 2));
                self.gesture(x, y, x, (y - dist).clamp(1, self.h as i32 - 1), 250);
            }
            InputEvent::Key { code, down: true } => match key_name(code) {
                Some(KeyName::Escape) => self.global("back"),
                Some(KeyName::Home) => self.global("home"),
                Some(KeyName::F(4)) => self.global("recents"),
                Some(KeyName::Backspace) => self.global("backspace"),
                Some(KeyName::Enter) => self.global("enter"),
                Some(KeyName::Char(c)) => {
                    let _ = text(&c.to_string());
                }
                _ => {}
            },
            InputEvent::Key { .. } => {}
            InputEvent::Text { text: t } => text(t)?,
        }
        Ok(())
    }
}

fn text(t: &str) -> Result<(), String> {
    let t: String = t.chars().take(2000).collect();
    with_bridge(|env, cls| {
        let s = env.new_string(&t)?;
        env.call_static_method(cls, "text", "(Ljava/lang/String;)Z", &[JValue::Object(&s)])?.z()
    })
    .map(|_| ())
}

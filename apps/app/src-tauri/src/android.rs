//! Android: Brücke zu den Kotlin-Diensten der App (Klasse `tech.codecraft.portal.SupportBridge`).
//! Mitteilungen laufen im Vordergrund-Dienst `NotifyService` (auch wenn die App geschlossen ist).

use jni::objects::{JClass, JObject, JString, JValue};
use jni::{JNIEnv, JavaVM};

const BRIDGE: &str = "tech.codecraft.portal.SupportBridge";

fn with_bridge<R>(f: impl FnOnce(&mut JNIEnv, &JClass) -> jni::errors::Result<R>) -> Option<R> {
    let ctx = ndk_context::android_context();
    let vm = unsafe { JavaVM::from_raw(ctx.vm().cast()) }.ok()?;
    let mut env = vm.attach_current_thread().ok()?;
    let res = (|| {
        let activity = unsafe { JObject::from_raw(ctx.context().cast()) };
        let loader = env.call_method(&activity, "getClassLoader", "()Ljava/lang/ClassLoader;", &[])?.l()?;
        let name = env.new_string(BRIDGE)?;
        let cls = env.call_method(&loader, "loadClass", "(Ljava/lang/String;)Ljava/lang/Class;", &[JValue::Object(&name)])?.l()?;
        f(&mut env, &JClass::from(cls))
    })();
    if env.exception_check().unwrap_or(false) {
        let _ = env.exception_describe();
        let _ = env.exception_clear();
    }
    res.ok()
}

/// Server und Schlüssel an den Mitteilungs-Dienst geben (leer = stoppen)
pub fn configure(server: &str, key: &str) {
    let _ = with_bridge(|env, cls| {
        let s = env.new_string(server)?;
        let k = env.new_string(key)?;
        env.call_static_method(cls, "configure", "(Ljava/lang/String;Ljava/lang/String;)V", &[JValue::Object(&s), JValue::Object(&k)])?
            .v()
    });
}

pub fn take_pending_url() -> Option<String> {
    with_bridge(|env, cls| {
        let o = env.call_static_method(cls, "takePendingUrl", "()Ljava/lang/String;", &[])?.l()?;
        if o.is_null() {
            return Ok(None);
        }
        let s: String = env.get_string(&JString::from(o))?.into();
        Ok(Some(s))
    })
    .flatten()
}

pub fn control_enabled() -> bool {
    with_bridge(|env, cls| env.call_static_method(cls, "controlEnabled", "()Z", &[])?.z()).unwrap_or(false)
}

pub fn control_available() -> bool {
    with_bridge(|env, cls| env.call_static_method(cls, "controlAvailable", "()Z", &[])?.z()).unwrap_or(false)
}

pub fn open_control_settings() {
    let _ = with_bridge(|env, cls| env.call_static_method(cls, "openControlSettings", "()V", &[])?.v());
}

pub fn support_changed(running: bool) {
    let _ = with_bridge(|env, cls| env.call_static_method(cls, "supportChanged", "(Z)V", &[JValue::Bool(running as u8)])?.v());
}

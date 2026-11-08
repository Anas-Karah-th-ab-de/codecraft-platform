"""Eigene Android-Teile in das von Tauri erzeugte Projekt (src-tauri/gen/android) einsetzen.
Aufruf nach `cargo tauri android init`: python3 apps/app/android/apply.py"""
import pathlib, shutil

HERE = pathlib.Path(__file__).resolve().parent
GEN = HERE.parent / "src-tauri" / "gen" / "android" / "app"
MAIN = GEN / "src" / "main"
PKG = MAIN / "java" / "tech" / "codecraft" / "portal"

for f in (HERE / "kotlin").glob("*.kt"):
    shutil.copy(f, PKG / f.name)
for sub in ("xml", "values"):
    (MAIN / "res" / sub).mkdir(parents=True, exist_ok=True)
    for f in (HERE / "res" / sub).glob("*.xml"):
        shutil.copy(f, MAIN / "res" / sub / f.name)

# Keep-Regeln: Rust ruft die Bridge per JNI auf (Namen dürfen nicht verkürzt werden)
(GEN / "km-keep.pro").write_text("-keep class tech.codecraft.portal.** { *; }\n")

m = (MAIN / "AndroidManifest.xml").read_text()
if "NotifyService" not in m:
    perms = """    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_REMOTE_MESSAGING" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
    <uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />
"""
    m = m.replace('    <uses-permission android:name="android.permission.INTERNET" />\n', perms, 1)
    m = m.replace('android:launchMode="singleTask"', 'android:launchMode="singleTask"\n            android:showWhenLocked="true"\n            android:turnScreenOn="true"', 1)
    comps = """
        <service android:name=".NotifyService" android:exported="false"
            android:foregroundServiceType="remoteMessaging" />
        <service android:name=".ProjectionService" android:exported="false"
            android:foregroundServiceType="mediaProjection" />
        <service android:name=".ControlService" android:exported="false"
            android:label="@string/control_label"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
            <intent-filter><action android:name="android.accessibilityservice.AccessibilityService" /></intent-filter>
            <meta-data android:name="android.accessibilityservice" android:resource="@xml/control_service" />
        </service>
        <activity android:name=".ConsentActivity" android:exported="false"
            android:theme="@android:style/Theme.DeviceDefault.Dialog.NoActionBar"
            android:excludeFromRecents="true" android:showWhenLocked="true" android:turnScreenOn="true" />
        <receiver android:name=".DeclineReceiver" android:exported="false" />
        <receiver android:name=".BootReceiver" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>
    </application>"""
    m = m.replace("    </application>", comps, 1)
    (MAIN / "AndroidManifest.xml").write_text(m)

g = (GEN / "build.gradle.kts").read_text()
if "androidx.core:core-ktx" not in g:
    g = g.replace('    implementation("androidx.webkit:webkit:', '    implementation("androidx.core:core-ktx:1.13.1")\n    implementation("androidx.webkit:webkit:', 1)
# installiertes SDK verwenden (Gradle lädt sonst die neueste Plattform)
(GEN / "build.gradle.kts").write_text(g)
print("Android-Teile eingesetzt:", PKG)

// Eigene App-Befehle als ACL-Berechtigungen (allow-<befehl>) erzeugen: das Portal läuft vom Server
// (fremde Herkunft) und darf nur die Befehle aufrufen, die capabilities/default.json ausdrücklich erlaubt.
const COMMANDS: &[&str] = &[
    "app_info",
    "app_enroll",
    "app_set_server",
    "app_reset",
    "app_pending_url",
    "support_start",
    "support_stop",
    "support_status",
    "control_settings",
    "open_file",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("Tauri-Build fehlgeschlagen");
}

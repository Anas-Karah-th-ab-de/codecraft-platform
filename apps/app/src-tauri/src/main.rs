// Windows: kein Konsolenfenster im Release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    km_portal_lib::run()
}

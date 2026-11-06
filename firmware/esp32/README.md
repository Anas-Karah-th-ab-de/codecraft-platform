# ESP32-Firmware

Rust (`std` über ESP-IDF). Nutzt dasselbe Protokoll-Crate wie Server und Agent.

```bash
# einmalig
cargo install espup ldproxy espflash && espup install && . ~/export-esp.sh
# bauen & flashen
CC_WIFI_SSID=… CC_WIFI_PASS=… CC_API_URL=https://api.code-craft.tech CC_DEVICE_TOKEN=cc_d_… cargo run --release
```

Status: Gerüst, noch nicht auf Hardware gebaut (Meilenstein 3).
Geplant: Provisionierung per BLE, Token in NVS, OTA mit SHA-256-Prüfung.

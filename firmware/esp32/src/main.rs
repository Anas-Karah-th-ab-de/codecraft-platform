//! ESP32-Firmware: WLAN verbinden, alle N Sekunden einen Report an die Plattform senden.
//!
//! Zugangsdaten werden beim Build gesetzt (später: Provisionierung per BLE/NVS):
//!   CC_WIFI_SSID, CC_WIFI_PASS, CC_API_URL, CC_DEVICE_TOKEN

use anyhow::Result;
use codecraft_protocol::{DeviceKind, Metric, Report, ReportAck, PROTOCOL_VERSION};
use embedded_svc::http::client::Client;
use embedded_svc::io::{Read, Write};
use esp_idf_svc::eventloop::EspSystemEventLoop;
use esp_idf_svc::hal::prelude::Peripherals;
use esp_idf_svc::http::client::{Configuration as HttpConfig, EspHttpConnection};
use esp_idf_svc::nvs::EspDefaultNvsPartition;
use esp_idf_svc::wifi::{AuthMethod, BlockingWifi, ClientConfiguration, Configuration, EspWifi};
use std::time::{Duration, Instant};

const SSID: &str = env!("CC_WIFI_SSID");
const PASS: &str = env!("CC_WIFI_PASS");
const API_URL: &str = env!("CC_API_URL");
const TOKEN: &str = env!("CC_DEVICE_TOKEN");

fn main() -> Result<()> {
    esp_idf_svc::sys::link_patches();
    esp_idf_svc::log::EspLogger::initialize_default();

    let p = Peripherals::take()?;
    let sysloop = EspSystemEventLoop::take()?;
    let nvs = EspDefaultNvsPartition::take()?;
    let mut wifi = BlockingWifi::wrap(EspWifi::new(p.modem, sysloop.clone(), Some(nvs))?, sysloop)?;
    wifi.set_configuration(&Configuration::Client(ClientConfiguration {
        ssid: SSID.try_into().map_err(|_| anyhow::anyhow!("SSID zu lang"))?,
        password: PASS.try_into().map_err(|_| anyhow::anyhow!("Passwort zu lang"))?,
        auth_method: AuthMethod::WPA2Personal,
        ..Default::default()
    }))?;
    wifi.start()?;
    wifi.connect()?;
    wifi.wait_netif_up()?;
    log::info!("WLAN verbunden");

    let started = Instant::now();
    let mut interval = Duration::from_secs(60);
    loop {
        let rssi = wifi.wifi().driver().get_rssi().unwrap_or(0);
        // SAFETY: reine Abfrage des Heap-Zählers
        let heap = unsafe { esp_idf_svc::sys::esp_get_free_heap_size() };
        let report = Report {
            protocol: PROTOCOL_VERSION,
            kind: DeviceKind::Esp32,
            version: env!("CARGO_PKG_VERSION").into(),
            uptime_s: started.elapsed().as_secs(),
            metrics: vec![
                Metric { name: "rssi_dbm".into(), value: rssi as f64 },
                Metric { name: "heap_free_kb".into(), value: heap as f64 / 1024.0 },
            ],
            events: vec![],
        };
        match send(&report) {
            Ok(ack) => interval = Duration::from_secs(ack.next_report_s.clamp(10, 86_400) as u64),
            Err(e) => log::warn!("Report fehlgeschlagen: {e:?}"),
        }
        std::thread::sleep(interval);
    }
}

fn send(report: &Report) -> Result<ReportAck> {
    let conn = EspHttpConnection::new(&HttpConfig {
        crt_bundle_attach: Some(esp_idf_svc::sys::esp_crt_bundle_attach),
        timeout: Some(Duration::from_secs(15)),
        ..Default::default()
    })?;
    let mut client = Client::wrap(conn);
    let body = serde_json::to_vec(report)?;
    let url = format!("{}/api/v1/devices/report", API_URL.trim_end_matches('/'));
    let auth = format!("Bearer {TOKEN}");
    let len = body.len().to_string();
    let headers =
        [("content-type", "application/json"), ("authorization", auth.as_str()), ("content-length", len.as_str())];
    let mut req = client.post(&url, &headers)?;
    req.write_all(&body)?;
    let mut res = req.submit()?;
    anyhow::ensure!(res.status() == 200, "HTTP {}", res.status());
    let mut buf = [0u8; 2048];
    let mut out = Vec::new();
    loop {
        let n = res.read(&mut buf)?;
        if n == 0 {
            break;
        }
        out.extend_from_slice(&buf[..n]);
    }
    Ok(serde_json::from_slice(&out)?)
}

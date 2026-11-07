//! Aktionen auf dem Gerät: Inventar, Befehle, Neustart, Dateien.

use base64::Engine;
use codecraft_protocol::remote::{DirEntry, Disk, FromDevice, Inventory};
use std::io::{Seek, SeekFrom, Write};
use std::time::Duration;
use sysinfo::{Disks, Networks, System};

const CHUNK: usize = 256 * 1024;
const MAX_FILE: u64 = 50 * 1024 * 1024;
const MAX_OUTPUT: usize = 256 * 1024;

pub fn inventory(screens: Vec<(u32, u32)>) -> Inventory {
    let mut sys = System::new();
    sys.refresh_cpu_all();
    sys.refresh_memory();
    let disks = Disks::new_with_refreshed_list();
    let nets = Networks::new_with_refreshed_list();
    let mut ips: Vec<String> = nets
        .values()
        .flat_map(|n| n.ip_networks().iter().map(|ip| ip.addr))
        .filter(|ip| !ip.is_loopback())
        .map(|ip| ip.to_string())
        .collect();
    ips.sort();
    ips.dedup();
    Inventory {
        hostname: System::host_name().unwrap_or_default(),
        os: System::long_os_version().unwrap_or_else(|| std::env::consts::OS.into()),
        arch: std::env::consts::ARCH.into(),
        cpu: sys.cpus().first().map(|c| c.brand().trim().to_string()).unwrap_or_default(),
        cores: sys.cpus().len() as u32,
        mem_total_mb: sys.total_memory() / 1_048_576,
        disks: disks
            .list()
            .iter()
            .map(|d| Disk {
                mount: d.mount_point().display().to_string(),
                total_gb: (d.total_space() as f64 / 1e8).round() / 10.0,
                free_gb: (d.available_space() as f64 / 1e8).round() / 10.0,
            })
            .collect(),
        ips,
        uptime_s: System::uptime(),
        user: std::env::var("USER").or_else(|_| std::env::var("USERNAME")).ok(),
        screens,
    }
}

/// Programm ohne Shell ausführen, Ausgabe (stdout+stderr) gekürzt zurückgeben
pub async fn exec(id: String, program: String, args: Vec<String>, timeout_s: u32) -> FromDevice {
    let mut cmd = tokio::process::Command::new(&program);
    cmd.args(&args).kill_on_drop(true).stdin(std::process::Stdio::null());
    let fut = cmd.output();
    match tokio::time::timeout(Duration::from_secs(timeout_s.max(1) as u64), fut).await {
        Ok(Ok(out)) => {
            let mut text = String::from_utf8_lossy(&out.stdout).into_owned();
            if !out.stderr.is_empty() {
                text.push_str(&String::from_utf8_lossy(&out.stderr));
            }
            if text.len() > MAX_OUTPUT {
                let cut = (0..=MAX_OUTPUT).rev().find(|i| text.is_char_boundary(*i)).unwrap_or(0);
                text.truncate(cut);
                text.push_str("\n… (gekürzt)");
            }
            FromDevice::Result { id, ok: out.status.success(), code: out.status.code(), output: text }
        }
        Ok(Err(e)) => FromDevice::Result { id, ok: false, code: None, output: format!("Start fehlgeschlagen: {e}") },
        Err(_) => FromDevice::Result { id, ok: false, code: None, output: format!("Abgebrochen nach {timeout_s} s") },
    }
}

/// Neustart nach kurzer Verzögerung (damit die Antwort noch ankommt)
pub fn reboot(id: String) -> FromDevice {
    std::thread::spawn(|| {
        std::thread::sleep(Duration::from_secs(3));
        #[cfg(windows)]
        let _ = std::process::Command::new("shutdown")
            .args(["/r", "/t", "5", "/c", "KM Code Craft Fernwartung: Neustart"])
            .status();
        #[cfg(not(windows))]
        let _ = std::process::Command::new("systemctl").arg("reboot").status();
    });
    FromDevice::Result { id, ok: true, code: None, output: "Neustart in wenigen Sekunden".into() }
}

pub fn list_dir(id: String, path: &str) -> FromDevice {
    #[cfg(windows)]
    if path.is_empty() {
        let entries = (b'A'..=b'Z')
            .map(|c| format!("{}:\\", c as char))
            .filter(|d| std::path::Path::new(d).exists())
            .map(|d| DirEntry { name: d, dir: true, size: 0, modified: None })
            .collect();
        return FromDevice::Dir { id, entries };
    }
    let path = if path.is_empty() { "/" } else { path };
    match std::fs::read_dir(path) {
        Ok(rd) => {
            let mut entries: Vec<DirEntry> = rd
                .flatten()
                .take(5000)
                .map(|e| {
                    let md = e.metadata().ok();
                    DirEntry {
                        name: e.file_name().to_string_lossy().into_owned(),
                        dir: md.as_ref().is_some_and(|m| m.is_dir()),
                        size: md.as_ref().map(|m| m.len()).unwrap_or(0),
                        modified: md
                            .and_then(|m| m.modified().ok())
                            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|d| d.as_secs() as i64),
                    }
                })
                .collect();
            entries.sort_by(|a, b| b.dir.cmp(&a.dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase())));
            FromDevice::Dir { id, entries }
        }
        Err(e) => FromDevice::Result { id, ok: false, code: None, output: format!("{path}: {e}") },
    }
}

/// Datei in Blöcken lesen → mehrere FileChunk-Nachrichten
pub fn get_file(id: String, path: &str) -> Vec<FromDevice> {
    let data = match std::fs::metadata(path) {
        Ok(m) if m.is_dir() => {
            return vec![FromDevice::Result { id, ok: false, code: None, output: "Ist ein Ordner".into() }]
        }
        Ok(m) if m.len() > MAX_FILE => {
            return vec![FromDevice::Result { id, ok: false, code: None, output: "Datei größer als 50 MB".into() }]
        }
        Ok(_) => match std::fs::read(path) {
            Ok(d) => d,
            Err(e) => return vec![FromDevice::Result { id, ok: false, code: None, output: e.to_string() }],
        },
        Err(e) => return vec![FromDevice::Result { id, ok: false, code: None, output: e.to_string() }],
    };
    let size = data.len() as u64;
    if data.is_empty() {
        return vec![FromDevice::FileChunk { id, offset: 0, data_b64: String::new(), last: true, size }];
    }
    let n = data.len().div_ceil(CHUNK);
    data.chunks(CHUNK)
        .enumerate()
        .map(|(i, c)| FromDevice::FileChunk {
            id: id.clone(),
            offset: (i * CHUNK) as u64,
            data_b64: base64::engine::general_purpose::STANDARD.encode(c),
            last: i + 1 == n,
            size,
        })
        .collect()
}

pub fn put_file(id: String, path: &str, offset: u64, data_b64: &str) -> FromDevice {
    let res = (|| -> std::io::Result<()> {
        let data = base64::engine::general_purpose::STANDARD
            .decode(data_b64)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
        if offset + data.len() as u64 > MAX_FILE {
            return Err(std::io::Error::other("Datei größer als 50 MB"));
        }
        let mut f = if offset == 0 {
            std::fs::File::create(path)?
        } else {
            std::fs::OpenOptions::new().write(true).open(path)?
        };
        f.seek(SeekFrom::Start(offset))?;
        f.write_all(&data)?;
        Ok(())
    })();
    match res {
        Ok(()) => FromDevice::Result { id, ok: true, code: None, output: String::new() },
        Err(e) => FromDevice::Result { id, ok: false, code: None, output: format!("{path}: {e}") },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn exec_and_files() {
        let FromDevice::Result { ok, output, .. } = exec("1".into(), "echo".into(), vec!["hallo".into()], 5).await
        else {
            panic!()
        };
        assert!(ok && output.trim() == "hallo");
        let FromDevice::Result { ok, .. } = exec("2".into(), "gibt-es-nicht".into(), vec![], 5).await else { panic!() };
        assert!(!ok);
        let dir = std::env::temp_dir().join(format!("cc-agent-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let p = dir.join("a.bin");
        let ps = p.to_string_lossy().to_string();
        let big: Vec<u8> = (0..600_000u32).map(|i| (i % 251) as u8).collect();
        let mut off = 0u64;
        for c in big.chunks(CHUNK) {
            let b = base64::engine::general_purpose::STANDARD.encode(c);
            assert!(matches!(put_file("3".into(), &ps, off, &b), FromDevice::Result { ok: true, .. }));
            off += c.len() as u64;
        }
        let chunks = get_file("4".into(), &ps);
        assert_eq!(chunks.len(), 3);
        let mut back = vec![];
        for c in chunks {
            if let FromDevice::FileChunk { data_b64, .. } = c {
                back.extend(base64::engine::general_purpose::STANDARD.decode(data_b64).unwrap());
            }
        }
        assert_eq!(back, big);
        let FromDevice::Dir { entries, .. } = list_dir("5".into(), &dir.to_string_lossy()) else { panic!() };
        assert_eq!(entries[0].name, "a.bin");
        std::fs::remove_dir_all(dir).unwrap();
    }
}

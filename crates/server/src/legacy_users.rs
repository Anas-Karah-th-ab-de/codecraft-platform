//! Übernahme der Benutzer aus dem Altsystem (Prisma-Export `User.json`, `Customer.json`,
//! `UserDepartment.json`, `Department.json`).
//!
//! Alte Passwort-Hashes werden NICHT übernommen. Jeder Benutzer bekommt ein eigenes
//! Einmal-Passwort und muss beim ersten Login ein neues festlegen. Bereits vorhandene
//! Benutzer (gleiche E-Mail oder schon übernommen) bleiben unverändert.

use crate::routes::{account, chat};
use codecraft_domain::access::Role;
use serde_json::Value;
use sqlx::PgPool;
use std::collections::HashMap;
use std::path::Path;
use uuid::Uuid;

/// Ergebnis je neu angelegtem Benutzer – das Passwort gibt es nur hier
pub struct Created {
    pub email: String,
    pub name: String,
    pub role: &'static str,
    pub password: String,
}

fn read(dir: &Path, name: &str) -> Result<Vec<Value>, String> {
    let p = dir.join(format!("{name}.json"));
    let s = std::fs::read_to_string(&p).map_err(|e| format!("{}: {e}", p.display()))?;
    serde_json::from_str(&s).map_err(|e| format!("{}: {e}", p.display()))
}

fn s<'a>(v: &'a Value, k: &str) -> &'a str {
    v.get(k).and_then(Value::as_str).unwrap_or("").trim()
}

pub fn map_role(old: &str) -> Option<Role> {
    Some(match old {
        "ADMIN" => Role::Admin,
        "LEITER" => Role::Lead,
        "MANAGER" => Role::Manager,
        "MITARBEITER" => Role::Staff,
        "AZUBI" => Role::Trainee,
        _ => return None,
    })
}

fn role_str(r: Role) -> &'static str {
    match r {
        Role::Admin => "admin",
        Role::Lead => "lead",
        Role::Manager => "manager",
        Role::Staff => "staff",
        Role::Trainee => "trainee",
        Role::Customer => "customer",
        Role::Device => "device",
    }
}

struct Candidate {
    legacy_id: String,
    email: String,
    name: String,
    role: Role,
    org: Option<Uuid>,
    departments: Vec<String>,
}

pub async fn import(
    db: &PgPool,
    dir: &Path,
    skip: &[String],
) -> Result<(Vec<Created>, Vec<String>), Box<dyn std::error::Error>> {
    let depts: HashMap<String, String> =
        read(dir, "Department")?.iter().map(|d| (s(d, "id").to_string(), s(d, "code").to_string())).collect();
    let mut user_depts: HashMap<String, Vec<(bool, String)>> = HashMap::new();
    for ud in read(dir, "UserDepartment")? {
        if let Some(code) = depts.get(s(&ud, "departmentId")) {
            let primary = ud.get("isPrimary").and_then(Value::as_bool).unwrap_or(false);
            user_depts.entry(s(&ud, "userId").to_string()).or_default().push((primary, code.clone()));
        }
    }
    let mut cands = vec![];
    let mut skipped = vec![];
    for u in read(dir, "User")? {
        let email = s(&u, "email").to_lowercase();
        if u.get("isActive").and_then(Value::as_bool) == Some(false) || email.is_empty() {
            skipped.push(format!("{email}: inaktiv"));
            continue;
        }
        let Some(role) = map_role(s(&u, "role")) else {
            skipped.push(format!("{email}: unbekannte Rolle {}", s(&u, "role")));
            continue;
        };
        let mut d = user_depts.remove(s(&u, "id")).unwrap_or_default();
        d.sort_by_key(|(p, _)| !*p); // Hauptabteilung zuerst
        cands.push(Candidate {
            legacy_id: s(&u, "id").to_string(),
            name: if s(&u, "name").is_empty() { email.clone() } else { s(&u, "name").to_string() },
            email,
            role,
            org: None,
            departments: d.into_iter().map(|(_, c)| c).collect(),
        });
    }
    for c in read(dir, "Customer")? {
        let email = s(&c, "email").to_lowercase();
        if c.get("isActive").and_then(Value::as_bool) == Some(false) || email.is_empty() {
            skipped.push(format!("{email}: inaktiv"));
            continue;
        }
        let org: Option<Uuid> = sqlx::query_scalar("SELECT id FROM organizations WHERE $1 = ANY(legacy_ids)")
            .bind(s(&c, "id"))
            .fetch_optional(db)
            .await?;
        let Some(org) = org else {
            skipped.push(format!("{email}: Firma {} nicht übernommen", s(&c, "companyName")));
            continue;
        };
        let name = [s(&c, "contactName"), s(&c, "companyName")].into_iter().find(|n| !n.is_empty()).unwrap_or(&email);
        cands.push(Candidate {
            legacy_id: s(&c, "id").to_string(),
            name: name.to_string(),
            email,
            role: Role::Customer,
            org: Some(org),
            departments: vec![],
        });
    }

    let mut created = vec![];
    for c in cands {
        if skip.contains(&c.email) {
            skipped.push(format!("{}: ausgeschlossen (--skip)", c.email));
            continue;
        }
        let exists: bool =
            sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM users WHERE lower(email) = $1 OR legacy_id = $2)")
                .bind(&c.email)
                .bind(&c.legacy_id)
                .fetch_one(db)
                .await?;
        if exists {
            skipped.push(format!("{}: existiert bereits", c.email));
            continue;
        }
        let id = Uuid::now_v7();
        let mut tx = db.begin().await?;
        sqlx::query(
            "INSERT INTO users (id, email, display_name, role, organization_id, legacy_id)
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(id)
        .bind(&c.email)
        .bind(&c.name)
        .bind(role_str(c.role))
        .bind(c.org)
        .bind(&c.legacy_id)
        .execute(&mut *tx)
        .await?;
        for (i, code) in c.departments.iter().enumerate() {
            sqlx::query(
                "INSERT INTO user_departments (user_id, department_id, is_primary)
                 SELECT $1, id, $3 FROM departments WHERE code = $2 ON CONFLICT DO NOTHING",
            )
            .bind(id)
            .bind(code)
            .bind(i == 0)
            .execute(&mut *tx)
            .await?;
        }
        chat::provision(&mut tx, id, &c.email, &c.name, c.role, c.org).await.map_err(|e| e.to_string())?;
        let password =
            account::set_onetime_password(&mut tx, "cli:import-users", id).await.map_err(|e| e.to_string())?;
        tx.commit().await?;
        created.push(Created { email: c.email, name: c.name, role: role_str(c.role), password });
    }
    Ok((created, skipped))
}

/// Einmal-Passwörter für bestehende Benutzer (E-Mail-Liste) neu vergeben
pub async fn reset(db: &PgPool, emails: &[String]) -> Result<Vec<Created>, Box<dyn std::error::Error>> {
    let mut out = vec![];
    for e in emails {
        let row: Option<(Uuid, String, String, String)> = sqlx::query_as(
            "SELECT id, email, display_name, role FROM users WHERE lower(email) = lower($1) AND role <> 'device'",
        )
        .bind(e.trim())
        .fetch_optional(db)
        .await?;
        let Some((id, email, name, role)) = row else {
            return Err(format!("{e}: Benutzer nicht gefunden").into());
        };
        let mut tx = db.begin().await?;
        let password =
            account::set_onetime_password(&mut tx, "cli:reset-passwords", id).await.map_err(|e| e.to_string())?;
        tx.commit().await?;
        let role = Role::parse(&role).map(role_str).unwrap_or("?");
        out.push(Created { email, name, role, password });
    }
    Ok(out)
}

/// Liste schreiben: nur für den Eigentümer lesbar, bestehende Datei wird nie überschrieben
pub fn write_list(path: &Path, rows: &[Created]) -> std::io::Result<()> {
    use std::io::Write;
    let mut o = std::fs::OpenOptions::new();
    o.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        o.mode(0o600);
    }
    let mut f = o.open(path)?;
    writeln!(f, "email;name;rolle;einmalpasswort")?;
    for r in rows {
        writeln!(f, "{};{};{};{}", r.email, r.name.replace(';', ","), r.role, r.password)?;
    }
    Ok(())
}

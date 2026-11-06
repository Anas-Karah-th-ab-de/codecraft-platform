# Frontends (Meilenstein 2)

- `web/` – code-craft.tech mit **Astro**: statisch generiert, DE/EN/AR inkl. RTL. Inhalte (Blog, Produkte, Jobs) kommen zur Build-Zeit aus der API; ein Webhook löst bei Änderungen einen Rebuild aus. Kein direkter DB-Zugriff mehr.
- `portal/` – **ein** Portal für Mitarbeiter und Kunden (React + Vite + TanStack Router/Query). Menüs und Seiten nach Rolle; alle Daten über `/api/v1`. API-Typen werden aus den Rust-Structs generiert (ts-rs), damit Frontend und Backend nicht auseinanderlaufen.

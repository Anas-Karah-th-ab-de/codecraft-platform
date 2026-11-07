# Umstellung: Mailcow, Matrix und LiveKit → eigener Server

Ziel: Mail, Chat und Anrufe laufen nur noch im `codecraft-server`. Kein Docker für Kommunikation mehr.
Jeder Schritt, der den Produktionsserver verändert, braucht vorher die Freigabe von Anas.

## 0. Vorher (nur lesen)

```bash
tools/legacy/mail-export.sh        # Mailcow-Postfächer → ~/prod-export/mail/*.pager
tools/legacy/matrix-export.sh      # Matrix-Verlauf als Archiv → ~/prod-export/matrix/
```

Der Matrix-Verlauf wird nicht in den neuen Chat übernommen: 42 Nachrichten, fast nur Testdaten. Er liegt als Archiv vor.

## 0b. Nichts darf verloren gehen

- `tools/legacy/mail-backup.sh` sichert die Mailcow-Rohdaten nur lesend auf den lokalen Rechner, mit SHA256-Prüfsummen:
  - vmail: alle Postfächer, inklusive gelöschter Ordner
  - crypt: die Schlüssel. Ohne sie sind die Rohdaten unlesbar.
- Mailcow selbst bleibt unverändert, bis Schritt 4 ausdrücklich freigegeben ist.
- Nach dem Import muss die Anzahl je Postfach und Ordner mit `doveadm mailbox status` übereinstimmen. Der Import zeigt dafür „gelesen / übernommen / übersprungen“ an.
- Im neuen System läuft täglich ein `pg_dump` der Datenbank. Er wird verschlüsselt und auch außerhalb des Servers abgelegt.

## 0c. Sicherheit (Pflicht in Produktion)

```
MAIL_ENC_KEY=$(codecraft-server mail-key)   # AES-256-GCM für alle Mails in der DB – sicher verwahren!
# niemals setzen: MAIL_ALLOW_PLAIN_AUTH
```

- **Verschlüsselung in der Datenbank:** Mails sind mit AES-256-GCM verschlüsselt.
  - Betreff, Absender und Vorschau bleiben lesbar, damit Suche und Liste funktionieren.
  - Ohne den Schlüssel sind Datenbank-Dumps wertlos. Verliert man ihn, sind die Inhalte aber nicht mehr lesbar. Deshalb den Schlüssel doppelt sichern.
- **Verbindungen:** Anmeldung nur über TLS. Pro IP höchstens 10 SMTP- und 20 IMAP-Verbindungen. Nach 8 Fehlversuchen wird die Anmeldung 15 Minuten gesperrt.
- **Konten:** Bei aktiver Zwei-Faktor-Anmeldung braucht man App-Passwörter. Pro Postfach sind 300 Empfänger pro Stunde erlaubt.
- **Anhänge:** Programme, Skripte, Makro-Dokumente und ISO-Dateien werden abgewiesen. Das gilt auch, wenn sie getarnt sind, zum Beispiel als „.pdf.exe“ oder an der Programm-Signatur erkennbar.
- **Prüfung beim Empfang:** SPF, DKIM und DMARC werden geprüft.
- **DNS-Regeln:**
  - DMARC ist streng (adkim=s, aspf=s). Nach erfolgreichem Test `p=reject` setzen.
  - MTA-STS und TLS-RPT sind gesetzt. Fremde Server dürfen nur verschlüsselt an uns zustellen.
- **TURN-Relay:** Er leitet nie an interne oder private Adressen weiter, damit niemand darüber an Postgres oder Redis kommt. Die Zugangsdaten gelten 24 Stunden.
- **Web-Header:** CSP, HSTS, Permissions-Policy, X-Frame-Options und COOP sind gesetzt.
- **HTML-Mails:** Sie werden abgeschottet angezeigt (Sandbox, keine Skripte). Externe Bilder werden erst auf Klick geladen.

## 1. Benutzer und Postfächer anlegen (Portal → Benutzer)

| Mailcow | Neu | Hinweis |
|---|---|---|
| ak@ | Anas Karah (admin) | gibt es schon |
| ah@ | Ali Hennawi (staff) | Login-E-Mail `ah@code-craft.tech` |
| lu@ | Luban Kara Mohamad (staff) | Login-E-Mail `lu@code-craft.tech` |
| info@ | Funktionskonto „Info“ (manager) | 104 Nachrichten |
| admin@, noreply@ | Funktionskonten | oder als Weiterleitung auf ak@ |
| support@ | Weiterleitung auf ak@ | leer |

Danach importieren (wiederholbar, legt nichts doppelt an):

```bash
codecraft-server mail-import ~/prod-export/mail/*.pager
```

## 2. TLS-Zertifikat für `mail.code-craft.tech`

Let's Encrypt (certbot oder vorhandener Proxy), dann in der Umgebung des Servers:

```
MAIL_HOSTNAME=mail.code-craft.tech
MAIL_TLS_CERT=/etc/letsencrypt/live/mail.code-craft.tech/fullchain.pem
MAIL_TLS_KEY=/etc/letsencrypt/live/mail.code-craft.tech/privkey.pem
TURN_PUBLIC_IP=194.62.29.64
TURN_SECRET=<32 zufällige Zeichen>
PUBLIC_HOST=code-craft.tech
```

## 3. Umschalten (kurze Mail-Pause von ca. 5 Minuten)

1. Mailcow anhalten: `docker compose stop` im Mailcow-Ordner. Die Daten bleiben erhalten.
2. Letzten Export ziehen und importieren (Schritt 0 und 1). Damit kommen auch die Mails seit dem ersten Export mit.
3. `codecraft-server` neu starten. Er übernimmt die Ports 25, 465, 587, 993 und 143 sowie UDP 3478 und 50000–50999.
4. Firewall: diese Ports öffnen. Postgres 5432 und Redis 6379 von außen schließen (offener Punkt).
5. DNS (Werte stehen im Portal unter E-Mail → Einstellungen):
   - `MX code-craft.tech → 10 mail.code-craft.tech.`
   - `TXT code-craft.tech → v=spf1 mx -all`
   - `TXT cc1._domainkey.code-craft.tech → v=DKIM1; k=rsa; p=…`
   - `TXT _dmarc.code-craft.tech → v=DMARC1; p=quarantine; …`
   - PTR/rDNS von 194.62.29.64 → `mail.code-craft.tech` (beim Hoster)
6. Test:
   - Mail von Gmail an ak@ schicken; sie kommt im Portal an.
   - Vom Portal an Gmail antworten; dort muss im Original „DKIM: PASS“ stehen.
   - Handy-Mail mit App-Passwort einrichten.
   - Anruf zwischen zwei Netzen, zum Beispiel Handy im Mobilnetz.

## 4. Abschalten (erst nach 1–2 Wochen ohne Probleme)

Mailcow, `matrix-synapse`, `matrix-element-web`, `matrix-proxy` und `matrix-livekit` entfernen. Die Volumes vorher sichern.

## Zurück zum alten Stand

Mailcow wieder starten und den MX-Eintrag zurückstellen. Die Daten im alten System wurden nie verändert.

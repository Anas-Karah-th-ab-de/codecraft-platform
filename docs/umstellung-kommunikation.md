# Umstellung: Mailcow, Matrix und LiveKit → eigener Server

Ziel: Mail, Chat und Anrufe laufen nur noch im `codecraft-server`. Kein Docker für Kommunikation mehr.
Jeder Schritt, der den Produktionsserver verändert, braucht vorher die Freigabe von Anas.

## 0. Vorher (nur lesen)

```bash
tools/legacy/mail-export.sh        # Mailcow-Postfächer → ~/prod-export/mail/*.pager
tools/legacy/matrix-export.sh      # Matrix-Verlauf als Archiv → ~/prod-export/matrix/
```

Der Matrix-Verlauf wird nicht in den neuen Chat übernommen: 42 Nachrichten, fast nur Testdaten. Er liegt als Archiv vor.

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

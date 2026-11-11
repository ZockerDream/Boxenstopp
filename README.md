# Boxenstopp

Werkstatt-Management für Roleplay-Server: Aufträge, Tuning-Konfigurator, Kunden- und Fahrzeugakten, Fahrzeug-Katalog mit Bildern, Fuhrpark, Preisliste und Lager, Finanzen mit Steuern, Lohn, Personal mit Schulungen, Lizenzen und Regelwerk, Rechte nach Rängen und Gruppen sowie User- und Server-Management. Eine Instanz = eine Firma. Selbst gehostet mit Docker Compose.

- Fachliches Konzept: [CONCEPT.md](CONCEPT.md)
- Technik und Umsetzungsstand: [TECHNICAL.md](TECHNICAL.md)
- Regeln für KI-Assistenten: [AGENTS.md](AGENTS.md)
- Klickbares Mockup (ohne Server): [mockup/index.html](mockup/index.html)

## Schnellstart

```bash
./scripts/gen-secrets.sh          # legt .env mit zufälligem DB-Passwort und ENCRYPTION_KEY an
nano .env                         # APP_PORT setzen (z. B. 9099)
docker compose up -d --build      # baut und startet db, api, worker
```

Danach `http://<server>:<APP_PORT>` öffnen. Bei leerer Datenbank führt die **Ersteinrichtung** durch: Firmenname, Kürzel für Nummern und das erste Konto (Inhaber und Administrator).

### Test-Instanz mit Demo-Daten

Statt der Ersteinrichtung lässt sich eine **leere** Instanz mit Beispieldaten füllen:

```bash
docker compose exec api node src/seed-demo.js
```

Eine Demo-Instanz aus 0.2.0 bekommt die neuen Demo-Daten (Katalog, Fuhrpark, Tuning-Pakete, Regelwerk) ohne Zurücksetzen mit `docker compose exec api node src/seed-demo-extras.js`.

Das legt die Firma „Rostfrei Garage“ mit elf Mitarbeitern, 20 Kunden, 30 Fahrzeugen, Preisliste, Lager, Aufträgen in jedem Status, Rechnungen, Buchungen, Steuerzeiträumen, Lohnläufen, Schulungen, Lizenzen und Schichten an. Alle Konten haben das Passwort `Boxenstopp2026!` (änderbar mit `DEMO_PASSWORD=…`):

| Konto | Rolle |
|---|---|
| `lena.brandt@rostfrei.rp` | Inhaberin, Administratorin |
| `marco.vogt@rostfrei.rp` | Werkstattleitung |
| `deniz.aydin@rostfrei.rp` | Meister |
| `tim.becker@rostfrei.rp` | Mechaniker (mit persönlicher Ausnahme) |
| `mia.schulz@rostfrei.rp` | Azubi (sieht nur eigene Aufträge) |
| `nora.weiss@rostfrei.rp` | Praktikantin |
| `kai.neumann@rostfrei.rp` | nur Support (Administration, kein Rang) |

## Betrieb

| Aufgabe | Befehl |
|---|---|
| Update | `git pull && docker compose up -d --build` (Migrationen laufen beim Start) |
| Logs | `docker compose logs -f api worker` |
| Backup sofort | Server-Management → System & Backups → „Backup jetzt“ (täglich 03:00 automatisch) |
| Backup holen | dort herunterladen oder `docker compose cp api:/backups ./backups` |
| Wiederherstellen | `docker compose exec -T db pg_restore --clean --if-exists -U "$DB_USER" -d "$DB_NAME" < datei.dump`, danach `docker compose restart api worker` |
| Ausgesperrt (IP-Allowlist) | `docker compose exec db psql -U "$DB_USER" -d "$DB_NAME" -c "UPDATE settings SET value = value || '{\"allowlist\":\"\"}' WHERE key='security'"` |
| Wartungsmodus aus | wie oben mit `'{\"maintenance\":false}'` |

Hinweise:

- `DB_USER`, `DB_PASSWORD` und `DB_NAME` werden nur beim ersten Start in ein leeres Volume übernommen.
- `ENCRYPTION_KEY` schützt 2FA-Geheimnisse und Webhook-URLs. Nach dem ersten Start nicht mehr ändern.
- Der Compose-Projektname `boxenstopp` bestimmt die Volumes. Nicht ändern.
- Hinter einem Reverse-Proxy `TRUST_PROXY=1` setzen. Bei HTTPS zusätzlich `SECURE_COOKIES=1`.

## Entwicklung und Tests

```bash
cd apps/api && npm install
for f in src/*.js src/routes/*.js; do node --check "$f"; done
for f in ../web/public/js/*.js; do node --input-type=module --check < "$f"; done
```

Ende-zu-Ende-Tests laufen gegen einen **Wegwerf-Stack**, nie gegen eine Instanz mit echten Daten:

```bash
cp .env /tmp/check.env && printf 'APP_PORT=18190\nIMAGE_TAG=check\nRATE_LIMIT_LOGIN=1000\n' >> /tmp/check.env
docker compose -p boxenstopp-check --env-file /tmp/check.env up -d --build --wait
docker compose -p boxenstopp-check --env-file /tmp/check.env exec -T api node src/seed-demo.js
BASE=http://localhost:18190 node tests/e2e/api.mjs                     # API-Abläufe, Rechte, Sicherheit
docker run --rm --network host -v "$PWD/tests/e2e":/work -w /work mcr.microsoft.com/playwright:v1.49.1-noble \
  sh -c 'npm i --silent --no-save playwright@1.49.1 && BASE=http://localhost:18190 node browser.mjs && BASE=http://localhost:18190 node crawl.mjs'
docker compose -p boxenstopp-check --env-file /tmp/check.env down -v
```

`crawl.mjs` ist nur lesend und darf auch gegen die Test-Instanz laufen.

## Versionen

- **0.3.0** (2026-11-11): anpassbares Dashboard, Fuhrpark, Tuning, Fahrzeug-Katalog mit Bildern, Regelwerk, interaktive Diagramme
- **0.2.0** (2026-11-11): erste lauffähige Version
- **0.1.0** (2026-11-11): klickbares Mockup

# Boxenstopp – Technische Sicht

Ergänzt [CONCEPT.md](CONCEPT.md). Stand: **Version 0.3.0** (2026-11-11). Abschnitt 0 beschreibt, was umgesetzt ist und wo die Umsetzung vom ursprünglichen Plan abweicht; die Abschnitte danach sind der Plan und gelten weiter als Ziel. Maßgeblich für das Schema ist [`apps/api/migrations/`](apps/api/migrations/).

Boxenstopp ist **eigenständig**: eigenes Repository, eigene Datenbank, eigene Benutzer, keine Abhängigkeit zu anderen Anwendungen. **Eine Instanz = eine Firma**; es gibt keine Mandanten-Spalte.

## 0. Umsetzungsstand 0.3.0

### Aufbau
| Teil | Datei | Inhalt |
|---|---|---|
| Einstieg | `apps/api/src/main.js` | Fastify, Security-Header (strikte CSP), Fehlerbehandlung (zod → 400 deutsch, 23505/23503 → 409, Trigger P0001 → 409), Sitzung/API-Schlüssel, Wartungsmodus, Admin-IP-Allowlist, Auslieferung von `apps/web/public` |
| Status | `routes/state.js` | `GET /api/state` liefert alles, was die Oberfläche braucht – **serverseitig nach Rechten gefiltert** (Stufe 1 „Eigene“, Finanzen, Administration). Die Oberfläche lädt nach jeder Änderung neu (und alle 60 s) |
| Stammdaten | `resources.js` | Generisches `POST/PATCH/DELETE /api/r/:name` mit zod-Schema, Rechte-Stufe je Ressource, Audit (Kunden, Fahrzeuge, Preisliste, Preisgruppen, Teile, Termine, Konten, Daueraufträge, Schulungen, Lizenzen, Personalakten, Brett, Gruppen, Klassen, Stellplätze) |
| Werkstatt | `routes/workshop.js` | Aufträge, Positionen (Klassenpreis, Preisgruppe, Rabattgrenze, Qualifikation, Teile-Reservierung), Rabattfreigaben, Statuswechsel (Teile-Entnahme, Tuning-Stand, Rechnung), Einsätze |
| Finanzen | `routes/finance.js`, `invoice.js`, `calc.js`, `pricing.js` | Zahlungen mit Steuer-Rücklage, Storno per Gegenrechnung (inkl. Erstattung), Buchungen, Umbuchungen, Tagesabschluss, Steuer-Abführung und Satz, Lohnlauf, Lager-Buchungen |
| Personal | `routes/staff.js` | Mitarbeiter (Rang-Hierarchie), Einladungen, Ränge, Rechte, Einzelrechte, Stempeluhr, Schulungen/Ergebnisse/Nachweise, Lizenzen, Brett, Firmen-Einstellungen, Tickets, öffentliche Preisliste |
| Administration | `routes/admin.js` | User-Management (Sperre, Ablauf, 2FA, Sitzungen, Reset-Link, Freigabe, Rollen), Systemrollen, Sicherheit, Jobs, Backups, Webhooks, CSV-Exporte |
| Jobs | `jobs.js`, `worker.js` | Eigener Zeitplan im Worker (Prüfung jede Minute, Läufe in `job_runs`): Daueraufträge, Erinnerungen, Mindestbestand, offene Schichten, Steuer fällig, Backup, Aufräumen |
| Demo-Daten | `seed-demo.js` | Nur auf leerer Datenbank; Daten relativ zum heutigen Datum |
| Oberfläche | `apps/web/public/js/` | `store.js` (API-Client, Daten), `app.js` (Router, Formulare, Ereignisse), `pages-*.js` (Seiten und Aktionen), `look.js` (Darstellung, Logo), `ui.js` (Bausteine, SVG-Diagramme) |

### Neu in 0.3.0 (Migration 002)
| Teil | Umsetzung |
|---|---|
| Tabellen | `vehicle_models`, `images` (bytea, damit Bilder im Backup sind), `fleet_vehicles`, `fleet_log`, `tuning_packages`, `rule_docs`, `rule_doc_versions`, `rule_acks`; `vehicles.model_id`, `callouts.fleet_id`, Buchungsquelle `fleet` |
| Rechte | neue Funktionen `fleet`, `models`, `tuning`, `rules`; bestehende Ränge/Gruppen übernehmen die Stufe von `vehicles` bzw. `catalog`, `rules` = Lesen (Leitung: Verwalten) |
| Routen | `routes/extras.js`: `/api/images` (Upload als data-URL, Magic-Byte-Prüfung, ≤ 3 MB, kein SVG; Auslieferung nur angemeldet mit `CSP: sandbox`), `/api/fleet/:id/checkout|checkin|entry`, `/api/tuning/order`, `/api/rules` (Fassungen, `/ack`, `/versions`, `/move`); Stammdaten über `/api/r/fleet`, `/api/r/models`, `/api/r/tuningPackages` |
| Status | `routes/state.js` liefert zusätzlich `models`, `images` (ohne Daten), `fleet`, `fleetLog`, `tuningPackages`, `ruleDocs`, `myAcks`, `ruleAcks`, `revenue90`, `weekly26` |
| Dashboard | Layout in `users.ui.dashboard` (`order`, `hidden`, `spans`); Module in `DASH` (`pages-werkstatt.js`) |
| Diagramme | `ui.js`: `data-tip` (Tooltip in `app.js`), `data-href` (Klick), Legende `chart-toggle`, Zeitraum `chart-range`; Zustand in `BX.state.chartHidden/chartRange` |
| Markdown | `U.mdBlock()` – erst escapen, dann Überschriften, Listen, Zitat, Tabelle, fett/kursiv, http(s)-Links |
| Demo | `seed-extras.js` (gezeichnete SVG-Fahrzeuge – nur der Seed darf SVG speichern), `seed-demo-extras.js` ergänzt bestehende 0.2.0-Demo-Instanzen |
| Jobs | `reminders.daily` meldet fälligen Fuhrpark-Service und ablaufende Versicherungen |

### Bewusste Abweichungen vom Plan
| Plan | Umsetzung | Grund |
|---|---|---|
| Argon2id | `scrypt` (N=16384) aus Node-Crypto | keine native Abhängigkeit im Alpine-Image |
| JWT + Refresh-Token | zufälliges Sitzungstoken im httpOnly-Cookie, in der DB nur als SHA-256; gleitende Laufzeit | einfacher, sofort widerrufbar (Sperren, Sitzungen beenden) |
| `pg-boss` | eigener Minuten-Takt im Worker mit `job_runs` | sieben einfache Zeitjobs, keine Queue nötig |
| `otplib` | eigene TOTP-Umsetzung (RFC 6238) in `lib.js` | otplib 13 hat eine neue API; 30 Zeilen Code |
| Seiten per `import()`, Assets unter `/assets/<Hash>/` | klassische Skripte, `Cache-Control: no-cache` mit ETag | gleicher Code wie das freigegebene Mockup; kein Build |
| `pdfkit` / PNG-Export | Druckansicht im Browser („Drucken / PDF“) | Rechnung, Preisliste, Steuerbericht als druckfertige Seite |
| Logo als Datei | Logo als `data:`-URL in `settings.logo` (≤ 512 KB, kein SVG) | kein Upload-Volume nötig; SVG wegen Skript-Risiko ausgeschlossen |
| Darstellung in eigenen Spalten | `users.ui.look` (jsonb) | eine Stelle für alle Darstellungs-Einstellungen |
| `tax_rates`/`tax_periods` mit Status | Zeiträume werden berechnet; nur abgeführte stehen in `tax_periods` (unveränderlich per Trigger) | nichts zu pflegen, Satzwechsel je Tag genau |

### Unveränderlichkeit (Trigger in der DB)
`invoices` (Betrag, Snapshot, Nummer, Datum; Löschen), `invoice_payments`, `tax_periods`, `payroll_runs`. Die API prüft zusätzlich gesperrte Aufträge, abgeschlossene Kassentage und abgeführte Zeiträume.

### Noch nicht umgesetzt (geplant)
Test im Tool für Schulungen, E-Mail-Versand (SMTP), Dokumente/Bilder an Kunden, Fahrzeugen und Aufträgen, Kunden zusammenführen, CSV-Import der Preisliste, Rechnung als Bild, eigene Inventur-Protokolle (Inventur ist derzeit eine Korrekturbuchung je Teil), Preisstände mit Gültig-ab-Datum für einzelne Leistungen, Benachrichtigungs-Einstellungen je Ereignis, Unit-Tests (`node --test`).

### Tests
`tests/e2e/api.mjs` (110 Prüfungen: Abläufe, Rechte, Unveränderlichkeit, 2FA, Sperre, Einladung, Backups, CSV, API-Schlüssel, Fuhrpark, Bilder, Tuning, Regelwerk, Dashboard-Layout), `tests/e2e/browser.mjs` (75 Prüfungen: geführte Abläufe, Dashboard anpassen, Diagramm-Interaktion, Fuhrpark, Galerie, Tuning, Regelwerk-Bestätigung, Rechte in der Navigation, 390/768/1024 px ohne Überlauf), `tests/e2e/crawl.mjs` (jede Seite und jeder Tab in vier Rollen, nur lesend, 447 Aufrufe). Ablauf: README.

## 1. Stack

| Schicht | Wahl | Anmerkung |
|---|---|---|
| Datenbank | PostgreSQL 16 | `numeric(14,2)` für Geld, `numeric(5,2)` für Prozent, CHECK-Constraints, `citext` |
| Backend | Node.js 22, Fastify 5, reines ESM-JavaScript | `zod` 4, handgeschriebenes SQL über `pg`, kein ORM |
| Migrationen | Nummerierte SQL-Dateien `NNN_name.sql` | Laufen beim API-Start, je Datei eine Transaktion, Advisory-Lock |
| Jobs | `pg-boss` im Service `worker` | Erinnerungen, Daueraufträge, Ablauf-Prüfungen, Webhooks, Backups |
| Frontend | Vanilla-JS-Module ohne Build und Framework | Statisch aus `apps/web/public`, Hash-Router, Seiten per `import()`, versioniert unter `/assets/<Hash>/` |
| Auth | E-Mail + Passwort (Argon2id), kurzes JWT + rotierendes Refresh-Token (httpOnly-Cookie), TOTP-2FA | Kein OAuth/Discord-Login |
| PDF / Bild | `pdfkit` für Rechnung, Preisliste, Steuerbericht; PNG-Export im Browser per Canvas aus derselben Vorlage | |
| Sonstiges | `nodemailer` (optional), `otplib`, `qrcode` | |
| Tests | `node --test` (Unit), Playwright im Container (E2E) | |

## 2. Repository-Struktur

```
Boxenstopp/
├── docker-compose.yml, .env.example
├── AGENTS.md, CLAUDE.md, CONCEPT.md, TECHNICAL.md, README.md
├── scripts/                     # gen-secrets.sh, update.sh
├── mockup/                      # statisches HTML-Mockup (nächster Schritt)
├── tests/e2e/                   # api.mjs, browser.mjs, crawl.mjs
└── apps/
    ├── api/
    │   ├── Dockerfile, package.json, migrations/, test/
    │   └── src/
    │       ├── main.js, worker.js, jobs.js, config.js, db.js, setup.js, settings.js
    │       ├── security.js, audit.js, mail.js, validation.js, uploads.js, notify.js
    │       ├── authz.js           # Rechte: level(), flag(), visibleSql(), assertLevel(), assertWithin()
    │       ├── numbering.js       # lückenlose Nummernkreise
    │       ├── pricing.js         # Klassenpreis, Preisgruppe, Rabatt, Steuer, Summen – rein, testbar
    │       ├── tax.js             # Steuerzeitraum, Zahllast, Rücklage – rein, testbar
    │       ├── payroll.js         # Lohn/Provision planen – rein, testbar
    │       ├── qualification.js   # Nachweise prüfen – rein, testbar
    │       └── routes/            # auth me setup staff ranks groups permissions customers vehicles
    │                              # orders catalog price-groups stock invoices accounts transactions
    │                              # tax payroll shifts trainings licenses staff-files board
    │                              # appointments callouts reports search public settings
    │                              # admin-users admin-roles admin-server admin-integrations tickets
    └── web/public/
        ├── index.html, favicon.svg, css/
        └── js/ app.js api.js ui.js charts.js calendar.js markdown.js
            └── pages/             # eine Datei je Seite
```

## 3. Deployment

- Docker Compose: `api` (SPA + REST am selben Ursprung, einziger veröffentlichter Port), `worker` (gleiches Image, kein Port), `db` (nur internes Netz).
- Compose-Projektname fest `boxenstopp` (bestimmt die Volumes – **nie ändern**).
- Port-Vorschlag **8090**.
- Container `read_only`, `cap_drop: ALL`, `no-new-privileges`, Healthchecks; Volumes `db_data`, `uploads`, `backups`.
- `TRUST_PROXY` für Betrieb hinter einem Reverse-Proxy (nicht mitgeliefert).
- Update: `git pull && docker compose up -d --build`; Migrationen laufen beim Start.
- Erster Start ohne Inhaber → Setup-Assistent unter `/#/setup`, gesperrt sobald ein Inhaber existiert.

## 4. Datenmodell

Konventionen: UUID-Primärschlüssel, Geld `numeric(14,2)`, Zeitpunkte `timestamptz`, Kalendertage `date`, `created_at/updated_at` überall, Archivieren statt Löschen wo fachlich nötig (`archived_at`).

### 4.1 Benutzer, Ränge, Gruppen, Rechte
```
users(id, email citext unique, password_hash, name, staff_no, duty_no, phone, joined_on, left_on,
      status[active|leave|locked|left|invited|pending], is_owner, rank_id, pay_model jsonb,
      totp_secret_enc, totp_enabled, force_2fa, expires_at, failed_logins, locked_until, last_login_at,
      ui_mode[system|light|dark] default dark, ui_accent default 'amber', ui_version[v1|v2] default v1,
      ui_prefs jsonb,                 -- V2: background_key, blur, glass, dim, mobile_blur
      background_key null, background_updated_at)   -- eigenes Hintergrundbild im Upload-Volume, nur für den Benutzer selbst
sessions(id, user_id, refresh_hash, ip, user_agent, created_at, last_seen_at, revoked_at)
recovery_codes, password_resets, invitations(id, email, rank_id, system_role_id, token_hash, expires_at, used_at, created_by)
system_roles(id, name, description, is_fixed, is_default)       -- fest: Administrator, Benutzer
system_permissions(key)                                          -- user:read|create|update|lock|delete, role:manage,
                                                                 -- server:read|settings, backup:manage, integration:manage,
                                                                 -- audit:read, ticket:manage
system_role_permissions(role_id, permission_key), user_system_roles(user_id, role_id)
api_keys(id, user_id, name, key_hash, prefix, last_used_at, revoked_at)
tickets(id, title, body_md, page, screenshot_key, status[open|in_progress|done|rejected], reporter_id, created_at)
ticket_comments(id, ticket_id, author_id, body_md, at)
job_runs(id, job, started_at, finished_at, status[ok|error], message)
backups(id, file_key, size, encrypted, created_by null, created_at)
ranks(id, name, position, default_pay jsonb)               -- unique(position) deferrable, höher = höher
groups(id, name, description), group_members(group_id, user_id)
permissions(id, rank_id | group_id | user_id, module, level smallint 0..4)   -- CHECK: genau eins gesetzt
permission_flags(id, rank_id | group_id | user_id, flag, value numeric)
rank_requirements(rank_id, training_id | license_type_id)
rank_history(id, user_id, from_rank_id, to_rank_id, by_user_id, reason, at)
settings(key, value jsonb)          -- Firmenstammdaten, Kürzel, Logo (firm.logo = {kind: preset|image, preset, file_key}),
                                    -- Steuer-Optionen, Funktionsschalter. Der App-Name „Boxenstopp“ ist fest im Code.
audit_log(id, user_id, action, entity, entity_id, diff jsonb, ip, at)
notifications(id, user_id, kind, title, link, read_at, created_at)
```
**Rechte-Auflösung als SQL-Funktion** `user_level(user, module) → smallint`: Inhaber → 4; ausgeschieden/gesperrt → 0; persönlicher Eintrag → dieser; sonst `max(Rang, Gruppen)`. Ebenso `user_flag(user, flag)`. In JS ausschließlich über `authz.js`.

**Systemrechte** (Administration) getrennt davon: `hasSystem(user, 'user:lock')` aus den Systemrollen; Administrator hat immer alle Systemrechte. Werkstatt-Routen prüfen nie Systemrechte, Admin-Routen nie Werkstatt-Stufen.

### 4.2 Kunden und Fahrzeuge
```
customers(id, name, kind[person|company|authority], phone, price_group_id, payment_terms_days, tax_exempt,
          warning, blocked_reason, tags text[], archived_at, merged_into_id)
customer_entries(id, customer_id, author_id, at, body_md)
customer_files(id, customer_id, storage_key, mime, caption)
vehicle_classes(id, name, position)
vehicles(id, plate, make, model, class_id, color, vin, mileage, owner_customer_id,
         status[active|scrapped|stolen])          -- unique(upper(plate)) where status <> 'scrapped'
vehicle_owner_history(id, vehicle_id, customer_id, from_at, to_at)
vehicle_plate_history(id, vehicle_id, old_plate, new_plate, at, by_user_id)
vehicle_tuning(vehicle_id, category, level, catalog_item_id, order_id, updated_at)   -- PK(vehicle_id, category)
vehicle_images(id, vehicle_id, storage_key, caption)
```

### 4.3 Preisliste und Lager
```
tax_rates(id, percent, valid_from)                       -- ein Firmensatz, Historie über valid_from
catalog_categories(id, name, position)
catalog_items(id, category_id, name, description, price_kind[flat|labor|part|bundle], unit,
              material_cost, std_minutes, warranty_days, group_id, tuning_category, tuning_level,
              part_id null, active, internal_note)       -- part_id bei price_kind = part
catalog_prices(id, item_id, class_id null, mode[fixed|surcharge_percent], value, valid_from)
                                                         -- class_id null = Einheitspreis; Historie über valid_from
catalog_item_parts(item_id, part_id, qty)                 -- Teile für flat (nur Bestand) und bundle
catalog_item_requirements(item_id, training_id | license_type_id)
price_groups(id, name, discount_percent, is_default)
price_group_categories(price_group_id, category_id, discount_percent)
parts(id, sku, name, unit, stock numeric, reserved numeric, min_stock, location, purchase_price, sale_price, active)
stock_movements(id, part_id, qty, kind[in|out|reserve|release|adjust|inventory], order_item_id, reason,
                purchase_transaction_id, by_user_id, at)
inventories(id, started_at, finished_at, by_user_id), inventory_lines(inventory_id, part_id, expected, counted)
```
**Preisermittlung** (nur `pricing.js`): gültiger Preis zum Stichtag → Klassenpreis oder Einheitspreis + Aufschlag → Preisgruppen-Rabatt (Kategorie vor pauschal) → manueller Rabatt (gegen `rabatt.max_prozent`) → Positionspreis. Alle Preise sind **Festpreise** (Endpreis für den Kunden); es gibt kein netto/brutto und keine Steuer auf Positions- oder Rechnungsebene. Steuer entsteht erst im Steuerzeitraum aus dem Umsatz (`tax.js`).

### 4.4 Aufträge, Einsätze, Termine
```
bays(id, name, active)
orders(id, number, customer_id, vehicle_id, class_id, price_group_id,
       status[quote|accepted|in_progress|waiting_parts|done|invoiced|picked_up|rejected|cancelled],
       mileage_in, condition jsonb, customer_request, due_at, bay_id, quote_approved_at,
       checked_by_id, cancel_reason, created_by)
order_assignees(order_id, user_id)
order_items(id, order_id, catalog_item_id null, name, price_kind, qty, unit_price, discount_percent,
            discount_approved_by, performed_by_id, line_total)              -- eingefrorener Stand
order_events(id, order_id, kind, from_status, to_status, by_user_id, note, at)
order_images(id, order_id, storage_key, caption)
discount_requests(id, order_item_id, requested_by, percent, status[open|approved|rejected], decided_by, at)
callouts(id, number, location, customer_id, vehicle_id, driver_id, status[open|en_route|on_site|done|cancelled],
         order_id, invoice_id, at)
appointments(id, customer_id, vehicle_id, bay_id, starts_at, ends_at, note, order_id)
```

### 4.5 Finanzen und Steuern
```
accounts(id, name, kind[bank|cash|tax_reserve|other], archived)
transactions(id, account_id, type[income|expense|transfer_in|transfer_out], amount, taxable boolean,
             booked_at, category, note, source[manual|invoice|payroll|stock|recurring|tax|closing|reserve],
             source_id, created_by, closing_id, tax_period_id)
recurring_rules(id, account_id, type, amount, taxable, category, frequency, interval, next_run, active)
number_sequences(kind, year, last_value)              -- PK(kind, year), SELECT … FOR UPDATE
invoices(id, number, order_id | callout_id | null, customer_id, issued_at, due_at,
         subtotal, discount, total, paid, status[open|partial|paid|overdue|cancelled], cancels_invoice_id,
         snapshot jsonb)                              -- Firma, Kunde, Positionen, Preise bei Ausstellung
invoice_payments(id, invoice_id, amount, method[cash|card|transfer], account_id, transaction_id,
                 reserve_transaction_id, at, by_user_id)   -- Zahlungen sind immer steuerpflichtig
tax_periods(id, period_start, period_end, rate, taxable_revenue, tax_due,
            status[open|filed], filed_at, filed_by, transaction_id)
cash_closings(id, account_id, day, expected, counted, difference, reason, by_user_id, at)
payroll_runs(id, period_start, period_end, status[draft|approved], approved_by, approved_at)
payroll_lines(id, run_id, user_id, hours, hourly_amount, commission_base, commission_amount, fixed_amount,
              adjustment, adjustment_reason, total, transaction_id)
```

### 4.6 Personal
```
shifts(id, user_id, started_at, ended_at, source[clock|manual], edited_by, reason)  -- partieller Unique: ein offener je User
absences(id, user_id, kind[vacation|sick|inactive], from_day, to_day, note)
staff_entries(id, user_id, kind[note|warning|praise|talk], level, expires_on, body_md, author_id, visible_to_self, at)
trainings(id, name, description_md, validity_months, active, exam jsonb null)
training_pages(id, training_id, title, body_md, position)
training_sessions(id, training_id, starts_at, location, trainer_id)
training_participants(id, session_id, user_id, result[registered|passed|failed|no_show], completed_on)
training_certificates(id, training_id, user_id, valid_from, valid_until, source[session|exam|manual])
exam_attempts(id, training_id, user_id, started_at, submitted_at, order jsonb, answers jsonb, score, passed, reset_at)
license_types(id, name, holder[member|firm], default_validity_months)
licenses(id, license_type_id, user_id null, number, issuer, issued_on, expires_on,
         status[valid|suspended|revoked], reason, scan_key)          -- user_id null = Firmenlizenz
board_posts(id, title, body_md, pinned, audience jsonb, author_id, at), board_reads(post_id, user_id, at)
webhooks(id, url_enc, events text[], active, last_status, last_at)
```

## 5. API

REST unter `/api`, JSON, Fehler als `{ error, message }` auf Deutsch.

| Bereich | Wichtige Routen |
|---|---|
| Setup/Auth | `GET/POST /setup` (nur ohne Inhaber), `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/2fa/*`, `/auth/invite/:token` |
| Personal-Verwaltung | `/staff`, `/ranks` (`PATCH /ranks/order`), `/groups`, `/permissions`, `/permission-flags`, `GET /permissions/explain/:userId` |
| Kunden/Fahrzeuge | `/customers`, `POST /customers/:id/merge`, `/vehicles`, `GET /vehicles/by-plate/:plate`, `/vehicles/:id/history`, `/vehicle-classes` |
| Preisliste | `/catalog/categories`, `/catalog/items`, `/catalog/items/:id/prices`, `/price-groups`, `/tax-rates`, `POST /catalog/import?dry=1`, `GET /catalog/export.csv`, `GET /catalog/pricelist.pdf`, `GET /public/pricelist` (ohne Login, nur wenn eingeschaltet) |
| Lager | `/parts`, `/stock-movements`, `/inventories` |
| Aufträge | `/orders`, `POST /orders/:id/status`, `/orders/:id/items`, `/discount-requests`, `POST /orders/:id/invoice`, `/callouts`, `/appointments`, `/bays` |
| Finanzen | `/accounts`, `/transactions`, `/recurring`, `/invoices`, `/invoices/:id/payments`, `POST /invoices/:id/cancel`, `GET /invoices/:id.pdf`, `/closings`, `/payroll-runs` |
| Steuern | `GET /tax/periods`, `GET /tax/periods/:id`, `POST /tax/periods/:id/file`, `GET /tax/periods/:id.pdf` |
| Personal | `POST /shifts/clock-in`, `/shifts/clock-out`, `/shifts`, `/absences`, `/activity`, `/staff-entries`, `/trainings`, `/licenses`, `/qualifications` |
| User-Management | `/admin/users` (inkl. `POST …/:id/lock`, `/unlock`, `/reset-2fa`, `/force-2fa`, `/reset-link`, `/revoke-sessions`, `/approve`), `GET /admin/users.csv`, `/admin/roles`, `/admin/invitations` |
| Server-Management | `GET /admin/overview`, `GET/PATCH /admin/settings`, `POST /admin/settings/smtp-test`, `/admin/jobs` (`POST …/:job/run`), `/admin/backups` (erstellen, Download, löschen), `GET /admin/env`, `/admin/webhooks` (`POST …/:id/test`), `/admin/api-keys`, `GET /admin/audit`, `GET /admin/audit.csv` |
| Tickets | `/tickets` (eigene), `/admin/tickets`, `/tickets/:id/comments` |
| Sonstiges | `/search?q=`, `/board`, `/reports/*`, `/notifications`, `/settings` (Firma), `/me/api-keys`, `/me/sessions`, `/ical/:token` |

## 6. Kernregeln (serverseitig erzwungen)

- **Rechte nur über `authz.js`** bzw. `user_level()`; Stufe 1 „Eigene“ über `visibleSql(alias, module)` mit je Tabelle definiertem Eigentümerfeld (`created_by`, `performed_by_id`, `user_id`).
- **Niemand vergibt mehr, als er hat** (`assertWithin`); Nicht-Inhaber nur unter dem eigenen Rang; letzter Inhaber geschützt.
- **Letzter Administrator** geschützt (`lastAdminGuard`): Sperren, Befristen, Rolle entziehen, Löschen → 409. Neue Felder, die Zugang entziehen können, dort mit absichern.
- **Zugangsablauf:** `expires_at` gilt bis einschließlich zum Tag (Zeitzone der Instanz); Prüfung bei Login und bei jedem Refresh.
- **Wartungsmodus:** Middleware lässt nur Benutzer mit Systemrolle Administrator durch, alle anderen bekommen 503 mit Hinweistext; Login-Seite zeigt den Text.
- **Admin-IP-Allowlist:** gilt für `/admin/*`; Speichern nur, wenn die aktuelle IP enthalten ist. Notausgang: `DELETE FROM settings WHERE key='security.admin_ip_allowlist'` (README).
- **Nummernkreise lückenlos** (`numbering.js`, Zeilensperre in derselben Transaktion).
- **Geld in Cent (BigInt)** in `pricing.js`/`tax.js`; `numeric` kommt als String aus `pg`, nie als Float rechnen. Rundung kaufmännisch je Position.
- **Steuer** (nur `tax.js`): `tax_due = round(rate × taxable_revenue)`; `taxable_revenue` = Summe der Rechnungszahlungen im Zeitraum minus Storno-Rückzahlungen plus als steuerpflichtig markierte manuelle Einnahmen. Gilt der Satz nur für einen Teil des Zeitraums (neuer `valid_from`), wird je Tag mit dem gültigen Satz gerechnet. Keine Vorsteuer, keine weiteren Abgaben.
- **Unveränderlich** (Route **und** DB-Trigger): abgerechnete Aufträge, ausgestellte Rechnungen (nur Storno), freigegebene Lohnläufe, abgeschlossene Kassentage, abgeführte Steuerzeiträume.
- **Rechnungs-Snapshot:** Rechnungen werden nur aus `snapshot` gerendert.
- **Lager:** Bestand nie direkt setzen, nur über `stock_movements`; `stock` und `reserved` werden in derselben Transaktion fortgeschrieben; Bestand darf negativ werden nur mit Einstellung „negativer Bestand erlaubt“.
- **Qualifikationsprüfung** beim Setzen von `performed_by_id` über `qualification.js`; Modus „hart“ → 409, „weich“ → Warnung im Response.
- **Funktionsschalter** (`settings.features`): ausgeschaltete Funktionen → 403 `disabled`, Daten bleiben erhalten.
- **Öffentliche Preisliste** liefert nur aktive Leistungen ohne Einkaufspreis, Marge, interne Notiz.
- **Audit:** jede schreibende Route ruft `audit()`; Diff ohne Secrets.
- **Darstellung:** Modus, Farbthema und Design stehen als Attribute an `<html>` (`data-theme`, `data-accent`, `data-ui`) und als CSS-Variablen (`--blur`, `--glass`, `--dim`). Alles Aussehen von V2 nur unter `[data-ui="v2"]`; neue Flächen nutzen `var(--surface)`/`var(--surface-2)`/`var(--border)`, dann werden sie in V2 automatisch Glas. Akzentfarben je Theme als Paar `--accent-d`/`--accent-l`. Hintergrundbilder nur als `data:`-URL oder aus `/api/me/background` anzeigen (CSP ohne `blob:`). Logo-Upload: PNG/JPEG/WebP/SVG ≤ 512 KB, SVG wird serverseitig bereinigt (keine Skripte), Ausgabe mit `Content-Type` und `X-Content-Type-Options: nosniff`.

## 7. Jobs (Worker)

| Job | Rhythmus | Aufgabe |
|---|---|---|
| `reminders.daily` | täglich 06:00 | Ablauf von Nachweisen/Lizenzen (30 Tage vorher, bei Ablauf), überfällige Rechnungen, Garantien |
| `recurring.run` | stündlich | Daueraufträge buchen |
| `tax.period` | täglich | Steuerzeitraum abschließen (Status bleibt `open` bis Abführung), Erinnerung |
| `stock.check` | nach Bewegung + täglich | Mindestbestand |
| `activity.weekly` | Montag 04:00 | Aktivitätsübersicht der Vorwoche, Meldung an Leitung |
| `shifts.stale` | stündlich | Offene Schichten > 12 h melden |
| `webhooks.deliver` | Queue | Discord-Webhooks mit Retry und Backoff |
| `backup.daily` | täglich 03:00 | `pg_dump`, verschlüsselt, Aufbewahrung |

## 8. Sicherheit

Strikte CSP (kein Inline-JS, keine `on*`-Attribute), Security-Header, Rate-Limits an Login, 2FA, Reset, Einladung und Setup, Argon2id, Refresh-Rotation mit Wiederverwendungserkennung, Uploads nur PNG/JPEG/PDF mit Magic-Byte-Prüfung und Größenlimit, Webhook-URLs verschlüsselt (`ENCRYPTION_KEY`), Setup-Route nach Einrichtung dauerhaft gesperrt.

## 9. Tests

| Stufe | Prüft |
|---|---|
| `npm test` | `pricing.js` (Klassenpreise, Preisgruppen, Rabatte, Rundung), `tax.js` (Satzwechsel im Zeitraum, Stornos), `payroll.js`, `qualification.js`, Rechte-Auflösung, Frontend-Syntax |
| `api.mjs` | Alle Routen, alle Stufen 0–4 je Funktion, Unveränderlichkeit, Nummernkreise unter Parallelität, Lagerbestand unter Parallelität, Funktionsschalter |
| `browser.mjs` | Annahme → Auftrag → Rechnung → Zahlung → Steuer-Rücklage; Handy-Breite 390 px; Konsole fehlerfrei |
| `crawl.mjs` | Jede Seite als Praktikant, Mechaniker, Buchhaltung, Inhaber, Administrator ohne Rang |
| `auth.mjs` | Refresh-Rotation, 2FA, Recovery-Codes, Sperre nach Fehlversuchen, Zugangsablauf, Wartungsmodus, letzter Administrator |

Getestet wird auf einem Wegwerf-Stack (Projektname `boxenstopp-check`), nie auf einer Instanz mit echten Daten.

# Boxenstopp – Anleitung für KI-Assistenten

Diese Datei gilt für jede KI, die an diesem Projekt arbeitet (`CLAUDE.md` verweist nur hierher). Sie ist die maßgebliche Quelle für Arbeitsweise, Regeln und Stand; halte sie bei jeder Änderung aktuell.

## Stand

- **2026-11-11:** Planung. Konzept ([CONCEPT.md](CONCEPT.md)) und technische Vorgaben ([TECHNICAL.md](TECHNICAL.md)) angelegt und nach Rückmeldung des Auftraggebers überarbeitet. Noch kein Code, kein Git-Repository.
- **Entscheidungen des Auftraggebers vom 2026-11-11:** Name Boxenstopp; eine Firma pro Instanz; kein Discord-Login; komplett eigenständig (das RP-Management-Board war nur Inspiration, keine Verbindung, kein gemeinsamer Code); Steuern ja; Lager und Pauschalpreise beide möglich; Preisliste als eigener Bereich; alle Zusatzvorschläge im Umfang.
- **Antworten des Auftraggebers vom 2026-11-11:** keine Vorsteuer, Gewinnsteuer oder Gewerbeabgabe; **nur Festpreise** (kein netto/brutto, Steuer = Firmensatz × Umsatz im Steuerzeitraum, nicht auf der Rechnung ausgewiesen); keine Mindeststunden bei der Aktivität.
- **Wunsch des Auftraggebers vom 2026-11-11:** User-Management und Server-Management wie beim RP-Management-Board (CONCEPT.md, Abschnitt 12). Systemrollen (Administration) sind getrennt von Rängen/Gruppen (Werkstatt).
- **2026-11-11:** Klickbares Mockup unter `mockup/` erstellt (`index.html` per Doppelklick, ohne Server). Alle 86 Ansichten in vier Rollen in Chromium ohne JS-Fehler geprüft, dazu Handy-Breite 390 px. Rückmeldung am selben Tag eingearbeitet: volle Breite, Handy- und Tablet-Tauglichkeit (390/768/1024 px geprüft), anpassbares Logo bei festem Namen „Boxenstopp“, Darstellung je Mitarbeiter (Modus System/Hell/Dunkel, 8 Farbthemes, Design V1 und V2 „Glass“ mit Hintergrund und Reglern; CONCEPT.md, Abschnitt 13). **Wartet auf Freigabe durch den Auftraggeber.** Danach Phase 1 (CONCEPT.md, Abschnitt 14).
- **2026-11-11, Version 0.2.0:** Auf Anweisung des Auftraggebers („Bau dem schitt“) die erste lauffähige Version gebaut: Backend, Oberfläche (aus dem Mockup), Worker, Demo-Daten. **Test-Instanz läuft auf Port 9099** (Compose-Projekt `boxenstopp`, Demo-Daten, Passwort `Boxenstopp2026!`). Git-Repository neu angelegt (Branch `main`, noch ohne Remote). Umsetzungsstand, Abweichungen vom Plan und offene Punkte: TECHNICAL.md, Abschnitt 0.
- **Nächster Schritt:** Rückmeldung des Auftraggebers zur Test-Instanz; danach die offenen Punkte aus TECHNICAL.md, Abschnitt 0.
- Offene Fragen: CONCEPT.md, Abschnitt 15. Antworten dort und hier mit Datum eintragen.

## Fallstricke (alle schon einmal aufgetreten)

- **`@fastify/static` v10:** `setHeaders` bekommt kein Node-Response-Objekt; Cache-Header werden im `onSend`-Hook gesetzt (`main.js`). Sonst liefert `/` einen 500er.
- **Parametertypen in SQL:** Wird derselbe Parameter in Zuweisung und Vergleich benutzt (`failed_logins = $2 … WHEN $2 >= $3`), scheitert PostgreSQL mit „inconsistent types deduced“. Immer casten (`$2::int`). So lieferte ein falsches Passwort einen 500er statt der Login-Sperre.
- **Strikte CSP** (`script-src 'self'`): kein Inline-JS, keine `on*`-Attribute. Auch Playwrights `waitForFunction` scheitert daran – in Tests per `page.url()` warten.
- **Rate-Limit Login** (10/Minute je IP, `RATE_LIMIT_LOGIN`): Tests auf dem Wegwerf-Stack setzen es hoch, sonst antwortet der Login mit 429.
- **Daten neu laden:** Die Oberfläche hält alles in `BX.data` und lädt nach jeder Änderung `/api/state` neu (`BX.call`, `BX.form`). Neue Daten für die Oberfläche gehören in `routes/state.js` – dort auch nach Rechten filtern, nie nur in der Oberfläche ausblenden.
- **Aktionsnamen** liegen alle in `BX.actions`; gleiche Namen in zwei Seitendateien überschreiben sich (`register` war doppelt).
- **Demo-Daten** nur auf leerer Datenbank (`seed-demo.js` bricht sonst ab). Neu aufsetzen: `docker compose down -v` löscht die Daten der Instanz.

## Einstieg in eine neue Sitzung

1. Diese Datei ganz lesen, danach CONCEPT.md und TECHNICAL.md.
2. Falls ein Git-Repository existiert: `git status -sb`, `git log --oneline -5`, `git branch -a`.
3. Laufende Container prüfen (`docker ps`), bevor du etwas startest oder testest. Auf demselben Host laufen andere Anwendungen (Port 8088, 9443) – nicht anfassen.
4. Vor Abschluss einer Änderung: Tests laufen lassen und Doku mitpflegen. Ergebnisse ehrlich berichten, auch Fehlschläge und Ungetestetes.

## Arbeitsweise

- Mit dem Auftraggeber **auf Deutsch** kommunizieren. UI, Fehlermeldungen, Hilfe und Doku deutsch, echte Umlaute, Du-Form in der Oberfläche.
- Wünsche des Auftraggebers mit Datum in CONCEPT.md festhalten („Wunsch des Auftraggebers vom …“).
- Bei Funktionsänderungen immer mitpflegen: CONCEPT.md, TECHNICAL.md, README.md (sobald vorhanden), Changelog, Hilfe-Seite und diese Datei.
- Commit und Push nur auf Anweisung. Hauptbranch `main`, größere Arbeit auf `feature/*`.
- `.env` enthält Secrets und wird nie committet; Änderungen nur in `.env.example` mit Platzhaltern.
- Im Zweifel nachfragen statt erfinden – besonders bei Geld, Steuern, Rechten und Löschregeln.

## Eigenständigkeit

Boxenstopp ist ein komplett eigenes Produkt. **Keine** Imports, Verweise, gemeinsamen Datenbanken, Benutzer oder Schnittstellen zu anderen Anwendungen auf dem Host (insbesondere nicht zum RP-Management-Board unter `/opt/docker/RP-Management-Board`). Das Board darf als Ideenquelle gelesen werden, dort wird nichts geändert, und Code wird nicht kopiert, sondern hier eigenständig geschrieben.

## Stack (verbindlich)

Node 22, Fastify 5, reines ESM-JavaScript, `zod` 4, `pg` mit handgeschriebenem SQL, `pg-boss`, PostgreSQL 16. Frontend ohne Build und ohne Framework (Vanilla-JS-Module). **Keine neuen Frameworks, ORMs, TypeScript oder Build-Schritte** ohne ausdrückliche Zustimmung. Kein OAuth-Login.

## Fachbegriffe

- **Eine Instanz = eine Firma.** Es gibt keine `firm_id`/`tenant_id`; Firmenstammdaten stehen in `settings`. Nicht nachträglich Mandantenfähigkeit einbauen.
- **Konto** = Geldbereich mit Kontostand (`accounts`). Es gibt kein „Budget“.
- **Kunde** hat keinen Login; **Mitarbeiter** ist ein Benutzer (`users`).
- **Auftrag** (`orders`) ≠ **Einsatz** (`callouts`) ≠ **Termin** (`appointments`).
- **Preisliste** = Katalog (`catalog_*`). Preisart `flat` (Pauschal), `labor` (Arbeit), `part` (Teil), `bundle` (Set).
- **Preisgruppe** (`price_groups`) = Kundenrabatt; **Fahrzeugklasse** (`vehicle_classes`) = Preisstaffel.
- **Nachweis** (`training_certificates`) ≠ **Lizenz** (`licenses`).

## Regeln, die nie verletzt werden dürfen

- **Zwei Rechte-Ebenen nie vermischen:** Werkstatt über Ränge/Gruppen (`user_level`), Administration über Systemrollen (`hasSystem`). Der letzte aktive Administrator bleibt geschützt (`lastAdminGuard`).
- **Rechte nur über `authz.js`** bzw. die SQL-Funktion `user_level()`. Neue Funktion → in `MODULES` eintragen und per Migration Standardrechte für bestehende Ränge setzen, sonst hat außer Inhabern niemand Zugriff.
- **Niemand vergibt mehr, als er selbst hat;** Nicht-Inhaber nur unter dem eigenen Rang; der letzte Inhaber kann nicht gehen.
- **Geld nie als Float.** `numeric` kommt als String; rechnen in Cent (BigInt). Preise und Steuern ausschließlich über `pricing.js` und `tax.js`.
- **Unveränderlich:** abgerechnete Aufträge, ausgestellte Rechnungen (nur Storno per Gegenrechnung), freigegebene Lohnläufe, abgeschlossene Kassentage, abgeführte Steuerzeiträume. Nichts davon löschen, auch nicht „zur Korrektur“.
- **Nummernkreise lückenlos** nur über `numbering.js` in derselben Transaktion.
- **Rechnungs-Snapshot:** Rechnungen immer aus `invoices.snapshot` rendern, nie live aus Preisliste oder Kunde.
- **Festpreise:** Kein netto/brutto, keine Steuer auf Positionen oder Rechnungen. Steuer nur in `tax.js` aus dem Umsatz des Zeitraums. Nicht „nachrüsten“ ohne Auftrag.
- **Auftragspositionen frieren den Preis ein;** Preisänderungen wirken nur auf neue Positionen.
- **Lagerbestand nur über `stock_movements`** ändern, nie direkt `parts.stock` setzen.
- **Öffentliche Preisliste** liefert nie Einkaufspreise, Marge oder interne Notizen.
- **Strikte CSP:** kein Inline-JavaScript, keine `on*`-Attribute.
- **Teil-Updates** mit eigenem `patchSchema()`, nie Zod `.partial()` mit Defaults (überschreibt fehlende Felder still).
- **Lösungen von Testfragen** nie an Teilnehmende ausliefern.
- **Compose-Projektname `boxenstopp` nie ändern** (bestimmt die Volumes).

## Testen

Nie gegen eine Instanz mit echten Daten testen. Wegwerf-Stack `boxenstopp-check`, danach `down -v`. Stufen: TECHNICAL.md, Abschnitt 9. Jede 5xx-Antwort und jeder JS-Fehler in der Konsole ist ein echter Fehler.

## Mockup

- Aufbau: `mockup/index.html`, `css/app.css`, `js/data.js` (Beispieldaten, `BX.data`), `js/ui.js` (Helfer, Icons, SVG-Diagramme), `js/pages-*.js` (eine Funktion je Seite in `BX.pages`), `js/app.js` (Hash-Router, Rechte `BX.perm`, Dialoge, Suche, Drag & Drop). Klassische Skripte statt ES-Module, weil Module unter `file://` blockiert werden.
- Der gelbe Balken oben schaltet die Ansicht zwischen Rollen um (Inhaberin, Werkstattleitung, Meister, Mechaniker, Azubi, Praktikantin, Support ohne Rang); Navigation und Seiten folgen den Rechten.
- Ort: `mockup/`, rein statisch, öffnet ohne Server (`index.html`), kein Inline-JS (CSP-tauglich, damit Teile später übernommen werden können).
- Beispieldaten frei erfunden (keine bekannten Spielnamen oder Marken): eine Firma, 8–10 Mitarbeiter in mehreren Rängen und Gruppen, 20 Kunden mit Preisgruppen, 30 Fahrzeuge in verschiedenen Klassen, Aufträge in jedem Status, Preisliste mit allen vier Preisarten, Lager mit knappen Teilen, Rechnungen mit Festpreisen, Steuerzeiträume (offen und abgeführt).
- Mindestens: Dashboard, Auftragsboard, Auftrag-Detail mit Positionen und Rabatten, Kundenakte, Fahrzeugakte, Preisliste (intern + Druck-/Kundenansicht), Lager, Rechnung, Finanzübersicht, Steuern, Mitarbeiter, Ränge & Gruppen, Rechte-Matrix, Schulungen, Lizenzen, Qualifikationsmatrix, Dienstplan, User-Management, Server-Management, Tickets, Handy-Ansicht.
- Dunkles Standardthema, Akzent Bernstein/Orange, Kennzeichen in Monospace.

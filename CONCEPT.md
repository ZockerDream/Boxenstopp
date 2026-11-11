# Boxenstopp – Konzept

Stand: **Version 0.3.0** (2026-11-11); was davon umgesetzt ist, steht in [TECHNICAL.md](TECHNICAL.md), Abschnitt 0. Technische Umsetzung: [TECHNICAL.md](TECHNICAL.md), Regeln für KI-Assistenten: [AGENTS.md](AGENTS.md).

## 1. Ziel

Boxenstopp ist ein selbst gehostetes, deutschsprachiges Werkstatt-Management für Roleplay-Server (z. B. FiveM/GTA-RP). **Eine Instanz = eine Firma** (Werkstatt, Tuner, Abschleppdienst). Die Firma verwaltet darin Mitarbeiter mit Rängen, Gruppen und Rechten, Kunden- und Fahrzeugakten, Aufträge, Preisliste und Lager, Finanzen mit Steuern, Schulungen und Lizenzen.

Leitidee: **Vom Kunden über den Auftrag zur Rechnung in einem Fluss.** Kennzeichen eintippen, Fahrzeug und Kunde sind da, Leistungen aus der Preisliste wählen, Auftrag abschließen, die Rechnung mit Steuer entsteht automatisch, die Zahlung landet in der Kasse, Provision und Lohn rechnen sich daraus, die Fahrzeugakte hat die komplette Historie.

**Eigenständig:** Boxenstopp ist ein komplett unabhängiges Produkt mit eigener Datenbank, eigenen Benutzern und eigenem Code. Es gibt keine Verbindung und keinen Datenaustausch mit anderen Anwendungen. Das RP-Management-Board diente nur als Inspiration für Bedienung und Rechte-Modell (Entscheidung des Auftraggebers vom 2026-11-11).

### Entscheidungen des Auftraggebers vom 2026-11-11
- Name **Boxenstopp**.
- **Eine Firma pro Instanz** (keine Mandanten).
- **Kein Discord-Login**; Anmeldung mit E-Mail und Passwort, optional 2FA. Discord-Webhooks für Meldungen bleiben.
- **Komplett standalone**, keine Verbindung zum RP-Management-Board.
- **Steuern: ja** (Abschnitt 8.3). Keine Vorsteuer, keine Gewinnsteuer, keine Gewerbeabgabe.
- **Nur Festpreise**, keine Unterscheidung netto/brutto: Der Preis in der Preisliste ist der Endpreis für den Kunden. Die Steuer berechnet sich als Prozentsatz vom Umsatz und wird von der Firma abgeführt.
- **Keine feste Mindeststundenzahl** für die Aktivität; die Aktivitätsübersicht zeigt nur die Stunden.
- **Lager und Pauschalpreise: beides möglich**, je Leistung wählbar (Abschnitt 7).
- **Preisliste / Katalog** als eigener Bereich (Abschnitt 7).
- Alle zusätzlichen Vorschläge (Qualifikationsmatrix, Stempeluhr, Einsätze, Stellplätze, Personalakten, Schwarzes Brett, Webhooks, Suche, Audit-Log) gehören zum Umfang.

## 2. Begriffe

| Begriff | Bedeutung |
|---|---|
| **Firma** | Die Werkstatt, die diese Instanz betreibt. Stammdaten in den Firmen-Einstellungen. |
| **Mitarbeiter** | Benutzer mit Zugang, genau ein Rang, beliebig viele Gruppen. |
| **Inhaber** | Mitarbeiter, der immer alles darf; mindestens einer bleibt. |
| **Kunde** | RP-Charakter, Firma/Fraktion oder Behörde. Kein Login. |
| **Fahrzeug** | Fahrzeug mit Kennzeichen und Akte, Halter ist ein Kunde. |
| **Auftrag** | Werkstattauftrag mit Positionen, Status und Bearbeitern; Grundlage der Rechnung. |
| **Einsatz** | Abschlepp- oder Pannendienst vor Ort; kann in einen Auftrag übergehen. |
| **Leistung** | Eintrag der Preisliste: Pauschale, Arbeitsleistung oder Teil. |
| **Teil** | Lagerartikel mit Bestand. |
| **Konto / Kasse** | Geldbereich mit Kontostand (Firmenkonto, Bargeldkasse …). |
| **Nachweis** | Bestandene Schulung eines Mitarbeiters mit Gültigkeit. |
| **Lizenz** | Ausgestellter Schein eines Mitarbeiters oder der Firma. |

## 3. Navigation

| Gruppe | Seite | Inhalt |
|---|---|---|
| Werkstatt | Dashboard | Kennzahlen, offene Aufträge, wer ist im Dienst, Termine heute, offene Einsätze, ablaufende Nachweise und Lizenzen, Lager-Warnungen, Steuer-Rücklage |
| | Aufträge | Board (Spalten nach Status), Liste, „Meine Aufträge“; Neuer Auftrag |
| | Termine | Kalender mit Werkstattterminen und Stellplatz-/Hebebühnenbelegung |
| | Einsätze | Abschlepp- und Pannendienst |
| Kunden | Kunden | Kundenakten |
| | Fahrzeuge | Fahrzeugakten, Suche nach Kennzeichen, Halter, Modell |
| Preisliste & Lager | Preisliste | Leistungen nach Kategorien mit Preisen je Fahrzeugklasse; Druck- und Kundenansicht |
| | Lager | Teile, Bestand, Wareneingang, Inventur |
| Finanzen | Übersicht | Umsatz, Ausgaben, Gewinn, offene Rechnungen, Kassenstände, Steuern |
| | Rechnungen | Alle Rechnungen, Zahlung erfassen, Storno |
| | Buchungen | Ein- und Ausgaben über alle Konten, Daueraufträge |
| | Konten | Firmenkonto, Bargeldkasse, weitere Kassen, Steuer-Rücklage |
| | Steuern | Steuersatz, Steuerzeiträume, Abführung |
| | Lohn & Provision | Lohnläufe, Provisionen, Auszahlungen |
| | Berichte | Tages-, Wochen-, Monatsabschluss, Export |
| Personal | Dienstplan | Stempeluhr, Dienstzeiten, Abwesenheiten, Aktivität |
| | Schulungen | Schulungen, Termine, Tests, Nachweise |
| | Lizenzen | Lizenzarten, Lizenzen der Mitarbeiter und der Firma |
| | Qualifikationen | Matrix Mitarbeiter × Schulungen/Lizenzen |
| | Personalakten | Rang-Historie, Vermerke, Verwarnungen, Belobigungen |
| | Schwarzes Brett | Ankündigungen mit Lesebestätigung |
| Firma | Mitarbeiter | Anlegen, einladen, Rang, Gruppen, Status, Lohnmodell |
| | Ränge & Gruppen | Ränge sortieren, Gruppen pflegen, Pflichtqualifikationen |
| | Berechtigungen | Rechte-Matrix, Einzelrechte, „Was darf X?“ |
| | Firmen-Einstellungen | Stammdaten, Logo, Rechnungsvorlage, Nummernkreise, Steuersatz, Fahrzeugklassen, Funktionen an/aus |
| Administration | User-Management | Benutzer, Rollen & Rechte, Einladungen (nur mit Systemrecht, Abschnitt 12) |
| | Server-Management | Übersicht, Sicherheit & Einstellungen, System & Backups, Integrationen, Audit-Log (nur mit Systemrecht) |
| | Tickets | Gemeldete Fehler (nur mit Systemrecht) |
| | Hilfe, Fehler melden, Changelog | Für alle Benutzer |
| Konto | Einstellungen | Profil, Sicherheit (Passwort, 2FA), Darstellung, Benachrichtigungen, Sitzungen, API & Kalender |

Kopfleiste: **Dienst-Knopf** („Dienst beginnen“ / „Dienst beenden“), globale Suche (Kennzeichen, Kunde, Auftrags-, Rechnungs-, Einsatznummer), Glocke, Profil.

## 4. Firmenverwaltung

### 4.1 Firma und Ersteinrichtung
Beim ersten Start führt ein Assistent durch: Firmenname, Kürzel (für Nummernkreise, z. B. `BXS`), Logo (Abschnitt 13), Adresse im RP, Telefon, Öffnungszeiten, Steuersatz, erster Inhaber (Benutzer mit Passwort; er bekommt zugleich die Systemrolle Administrator). Danach gibt es standardmäßig keine öffentliche Registrierung; neue Mitarbeiter kommen per Einladung oder Anlage durch Berechtigte. Die Selbstregistrierung lässt sich im Server-Management einschalten; neue Konten warten dann ohne Rang auf Freigabe.

### 4.2 Mitarbeiter
Name, E-Mail (Login), Personalnummer, Dienstnummer, Telefon (RP), Eintrittsdatum, Rang, Gruppen, Lohnmodell (8.6), Status (aktiv, beurlaubt, gesperrt, ausgeschieden). Ausgeschiedene verlieren den Zugang, bleiben aber in Aufträgen, Rechnungen und Historie sichtbar. Einladung per Link (E-Mail optional) mit vorgegebenem Rang und Ablauf.

### 4.3 Ränge
Sortiert, höchster oben. Vorgaben beim Einrichten: **Geschäftsführung, Werkstattleitung, Meister, Mechaniker, Azubi, Praktikant**. Je Rang: Standard-Lohnmodell, **Pflichtschulungen** und **Pflichtlizenzen**. Ein Rang mit Mitgliedern lässt sich nicht löschen. Beförderung und Degradierung mit Grund landen in der Personalakte; die Beförderungsansicht zeigt, welche Pflichtqualifikationen für den neuen Rang fehlen.

### 4.4 Gruppen
Freie Zusammenschlüsse quer zu Rängen, z. B. *Tuning*, *Abschleppdienst*, *Lackiererei*, *Ausbilder*, *Buchhaltung*. Ein Mitarbeiter kann in mehreren Gruppen sein. Gruppen können Leistungen der Preisliste zugeordnet sein (z. B. nur *Lackiererei* bucht Lackierungen).

### 4.5 Berechtigungen

| Stufe | Bedeutung |
|---|---|
| 0 Kein Zugriff | Funktion unsichtbar |
| 1 Eigene | Nur eigene Datensätze (eigene Aufträge, eigene Dienstzeiten, eigene Nachweise, eigene Lohnabrechnung); bei Schulungen: sich an- und abmelden |
| 2 Lesen | Alles sehen |
| 3 Lesen & Schreiben | Anlegen und ändern |
| 4 Verwalten | Zusätzlich löschen, stornieren, freigeben und Einstellungen der Funktion |

**Funktionen:** Mitarbeiter, Ränge & Gruppen, Berechtigungen, Kunden, Fahrzeuge, Aufträge, Termine, Einsätze, Preisliste, Lager, Rechnungen, Konten & Buchungen, Steuern, Lohn & Provision, Berichte, Dienstplan, Schulungen, Lizenzen, Personalakten, Schwarzes Brett, Firmen-Einstellungen. Nicht jede Funktion kennt jede Stufe. Die Administration (User- und Server-Management) hängt nicht an Rängen, sondern an Systemrollen (Abschnitt 12).

**Einzelrechte** (zusätzlich, je Rang/Gruppe/Person):
- `rabatt.max_prozent` – höchster Rabatt ohne Freigabe (Zahl)
- `auftrag.preis_aendern` – vom Preislistenpreis abweichen oder freie Positionen
- `rechnung.storno` – Rechnungen stornieren
- `kasse.abschluss` – Tagesabschluss
- `personal.lohn_sehen` – Löhne anderer sehen

**Verrechnung:** höchstes Recht aus Rang und Gruppen; ist für eine Person persönlich etwas gesetzt, gilt genau das (auch weniger). **Inhaber** dürfen alles.

**Hierarchie:** Nicht-Inhaber verwalten nur Mitarbeiter und Ränge unter dem eigenen Rang, ändern sich nie selbst und vergeben nie mehr, als sie selbst haben. Nur Inhaber ernennen Inhaber; der letzte Inhaber kann nicht gehen oder gesperrt werden.

**Komfort:** Rechtevorlagen beim Anlegen eines Rangs (Leitung, Mechaniker, Azubi, Buchhaltung, Nur lesen); Ansicht **„Was darf X?“** zeigt je Funktion die wirksame Stufe und woher sie kommt (Rang, Gruppe, persönlich).

## 5. Kundenakten und Fahrzeugakten

### 5.1 Kundenakte
Name, Art (Privatperson, Firma/Fraktion, Behörde), Telefon (RP), **Preisgruppe** (7.3), Zahlungsziel, Warnhinweis (z. B. „nur Barzahlung“), Sperre mit Grund, Tags. Tabs:
- **Übersicht:** Umsatz gesamt, offene Beträge, letzte Besuche
- **Fahrzeuge:** aktuelle und frühere (über Halterwechsel)
- **Aufträge**, **Einsätze**, **Rechnungen**
- **Einträge:** datiert, Markdown, mit Verfasser
- **Dokumente:** Bilder und PDFs

Doppelte Kunden lassen sich **zusammenführen**. Kunden mit Rechnungen lassen sich nicht löschen, nur archivieren.

### 5.2 Fahrzeugakte
Kennzeichen (eindeutig unter nicht verschrotteten Fahrzeugen), Hersteller, Modell, **Fahrzeugklasse** (für Preise, 7.2), Farbe, Fahrgestellnummer optional, Kilometerstand, Halter (Kunde), Status (aktiv, verschrottet, gestohlen gemeldet), Bilder. Tabs:
- **Historie:** Zeitleiste aller Aufträge, Einsätze, Halter- und Kennzeichenwechsel, Kilometerstände
- **Tuning-Stand:** verbaute Tuning-Teile je Kategorie (Motor, Bremsen, Getriebe, Federung, Turbo, Panzerung, Optik …), automatisch aus abgeschlossenen Aufträgen, von Hand korrigierbar
- **Zustand:** letzter Zustand bei Annahme (Motor, Karosserie, Reifen in %, Schäden mit Bild)
- **Garantie:** laufende Garantien aus Aufträgen mit Ablauf
- **Halter-Historie**

## 6. Aufträge

### 6.1 Ablauf
```
Angebot ──> Angenommen ──> In Arbeit ──> Fertig ──> Abgerechnet ──> Abgeholt
   │                └──> Wartet auf Teile ──┘
   └──> Abgelehnt                 (bis „Abgerechnet“ jederzeit: Storniert, mit Grund)
```
- **Angebot / Kostenvoranschlag:** Positionen und Gesamtpreis; optional „Kunde hat zugestimmt“ mit Zeitpunkt.
- **Annahme:** Kennzeichen-Schnellsuche oder neues Fahrzeug, Kilometerstand, Zustand, Kundenwunsch, Fotos, Fertigstellungstermin, Stellplatz.
- **In Arbeit:** Bearbeiter, Positionen ergänzen, Teile aus dem Lager entnehmen, interne Notizen.
- **Fertig:** optional Prüfung durch einen Meister (Vier-Augen, in den Firmen-Einstellungen schaltbar); Meldung an den Kunden als Webhook oder als kopierbarer Text fürs RP-Handy.
- **Abgerechnet:** Rechnung entsteht automatisch, Auftrag ist danach gesperrt.

Nummer: `KÜRZEL-JJJJ-laufend`, z. B. `BXS-2026-0042`.

### 6.2 Positionen
Aus der Preisliste oder frei (nur mit `auftrag.preis_aendern`). Je Position: Leistung, Menge, Einzelpreis (Festpreis, Stand der Preisliste eingefroren), Rabatt, ausführender Mitarbeiter (Provision). Bei Leistungen mit Lagerteilen werden die Teile automatisch reserviert und bei „Fertig“ entnommen.

**Qualifikationsprüfung:** Erfordert eine Leistung eine Schulung oder Lizenz, kann sie nur ein Mitarbeiter mit gültigem Nachweis ausführen. Modus je Firma: Warnung oder harte Sperre.

**Rabatt:** bis `rabatt.max_prozent` direkt, darüber Freigabe durch jemanden mit höherem Wert (Anfrage erscheint in der Glocke).

### 6.3 Ansichten
**Board** mit Spalten je Status (Ziehen ändert den Status, soweit erlaubt), **Liste** mit Filtern (Status, Bearbeiter, Kunde, Zeitraum), **Meine Aufträge**.

## 7. Preisliste und Lager

### 7.1 Preisliste (Katalog)
Kategorien (Reparatur, Wartung, Tuning Motor, Tuning Fahrwerk, Optik, Lackierung, Abschleppen, Pauschalen …) mit Reihenfolge. Jede Leistung hat eine **Preisart**:

| Preisart | Bedeutung | Lager |
|---|---|---|
| **Pauschal** | Fester Endpreis inkl. Material, z. B. „Reparatur Karosserie komplett“ | Optional: verbraucht im Hintergrund Teile (nur Bestand, kein Preisanteil) |
| **Arbeit** | Preis je Einheit/Stunde, z. B. „Arbeitsstunde Mechanik“ | Nein |
| **Teil** | Verkauf eines Lagerteils, Preis = Verkaufspreis des Teils | Ja, Bestand sinkt |
| **Set** | Bündel aus Arbeit und Teilen zu einem Paketpreis, z. B. „Tuning-Paket Stufe 2“ | Ja, Teile werden entnommen |

Alle Preise sind **Festpreise** (Endpreis für den Kunden, keine Unterscheidung netto/brutto). Weitere Felder: Beschreibung, Einkaufs-/Materialkosten (für Marge), Richtzeit, Garantie in Tagen, benötigte Qualifikation, zuständige Gruppe, Tuning-Kategorie und -Stufe, aktiv/inaktiv, interne Notiz.

### 7.2 Preise je Fahrzeugklasse
Fahrzeugklassen pflegt die Firma selbst (Kompakt, Limousine, Sport, Super, SUV, Motorrad, Nutzfahrzeug …). Eine Leistung hat entweder einen Einheitspreis oder je Klasse einen eigenen Preis bzw. einen Aufschlag in %. Im Auftrag wird automatisch der Preis für die Klasse des Fahrzeugs gewählt.

### 7.3 Preisgruppen
Preisgruppen für Kunden, z. B. *Standard*, *Stammkunde −10 %*, *Behörde −20 %*, *Mitarbeiter −30 %*. Rabatt pauschal oder je Kategorie. Kunde hat eine Preisgruppe; der Rabatt wird im Auftrag vorgeschlagen.

### 7.4 Preisstände
Preisänderungen gelten ab einem Datum (sofort oder geplant). Die Preisliste zeigt den aktuellen Stand, ältere Stände bleiben nachvollziehbar. Bestehende Auftragspositionen behalten ihren Preis.

### 7.5 Kundenansicht und Druck
- **Druckbare Preisliste** (PDF und Bild) mit Logo und ausgewählten Kategorien, ohne interne Felder.
- **Öffentlicher Link** (optional, in den Firmen-Einstellungen einschaltbar): schreibgeschützte Preisliste ohne Login, z. B. für das Forum oder den Discord des Servers.
- CSV-Import und -Export mit Prüfung vor dem Schreiben.

### 7.6 Lager
Teile mit Artikelnummer, Bestand, Einheit, Mindestbestand, Lagerort, Einkaufspreis, Verkaufspreis. **Wareneingang** (erzeugt optional eine Ausgabe-Buchung), **Entnahme** über Aufträge oder von Hand mit Grund, **Reservierung** durch offene Aufträge, **Inventur** mit Differenzprotokoll, Warnung unter Mindestbestand. Das Lager lässt sich in den Firmen-Einstellungen komplett ausschalten; dann gibt es nur Pauschal- und Arbeitspreise.

## 8. Finanzen

### 8.1 Konten und Kassen
Mehrere Konten (Firmenkonto, Bargeldkasse, Trinkgeldkasse, **Steuer-Rücklage**). Kontostand = Einnahmen − Ausgaben. Umbuchungen zwischen Konten.

### 8.2 Rechnungen
Entsteht aus Auftrag oder Einsatz, oder frei. Nummernkreis `KÜRZEL-R-JJJJ-laufend`, lückenlos. Die Rechnung zeigt Positionen, Rabatte und den Gesamtpreis; Steuer wird nicht ausgewiesen (Festpreise). Status: offen, teilweise bezahlt, bezahlt, überfällig, storniert. Zahlung erfassen mit Zahlungsart (bar, Karte, Überweisung) und Zielkonto → Buchung entsteht automatisch. **Storno** erzeugt eine Gegenrechnung; gelöscht wird nichts. Rechnung als **PDF und als Bild** (zum Posten im RP), Vorlage mit Logo und Fußtext aus den Einstellungen. Die Rechnung friert Firma, Kunde, Positionen und Preise zum Ausstellzeitpunkt ein.

### 8.3 Steuern
Einfaches Modell nach Entscheidung des Auftraggebers vom 2026-11-11: **Festpreise, keine Vorsteuer, keine weiteren Abgaben.**
- **Steuersatz:** ein Prozentsatz für die Firma (Firmen-Einstellung), änderbar mit Gültig-ab-Datum; ältere Zeiträume behalten ihren Satz.
- **Bemessung:** Steuer = Satz × **steuerpflichtiger Umsatz** des Zeitraums. Steuerpflichtig sind die bezahlten Rechnungsbeträge (Zahlungseingänge, Stornos mindern). Manuelle Einnahmen lassen sich je Buchung als steuerpflichtig markieren (Standard: nein). Ausgaben spielen keine Rolle.
- **Steuerzeitraum:** Woche oder Monat (Firmen-Einstellung). Die Seite *Steuern* zeigt je Zeitraum Umsatz, Satz und Steuerschuld, dazu den laufenden Zeitraum als Hochrechnung.
- **Steuer-Rücklage:** auf Wunsch wird bei jeder Zahlung der Steueranteil (Satz × Zahlbetrag) automatisch auf das Rücklagekonto umgebucht, damit das Geld nicht versehentlich ausgegeben wird.
- **Abführung:** „Steuern abführen“ bucht die Steuerschuld als Ausgabe (Kategorie Steuern, wahlweise vom Rücklagekonto) und schließt den Zeitraum; danach ist er unveränderlich. Steuerbericht als PDF für das RP-Finanzamt.

### 8.4 Buchungen
Ein- und Ausgaben mit Konto, Kategorie (Teileeinkauf, Miete, Löhne, Steuern, Strafen, Sonstiges …), Datum, bei Einnahmen „steuerpflichtig“ ja/nein, Beleg, Notiz, Quelle (manuell, Rechnung, Lohn, Lager, Dauerauftrag, Steuer, Tagesabschluss). **Daueraufträge** für wiederkehrende Kosten (Miete, Versicherung, Lizenzgebühren).

### 8.5 Tagesabschluss
Kassensturz je Kasse: erwarteter vs. gezählter Bestand, Differenz mit Begründung. Danach sind Buchungen dieses Tages in dieser Kasse gesperrt; Korrekturen nur als neue Buchung.

### 8.6 Lohn und Provision
Lohnmodell je Mitarbeiter (vom Rang vorgeschlagen): **Stundenlohn** auf Dienstzeiten, **Provision** in % auf eigene abgerechnete Positionen (Positionspreis nach Rabatt), **Fixum** je Woche, oder Kombination. **Lohnlauf** je Zeitraum berechnet Vorschläge, die Leitung prüft, passt an (mit Begründung) und gibt frei → Ausgabe-Buchung je Mitarbeiter. Freigegebene Lohnläufe sind unveränderlich. Mitarbeiter sehen ihre eigene Abrechnung (Stufe „Eigene“).

### 8.7 Berichte
Umsatz nach Zeitraum, Kategorie, Mitarbeiter, Kunde; Top-Leistungen; Marge je Leistung; Auslastung der Stellplätze; Lohnkosten; offene Posten; Steuern. Export CSV und PDF.

## 9. Personal

### 9.1 Dienstplan und Stempeluhr
„Dienst beginnen/beenden“ in der Kopfleiste. Dashboard zeigt, wer gerade im Dienst ist. Dienstzeiten fließen in den Stundenlohn. Nachträge mit Grund (Recht nötig). Abwesenheiten (Urlaub, krank, inaktiv gemeldet) mit Zeitraum. **Aktivitätsübersicht:** Dienststunden je Mitarbeiter und Woche, sortierbar, mit Abwesenheiten daneben. Eine Mindeststundenzahl gibt es nicht (Entscheidung des Auftraggebers vom 2026-11-11).

### 9.2 Schulungen
Schulung mit Beschreibung, Gültigkeit in Monaten, Unterlagen als Markdown-Seiten, Termine (Datum, Ort, Ausbilder), Teilnahme mit Ergebnis (angemeldet, bestanden, nicht bestanden, nicht erschienen). Optional **Test im Tool**: Fragen mit Einfach- oder Mehrfachauswahl, Bestehensgrenze, Zeitlimit, Anzahl Versuche, Mischen. Bestanden → Nachweis mit Ablaufdatum. Mitarbeiter mit Stufe „Eigene“ melden sich selbst an und sehen nur ihre eigenen Ergebnisse. Beispiele: *Grundlagen Reparatur*, *Tuning Stufe 1–3*, *Abschleppen & Sicherung*, *Kasse & Kundenservice*.

### 9.3 Lizenzen
Lizenzarten mit Standard-Gültigkeit und Inhaberart **Mitarbeiter** oder **Firma**. Nummer, Aussteller (z. B. Stadtverwaltung), Ausstellung, Ablauf, Status gültig/gesperrt/entzogen mit Grund, Scan als Bild/PDF. Firmenlizenzen (Gewerbeschein, Abschlepp-Konzession) warnen bei Ablauf alle mit Verwalten.

### 9.4 Qualifikationsmatrix
Mitarbeiter × Schulungen/Lizenzen mit Ampel (gültig, läuft in 30 Tagen ab, abgelaufen, fehlt). Pflichtqualifikationen des Rangs sind hervorgehoben. Leistungen der Preisliste verweisen auf Qualifikationen (6.2).

### 9.5 Personalakten
Vermerke, Verwarnungen (Stufe, Ablauf), Belobigungen, Gesprächsnotizen, Rang-Historie, Ein- und Austritt. Sichtbar nur mit Recht „Personalakten“; je Eintrag einstellbar, ob der Mitarbeiter ihn selbst sieht.

### 9.6 Schwarzes Brett
Ankündigungen mit Markdown, anheften, Zielgruppe (alle, Ränge, Gruppen), Lesebestätigung („gelesen von 12/15“, wer fehlt).

## 10. Werkstattbetrieb

- **Einsätze / Abschleppdienst:** Einsatznummer, Ort, Auftraggeber (Kunde, Behörde, eigen), Fahrzeug, Fahrer, Status (offen, unterwegs, vor Ort, erledigt), Anfahrtspauschale aus der Preisliste. Übergang in einen Auftrag oder direkt abrechnen. Offene Einsätze sind auf dem Dashboard hervorgehoben.
- **Termine & Stellplätze:** Stellplätze/Hebebühnen als Ressourcen; Termine belegen sie; Kalender Tag/Woche mit einer Spalte je Stellplatz; aus einem Termin wird per Klick ein Auftrag.

## 11. Querschnitt

- **Globale Suche** mit Kennzeichen-Schnellzugriff.
- **Benachrichtigungen** in der Glocke (und optional E-Mail): Rabattfreigabe, Auftrag fertig zur Prüfung, Einsatz neu, Lager knapp, Nachweis/Lizenz läuft ab, Rechnung überfällig, Steuerzeitraum fällig, Ankündigung.
- **Discord-Webhooks** (gepflegt unter Server-Management → Integrationen) je Ereignis (Auftrag fertig, Rechnung erstellt, Einsatz neu, Dienstbeginn/-ende, Lager knapp, Lizenz läuft ab, Ankündigung). Nur ausgehend, kein Login.
- **Audit-Log:** wer hat was wann geändert; besonders Preise, Rabatte, Stornos, Steuern, Rechte, Löhne.
- **Funktionen an/aus** in den Firmen-Einstellungen: Lager, Einsätze, Termine, Steuer-Rücklage, Test im Tool, Vier-Augen-Prüfung, öffentliche Preisliste.
- **Druck/Export:** Auftrag, Rechnung, Fahrzeugakte, Preisliste, Qualifikationsmatrix, Steuerbericht.
- **Backups** verschlüsselt, täglich, mit Download (Server-Management).

## 12. Administration (User-Management und Server-Management)

Wunsch des Auftraggebers vom 2026-11-11: „Server-Management und User-Management wie beim RP-Management-Board“ – als Vorbild, eigenständig umgesetzt.

### 12.1 Zwei Ebenen von Rechten
- **Ränge, Gruppen und Berechtigungen** (Abschnitt 4) regeln die **Werkstatt**: Aufträge, Kunden, Finanzen, Personal.
- **Systemrollen** regeln die **Administration**: Benutzerkonten, Server-Einstellungen, Backups, Integrationen, Audit-Log, Tickets. Rechte als `ressource:aktion`, z. B. `user:create`, `user:lock`, `role:manage`, `server:settings`, `backup:manage`, `integration:manage`, `audit:read`, `ticket:manage`.
- Feste Systemrollen: **Administrator** (alle Systemrechte) und **Benutzer** (keine). Eigene Systemrollen frei definierbar, z. B. *Support* (`user:read`, `ticket:manage`, `audit:read`).
- Ein Benutzer kann beides sein, z. B. Mechaniker und Administrator. Systemrollen geben **keine** Werkstatt-Rechte und umgekehrt; Inhaber haben nicht automatisch Systemrechte.
- Der **letzte aktive Administrator** kann weder gesperrt noch befristet noch herabgestuft werden.

### 12.2 User-Management

| Tab | Funktionen |
|---|---|
| Benutzer | Suche, Filter (Status, Rang, Systemrolle, 2FA, letzter Login), Anlegen, Einladen, Bearbeiten, Sperren/Entsperren, **Zugangsablauf** (gilt bis einschließlich zum gewählten Tag), 2FA erzwingen oder zurücksetzen, Passwort-Reset-Link erzeugen, alle Sitzungen beenden, Freigabe wartender Registrierungen, CSV-Export |
| Rollen & Rechte | Systemrollen anlegen, umbenennen, löschen (nicht die festen), Rechte-Matrix je Ressource, Standardrolle für neue Benutzer |
| Einladungen | Offene Einladungen mit Rang, Ablauf und Ersteller; erneut senden, Link kopieren, widerrufen |

Abgrenzung: Das **User-Management** verwaltet den **Zugang** (Login, Status, 2FA, Sitzungen, Systemrolle). Die Seite **Mitarbeiter** (Firma) verwaltet dieselbe Person **fachlich** (Rang, Gruppen, Personalnummer, Lohn). Ein Klick führt jeweils zur anderen Ansicht.

### 12.3 Server-Management

| Tab | Funktionen |
|---|---|
| Übersicht | Kennzahlen (aktive Benutzer, jetzt angemeldet, im Dienst, Aufträge heute, Datenbankgröße, Speicher der Uploads, letzte Sicherung), Aktivität der letzten 14 Tage, Rollenverteilung, letzte Ereignisse, Version |
| Sicherheit & Einstellungen | Passwort-Mindestlänge, Sperre nach Fehlversuchen (Anzahl, Dauer), Sitzungsdauer, 2FA-Pflicht (aus, Administratoren, alle), Admin-IP-Allowlist (speichert nur, wenn die eigene IP enthalten ist), Selbstregistrierung, **Wartungsmodus** mit Hinweistext (nur Administratoren kommen hinein), Sprache und Zeitzone, Aufbewahrungsfristen (Audit-Log, Benachrichtigungen, Sitzungen), SMTP mit Testmail, Warnung bei fehlendem `TRUST_PROXY` |
| System & Backups | Geplante Jobs mit letztem/nächstem Lauf und Status, „Jetzt ausführen“; Backups (manuell erstellen, Liste, Download, Löschen, verschlüsselt), Aufbewahrung; Umgebungswerte schreibgeschützt; Version und letzte Migration |
| Integrationen | Discord-Webhooks (URL, Ereignisse, Test senden, letzter Status), API-Schlüssel aller Benutzer (ansehen, widerrufen) |
| Audit-Log | Filter nach Benutzer, Aktion, Bereich und Zeitraum; Details mit Vorher/Nachher; CSV-Export |

### 12.4 Tickets, Hilfe, Changelog
- **Fehler melden** (alle): Titel, Beschreibung (Markdown), Seite, optional Screenshot. Melder sehen, kommentieren und löschen ihre eigenen Tickets.
- **Tickets** (`ticket:manage`): alle Meldungen mit Status (offen, in Arbeit, erledigt, abgelehnt), Kommentare, Löschen. Kommentare benachrichtigen die jeweils andere Seite.
- **Hilfe:** Anleitung je Bereich. **Changelog:** alle Versionen, neueste oben als „Installiert“, Suche und Filter nach Art (Neu, Geändert, Behoben, Technik).

## 13. Design

Wünsche des Auftraggebers vom 2026-11-11 (nach dem ersten Mockup):

- **Volle Breite:** Der Inhalt nutzt die ganze Fensterbreite, ohne feste Maximalbreite. Raster passen sich an (z. B. 6 Kennzahlen nebeneinander auf breiten Bildschirmen, 3 bis 1400 px, 2 auf Tablet und Handy).
- **Handy und Tablet:** Bedienbar ab 390 px.
  - **Ab 1024 px abwärts** (Tablet) wird die Seitenleiste zur Schublade mit Menü-Knopf, Touch-Flächen werden größer, zweispaltige Raster bleiben.
  - **Unter 900 px** wird einspaltig.
  - **Unter 640 px** werden Tabellen zu Karten, Formulare einspaltig, das Auftragsboard rastet spaltenweise ein, und Eingaben haben 16 px Schrift (kein Zoom auf iOS).
- **Name und Logo:** Der App-Name **„Boxenstopp“** steht fest oben links und ist nicht änderbar. Das **Logo** daneben ist anpassbar (Firmen-Einstellungen → Stammdaten, gilt für alle in der Firma):
  - eine Vorlage aus mehreren Symbolen (in der Akzentfarbe des Betrachters) oder ein eigenes Bild (PNG, JPEG, WebP, SVG, höchstens 512 KB)
  - erscheint in Seitenleiste, Login, Rechnungen und Preisliste
  - der Firmenname darunter wird bei Überlänge gekürzt
- **Darstellung je Mitarbeiter** (Einstellungen → Darstellung, gespeichert am Benutzer, wirkt sofort):
  - **Modus:** System (folgt dem Gerät), Hell, Dunkel. Schnell umschalten auch oben rechts.
  - **Farbthema:** Bernstein (Standard), Racing-Rot, Rosé, Indigo, Ozean, Smaragd, Limette, Mono; je Farbe ein passender Ton für Hell und Dunkel.
  - **Design V1 „Klassisch“:** flach, volle Flächen (Standard).
  - **Design V2 „Glass“:** Karten, Seitenleiste, Kopfleiste und Seitenkopf als durchscheinende Panels mit Unschärfe über einem festen Hintergrund. Dialoge und Menüs sind deckender, damit Formulare lesbar bleiben.
    - Hintergrund: Vorlagen (Werkstatt bei Nacht, Dämmerung, Hafen, Wald, Asphalt, ohne Bild) oder ein eigenes Bild (höchstens 4 MB), das nur der jeweilige Benutzer sieht.
    - Regler für Unschärfe (0–40 px), Deckkraft der Panels (20–90 %) und Abdunkeln des Hintergrunds (0–70 %).
    - Schalter „Unschärfe auf dem Handy“, Standard aus: Das spart Akku, die Panels werden dafür deckender.
  - „Auf Standard zurücksetzen“.
- Grundstil: schlichte Karten, SVG-Diagramme, Monospace für Kennzeichen und Nummern.
- Annahme und Auftrag sind auf Tempo optimiert: Kennzeichen tippen → Fahrzeug, Halter, Preisgruppe und Klasse sind gesetzt.

## 14. Phasen

| Phase | Umfang |
|---|---|
| **1 – MVP** | Ersteinrichtung, Login/2FA, User-Management, Server-Management (ohne Integrationen), Mitarbeiter, Ränge, Gruppen, Berechtigungen; Kunden- und Fahrzeugakten; Preisliste (Pauschal, Arbeit, Klassenpreise, Preisgruppen); Aufträge; Rechnungen; Konten, Buchungen; Dashboard |
| **2** | Lager (Teile, Sets, Reservierung); Steuern (Satz, Zeiträume, Rücklage, Abführung); Tagesabschluss; Stempeluhr; Lohn & Provision |
| **3** | Schulungen, Lizenzen, Qualifikationsmatrix und -prüfung; Personalakten; Schwarzes Brett; Einsätze; Termine & Stellplätze |
| **4** | Test im Tool, Tuning-Stand, Rechnung/Preisliste als Bild, öffentliche Preisliste, Kunden zusammenführen, CSV-Importe, Integrationen (Webhooks, API-Schlüssel), Tickets, Berichte |

## 15. Erweiterungen 0.3.0

Wünsche des Auftraggebers vom 2026-11-11 (nach der ersten lauffähigen Version):

### 15.1 Anpassbares Dashboard („wie im RP-Management-Board“)
- 14 Module: Kennzahlen, Umsatz, Im Dienst, Handlungsbedarf, Heute auf den Bühnen, Offene Einsätze, Umsatz & Ausgaben je Woche, Aufträge nach Status, Meine Aufträge, Fuhrpark, Regelwerk, Umsatz nach Kategorie, Lager knapp, Schwarzes Brett. Jeder sieht nur Module, für die er die Rechte hat.
- „Anpassen“: Module ziehen oder mit ‹ › verschieben, Breite 4/6/8/12 von 12 Spalten, mit ✕ ausblenden, über die Leiste wieder hinzufügen, „Standard“ setzt zurück. Gespeichert je Benutzer, sofort.
- Anders als im Board in **V1 und V2** (im Board nur V2).

### 15.2 Fuhrpark der Werkstatt
- Firmenfahrzeuge (Abschleppwagen, Servicewagen, Transporter, Dienstwagen …) mit Rufname, Kennzeichen, Modell aus dem Katalog, Kilometerstand, nächstem Service (Datum und/oder km), Versicherung, Kaufpreis, Bildern.
- Status: verfügbar, im Einsatz, Werkstatt, ausgemustert.
- **Ausgabe und Rückgabe** mit Kilometerstand (Fahrtenbuch). Selbst ausgeben ab „Lesen“, für andere ab „Lesen & Schreiben“. Bei der Rückgabe kann ein Schaden gemeldet werden: Das Fahrzeug geht in die Werkstatt, die Verwalter werden benachrichtigt.
- Service, Tanken, Schäden, Kosten und Vermerke. Kosten optional als Ausgabe gebucht (Kategorie „Fuhrpark“).
- Täglicher Hinweis bei fälligem Service (7 Tage vorher, bzw. Kilometerstand erreicht) und ablaufender Versicherung (14 Tage).
- Einsätze tragen das eingesetzte Firmenfahrzeug.
- Recht „Fuhrpark“ (bei der Einführung von „Fahrzeuge“ übernommen).

### 15.3 Tuning
- **Konfigurator:** Kundenfahrzeug wählen, aktuellen Tuning-Stand je Kategorie sehen, Upgrades je Kategorie mit dem Preis der Fahrzeugklasse wählen (bereits Verbautes ist gesperrt). Extras (Optik, Lack) und Pakete dazu. Die Zusammenstellung zeigt Rabatt aus Preisgruppe bzw. Paket. Daraus entsteht mit einem Klick ein **Angebot** oder ein **Auftrag** (inklusive Teile-Reservierung und Qualifikationsprüfung).
- **Pakete:** mehrere Leistungen mit Paketrabatt; der Paketrabatt gilt ohne Freigabe, ein höherer Gruppenrabatt geht vor.
- **Übersicht:** getunte Fahrzeuge, Stufen je Kategorie, Tuning-Umsatz, am stärksten getunte Fahrzeuge.
- Recht „Tuning“ (Pakete pflegen ab „Lesen & Schreiben“); Angebote/Aufträge anlegen braucht „Aufträge: Lesen & Schreiben“.

### 15.4 Fahrzeug-Katalog mit Bildern
- Modelle mit Hersteller, Modell, Fahrzeugklasse (bestimmt die Preise), Bauform, Neupreis, Sitzen, Höchstgeschwindigkeit, Antrieb, Kraftstoff, Beschreibung, Hinweisen für die Werkstatt.
- **Bildergalerie** je Modell (und je Firmenfahrzeug): bis 30 Bilder, Titelbild, Reihenfolge, Bildunterschrift, Leuchtkasten. Upload PNG/JPEG/WebP; im Browser auf höchstens 1600 px verkleinert; höchstens 3 MB.
- Kunden- und Firmenfahrzeuge verknüpfen ein Modell (füllt Hersteller, Modell, Klasse); die Fahrzeugakte zeigt das Bild.
- Recht „Fahrzeug-Katalog“ (bei der Einführung von „Preisliste“ übernommen).

### 15.5 Regelwerk – nur für Mitarbeiter
- Eigener Bereich „Regelwerk“ mit Dokumenten wie **Dienstverordnung** und **Firmen-Kodex** (beliebig viele, sortierbar). Nur für Benutzer mit Rang; Support-Konten ohne Rang sehen ihn nicht.
- Text mit einfacher Formatierung (Überschriften, Listen, fett, Hinweis, Tabelle), Inhaltsverzeichnis.
- **Fassungen:** Eine Änderung kann als neue Fassung veröffentlicht werden (alle müssen neu bestätigen, Benachrichtigung) oder als Korrektur ohne neue Version. Alte Fassungen bleiben einsehbar.
- **Lesebestätigung:** „Gelesen und akzeptiert“ je Fassung; Zähler in der Navigation und Eintrag unter „Handlungsbedarf“, solange etwas offen ist. Verwalter sehen, wer welche Fassung bestätigt hat.
- Recht „Regelwerk“: lesen haben alle Ränge, bearbeiten die Leitung.

### 15.6 Interaktive Diagramme
- Tooltip mit allen Werten beim Überfahren, Hilfslinie und hervorgehobener Punkt, gedimmte übrige Balken.
- Legende: Reihen ein- und ausblenden. Donut: Segment hervorheben, Wert in der Mitte, Segmente über die Legende ausblenden.
- Zeitraum wählbar (Umsatz 7/14/30/90 Tage, Wochen 8/13/26).
- Klick führt zu den Daten: Woche → Buchungen dieser Woche, Status-Segment → Auftragsliste mit diesem Status.

### 15.7 Echte Fahrzeugmodelle

Wunsch des Auftraggebers vom 2026-11-11: „Ersetz alle Fahrzeuge durch wirklich existierende Fahrzeuge in der DB.“ Die erfundenen Modelle im Fahrzeug-Katalog (und damit in Kundenfahrzeugen und Fuhrpark) sind durch reale Modelle ersetzt, passend zu Klasse und Rolle:

| Klasse | Modelle |
|---|---|
| Sport | Porsche 718 Cayman GTS 4.0, BMW M4 Competition Coupé |
| Super | Lamborghini Huracán EVO, McLaren 750S |
| Limousine | Škoda Superb 2.0 TDI (Taxi), Mercedes-Benz S 580 4MATIC, Dodge Charger Pursuit (Behörden) |
| SUV | Toyota Land Cruiser 250, Land Rover Range Rover P550e |
| Kompakt | Volkswagen Polo 1.0 TSI, Renault 5 E-Tech Electric |
| Motorrad | Honda CBR1000RR-R Fireblade |
| Nutzfahrzeug | MAN TGL 12.250 Plateau (Abschleppwagen) |

Die Katalogbilder bleiben gezeichnete Platzhalter (keine Herstellerfotos). Ausgestellte Rechnungen behalten im Snapshot die alten Namen (unveränderlich). Das Mockup bleibt bei den erfundenen Namen.

## 16. Offene Fragen

Keine. Beantwortet am 2026-11-11: keine Vorsteuer, Gewinnsteuer oder Gewerbeabgabe; nur Festpreise; keine Mindeststunden.

Annahme ohne ausdrückliche Rückmeldung (bei Bedarf nachfragen): ein einziger Steuersatz für alle Leistungen, Bemessung auf bezahlte Rechnungsbeträge.

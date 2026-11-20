# 🎄 Wichtel-Zauber

Kleine Web-App für unsere Familien-Wichtelziehung – mit Mehrfachziehung und Wunschgeschenk-Regel.
Läuft kostenlos über **GitHub Pages**, ohne Server und ohne Datenbank – geschützt durch ein Familien-Passwort.

## So funktioniert's

1. **Organisator** öffnet die App, trägt alle Teilnehmer ein, stellt ein, wie viele Namen jeder zieht,
   und trägt optional für jeden einen Wunsch/eine Beschreibung ein.
2. **„Jetzt auslosen“** – die App lost nach allen Regeln aus:
   - Jeder zieht genau *x* verschiedene Namen
   - Niemand zieht sich selbst, niemand zieht einen Namen doppelt
   - Jeder Name wird genau *x*-mal vergeben
   - Jeder zieht **genau ein** Los **mit** Beschreibung (Wunschgeschenk), die übrigen ohne
3. Für jeden Teilnehmer gibt es einen **persönlichen Link** (per WhatsApp, Teilen-Menü oder Kopieren).
   Jeder Link zeigt nur die Ziehung dieser einen Person.
4. Wer zusammensitzt, kann alternativ wie früher **das Handy herumgeben**.

### Datenschutz / Geheimhaltung

- Die Ziehung steckt im Teil der Adresse **nach dem `#`**. Dieser Teil wird vom Browser nie an
  einen Server geschickt – GitHub sieht davon nichts.
- Die Ziehung wird nur im Browser des Organisators gespeichert (localStorage), damit man die Links
  später nochmal verschicken kann.
- Der Organisator *könnte* theoretisch andere Links öffnen oder die „Auswertung (Spoiler!)“ ansehen –
  wie bei der Offline-Version gilt: Familienehrenwort 😉
- **Neu auslosen** macht alte Links nicht ungültig – danach also allen die neuen Links schicken.
  (Jeder Link zeigt Datum und Uhrzeit der Ziehung, so sieht man, welcher aktuell ist.)

## Passwortschutz

Die veröffentlichte Seite ist mit einem Passwort geschützt. Das Passwort steht **nirgends im Repository**,
sondern nur im GitHub-Secret `WICHTEL_PASSWORT`:

- Bei jedem Hochladen auf `main` laufen erst alle Tests. Danach verschlüsselt `scripts/build.js` die
  komplette App mit dem Passwort (AES-256-GCM, Schlüssel per PBKDF2 mit 600.000 Runden) und veröffentlicht
  nur die verschlüsselte Fassung samt Passwortabfrage (`scripts/login.html`).
- Ohne Passwort lässt sich die App nicht öffnen – auch nicht über persönliche Links.
- „Auf diesem Gerät angemeldet bleiben“ merkt sich den Zugang im Browser; dann fragt die Seite nicht jedes Mal.
- Fehlt das Secret, bricht die Veröffentlichung ab – es wird nie eine ungeschützte Version veröffentlicht.

> Der App-**Code** selbst ist im öffentlichen Repository sichtbar – er enthält aber keine Namen, Wünsche oder
> Ziehungen. Geschützt wird die Website, auf der eure Familie die App benutzt.

### Einrichtung (einmalig)

1. **Settings → Secrets and variables → Actions → New repository secret**
   - *Name*: `WICHTEL_PASSWORT`
   - *Secret*: euer Familien-Passwort (mind. 6 Zeichen, lieber mehr)
2. **Settings → Pages → Build and deployment → Source: „GitHub Actions“**
3. **Actions → „Tests & Veröffentlichung“ → Run workflow** (oder einfach etwas hochladen)
4. Nach ein paar Minuten: **https://muffl93.github.io/Wichtel-App/** fragt nach dem Passwort.

**Passwort ändern:** Secret unter *Settings → Secrets and variables → Actions* aktualisieren und den Workflow
erneut starten. Alle müssen sich dann einmal neu anmelden. Bereits verschickte Wichtel-Links funktionieren
weiter (mit dem neuen Passwort).

Lokal ausprobieren: `WICHTEL_PASSWORT=meinpasswort node scripts/build.js` → `dist/index.html`
(muss über einen Webserver geöffnet werden, z. B. `npx serve dist`).

## Tests

Die Zieh-Logik steckt in `wichtel-logic.js` und wird automatisch geprüft:

- `tests/logic.test.js` – alle Ziehregeln mit tausenden Zufallsziehungen, Zufälligkeit, Link-Kodierung
- `tests/ui.test.js` – klickt die echten Abläufe im Browser durch (auslosen, ändern & neu auslosen,
  Links öffnen, Handy herumgeben, Neuladen …)
- `tests/protected.test.js` – Passwortschutz: falsches/richtiges Passwort, angemeldet bleiben,
  persönliche Links, kein Klartext in der veröffentlichten Seite, kein Build ohne Passwort

Bei jedem Hochladen laufen die Tests automatisch auf GitHub (Reiter **Actions**).
Lokal (Node.js nötig):

```
npm install
npx playwright install chromium
npm test
```

## Lokal öffnen

`index.html` (die unverschlüsselte Quelle) einfach im Browser öffnen. Zum Verschicken der Links aber die GitHub-Pages-Adresse
benutzen – Links aus einer lokal geöffneten Datei funktionieren nur auf dem eigenen PC
(die App warnt dann auch).

# 🎄 Wichtel-Zauber

Kleine Web-App für unsere Familien-Wichtelziehung – mit Mehrfachziehung und Wunschgeschenk-Regel.
Läuft kostenlos über **GitHub Pages**, ohne Server, ohne Datenbank und ohne Anmeldung.

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

## Einrichtung (einmalig, ca. 5 Minuten)

1. Im Repository auf GitHub: **Add file → Upload files**, `index.html` und `README.md` hochladen,
   **Commit changes**.
2. **Settings → Pages**:
   - *Source*: **Deploy from a branch**
   - *Branch*: **main**, Ordner **/ (root)** → **Save**
3. Nach 1–2 Minuten ist die App erreichbar unter:
   **https://muffl93.github.io/Wichtel-App/**

> Hinweis: GitHub Pages ist für **öffentliche** Repositories kostenlos. Das ist unbedenklich – im
> Repository liegt nur der App-Code, keine Namen und keine Ziehungen.

## Lokal testen

`index.html` einfach im Browser öffnen. Zum Verschicken der Links aber die GitHub-Pages-Adresse
benutzen – Links aus einer lokal geöffneten Datei funktionieren nur auf dem eigenen PC
(die App warnt dann auch).

# KERNWACHT

**Ein Sci-Fi-Tower-Defense-Spiel, das direkt im Browser läuft.**

Die Forschungsstation *Aurelis* auf dem fremden Planeten *Veyra IV* wird von Alien-Schwärmen und Maschinenwesen angegriffen. Du baust Verteidigungstürme entlang der Angriffswege und schützt den Reaktorkern – das Herz der Station. Erreichen zu viele Gegner den Kern, ist das Spiel verloren.

Alles im Spiel ist selbst gemacht: Grafik, Leuchteffekte, Explosionen und Sounds entstehen direkt im Browser. Es werden keine Bilder oder Tondateien geladen.

## Spielen

**Online:** https://the-hamster.github.io/browserspiel/

**Auf dem eigenen Rechner:** Der Ordner braucht einen kleinen lokalen Webserver (ein Doppelklick auf `index.html` reicht wegen der Browser-Sicherheitsregeln nicht). Zum Beispiel:

```bash
python3 -m http.server 8000
```

Danach im Browser `http://localhost:8000` öffnen.

Läuft am PC (Maus und Tastatur) und am Handy oder Tablet (Touch, im Querformat).

## So funktioniert's

- **Türme bauen:** Unten einen Turm wählen und auf einen freien Platz neben dem Weg tippen – oder erst den Platz antippen, dann den Turm. Beim Bauen wird der freie Bereich dezent grün markiert.
- **Welle starten:** Oben „Welle starten“. Danach kommen die Wellen von selbst. Wer früher startet, bekommt Bonus-Credits.
- **Aufrüsten:** Einen Turm antippen – das Fenster öffnet sich direkt daneben. Jeder Turm hat 3 Stufen, auf Stufe 3 wählst du eine von zwei Spezialisierungen. Dort kannst du auch verkaufen und das Ziel wählen (Erster, Stärkster, Nächster).
- **Reaktorkern ausbauen:** Den Kern antippen: Panzerung, Energieschild, Kernkanone, Energiefluss und die Notfall-Pulswelle.
- **Zwei Währungen:** Credits (durch Abschüsse) für Türme und Ausbau, Energie (lädt sich auf) für Spezialfähigkeiten.
- **Spezialfähigkeiten** (unten links): Orbitalschlag, Zeitverzerrung, Reparaturdrohnen und – nach Ausbau – Pulswelle.
- Oben siehst du, welche Gegner in der nächsten Welle kommen.

### Türme

| Turm | Stärke |
|---|---|
| Pulslaser | schnell, günstig, trifft auch Flieger |
| Plasmawerfer | Flächenschaden gegen Gruppen |
| Schienenkanone | riesige Reichweite, schießt durch mehrere Gegner |
| EMP-Turm | bremst Gegner, zerstört Schilde |
| Raketenwerfer | zielsuchend, besonders stark gegen Flieger |
| Bogenspule | Blitz springt von Gegner zu Gegner |
| Drohnenhangar | Drohnen jagen Gegner |
| Schildgenerator | schützt Nachbartürme |
| Radarmast | macht getarnte Gegner sichtbar, stärkt Nachbarn |

### Gegner

Schwärmer (viele, schwach) · Belagerer (gepanzert, beschießt Türme) · Schildträger · Phantom (getarnt) · Gleiter (fliegt direkt zum Kern) · Teiler (zerfällt in kleine Teile) · Schwarmträger (Boss alle 10 Wellen).

## Steuerung am PC

| Taste | Aktion |
|---|---|
| Klick | Bauen, Auswählen |
| Rechtsklick / Esc | Abbrechen |
| 1–9 | Turm wählen |
| Umschalt + Klick | mehrere Türme hintereinander bauen |
| Leertaste | Pause |
| N | Nächste Welle |
| F | Tempo 1x / 2x / 3x |
| Q W E R | Orbitalschlag, Zeitverzerrung, Reparatur, Pulswelle |
| U / V / T | Turm aufrüsten / verkaufen / Ziel wechseln |
| B | Kern-Ausbau öffnen |
| H, dann Klick | Kommandant auswählen und bewegen |
| Y / X | Fähigkeiten des Kommandanten |
| M | Ton an/aus |
| Esc | Pause-Menü |

Am Handy wird alles angetippt; die Knöpfe sind dafür groß genug.

## Schwierigkeit

Vor jeder Partie wählst du **Leicht · Mittel · Schwer · Experte**. Je höher, desto zäher die Gegner und desto weniger Start-Credits und Kern-Leben – dafür gibt es mehr Punkte. Auf **Leicht** kommen Wellen nur, wenn du sie startest.

## Die Modi

| | Standard | Advance |
|---|---|---|
| Wellen | 30 (Boss alle 10) | 30 (Boss alle 10) |
| Gegner | je nach Schwierigkeit | etwas zäher, dazu **Elite-Gegner** mit Sonderfähigkeiten |
| Tipps für den Einstieg | ja | – |
| **Kommandant** | – | eigene Einheit: antippen und irgendwohin schicken, kämpft mit, steigt bis Stufe 10 auf, hat 2 Fähigkeiten (Schockgranate, Überladung) |
| **Karten-Ereignisse** | – | Meteoritenschauer (beschädigt Türme), Sandsturm (weniger Reichweite), Energiesturm (Fähigkeiten schneller bereit) – jeweils vorher angekündigt |
| **Forschung** | – | Jede Runde bringt Forschungspunkte. Im Forschungslabor schaltest du dauerhafte Verbesserungen frei: neue Turm-Varianten, Basis-Boni, stärkere Fähigkeiten |

**Endlos-Modus:** Auf jeder Karte zuschaltbar – Wellen ohne Ende, sie werden immer härter.

**Tägliche Herausforderung:** Jeden Tag eine feste Karte, zwei Sonderregeln und dieselben Wellen für alle (20 Wellen auf „Mittel“ mit Kommandant und Ereignissen, ohne Forschungs-Boni).

**Karten-Editor:** Weg mit runden Kurven, Startpunkt, Landschaft (Glutwüste, Frostebene, Kristallfeld, Giftdschungel) und Hindernisse selbst setzen, speichern und in beiden Modi spielen.

**Erfolge:** 20 Erfolge zum Freischalten.

Rekorde, Forschung, Erfolge, eigene Karten, Einstellungen und der laufende Spielstand (zwischen den Wellen) werden im Browser gespeichert.

## Grafik

Vier Landschaften mit eigener Stimmung (Tag, Dämmerung, Nacht), runde Straßen mit Spuren, Flüsse aus Lava, Eis oder Gift, Licht von Schüssen und Explosionen, Bodennebel, Brandflecken. In den Einstellungen: **Grafik Hoch / Mittel / Niedrig** (am Handy startet das Spiel auf Mittel).

## Technik in Kürze

Reines HTML, CSS und JavaScript ohne Zusatzbibliotheken und ohne Build-Schritt. Gezeichnet wird mit Canvas 2D, Sounds entstehen mit der Web-Audio-Schnittstelle. Der Aufbau ist in `SCOPE.md` beschrieben, die Grafik-Runde in `GRAFIK.md`.

# KERNWACHT

**Version 1.0.7**

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

## Neu in Version 1.0.7

- **Frontbau im Raster:** Alles liegt auf sichtbaren Kästchen. Die Basis belegt 4 × 4 Kästchen, ein Turm eines. Jeder Turm reicht 1, 2 oder 3 Kästchen weit (auf Stufe 3 eines mehr) – angezeigt als farbige Kästchen.
  - 1 Kästchen: EMP, Bogenspule, Schildgenerator · 2 Kästchen: Pulslaser, Plasmawerfer, Drohnenhangar, Radarmast · 3 Kästchen: Schienenkanone, Raketenwerfer
- **Nachbar-Bonus:** Gleiche Türme nebeneinander machen je +10 % Schaden (bis +30 %), ein Radarmast stärkt die 8 Kästchen um sich herum um 15 %.
- **Neue Karten:** Sumpfstück (Gegner langsamer), Glutstück (Gegner brennen), Abzweigung (zweiter Eingang), Energiekristall (Türme daneben +1 Kästchen Reichweite), Risiko (zähere Welle, doppelte Credits), Türme direkt auf Stufe 2 oder 3.
- **Seltenheit:** Karten sind gewöhnlich, selten oder episch – mit farbigem Rahmen.
- **Neu ziehen:** Einmal pro Runde drei neue Karten gegen Credits.
- **Einführung:** Die ersten Runden Frontbau erklären Schritt für Schritt, was zu tun ist.
- **Bedienung:** Ein Klick auf eine leere Stelle hebt die Auswahl auf (wie Rechtsklick), Ziehen verschiebt die Karte. Gebaut wird so: erst Turm wählen, dann Platz anklicken.
- **Zwei neue Gegner:** Heiler (heilt Gegner in der Nähe) und Gräber (gräbt sich zeitweise ein und ist dann unverwundbar).
- **Auswertung** am Spielende: Schaden je Turmart als Balken.
- **Wochen-Herausforderung:** eine Woche lang dieselben Regeln für alle – 25 Wellen auf Schwer mit drei Sonderregeln, eigene Rangliste.
- Berge der Grenze jetzt auch im Karten-Editor.
- **Farbhilfe** für Farbenblinde in den Einstellungen (Blau/Orange statt Grün/Rot bei Leben, Bauvorschau und Reichweiten).
- Ohne Reparatur (Standard, Frontbau) beschleunigt der Schildgenerator seine Nachbarn, statt Schilde zu verteilen.

## Neu in Version 1.0.6

- **Frontbau** (neuer Modus): Vor jeder Welle ziehst du drei Karten und nimmst eine – ein Wegstück (der Weg der Gegner wird länger), einen Turm (kostenlos) oder eine Spezialkarte. Lege eine Turmkarte auf einen gleichen Turm, um ihn kostenlos aufzurüsten. Vor dem Start wählst du Landschaft und dein Kartendeck; weitere Karten schaltest du mit Erfolgen frei.
- **Tägliches Frontbau:** jeden Tag dieselben Karten in derselben Reihenfolge für alle, mit eigener Rangliste.
- Neuer Menüpunkt **Modi**: Advance, Frontbau, Tägliches Frontbau, Tägliche Herausforderung und Endlos an einer Stelle.
- **Größere Karten** (30 × 24 Felder) mit natürlicher Grenze: Bergketten (mit Schnee, Glut, Kristallen oder Moos) und Schluchten (mit Lava, Gift- oder Kristallschein) statt gerader Linien. Dahinter geht die Landschaft weiter.
- Die Mitte des Bildschirms kann bis an den Rand der Baufläche geschoben werden; weiter herauszoomen bis zur ganzen Karte.
- **Schaden:** Wo es keine Reparatur gibt (Standard, Frontbau), bleiben Türme heil – Belagerer und Bosse schießen dann aus der Nähe auf den Kern.
- Pfeile auf dem Weg zeigen, wo die nächste Welle entlangkommt.
- **Schnellbau:** Taste C wählt den zuletzt gebauten Turm noch einmal.
- Eigene Musikstimmung je Landschaft.
- Drei neue Erfolge (jetzt 23).

## Neu in Version 1.0.5

- Runde, moderne Türme: abgerundete Formen, weiche Glanzlichter, Kuppeldächer, Fußwulst, Lichtbänder entlang der Rundung, runde Geschützköpfe und Glaslinsen.
- Das Spiel füllt den ganzen Bildschirm: Leisten und Knöpfe liegen über der Karte, die Karte lässt sich unter den Leisten hervorziehen.
- Größere Karten (20 × 14 Felder) mit längeren Wegen.
- Zwei neue Karten: **Aschenserpentine** (Aschewüste, der längste Weg) und **Nebelsumpf** – mit zwei neuen Landschaften für den Editor.
- Flieger folgen grob dem Weg mit Abkürzungen, statt quer über die Karte zu fliegen.
- Auf Karten mit langen Wegen bleibt mehr Zeit zwischen den Wellen.

## Neu in Version 1.0.4

- Türme kleiner und schlanker, stimmigere Proportionen (kleinere Geschützköpfe und Bodenplatten), runde Felsbrocken, schlankerer Reaktor.

## Neu in Version 1.0.3

- Leicht schräge 3D-Ansicht: Türme, Felsen, Kristalle und der Reaktor stehen aufrecht und werfen Schatten.
- Jede Turmart hat eine eigene Bauform und Höhe (vom flachen Bunker bis zum hohen Radarmast).
- Türme unten mittig, Spezialfähigkeiten als Notfallknöpfe links, offene Leisten oben und unten.
- Spiel-Kärtchen beim Drüberfahren mit der Maus (Türme, Fähigkeiten, Gegner-Vorschau).
- Reparaturdrohnen nur im Advance-Modus.
- Reichweiten aller Türme auf Knopfdruck, Abdeckungs-Anzeige beim Bauen, Rückgängig nach dem Bauen.
- Zoomen (Mausrad, zwei Finger, + / −) und Verschieben (rechte Maustaste oder Ziehen).
- Feuerwerk vom besten Turm nach jeder Welle, mit Abschüssen und Schaden.
- Gegner-Lexikon, Turm-Erfahrung (Veteran, Elite, Legende) und vier Kombi-Effekte.
- **Kampagne** mit 8 Missionen und Funksprüchen, zweiter Boss **Maschinenkoloss** mit Störimpuls.
- Wetter je Karte (Glut, Schnee, Kristallstaub, Sporen).
- Vollbild-Knopf, als App installierbar (offline spielbar), Ergebnis teilen.
- **Rangliste** mit kleinem Server-Programm für den eigenen Server.

## So funktioniert's

- **Türme bauen:** Unten einen Turm wählen und auf einen freien Platz neben dem Weg tippen. Beim Bauen wird der freie Bereich dezent grün markiert. Tippen auf eine leere Stelle hebt die Auswahl auf, Ziehen verschiebt die Karte.
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

Schwärmer (viele, schwach) · Belagerer (gepanzert, beschießt den Kern – im Advance-Modus auch Türme) · Schildträger · Phantom (getarnt) · Gleiter (fliegt direkt zum Kern) · Teiler (zerfällt in kleine Teile) · Heiler (heilt Gegner in der Nähe) · Gräber (gräbt sich zeitweise ein) · Schwarmträger und Maschinenkoloss (Bosse alle 10 Wellen).

## Steuerung am PC

| Taste | Aktion |
|---|---|
| Klick | Bauen, Auswählen |
| Klick auf leere Stelle / Rechtsklick / Esc | Abbrechen, Auswahl aufheben |
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
| G | Reichweiten aller Türme |
| C | Schnellbau: zuletzt gebauten Turm wählen |
| Mausrad / + / − / 0 | Zoomen / zurücksetzen |
| Rechte Maustaste ziehen | Ansicht verschieben |
| F11 | Vollbild |
| Esc | Pause-Menü |

Am Handy wird alles angetippt; die Knöpfe sind dafür groß genug.

## Schwierigkeit

Vor jeder Partie wählst du **Leicht · Mittel · Schwer · Experte**. Je höher, desto zäher die Gegner und desto weniger Start-Credits und Kern-Leben – dafür gibt es mehr Punkte. Auf **Leicht** kommen Wellen nur, wenn du sie startest.

## Die Modi

Im Hauptmenü unter **Modi** findest du Advance, Frontbau, Tägliches Frontbau, Tägliche Herausforderung, Wochen-Herausforderung und Endlos.

| | Standard | Advance |
|---|---|---|
| Wellen | 30 (Boss alle 10) | 30 (Boss alle 10) |
| Gegner | je nach Schwierigkeit | etwas zäher, dazu **Elite-Gegner** mit Sonderfähigkeiten |
| Tipps für den Einstieg | ja | – |
| **Kommandant** | – | eigene Einheit: antippen und irgendwohin schicken, kämpft mit, steigt bis Stufe 10 auf, hat 2 Fähigkeiten (Schockgranate, Überladung) |
| **Karten-Ereignisse** | – | Meteoritenschauer (beschädigt Türme), Sandsturm (weniger Reichweite), Energiesturm (Fähigkeiten schneller bereit) – jeweils vorher angekündigt |
| **Forschung** | – | Jede Runde bringt Forschungspunkte. Im Forschungslabor schaltest du dauerhafte Verbesserungen frei: neue Turm-Varianten, Basis-Boni, stärkere Fähigkeiten |

**Endlos-Modus:** Auf jeder Karte zuschaltbar – Wellen ohne Ende, sie werden immer härter.

**Frontbau:** 30 Wellen auf einem Kästchen-Raster. Vor jeder Welle eine von drei Karten: Wegstück (auch Sumpf, Glut oder Abzweigung), Turm (kostenlos) oder Spezialkarte (Nachschub, Risiko, Energiekristall, Orbitalladung, Kernverstärkung, Doppelzug). Türme gibt es nur über Karten, Credits gehen in Ausbauten. Drohnenhangar, Schildgenerator und einige Spezialkarten werden über Erfolge freigeschaltet. Die erste Karte ist immer ein Turm.

**Tägliche Herausforderung:** Jeden Tag eine feste Karte, zwei Sonderregeln und dieselben Wellen für alle (20 Wellen auf „Mittel“ mit Kommandant und Ereignissen, ohne Forschungs-Boni).

**Wochen-Herausforderung:** Eine Woche lang feste Karte, drei Sonderregeln und dieselben Wellen für alle (25 Wellen auf „Schwer“).

**Karten-Editor:** Weg mit runden Kurven, Startpunkt, Landschaft (Glutwüste, Frostebene, Kristallfeld, Giftdschungel, Aschewüste, Nebelsumpf) und Hindernisse selbst setzen, speichern und in beiden Modi spielen.

**Erfolge:** 23 Erfolge zum Freischalten.

Rekorde, Forschung, Erfolge, eigene Karten, Einstellungen und der laufende Spielstand (zwischen den Wellen) werden im Browser gespeichert.

## Rangliste auf dem eigenen Server

Das Spiel trägt Ergebnisse automatisch ein, sobald in der Rangliste ein Spielername gesetzt ist. Dafür liegt ein kleines Server-Programm bei (braucht nur Node.js 18 oder neuer, keine Zusatzpakete):

```bash
node server/rangliste-server.js
```

Es liefert das Spiel und die Rangliste zusammen unter `http://localhost:8080` aus (Port mit `PORT=…` änderbar). Die Ergebnisse landen in `server/daten/rangliste.json`.

Läuft das Spiel woanders (zum Beispiel im Portal), zeigt die Rangliste standardmäßig auf `api/rangliste` neben dem Spiel. Eine andere Adresse lässt sich vor dem Spiel-Skript setzen:

```html
<script>window.KERNWACHT_API = 'https://mein-server.de/api/rangliste';</script>
```

Ist kein Server erreichbar, zeigt die Rangliste die eigenen besten Ergebnisse auf dem Gerät.

## Einbinden ins Portal (Vollbild)

Wird das Spiel in einem `<iframe>` eingebunden, braucht der Rahmen die Erlaubnis für Vollbild:

```html
<iframe src="https://…/kernwacht/" allow="fullscreen; autoplay" style="width:100%;height:100%;border:0"></iframe>
```

## Grafik

Sechs Landschaften mit eigener Stimmung (Tag, Dämmerung, Nacht), runde Straßen mit Spuren, Flüsse aus Lava, Eis oder Gift, Licht von Schüssen und Explosionen, Bodennebel, Brandflecken. In den Einstellungen: **Grafik Hoch / Mittel / Niedrig** (am Handy startet das Spiel auf Mittel).

## Technik in Kürze

Reines HTML, CSS und JavaScript ohne Zusatzbibliotheken und ohne Build-Schritt. Gezeichnet wird mit Canvas 2D, Sounds entstehen mit der Web-Audio-Schnittstelle. Der Aufbau ist in `SCOPE.md` beschrieben, die Grafik-Runde in `GRAFIK.md`.

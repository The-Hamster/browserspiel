# KERNWACHT – Scope

Sci-Fi-Tower-Defense im Browser. Forschungsstation **Aurelis** auf dem Planeten **Veyra IV** wird von Alien-Schwärmen und Maschinenwesen angegriffen. Der Spieler schützt den Reaktorkern.

## Spielablauf
1. Hauptmenü → Modus wählen → Karte wählen (optional Endlos) → Spiel.
2. Türme auf leuchtende Bauflächen setzen, Welle starten, Gegner laufen den Weg zum Reaktorkern.
3. Credits durch Abschüsse → Türme bauen/aufrüsten, Basis ausbauen. Energie lädt sich auf → Spezialfähigkeiten.
4. Sieg nach 30 Wellen (Tägliche Herausforderung: 20), Niederlage wenn der Kern zerstört wird. Statistik-Bildschirm.

## Modi
- **Standard**: 30 Wellen, Boss alle 10 Wellen, Tutorial-Tipps in den ersten Wellen.
- **Experte**: wie Standard, aber zähere Gegner, weniger Start-Credits, Elite-Gegner, Kommandant (Helden-Einheit), Karten-Ereignisse (Meteoriten, Sandsturm, Energiesturm), Forschungsbaum zwischen den Runden.
- **Endlos**: Schalter auf jeder Karte, Wellen ohne Ende.
- **Tägliche Herausforderung**: Experte-Regeln ohne Forschung, Karte + 2 Sonderregeln + Zufall fest pro Datum.
- **Wochen-Herausforderung** (ab 1.0.7): wie täglich, aber fest pro Kalenderwoche, 25 Wellen, Schwer, 3 Sonderregeln.
- **Karten-Editor**: Weg, Startpunkt, Bauflächen setzen, im localStorage speichern, in allen Modi spielbar.
- **Frontbau** (ab 1.0.6, unter „Modi“; ab 1.0.7 Raster 1 Kästchen = 1 Feld, Basis 4×4, Reichweite 1/2/3 Kästchen, Nachbar-Bonus, Sonderkacheln Sumpf/Glut, Abzweigung, Energiekristall, Risiko, Seltenheit, Neu ziehen): Vor jeder Welle 3 Karten ziehen, eine nehmen – Wegstück (Weg wächst als Baum vom Kern weg, jede Spitze ist ein Eingang), Turm (kostenlos, oder auf gleichen Turm legen = kostenlos aufrüsten) oder Spezialkarte (Nachschub, Orbitalladung, Kernverstärkung, Doppelzug). Kartendeck vor dem Start wählbar, weitere Karten über Erfolge. **Tägliches Frontbau**: gleiche Landschaft, gleiches Deck und gleiche Kartenreihenfolge für alle pro Datum.
- **Schaden** (ab 1.0.6): Wo es keine Reparatur gibt (Standard, Frontbau, Kampagne-Missionen im Standard-Modus), werden Türme nicht beschädigt – Belagerer und Bosse schießen dann aus der Nähe auf den Kern.

## Türme (je 3 Stufen, Stufe 3 = Wahl aus 2 Varianten, Experte-Forschung schaltet 3. Variante frei)
Pulslaser · Plasmawerfer · Schienenkanone · EMP-Turm · Raketenwerfer · Bogenspule (Tesla) · Drohnenhangar · Schildgenerator · Radarmast (Scanner gegen Tarnung). Zielmodus: Erster / Stärkster / Nächster. Verkaufen.

## Gegner
Schwärmer, Heiler (heilt Gegner in der Nähe), Gräber (zeitweise eingegraben = unverwundbar), Belagerer (Panzer, schießt auf den Kern bzw. im Advance-Modus auch auf Türme), Schildträger, Phantom (getarnt), Gleiter (Flieger), Teiler (zerfällt), Schwarmträger (Boss alle 10 Wellen). Experte: Elite-Varianten mit Sonderfähigkeiten.

## Basis (Reaktorkern)
Lebenspunkte, eigene Kernkanone. Ausbau: Panzerung, Energieschild, Kernkanone, Energiefluss, Notfall-Pulswelle.

## Fähigkeiten (Energie + Abklingzeit)
Orbitalschlag, Zeitverzerrung, Reparaturdrohnen, Pulswelle (nach Ausbau). Kommandant: Schockgranate, Überladung.

## Technik
- Reines HTML/CSS/JS (ES-Module), Canvas 2D, kein Build-Schritt, keine externen Dateien.
- Glow über vorgerenderte Sprites, Partikel in typisierten Arrays, Objekt-Pools, fester Simulationstakt (60 Hz) mit 1x/2x/3x.
- WebAudio-Synthese für alle Sounds, Lautstärke + Stumm.
- Maus, Tastatur, Touch; Querformat; localStorage für Einstellungen, Rekorde, Forschung, Erfolge, Karten, Spielstand.
- Karten 30 × 24 Felder; natürliche Grenze aus Bergen (aufrecht gezeichnet) und Schluchten (in der Bodenebene) mit unregelmäßigem Rand, Durchgänge an Wegen und Flüssen; Umgebung außerhalb als eigene Ebene.

## Dateien
```
index.html          Einstieg, DOM-Oberfläche
css/style.css       Neon-Oberfläche, responsive
js/main.js          Start, Hauptschleife, Bildschirme
js/data.js          Türme, Gegner, Karten, Ausbau, Forschung, Erfolge
js/waves.js         Wellen-Generator, Tagesregeln
js/kachel.js        Frontbau: Wegstücke, Karten ziehen, Deck
js/terrain.js       Boden, Wege, Grenze (Berge/Schluchten), Umgebung
js/rank.js          Rangliste
js/game.js          Simulation
js/render.js        Zeichnen, Sternenhimmel, Effekte
js/sprites.js       vorgerenderte Grafiken, Icons
js/particles.js     Partikelsystem
js/audio.js         Sound-Synthese
js/ui.js            HUD, Menüs, Panels
js/editor.js        Karten-Editor
js/storage.js       Speichern
js/util.js          Zufall, Hilfsfunktionen
```

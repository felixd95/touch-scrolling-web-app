# Fling- und Threshold-Logik (aktueller Stand)

Diese Datei beschreibt, wie die Fling- und Threshold-Logik aktuell im Projekt arbeitet.

## Wo die aktive Logik liegt

Die aktuell aktive Runtime-Implementierung liegt in:

- `src/ScrollList.js`

Hinweis:

- `src/scrollPhysics/flingThreshold.js`
- `src/scrollPhysics/overScrollerPhysics.js`

existieren ebenfalls, sind im aktuellen Stand aber nicht die primare Laufzeitquelle fuer die Scroll-Physik in `ScrollList`.

## Ablauf beim Touch

1. `handleTouchStart` startet die Gesten-Erfassung und leert alte Samples.
2. `handleTouchMove` sammelt Zeit-/Positions-Samples in einem kurzen Fenster.
3. `handleTouchEnd` berechnet aus den Samples die Regressions-Geschwindigkeit (`fingerVelocityPxMs`).
4. Wenn der Threshold erreicht ist, startet ein Fling (`startMomentum`), sonst kein Fling.

## Velocity-Schaetzung

Die Geschwindigkeit wird ueber lineare Regression auf den letzten Samples berechnet:

- Sample-Fenster: `ANDROID_SAMPLE_WINDOW_MS = 100`
- Max. Samples: `ANDROID_MAX_SAMPLES = 20`

Dadurch wird Rauschen reduziert, verglichen mit nur der letzten Delta-Messung.

## Threshold-Logik

Aktueller Mindest-Threshold:

- `FLING_THRESHOLD_PX_MS = 1`

Im End-Handler gilt:

- `meetsFlingThreshold = abs(fingerVelocityPxMs) >= FLING_THRESHOLD_PX_MS`

Nur dann wird `launchVelocity` gesetzt.

Zusaetzlich wird `launchVelocity` hart begrenzt:

- `ANDROID_MAX_LAUNCH_VELOCITY = 40` (px/ms)

Clamp:

- `launchVelocity = max(-40, min(40, launchVelocity))`

## Fling-Distanz und Dauer (Android-Spline)

Wenn ein Fling gestartet wird:

1. Umrechnung in px/s (`initialVelocityPxPerSec = initialVelocityPxMs * 1000`)
2. Distanz und Dauer kommen aus Android-inspirierten Spline-Formeln
3. Position wird pro Frame ueber die Spline-Tabelle (`ANDROID_SPLINE_TABLE`) interpoliert

Wichtige Parameter:

- `ANDROID_SCROLL_FRICTION = 0.015`
- `ANDROID_DECELERATION_RATE = log(0.78)/log(0.9)`
- `ANDROID_INFLEXION = 0.35`
- `ANDROID_SPLINE_SAMPLES = 100`

Je kleiner die Friction, desto laenger scrollt der Fling nach.

## Verhalten an den Raendern

### 1) Drag im Overscroll

Bei direktem Ziehen ausserhalb der Bounds wirkt Widerstand:

- `OVERSCROLL_RESISTANCE = 0.35`
- Maximaler Overscroll: `OVER_SCROLL_DISTANCE_PX = 120`

### 2) Ballistic-Phase bei Edge-Treffer

Wenn ein laufender Fling die Grenze trifft:

- Wechsel in `startBallisticPhase`
- Kinematik mit konstanter Gegenbeschleunigung
- Basis-Decel: `EDGE_BALLISTIC_DECEL_PX_S2 = 2000`
- Overshoot wird auf `OVER_SCROLL_DISTANCE_PX` begrenzt

### 3) Springback

Anschliessend Rueckfederung in den gueltigen Bereich (`startSpringback`):

- Mindestdauer: `MIN_SPRINGBACK_DURATION_MS = 180`
- Maximaldauer: `MAX_SPRINGBACK_DURATION_MS = 480`
- Easing: kubisch (`3t^2 - 2t^3`)

## Welche Parameter was beeinflussen

Fling startet haeufiger:

- `FLING_THRESHOLD_PX_MS` kleiner machen

Fling startet seltener:

- `FLING_THRESHOLD_PX_MS` groesser machen

Fling scrollt weiter:

- `ANDROID_SCROLL_FRICTION` kleiner machen
- `ANDROID_MAX_LAUNCH_VELOCITY` groesser machen (nur bei sehr schnellen Gesten relevant)

Weniger/mehr Rand-Ueberschwinger:

- `OVER_SCROLL_DISTANCE_PX` kleiner/groesser
- `EDGE_BALLISTIC_DECEL_PX_S2` groesser/kleiner

## Kurzfazit

Die aktuelle Logik kombiniert:

- festen Fling-Threshold in px/ms,
- Android-aehnliche Spline-Animation fuer den Haupt-Fling,
- Edge-Phasen (Ballistic + Springback) fuer natuerliches Verhalten an den Grenzen.

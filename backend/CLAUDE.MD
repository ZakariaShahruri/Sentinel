# CLAUDE.md — Sentinel Project

## Project Overview

**Sentinel** is a tilt-controlled marble balance game. You control a ball on a 2D maze by physically tilting your device — the onboard accelerometer reads the tilt and streams it to a web-based game where gravity is simulated in real time. Navigate the ball through the maze, avoid holes, and reach the goal.

> Tags: Embedded IoT · Real-time physics · Live web game

---

## Team Structure (6 People)

| Role | Responsibilities |
|---|---|
| **Product Owner (PO)** | Defines scope, prioritizes backlog, owns the product vision and demo narrative. Signs off on features each week. |
| **Scrum Master** | Facilitates sprint planning, standups, and retrospectives. Removes blockers, tracks progress across the 3-week plan. |
| **Web Developer** | Builds and maintains the live HTML5 canvas game served from the ESP32. Responsible for the maze renderer, ball physics loop, WebSocket/MQTT integration, and the game UI (score, lives, level). |
| **Integration Engineer** | Owns the base station firmware (ESP32): RF receive pipeline, WiFi web server, OLED status display, and continuous tilt packet forwarding to the browser via MQTT/WebSocket. |
| **IoT Engineer** | Owns the sensor node firmware (Arduino Nano): accelerometer sampling at continuous rate, 433MHz TX packet construction and transmission at ~20–50 Hz, OLED live status, and LED ring. Also responsible for the 3D-printed PLA enclosure (Fusion 360 design and printing). |
| **Data & Security Engineer** | Owns packet integrity (XOR checksum), heartbeat/watchdog logic, tamper detection (LDR), calibration of the accelerometer's "flat" reference, and tilt angle derivation from raw X/Y/Z. Also owns the DB schema for tilt readings and match/session history. |

---

## Hardware

### Sensor Node (×1, expandable)
- **MCU**: Arduino Nano
- **Sensor**: Accelerometer (I2C/SPI, 200Hz capable — run at 20–50 Hz for game streaming)
- **Radio**: 433MHz TX module (RadioHead library, custom packet format)
- **Display**: OLED (live tilt angles / connection status)
- **Indicator**: LED ring (game status at a glance)
- **Security**: LDR tamper detection
- **Enclosure**: 3D-printed PLA, snap-fit lid, 80×50×28mm target

### Base Station (×1)
- **MCU**: ESP32
- **Radio**: 433MHz RX module
- **Display**: OLED (running summary)
- **Indicators**: Red/Green LEDs, pushbutton, buzzer
- **Connectivity**: WiFi (serves live web game over local network)
- **Storage**: PostgreSQL (via backend API) for session/match history

---

## 1. Tilt Streaming Architecture

The Arduino Nano sends **continuous tilt packets** at ~20–50 Hz — one packet per tick regardless of whether anything interesting happened. This is a deliberate shift from event-driven to time-driven operation.

**Pipeline:**
```
Accelerometer (200Hz) → Downsample to 20–50 Hz → Pack X/Y/Z → 433MHz TX → ESP32 RX → MQTT/WebSocket → Browser physics loop
```

**Axes used by the game:**
- `X` — left/right tilt → ball accelerates left or right
- `Y` — forward/backward tilt → ball accelerates up or down on screen
- `Z` — perpendicular to platform (~1g when flat) — used for calibration and detecting if device is lifted/flipped

**Tilt to physics mapping:**
The browser reads X and Y as components of the gravity vector projected onto the maze plane. The ball's acceleration is:
```
ax = g * sin(atan2(x, z))   // roll angle
ay = g * sin(atan2(y, z))   // pitch angle
```
Where `g` is a tunable game gravity constant (e.g. 9.8 scaled to pixels/s²).

**Calibration:**
On startup the Arduino takes a 1-second average of X/Y/Z to establish the "flat" reference. All subsequent readings are offset-corrected against this baseline.

---

## 2. RF Packet Format

The 433MHz link is **one-way**: Nano transmits, ESP32 receives. The RadioHead library handles the physical layer; the packet structure is custom.

### Tilt Packet (12 bytes, sent every ~20–50ms)

| Byte | Field | Value |
|---|---|---|
| 0 | Preamble | `0xAA` |
| 1 | Version | `0x01` |
| 2 | Node ID | node identifier |
| 3 | Packet type | `0x10` = tilt data |
| 4–5 | X (int16, mg) | signed raw accelerometer X |
| 6–7 | Y (int16, mg) | signed raw accelerometer Y |
| 8–9 | Z (int16, mg) | signed raw accelerometer Z |
| 10 | Sequence number | rolling counter (wraps at 255) |
| 11 | Checksum | XOR of bytes 0–10 |

Values are in milli-g (mg): 1000 = 1g. Signed int16 range ±32768 mg covers ±32g, more than enough for any tilt.

### Heartbeat Packet (sent every 10s)
`0xAA | 0x01 | NODE | 0xFE`

The base station runs a **watchdog timer per node**: if no packet arrives within 30 seconds, the node is marked offline and the game pauses.

**XOR checksum:**
```c
uint8_t ck = 0;
for (int i = 0; i < 11; i++) ck ^= buf[i];
```
Receiver rejects any packet where computed checksum ≠ byte 11.

---

## 3. ESP32 Web Server & MQTT

The ESP32 receives tilt packets over RF and immediately forwards them to the browser via MQTT over WebSocket. No processing or physics happens on the ESP32 — it is a transparent relay.

### Architecture

```
Arduino Nano (433MHz TX) → ESP32 (WiFi) → MQTT broker (Mosquitto) → browser game (MQTT over WebSocket)
```

### MQTT Topics

| Topic | Direction | Payload |
|---|---|---|
| `sentinel/tilt` | ESP32 → broker → browser | `{"node":1,"x":120,"y":-45,"z":980,"seq":42,"ts":12345}` |
| `sentinel/status` | ESP32 → broker → browser | `{"node_online":true}` |

### HTTP Endpoints (served by ESPAsyncWebServer)

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Full HTML5 game (served from PROGMEM) |
| `/sessions` | GET | JSON array of recent game sessions |
| `/ws` | WebSocket | Direct WebSocket endpoint (alternative to MQTT path) |

### Game Client

The browser runs the physics loop at 60 fps. On each MQTT tilt message it updates the gravity vector; on each frame it integrates acceleration, moves the ball, checks collisions with walls and holes.

```js
const client = mqtt.connect('ws://192.168.x.x:9001');
client.subscribe('sentinel/tilt');
client.on('message', (topic, payload) => {
  const { x, y, z } = JSON.parse(payload);
  game.setGravity(x, y, z);  // browser updates gravity vector
});
```

### Broker Setup (Mosquitto)
```
listener 1883
listener 9001
protocol websockets
allow_anonymous true
```

---

## 4. Database Schema

The backend (FastAPI + PostgreSQL) stores tilt readings and game session history.

### `tilt_readings` table

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `node_id` | bigint | FK to nodes |
| `sequence_num` | smallint | for packet loss detection |
| `node_timestamp` | bigint | Arduino `millis()` |
| `x` | int | raw accelerometer X in mg |
| `y` | int | raw accelerometer Y in mg |
| `z` | int | raw accelerometer Z in mg |
| `received_at` | timestamptz | server receipt time |

`event_class`, `confidence`, `peak_amplitude`, `rms_energy`, `zcr`, `decay_ms` are **not captured** — they are vibration classification features and have no meaning in a tilt-streaming context.

### `matches` / `sessions` table (existing, kept)

Tracks game sessions: player IDs, score, outcome, duration.

---

## 5. Fusion 360 Enclosure Design

Target dimensions for sensor node: **80×50×28mm** (fits Nano, accelerometer, 433MHz TX, battery holder with 4mm clearance on all sides).

### Key Design Principles

**Tolerance-first:**
- Accelerometer pocket: 0.3mm larger than chip on every side (drop-in fit).
- OLED aperture: 0.5mm smaller than display glass (display rests on ledge from behind).

**Snap-fit lid (no screws):**
- 1mm lip around top edge of base; 1mm inset on lid.
- Faster to open for debugging; cleaner for demo.

**Sensor window:**
- 2mm floor with a 12×12mm recess to bring sensor close to outer skin.
- Thinner floor = better vibration coupling.

**Print orientation:**
- Stand enclosure on its long side so layer lines run horizontally across the face.
- Snap-fit lip is strongest with layers parallel to stress direction.
- Layer height: 0.2mm for visible surfaces, 0.3mm elsewhere.

---

## 3-Week Sprint Plan

### Week 1 — Sense & Stream
- Configure accelerometer for continuous output at 20–50 Hz
- Build tilt packet format + XOR checksum on Nano
- 433MHz TX/RX link verified end-to-end
- Calibration routine (flat reference on startup)
- Start enclosure design in Fusion 360

### Week 2 — Physics & Game
- Browser physics loop: gravity vector → ball acceleration → position integration
- Maze renderer (HTML5 canvas): walls, holes, goal
- MQTT/WebSocket tilt stream wired into game loop
- Collision detection (walls, holes, goal)
- OLED status UI on both devices; print enclosures

### Week 3 — Polish & Prove
- Multiple maze levels
- Score, lives, timer UI
- Watchdog: game pauses if node goes offline
- Demo video, GitHub README, architecture writeup

---

## What Makes This a Real Product

- **Physical controller**: The Arduino Nano streams real accelerometer tilt data at up to 50 Hz over 433MHz RF — no Bluetooth, no WiFi on the node. The device is the controller.
- **Custom RF protocol**: Packets carry raw X/Y/Z readings, node ID, sequence number, and checksum. The base station validates checksums and watchdogs node connectivity.
- **3D-printed enclosure**: Designed in Fusion 360, printed at Group T's workshop. Snap-fit lid, recessed sensor window, cable routing built in.
- **Live browser game**: The ESP32 relays tilt data to a local Mosquitto broker. The browser subscribes via MQTT-over-WebSocket and runs a 60 fps physics simulation — open a browser, tilt the node, watch the marble roll.

---

## Repository & Deliverables
- Firmware A: sensor node (Arduino Nano — accelerometer streaming, tilt packet TX)
- Firmware B: base station (ESP32 — 433MHz RX, MQTT publish, web server)
- Web game: HTML5 canvas, ball physics, maze levels, MQTT tilt integration
- Hardware & enclosure: Fusion 360 source files, print settings, assembly guide
- Backend: FastAPI + PostgreSQL, tilt_readings table, session history
- Docs & demo: architecture diagrams, README, demo video script, presentation slides
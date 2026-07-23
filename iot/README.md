# Sentinel — Hardware & Firmware

Multi-node IoT system using Arduino Nano(s) with MPU-6050 accelerometers and an ESP32 base station.

Each Nano samples at ~90Hz and transmits AES-128 encrypted packets over 433MHz RF. The ESP32 base receives, decrypts, and processes packets differently per node ID, then forwards data to the backend via Socket.IO. An OLED display and three LEDs on the base give live local feedback.

---

## Architecture

```
[Nano + MPU-6050]  --433MHz RF (AES-128 CTR)-->  [ESP32 base]  --Socket.IO-->  [Backend API]
  accelerometer                                     RF receive
  delta-compressed packets                          per-node dispatch
  NODE_ID in RF header                              OLED + LEDs
```

---

## Node types

Each node runs the same firmware. `NODE_ID` in `config.h` determines how the base processes its data.

| NODE_ID | Role | Socket.IO event |
| ------- | ---- | --------------- |
| `0x01`  | Vibration monitor — peak, RMS, ZCR, decay forwarded to dashboard | `sentinel_data` |
| `0x02`  | Marble balancing game — roll and pitch in degrees | `game_data` |

---

## Hardware

### Components

| Component                 | Role |
| ------------------------- | ---- |
| Arduino Nano (ATmega328P) | Sensor node — samples MPU-6050, transmits over RF |
| MPU-6050                  | Accelerometer — I2C on A4 (SDA) and A5 (SCL) |
| 433MHz TX module          | Transmits packets from Nano on D12 |
| ESP32                     | Base station — receives RF, processes, forwards |
| 433MHz RX module          | Receives packets on ESP32 GPIO4 |
| SH1106 OLED (128×64)      | Live data display on base — I2C on GPIO21/22 |
| Green LED                 | Base GPIO25 — WiFi connected indicator |
| Yellow LED                | Base GPIO26 — medium vibration / slight tilt |
| Red LED                   | Base GPIO27 — high vibration / heavy tilt |

### Nano wiring

| From             | To        | Notes |
| ---------------- | --------- | ----- |
| MPU-6050 VCC     | Nano 3.3V | 3.3V only — not 5V tolerant |
| MPU-6050 GND     | Nano GND  | |
| MPU-6050 SDA     | Nano A4   | I2C shared with OLED (node 0x01) |
| MPU-6050 SCL     | Nano A5   | I2C shared with OLED (node 0x01) |
| 433MHz TX signal | Nano D12  | RH_ASK TX pin |
| 433MHz TX GND    | Nano GND  | |
| 433MHz TX VCC    | Nano 5V   | 5V for better range |
| Battery +        | Nano VIN  | 6–12V; 4× AA recommended |
| Battery −        | Nano GND  | |

**Node `0x01` only — OLED display and LEDs:**

| From              | To           | Notes |
| ----------------- | ------------ | ----- |
| OLED VCC          | Nano 3.3V    | 3.3V only |
| OLED GND          | Nano GND     | |
| OLED SDA          | Nano A4      | Shared I2C bus with MPU-6050 |
| OLED SCL          | Nano A5      | Shared I2C bus with MPU-6050 |
| Green LED anode   | 220Ω → D5    | Always on after calibration |
| Yellow LED anode  | 220Ω → D6    | Medium vibration (mag ≥ 200) |
| Red LED anode     | 220Ω → D7    | High vibration (mag ≥ 800) |
| All LED cathodes  | Nano GND     | |

> Disconnect anything on Nano D0/D1 (hardware serial) before uploading firmware — they share the bootloader line.

### ESP32 base station wiring

| From              | To           | Notes |
| ----------------- | ------------ | ----- |
| 433MHz RX signal  | ESP32 GPIO4  | |
| 433MHz RX GND     | ESP32 GND    | |
| 433MHz RX VCC     | ESP32 3.3V or 5V | 5V gives slightly better sensitivity |
| OLED VCC          | ESP32 3.3V   | 3.3V only |
| OLED GND          | ESP32 GND    | |
| OLED SDA          | ESP32 GPIO21 | Hardware I2C |
| OLED SCL          | ESP32 GPIO22 | Hardware I2C |
| Green LED anode   | 220Ω → GPIO25 | WiFi alive indicator |
| Yellow LED anode  | 220Ω → GPIO26 | Intensity / tilt |
| Red LED anode     | 220Ω → GPIO27 | Intensity / tilt |
| All LED cathodes  | ESP32 GND    | |

> Solder a 17.3cm wire to the ANT pad on both RF modules for reliable range.

### Powering the Nano wirelessly

| Option     | Notes |
| ---------- | ----- |
| 4× AA (6V) | Recommended — long life, stays in regulator's comfortable range |
| 9V block   | Works, but wastes energy as heat in the regulator |

---

## Repo structure

```
sentinel-node/              Arduino Nano firmware (PlatformIO)
  src/main.cpp              Accelerometer sampling, AES encrypt, RF transmit
  include/config.h          NODE_ID + AES key — gitignored, copy from .example
  include/config.h.example  Config template
  platformio.ini            Board: nanoatmega328new, ATmega328P, 16MHz

sentinel-base/              ESP32 base station firmware (PlatformIO)
  src/main.cpp              RF receive, per-node dispatch, OLED, LEDs, Socket.IO
  include/config.h          WiFi + AES config — gitignored, copy from .example
  include/config.h.example  Config template
  platformio.ini            Board: esp32dev
```

---

## Setup

### Nano firmware

Copy the config template:

```bash
cp sentinel-node/include/config.h.example sentinel-node/include/config.h
```

Set `NODE_ID` and `AES_KEY_BYTES` in `config.h`:

```cpp
#define NODE_ID 0x01        // 0x01 = vibration monitor, 0x02 = marble game
#define AES_KEY_BYTES { 0x00, ... }  // must match the base station
```

Open `sentinel-node/` in PlatformIO and upload via USB.

Board target is `nanoatmega328new`. If upload fails try `nanoatmega328old` in `platformio.ini`.

### ESP32 firmware

Copy the config template:

```bash
cp sentinel-base/include/config.h.example sentinel-base/include/config.h
```

Fill in `WIFI_SSID`, `WIFI_PASS`, and `AES_KEY_BYTES`. Open `sentinel-base/` in PlatformIO and upload.

---

## Data formats

### RF packet (Nano → ESP32)

4800 baud via RadioHead RH_ASK. Header ID `0x04`, FROM field = `NODE_ID`.

Payload (binary):

| Field | Type | Notes |
| ----- | ---- | ----- |
| `seq` | int16 LE | Packet sequence number — plaintext |
| `flags` | uint8 | Plaintext |
| `sample_count` | uint8 | Plaintext |
| `scale` | uint8 | Delta scale factor — plaintext |
| `s0` | 3× int16 LE | First sample absolute — AES-128 CTR encrypted |
| `deltas` | (count−1) × 3× int8 | Subsequent samples as deltas — encrypted |

AES-128 CTR nonce incorporates `NODE_ID` in byte 5 and `seq` in bytes 6–7, preventing keystream reuse across nodes.

### Socket.IO events (ESP32 → Backend)

#### `sentinel_data` — node `0x01` (vibration monitor)

```json
{
  "room": "sentinel",
  "node_id": 1,
  "seq": 42,
  "count": 12,
  "scale": 128,
  "peak": 1240,
  "rms": 604,
  "zcr": 3,
  "decay": 72,
  "lastx": 80,
  "lasty": -12,
  "lastz": 44
}
```

#### `game_data` — node `0x02` (marble game)

```json
{
  "room": "sentinel",
  "node_id": 2,
  "seq": 17,
  "roll": 12.5,
  "pitch": -3.2
}
```

`roll` and `pitch` are in degrees (±30° range). Positive roll = right tilt, positive pitch = forward tilt.

### OLED display (vibration node `0x01`)

```
Row 0: NODE  0x01          (static — node identity)
Row 1: Cal: OK             (set after 200-sample calibration on boot)
Row 2: Pkts: 142           (increments each transmitted packet)
Row 3: Mag:  1240          (peak axis magnitude this window)
Row 4: Lvl:  HIGH          (LOW / MED / HIGH)
Row 5: ----------------    (static separator)
Row 6: Last: HIGH          (highest level seen ≥ MED since boot)
Row 7: @ pkt 141           (packet number where that event occurred)
```

Rows 6–7 only appear after the first MED-or-higher event.

### OLED display (base station)

```
Row 0: BASE STATION
Row 1: W:OK  S:OK          WiFi and Socket.IO status
Row 2: N:01 Pkts:142       Active node ID and total packet count
Row 3: Peak:1240           (vibration) or Roll: +12.5  (game)
Row 4: RMS: 604            (vibration) or Ptch: -3.2   (game)
Row 5: ZCR: 3              (vibration) or blank        (game)
Row 6: Dec: 72%            (vibration) or blank        (game)
Row 7: Lvl: MED            (vibration) or Tilt: SLIGHT (game)
```

### LED behaviour (vibration node `0x01`)

| Peak magnitude | Green | Yellow | Red |
| -------------- | ----- | ------ | --- |
| Any (calibrated) | on | — | — |
| ≥ 200 | on | on | — |
| ≥ 800 | on | on | on |

Yellow and red auto-clear 350ms after the packet that triggered them (same hold logic as the base).

Node `0x02` (game) has no LEDs or display — firmware compiles without them.

### LED behaviour (base station)

**Node `0x01` — vibration intensity:**

| Peak value | Green | Yellow | Red |
| ---------- | ----- | ------ | --- |
| Any (WiFi up) | on | — | — |
| ≥ 200 | on | on | — |
| ≥ 800 | on | on | on |

**Node `0x02` — tilt indicator:**

| Max(|roll|, |pitch|) | Green | Yellow | Red |
| -------------------- | ----- | ------ | --- |
| Any (WiFi up) | on | — | — |
| ≥ 5° | on | on | — |
| ≥ 15° | on | on | on |

Yellow and red auto-clear 350ms after the last packet if vibration/tilt drops below threshold.

---

## Current status

- [x] Accelerometer wired and reading
- [x] Auto-calibration on startup (200-sample average)
- [x] AES-128 CTR encryption with per-node nonce
- [x] 433MHz RF transmit from Nano
- [x] 433MHz RF receive on ESP32
- [x] WiFi + Socket.IO connection on ESP32
- [x] Per-node dispatch (NODE_ID in RF header)
- [x] Node `0x01` — vibration features (peak, RMS, ZCR, decay)
- [x] Node `0x02` — tilt (roll, pitch in degrees)
- [x] OLED display on base station
- [x] LED intensity / tilt indicators on base station
- [x] Node `0x01` — OLED display (live magnitude, level, last event)
- [x] Node `0x01` — LED intensity indicators on node itself (D5/D6/D7)
- [ ] Vibration classifier decision tree
- [ ] Backend API (server + storage)
- [ ] Web dashboard

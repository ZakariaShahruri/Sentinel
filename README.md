# Sentinel

**A multi-node IoT vibration-monitoring platform** — battery-powered sensor nodes stream
encrypted accelerometer data over 433&nbsp;MHz RF to a base station, which forwards
classified events to a REST backend and a real-time web dashboard.

This monorepo combines the three components of the system (hardware/firmware, backend API,
and web frontend) into a single repository.

> Originally built by **Team EN04** as an integration project at UC Leuven-Limburg (UCLL),
> May 2026. See [Team & attribution](#team--attribution) below.

---

## Architecture

```
┌──────────────────────┐        ┌────────────────────┐        ┌─────────────────┐        ┌──────────────────┐
│  Arduino Nano node    │  433MHz │   ESP32 base       │ Socket │  FastAPI backend │  HTTP  │  Next.js frontend │
│  MPU-6050 accelerometer│──RF───▶│  station           │──.IO──▶│  + PostgreSQL    │◀──────▶│  dashboard        │
│  AES-128 CTR packets   │ (AES)  │  decrypt + dispatch │        │  ETL + ML events │        │  live monitoring  │
└──────────────────────┘        │  OLED + status LEDs│        └─────────────────┘        └──────────────────┘
                                 └────────────────────┘
```

Each Nano samples at ~90&nbsp;Hz and transmits delta-compressed, AES-128-encrypted packets
over 433&nbsp;MHz RF. The ESP32 base station receives, decrypts, and dispatches packets by
node ID, drives an OLED and status LEDs for local feedback, and forwards data to the backend
over Socket.IO. The backend classifies vibration events, persists them to PostgreSQL, and
exposes them over HTTP. The Next.js dashboard visualises node status, events, alarms, and
system health in real time.

## Repository layout

| Path         | Component        | Stack                                                     |
| ------------ | ---------------- | --------------------------------------------------------- |
| [`iot/`](iot)         | Hardware / firmware | Arduino Nano (C++), ESP32 (C++), MPU-6050, 433&nbsp;MHz RF |
| [`backend/`](backend) | REST API + ETL      | Python, FastAPI, PostgreSQL, Alembic, Docker              |
| [`frontend/`](frontend)| Web dashboard       | TypeScript, Next.js, React, Jest                          |

Each subfolder keeps its own README with detailed setup instructions.

## Quick start

Each component runs independently — see the per-component READMEs:

- **Hardware / firmware:** [`iot/README.md`](iot/README.md)
- **Backend API:** [`backend/README.md`](backend/README.md) — Python 3.11+, `docker compose up -d`, `alembic upgrade head`
- **Frontend dashboard:** [`frontend/README.md`](frontend/README.md) — Node.js 18+, `npm install`, `npm run dev`

The frontend expects the backend running on `http://localhost:8000`; the backend receives
data from the base station over Socket.IO.

## Highlights

- **Custom RF protocol** — delta-compressed sensor packets with AES-128-CTR encryption over
  433&nbsp;MHz, with per-node dispatch on the base station.
- **Real-time pipeline** — sensor → base → Socket.IO → backend ETL → dashboard, end to end.
- **Event classification** — vibration events (peak, RMS, zero-crossing rate, decay) derived
  on-device and classified server-side.
- **Production-minded tooling** — Docker Compose, Alembic migrations, monitoring, CI code-quality
  gates (ruff / ESLint / Prettier), and test suites across backend and frontend.

## Team & attribution

Sentinel was a group project by **Team EN04** (UCLL Integration Project, May 2026). This
monorepo is maintained by **[Zakaria Shahruri](https://github.com/ZakariaShahruri)**, who
led the **hardware / IoT** component (sensor firmware and ESP32 base station).

The commit history preserves original authorship: each component's commits are attributed to
its lead contributor, with `Co-authored-by` trailers crediting the full team. Contributors:

- Zakaria Shahruri — hardware / IoT lead
- Nathan Pennings — frontend lead
- Oleksandr Uvarov — backend lead
- Milan Vandenbussche
- Mohammed (Med23B)
- MrB
- Tiebe Van Nieuwenhove

# Sentinel — backend

FastAPI + Socket.IO service for the **Sentinel** wireless sensor platform. The ESP32 base
station connects over Socket.IO and streams processed sensor data; the backend classifies and
persists it to PostgreSQL and re-broadcasts it to dashboard clients in real time. It serves both
platform applications — the **vibration monitor** (`sentinel_data`) and the **marble game**
(`game_data`) — plus JWT/OTP authentication and a REST API for the frontend.

## Prerequisites

- [Python](https://www.python.org/downloads/) v3.11 or higher
- [pip](https://pip.pypa.io/en/stable/) v23 or higher
- [Docker](https://www.docker.com/) for running PostgreSQL

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. Never commit `.env`.

```bash
cp .env.example .env
```

## Install python dependencies

```bash
pip install -r requirements.txt
```

## Code quality

The project uses ruff for linting and formatting, enforced via a pre-commit hook and a CI workflow.

### Install the pre-commit hook (run once after cloning)

```bash
pre-commit install
```

After this, ruff will run automatically before every commit. A commit is blocked if there are lint or formatting violations.

### Run manually

```bash
ruff check .        #lint
ruff format --check #check the formatting without changing any files
ruff format .        #fix the formatting
```

### CI

The `code-quality.yaml` workflow runs on every pr to `main` and it blocks merges if ruff finds any violations.

## Setting up docker

```bash
docker compose up -d
```

## Apply the schema

```bash
alembic upgrade head
```

### or run it standalone:

```bash
python seed.py
```

## Running backend

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Swagger overview of endpoints

`http://localhost:8000/docs`

## Auth & OTP flow

- `POST /auth/login` (form data): verifies username/email + password.
  - Admins get a JWT immediately.
  - Non-admins receive an OTP email and a response with `requires_otp`.
- `POST /auth/verify-otp` (JSON): verifies `{ email, otp }` and issues a JWT.
- `GET /auth/me`: returns the token subject info.

### Local SMTP testing (Mailpit)

- The Docker Compose stack includes `mailpit` for local SMTP testing. Mailpit exposes:
  - SMTP on port `1025` (container name `mailpit`) — used by the backend.
  - Web UI on port `8025` (http://localhost:8025) to view sent messages.

Run the stack locally and open Mailpit UI:

```
  http://localhost:8025
```

Your `.env` is preconfigured to point `SMTP_HOST=localhost` and `SMTP_PORT=1025` when you run the backend directly on your host.
If you use Docker Compose for the backend, the compose file overrides `SMTP_HOST` to `mailpit` inside the container network.

Do NOT use Mailpit in production — it's only for development and QA.

## Project Structure

```
controller/            route handlers — REST endpoints + wsController.py (Socket.IO server)
service/               business logic and SQL queries
alembic/               database migrations
analysis/              standalone analytics (Dash dashboard + LLM event analysis)

main.py                FastAPI + Socket.IO ASGI app; APScheduler cleanup job
models.py              SQLAlchemy models and the EventClass enum
event_classifier.py    heuristic classifier — peak / RMS / ZCR / decay → event class
config.py              settings loaded from the environment
seed.py                seeds the initial admin user and reference data
```

## Architecture

The ESP32 base station connects to this backend as a Socket.IO client and streams processed
sensor data; the backend persists it and re-broadcasts to dashboard clients in real time:

```
Arduino Nano (sensor node)
  → 433 MHz RF (AES-128-CTR, delta-compressed) →
ESP32 (base station — decrypts, computes features / tilt)
  → Socket.IO ("sentinel_data" / "game_data") →
FastAPI + Socket.IO backend (classify + persist)
  → PostgreSQL + Socket.IO broadcast →
Frontend (vibration dashboard / marble game)
```

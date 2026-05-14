# Sentinel — backend

REST API for the Sentinel vibration-sensing IoT system. It receives classified vibration events from the Arduino Nano sensor nodes (via the ESP32 base station), it stores them in PostgreSQL, and then exposes them over HTTP for the frontend dashboard.

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
controller/        route handlers (HTTP layer)
service/           business logic and SQL queries
alembic/           database migrations

packet_parser.py   encodes/decodes 12-byte RF packets from the Arduino nodes
etl.py             polls the ESP32 every 5s and writes events to the database
mock_ingest.py     inserts fake events — use this when no hardware is available
watchdog.py        logs which nodes are online based on heartbeat timeout
evaluate.py        runs the classifier against training_samples and prints a report
seed_user.py       creates the initial admin user (run once)
```

## Architecture

Data flows from the physical sensor nodes through the ESP32 base station into this backend:

```
Arduino Nano (sensor node)
  → 433 MHz RF →
ESP32 (base station, /events endpoint)
  → HTTP polling every 5s (etl.py) →
PostgreSQL
  → FastAPI REST API →
Frontend dashboard
```

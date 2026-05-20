import os
import time
import logging
from dataclasses import dataclass
from typing import Optional

import requests
import psycopg2
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

ESP32_URL = os.getenv("ESP32_URL", "http://192.168.1.100")
POLL_SEC = 5
CONFIDENCE_MIN = 0
CONFIDENCE_MAX = 100

# ─────────────────────────────────────────────────────────────────────────────
# State: last seen sequence number per node, to detect drops and duplicates
# ─────────────────────────────────────────────────────────────────────────────
last_seq: dict[str, int] = {}


# ─────────────────────────────────────────────────────────────────────────────
# EXTRACT — fetch raw event list from the ESP32 web server
# ─────────────────────────────────────────────────────────────────────────────
def extract() -> list[dict]:
    """GET /events from the ESP32. Returns a list of raw event dicts, or [] on failure."""
    try:
        resp = requests.get(f"{ESP32_URL}/events", timeout=3)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        log.warning(f"Extract failed: {e}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# TRANSFORM — validate, normalise, and enrich each raw event
# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class CleanEvent:
    node_id: int
    event_class: str
    confidence: int
    sequence_num: int
    node_timestamp: int
    is_heartbeat: bool
    dropped_packets: int  # gap since last sequence number


def transform(raw: dict) -> Optional[CleanEvent]:
    """Validate and normalise one raw event dict from the ESP32.
    Returns None if the event should be discarded."""

    node_id = int(raw.get("node_id", 0))
    event_class = raw.get("event_class", "")
    confidence = raw.get("confidence", -1)
    sequence = raw.get("sequence", -1)
    timestamp = raw.get("timestamp", 0)
    is_heartbeat = raw.get("heartbeat", False)

    # ── structural checks ──────────────────────────────────────────────────
    if not node_id:
        log.warning("Dropped: missing node_id")
        return None

    valid_classes = {"background", "footstep", "door_slam", "impact", "unknown"}
    if not is_heartbeat and event_class not in valid_classes:
        log.warning(f"Dropped [{node_id}]: unknown event_class '{event_class}'")
        return None

    if not (CONFIDENCE_MIN <= confidence <= CONFIDENCE_MAX):
        log.warning(f"Dropped [{node_id}]: confidence {confidence} out of range")
        return None

    # ── duplicate detection ────────────────────────────────────────────────
    if node_id in last_seq and sequence == last_seq[node_id]:
        log.debug(f"Dropped [{node_id}]: duplicate seq={sequence}")
        return None

    # ── dropped packet detection ───────────────────────────────────────────
    dropped = 0
    if node_id in last_seq:
        expected = (last_seq[node_id] + 1) % 256
        if sequence != expected:
            dropped = (sequence - last_seq[node_id] - 1) % 256
            if dropped > 0:
                log.warning(f"[{node_id}] {dropped} packet(s) dropped (seq {last_seq[node_id]} → {sequence})")

    last_seq[node_id] = sequence

    return CleanEvent(
        node_id=node_id,
        event_class=event_class,
        confidence=confidence,
        sequence_num=sequence,
        node_timestamp=timestamp,
        is_heartbeat=is_heartbeat,
        dropped_packets=dropped,
    )


# ─────────────────────────────────────────────────────────────────────────────
# LOAD — write one clean event to the database
# ─────────────────────────────────────────────────────────────────────────────
def load(cur, event: CleanEvent) -> None:
    """Insert a validated event or heartbeat into the database."""

    # ensure the node is registered
    cur.execute(
        "INSERT INTO nodes (node_id) VALUES (%s) ON CONFLICT (node_id) DO NOTHING",
        (event.node_id,),
    )

    if event.is_heartbeat:
        cur.execute("INSERT INTO heartbeats (node_id) VALUES (%s)", (event.node_id,))
        log.info(f"[{event.node_id}] heartbeat")
    else:
        cur.execute(
            """
            INSERT INTO events
              (node_id, event_class, confidence, sequence_num, node_timestamp)
            VALUES (%s, %s::event_class, %s, %s, %s)
            """,
            (
                event.node_id,
                event.event_class,
                event.confidence,
                event.sequence_num,
                event.node_timestamp,
            ),
        )
        log.info(f"[{event.node_id}] {event.event_class} conf={event.confidence}%  seq={event.sequence_num}")

    cur.execute("UPDATE nodes SET last_seen = NOW() WHERE node_id = %s", (event.node_id,))


# ─────────────────────────────────────────────────────────────────────────────
# Pipeline loop
# ─────────────────────────────────────────────────────────────────────────────
def run():
    conn = psycopg2.connect(os.getenv("DB_URL"))
    log.info(f"ETL pipeline started — polling {ESP32_URL}/events every {POLL_SEC}s")

    while True:
        raw_events = extract()

        if raw_events:
            cur = conn.cursor()
            loaded = 0
            for raw in raw_events:
                event = transform(raw)
                if event is not None:
                    load(cur, event)
                    loaded += 1
            conn.commit()
            cur.close()
            if loaded:
                log.info(f"Cycle complete — {loaded}/{len(raw_events)} events loaded")

        time.sleep(POLL_SEC)


if __name__ == "__main__":
    run()

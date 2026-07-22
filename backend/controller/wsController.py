import socketio
import asyncio
import psycopg2
import psycopg2.extras
from service.events import create_event
from controller.schemas import EventCreate
from models import EventClass
from config import DATABASE_URL

# Async Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",  # tells it to run as an ASGI app, not a standalone server so that it can live inside FastAPI
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=False,
)


# ── Connection lifecycle ──────────────────────────────────────────


@sio.event
async def connect(sid, environ, auth):
    print(f"[SIO] Client connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"[SIO] Client disconnected: {sid}")


# ── Room joining (ESP32 base station and dashboard clients) ───────


@sio.event
async def joinRoom(sid, room):
    await sio.enter_room(sid, room)
    print(f"[SIO] {sid} joined room: {room}")


# ── Sensor data from ESP32 ────────────────────────────────────────


@sio.event
async def sentinel_data(sid, data):
    """
    Receives: { node, peak, rms, zcr, decay, timestamp }
    Saves to DB and broadcasts to dashboard listeners.
    """
    print(f"[SIO] sentinel_data from {sid}: {data}")

    def _insert():
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
        body = EventCreate(
            node_id=data["node"],
            event_class=EventClass.background,
            confidence=0,
            sequence_num=data["seq"],
            node_timestamp=data["timestamp"],
            peak_amplitude=data["peak"],
            rms_energy=data["rms"],
            zcr=data["zcr"],
            decay_ms=data["decay"],
            lastx=data["lastx"],
            lasty=data["lasty"],
            lastz=data["lastz"],
        )

        row = create_event(conn, body)
        conn.close()
        return row

    await asyncio.to_thread(_insert)

    # Forward to any dashboard clients in the same room
    await sio.emit("sentinel_data", data, room="vibrationEN04", skip_sid=sid)


@sio.event
async def game_data(sid, data):
    """
    Receives: { room, node_id, seq, roll, pitch }
    """
    print(f"[SIO] game_data from {sid}: {data}")

    # so these values should be added into the database.
    # tiltreading table should be adjusted

    # Forward to dashboard listeners in the same room
    await sio.emit("game_data", data, room="vibrationEN04", skip_sid=sid)

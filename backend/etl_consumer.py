import socketio
import uvicorn

sio = socketio.AsyncServer(cors_allowed_origins="*", async_mode="asgi")
app = socketio.ASGIApp(sio)

buffer = []


@sio.event
async def connect(sid, environ):
    print(f"[SIO] ESP32 connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"[SIO] ESP32 disconnected: {sid}")


@sio.on("sentinel_data")
async def on_sentinel_data(sid, data):
    print(f"Data received from {sid}: {data}")
    buffer.append(data)
    if len(buffer) >= 100:
        process(buffer.copy())
        buffer.clear()


def process(batch):
    print(f"Processing {len(batch)} points")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

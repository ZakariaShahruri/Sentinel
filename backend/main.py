from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from controller import (
    api,
    eventController,
    nodeController,
    authController,
    tiltReadingController,
    gameController,
    gameSummaryController,
    llmController,
    userController,
)
import socketio
import os
import psycopg2

from controller.rate_limit import limiter
from controller.wsController import sio


load_dotenv()

scheduler = AsyncIOScheduler()


async def run_cleanup():
    from config import DATABASE_URL

    conn = psycopg2.connect(DATABASE_URL)
    try:
        cur = conn.cursor()
        cur.execute("CALL cleanup_old_tilt_readings(%s)", (3,))
        conn.commit()
    finally:
        conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(run_cleanup, "cron", hour=2, minute=0)
    scheduler.start()

    if os.getenv("SEED_ON_STARTUP"):
        from seed import run_seed
        import psycopg2

        try:
            run_seed()
        except psycopg2.OperationalError as e:
            print(f"[startup] Seed skipped — DB not reachable: {e}")
    yield
    scheduler.shutdown()

    for sid in list(sio.manager.get_participants("/", None)):
        await sio.disconnect(sid)


fastapi_app = FastAPI(title="Sentinel API", version="1.0.0", lifespan=lifespan)

fastapi_app.state.limiter = limiter
fastapi_app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
fastapi_app.add_middleware(SlowAPIMiddleware)

# env vars can't hold arrays, so multiple origins are comma separated
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

fastapi_app.add_middleware(
    CORSMiddleware,
    # allow_origins=origins,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fastapi_app.include_router(api.router)
fastapi_app.include_router(eventController.router)
fastapi_app.include_router(nodeController.router)
fastapi_app.include_router(authController.router)
fastapi_app.include_router(tiltReadingController.router)
fastapi_app.include_router(gameController.router)
fastapi_app.include_router(gameSummaryController.router)
fastapi_app.include_router(llmController.router)
fastapi_app.include_router(userController.router)

socket_app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)

app = socket_app

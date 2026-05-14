from typing import Optional

from fastapi import APIRouter, Depends, Query

from controller.deps import get_conn
from service import tilt_readings

router = APIRouter()


@router.get("/tilts")
def list_tilts(date: Optional[str] = Query(None), game_id: Optional[int] = Query(None), conn=Depends(get_conn)):
    return tilt_readings.list_readings(conn, date, game_id)

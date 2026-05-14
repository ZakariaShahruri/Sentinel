from typing import Optional

from fastapi import APIRouter, Depends, Query

from controller.deps import get_conn
from service import game_summaries

router = APIRouter()


@router.get("/game_summaries")
def get_game_summary(game_id: Optional[int] = Query(None), conn=Depends(get_conn)):
    return game_summaries.get_game_summary(conn, game_id)

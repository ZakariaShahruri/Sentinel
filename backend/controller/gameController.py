from typing import Optional

from fastapi import APIRouter, Depends, Query

from controller.schemas import GameStatusUpdate
from controller.deps import get_conn, get_current_user, require_roles
from service import games

router = APIRouter()


@router.get("/games")
def list_games(game_id: Optional[int] = Query(None), conn=Depends(get_conn), user=Depends(require_roles("player"))):
    return games.list_games(conn, user["user_id"], game_id)


@router.post("/games")
def create_game(conn=Depends(get_conn), user=Depends(get_current_user)):
    return games.create_game(conn, user["user_id"])


@router.put("/games")
def change_games_status(body: GameStatusUpdate, conn=Depends(get_conn), user=Depends(get_current_user)):
    print("body", body)
    return games.change_game_status(conn, user["user_id"], body)

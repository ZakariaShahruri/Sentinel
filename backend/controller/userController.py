from fastapi import APIRouter, Depends, HTTPException

from controller.deps import get_conn, get_current_user
from service import users

router = APIRouter()


@router.get("/users")
def list_users(conn=Depends(get_conn), user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return users.list_users(conn)

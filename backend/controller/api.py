from fastapi import APIRouter, Depends

from controller.deps import get_conn, require_roles
from service import stats

router = APIRouter()


@router.get("/stats")
def get_stats(_user=Depends(require_roles("admin")), conn=Depends(get_conn)):
    return stats.get_stats(conn)


@router.get("/api/test-connection")
def test_connection():
    return {
        "status": "success",
        "message": "Hello from the Python backend! The network is working perfectly.",
    }

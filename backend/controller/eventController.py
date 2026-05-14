from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from controller.deps import VALID_CLASSES, get_conn, require_roles
from controller.schemas import EventCreate
from service import events

router = APIRouter()


@router.get("/events")
def list_events(
    _user=Depends(require_roles("admin")),
    node_id: Optional[int] = Query(None),
    event_class: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    conn=Depends(get_conn),
):
    if event_class and event_class not in VALID_CLASSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid event_class. Must be one of {VALID_CLASSES}",
        )
    return events.list_events(conn, node_id, event_class, limit)


@router.get("/events/{event_id}")
def get_event(event_id: int, _user=Depends(require_roles("admin")), conn=Depends(get_conn)):
    row = events.get_event(conn, event_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return row


@router.post("/events")
def post_event(body: EventCreate, _user=Depends(require_roles("admin")), conn=Depends(get_conn)):
    return events.create_event(conn, body)

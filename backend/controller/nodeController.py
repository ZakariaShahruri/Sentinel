from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from controller.deps import get_conn, require_roles
from controller.schemas import NodeUpdate, NodeCreate
from service import nodes

router = APIRouter()


@router.get("/nodes")
def list_nodes(node_id: Optional[int] = Query(None), _user=Depends(require_roles("admin")), conn=Depends(get_conn)):
    return nodes.list_nodes(conn, node_id)


@router.put("/nodes/{node_id}")
def update_node(node_id: int, body: NodeUpdate, _user=Depends(require_roles("admin")), conn=Depends(get_conn)):
    row = nodes.update_node(conn, node_id, body.location)
    if row is None:
        raise HTTPException(status_code=404, detail="Node not found")
    return row


@router.post("/nodes")
def post_node(body: NodeCreate, _user=Depends(require_roles("admin")), conn=Depends(get_conn)):
    row = nodes.create_node(conn, body)
    if row is None:
        raise HTTPException(status_code=409, detail="Node already exists")
    return row

from pydantic import BaseModel, Field
from typing import Optional
from models import EventClass


class NodeUpdate(BaseModel):
    location: str


class EventCreate(BaseModel):
    node_id: int
    event_class: EventClass
    confidence: int = Field(ge=0, le=100)
    sequence_num: int
    node_timestamp: int
    peak_amplitude: Optional[float] = None
    rms_energy: Optional[float] = None
    zcr: Optional[float] = None
    decay_ms: Optional[float] = None
    lastx: Optional[int] = None
    lasty: Optional[int] = None
    lastz: Optional[int] = None


class NodeCreate(BaseModel):
    node_id: int
    location: Optional[str] = None


class GameStatusUpdate(BaseModel):
    game_id: int
    end_reason: str


class TiltReadingCreate(BaseModel):
    id: int
    node_id: int
    game_id: int
    sequence_num: int
    node_timestamp: int
    lastx: Optional[int] = None
    lasty: Optional[int] = None
    lastz: Optional[int] = None

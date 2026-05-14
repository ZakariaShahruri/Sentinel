from sqlalchemy import (
    BigInteger,
    SmallInteger,
    Float,
    String,
    Text,
    Enum,
    TIMESTAMP,
    ForeignKey,
    func,
    text,
)
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped
from typing import Optional
import enum


class Base(DeclarativeBase):
    pass


class EventClass(enum.Enum):
    attack = "attack"
    defense = "defense"
    background = "background"


class Node(Base):
    __tablename__ = "nodes"
    node_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    location: Mapped[Optional[str]] = mapped_column(String(64))
    registered_at: Mapped[Optional[str]] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    last_seen: Mapped[Optional[str]] = mapped_column(TIMESTAMP(timezone=True))


class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    node_id: Mapped[Optional[int]] = mapped_column(BigInteger)
    event_class: Mapped[EventClass] = mapped_column(Enum(EventClass, name="event_class"), nullable=False)
    confidence: Mapped[Optional[int]] = mapped_column(SmallInteger)
    sequence_num: Mapped[int] = mapped_column(BigInteger, nullable=False)
    node_timestamp: Mapped[int] = mapped_column(BigInteger, nullable=False)
    peak_amplitude: Mapped[Optional[float]] = mapped_column(Float)
    rms_energy: Mapped[Optional[float]] = mapped_column(Float)
    zcr: Mapped[Optional[float]] = mapped_column(Float)
    decay_ms: Mapped[Optional[float]] = mapped_column(Float)
    lastx: Mapped[Optional[int]] = mapped_column(BigInteger)
    lasty: Mapped[Optional[int]] = mapped_column(BigInteger)
    lastz: Mapped[Optional[int]] = mapped_column(BigInteger)
    received_at: Mapped[Optional[str]] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())


class Heartbeat(Base):
    __tablename__ = "heartbeats"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    node_id: Mapped[Optional[int]] = mapped_column(BigInteger)
    received_at: Mapped[Optional[str]] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, server_default=text("'player'"))
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    otp_code: Mapped[Optional[str]] = mapped_column(Text)
    otp_expires_at: Mapped[Optional[str]] = mapped_column(TIMESTAMP(timezone=True))
    login_attempts: Mapped[Optional[int]] = mapped_column(SmallInteger, server_default=text("0"))
    login_locked_until: Mapped[Optional[str]] = mapped_column(TIMESTAMP(timezone=True))
    otp_attempts: Mapped[Optional[int]] = mapped_column(SmallInteger, server_default=text("0"))
    otp_locked_until: Mapped[Optional[str]] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[Optional[str]] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())


class Game(Base):
    __tablename__ = "games"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    end_reason: Mapped[Optional[str]] = mapped_column(String(64), default="not_finished")


class TiltReading(Base):
    __tablename__ = "tilt_readings"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    node_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("nodes.node_id"), nullable=False)
    game_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("games.id"), nullable=False)
    sequence_num: Mapped[int] = mapped_column(BigInteger, nullable=False)
    node_timestamp: Mapped[int] = mapped_column(BigInteger, nullable=False)
    lastx: Mapped[Optional[int]] = mapped_column(BigInteger)
    lasty: Mapped[Optional[int]] = mapped_column(BigInteger)
    lastz: Mapped[Optional[int]] = mapped_column(BigInteger)
    received_at: Mapped[Optional[str]] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())


class GameSummary(Base):
    __tablename__ = "game_summaries"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    game_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("games.id"), nullable=False)
    duration_seconds: Mapped[float] = mapped_column(Float)
    avg_tilt_magnitude: Mapped[float] = mapped_column(Float)
    x_bias: Mapped[float] = mapped_column(Float)
    tilt_variance: Mapped[float] = mapped_column(Float)
    sharp_reversals: Mapped[int] = mapped_column(BigInteger)
    max_tilt_angle_deg: Mapped[float] = mapped_column(Float)
    packet_loss_rate: Mapped[float] = mapped_column(Float)
    outcome: Mapped[Optional[str]] = mapped_column(String(64))

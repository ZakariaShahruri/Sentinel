import os
import secrets
from datetime import datetime, timedelta, timezone


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def expiration_time() -> datetime:
    minutes = int(os.getenv("OTP_EXP_MINUTES", "10"))
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


def is_valid_otp(otp: str, stored: str) -> bool:
    return secrets.compare_digest(otp, stored)

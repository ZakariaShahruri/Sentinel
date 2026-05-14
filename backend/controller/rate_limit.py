import os
import logging

import redis
from slowapi import Limiter
from slowapi.util import get_remote_address


logger = logging.getLogger(__name__)


def _storage_uri() -> str | None:
    uri = os.getenv("REDIS_URL")
    return uri if uri else None


def _is_truthy(value: str | None) -> bool:
    return (value or "").lower() in {"1", "true", "yes"}


def _redis_available(uri: str) -> bool:
    try:
        client = redis.from_url(uri, socket_connect_timeout=0.5, socket_timeout=0.5)
        client.ping()
        return True
    except Exception as exc:
        logger.warning("Redis unavailable for rate limiting (%s). Falling back to in-memory.", exc)
        return False


def _build_limiter() -> Limiter:
    uri = _storage_uri()
    use_redis = _is_truthy(os.getenv("RATE_LIMIT_USE_REDIS"))

    if use_redis and uri and _redis_available(uri):
        return Limiter(key_func=get_remote_address, storage_uri=uri)

    return Limiter(key_func=get_remote_address)


limiter = _build_limiter()

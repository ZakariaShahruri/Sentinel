import os
import psycopg2
import psycopg2.extras
from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import APIKeyHeader, OAuth2PasswordBearer
from jose import JWTError, jwt
from config import DATABASE_URL

API_KEY = os.getenv("API_KEY")
api_key_header = APIKeyHeader(name="X-API-Key")

ALGORITHM = "HS256"
AUTH_COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "access_token")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def verify_key(key: str = Security(api_key_header)):
    if key != API_KEY:
        raise HTTPException(status_code=403)


VALID_CLASSES = {"background", "footstep", "door_slam", "impact", "unknown"}


def get_conn():
    conn = psycopg2.connect(
        DATABASE_URL,
        cursor_factory=psycopg2.extras.RealDictCursor,  # rows come back as dicts, not as tuples
    )
    try:
        yield conn  # fastapi inject this and closes the connection afterwards
    finally:
        conn.close()


def _get_jwt_secret() -> str:
    jwt_secret = os.getenv("JWT_SECRET") or os.getenv("SECRET_KEY")
    if not jwt_secret:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="JWT secret missing")
    return jwt_secret


def get_current_user(request: Request, token: str | None = Depends(oauth2_scheme)):
    auth_token = token or request.cookies.get(AUTH_COOKIE_NAME)
    if not auth_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    try:
        payload = jwt.decode(auth_token, _get_jwt_secret(), algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    username = payload.get("sub")
    if username is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    return {
        "username": username,
        "role": payload.get("role"),
        "user_id": payload.get("uid"),
    }


def require_roles(*allowed_roles: str):
    def dependency(user=Depends(get_current_user)):
        if allowed_roles and user.get("role") not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user

    return dependency

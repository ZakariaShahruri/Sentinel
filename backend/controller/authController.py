import logging
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
import psycopg2

from config import DATABASE_URL
from controller.rate_limit import limiter
from service import auth_db
from service import email as email_service
from service import otp as otp_service


ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))
OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", 5))
OTP_LOCK_MINUTES = int(os.getenv("OTP_LOCK_MINUTES", 10))
LOGIN_MAX_ATTEMPTS = int(os.getenv("LOGIN_MAX_ATTEMPTS", 5))
LOGIN_LOCK_MINUTES = int(os.getenv("LOGIN_LOCK_MINUTES", 10))

USE_AUTH_COOKIES = os.getenv("USE_AUTH_COOKIES", "false").lower() in {"1", "true", "yes"}
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "true").lower() in {"1", "true", "yes"}
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax")
AUTH_COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "access_token")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
DUMMY_HASH = pwd_context.hash("dummy-password")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)
router = APIRouter(prefix="/auth", tags=["auth"])

security_logger = logging.getLogger("security")


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str


def get_db():
    return psycopg2.connect(DATABASE_URL)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def create_access_token(data: dict) -> str:
    jwt_secret = os.getenv("JWT_SECRET") or os.getenv("SECRET_KEY")
    if not jwt_secret:
        raise RuntimeError("JWT_SECRET is not set")
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(payload, jwt_secret, algorithm=ALGORITHM)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _issue_token_response(token: str, user: dict):
    user_info = {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
    }

    if USE_AUTH_COOKIES:
        response = JSONResponse({"token_type": "bearer", "user": user_info})
        response.set_cookie(
            AUTH_COOKIE_NAME,
            token,
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
            max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
        return response

    return {"access_token": token, "token_type": "bearer", "user": user_info}


@router.post("/login")
@limiter.limit(os.getenv("LOGIN_RATE_LIMIT", "10/minute"))
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    identifier = form_data.username.strip()
    if not identifier:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username or email required")

    conn = get_db()
    try:
        user = auth_db.get_user_by_identifier(conn, identifier)
        now = _utc_now()
        client_ip = request.client.host if request.client else "unknown"

        if user and user.get("login_locked_until") and user["login_locked_until"] > now:
            verify_password(form_data.password, DUMMY_HASH)
            security_logger.warning("login_locked user=%s ip=%s", identifier, client_ip)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Try again later",
            )

        password_hash = user["password_hash"] if user else DUMMY_HASH
        password_ok = verify_password(form_data.password, password_hash)
        if not user or not password_ok:
            if user:
                attempts = (user.get("login_attempts") or 0) + 1
                locked_until = None
                if attempts >= LOGIN_MAX_ATTEMPTS:
                    locked_until = now + timedelta(minutes=LOGIN_LOCK_MINUTES)
                auth_db.update_login_attempts(conn, user["id"], attempts, locked_until)
                conn.commit()
            security_logger.warning("login_failed user=%s ip=%s", identifier, client_ip)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

        auth_db.reset_login_attempts(conn, user["id"])
        conn.commit()

        if user["role"] == "admin":
            token = create_access_token({"sub": user["username"], "uid": user["id"], "role": user["role"]})
            security_logger.info("login_success user=%s ip=%s", user["username"], client_ip)
            return _issue_token_response(token, user)

        otp_code = otp_service.generate_otp()
        otp_expires_at = otp_service.expiration_time()
        auth_db.set_otp(conn, user["id"], otp_code, otp_expires_at)
        conn.commit()

        try:
            email_service.send_otp_email(user["email"], otp_code)
        except Exception:
            auth_db.clear_otp(conn, user["id"])
            conn.commit()
            security_logger.error("otp_send_failed user=%s ip=%s", user["username"], client_ip)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to send OTP",
            )

        security_logger.info("otp_sent user=%s ip=%s", user["username"], client_ip)
        return {
            "requires_otp": True,
            "email": user["email"],
            "otp_expires_at": otp_expires_at.isoformat(),
        }
    finally:
        conn.close()


@router.post("/verify-otp")
@limiter.limit(os.getenv("VERIFY_OTP_RATE_LIMIT", "10/minute"))
def verify_otp(request: Request, body: VerifyOtpRequest):
    conn = get_db()
    try:
        email = body.email.lower()
        if not (body.otp.isdigit() and len(body.otp) == 6):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP must be a 6-digit code",
            )
        user = auth_db.get_user_by_email(conn, email)
        now = _utc_now()
        client_ip = request.client.host if request.client else "unknown"

        if not user:
            security_logger.warning("otp_verify_unknown email=%s ip=%s", email, client_ip)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or OTP")

        if user.get("otp_locked_until") and user["otp_locked_until"] > now:
            security_logger.warning("otp_locked user=%s ip=%s", user["username"], client_ip)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Try again later",
            )

        if not user.get("otp_code") or not user.get("otp_expires_at") or user["otp_expires_at"] <= now:
            auth_db.clear_otp(conn, user["id"])
            conn.commit()
            security_logger.warning("otp_expired user=%s ip=%s", user["username"], client_ip)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or OTP")

        if not otp_service.is_valid_otp(body.otp, user["otp_code"]):
            attempts = (user.get("otp_attempts") or 0) + 1
            locked_until = None
            if attempts >= OTP_MAX_ATTEMPTS:
                locked_until = now + timedelta(minutes=OTP_LOCK_MINUTES)
            auth_db.update_otp_attempts(conn, user["id"], attempts, locked_until)
            conn.commit()
            security_logger.warning("otp_invalid user=%s ip=%s", user["username"], client_ip)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or OTP")

        auth_db.clear_otp(conn, user["id"])
        conn.commit()

        token = create_access_token({"sub": user["username"], "uid": user["id"], "role": user["role"]})
        security_logger.info("otp_verified user=%s ip=%s", user["username"], client_ip)
        resp = _issue_token_response(token, user)
        return resp

    finally:
        conn.close()


@router.get("/me")
def get_me(request: Request, token: str | None = Depends(oauth2_scheme)):
    try:
        auth_token = token or request.cookies.get(AUTH_COOKIE_NAME)
        if not auth_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        jwt_secret = os.getenv("JWT_SECRET") or os.getenv("SECRET_KEY")
        if not jwt_secret:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="JWT secret missing")

        payload = jwt.decode(auth_token, jwt_secret, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return {
            "username": username,
            "role": payload.get("role"),
            "user_id": payload.get("uid"),
        }
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


@router.post("/register")
def register(body: RegisterRequest):
    conn = get_db()
    cur = conn.cursor()

    normalized_email = body.email.lower()

    cur.execute(
        "SELECT id FROM users WHERE username = %s OR LOWER(email) = LOWER(%s)",
        (body.username, normalized_email),
    )
    if cur.fetchone() is not None:
        conn.close()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username or email already taken")

    cur.execute(
        "INSERT INTO users (username, email, password_hash, role) VALUES (%s, %s, %s, %s)",
        (body.username, normalized_email, hash_password(body.password), "player"),
    )
    conn.commit()
    conn.close()

    return {"message": "User created successfully"}

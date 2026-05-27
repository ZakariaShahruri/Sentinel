import os
from datetime import datetime, timedelta, timezone

os.environ["JWT_SECRET"] = "test-secret"
os.environ["LOGIN_RATE_LIMIT"] = "1000/minute"
os.environ["VERIFY_OTP_RATE_LIMIT"] = "1000/minute"

from fastapi.testclient import TestClient

from controller import authController
from controller.deps import get_conn
from main import fastapi_app
from service import events as events_service
from service import games as games_service
from service import nodes as nodes_service
from service import stats as stats_service


class FakeConn:
    def commit(self):
        return None

    def close(self):
        return None


def _build_users():
    return {
        1: {
            "id": 1,
            "username": "player1",
            "email": "player1@example.com",
            "role": "player",
            "password_hash": authController.hash_password("player1pass"),
            "login_attempts": 0,
            "login_locked_until": None,
            "otp_code": None,
            "otp_expires_at": None,
            "otp_attempts": 0,
            "otp_locked_until": None,
        }
    }


def test_login_sends_otp_for_non_admin(monkeypatch):
    users = _build_users()
    sent = {}
    fixed_expiry = datetime.now(timezone.utc) + timedelta(minutes=5)

    def get_user_by_identifier(_conn, identifier):
        for user in users.values():
            if user["username"] == identifier or user["email"] == identifier:
                return user
        return None

    def reset_login_attempts(_conn, user_id):
        users[user_id]["login_attempts"] = 0
        users[user_id]["login_locked_until"] = None

    def set_otp(_conn, user_id, otp_code, otp_expires_at):
        users[user_id]["otp_code"] = otp_code
        users[user_id]["otp_expires_at"] = otp_expires_at
        users[user_id]["otp_attempts"] = 0
        users[user_id]["otp_locked_until"] = None

    monkeypatch.setattr(authController, "get_db", lambda: FakeConn())
    monkeypatch.setattr(authController.auth_db, "get_user_by_identifier", get_user_by_identifier)
    monkeypatch.setattr(authController.auth_db, "reset_login_attempts", reset_login_attempts)
    monkeypatch.setattr(authController.auth_db, "set_otp", set_otp)
    monkeypatch.setattr(authController.otp_service, "generate_otp", lambda: "123456")
    monkeypatch.setattr(authController.otp_service, "expiration_time", lambda: fixed_expiry)
    monkeypatch.setattr(
        authController.email_service,
        "send_otp_email",
        lambda to_email, otp: sent.update({"to": to_email, "otp": otp}),
    )

    client = TestClient(fastapi_app)
    response = client.post("/auth/login", data={"username": "player1", "password": "player1pass"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["requires_otp"] is True
    assert payload["email"] == "player1@example.com"
    assert users[1]["otp_code"] == "123456"
    assert sent["to"] == "player1@example.com"


def test_verify_otp_issues_token(monkeypatch):
    users = _build_users()
    users[1]["otp_code"] = "123456"
    users[1]["otp_expires_at"] = datetime.now(timezone.utc) + timedelta(minutes=5)

    def get_user_by_email(_conn, email):
        for user in users.values():
            if user["email"] == email:
                return user
        return None

    def clear_otp(_conn, user_id):
        users[user_id]["otp_code"] = None
        users[user_id]["otp_expires_at"] = None
        users[user_id]["otp_attempts"] = 0
        users[user_id]["otp_locked_until"] = None

    monkeypatch.setattr(authController, "get_db", lambda: FakeConn())
    monkeypatch.setattr(authController.auth_db, "get_user_by_email", get_user_by_email)
    monkeypatch.setattr(authController.auth_db, "clear_otp", clear_otp)

    client = TestClient(fastapi_app)
    response = client.post("/auth/verify-otp", json={"email": "player1@example.com", "otp": "123456"})

    assert response.status_code == 200
    payload = response.json()
    assert "access_token" in payload
    assert users[1]["otp_code"] is None


def test_verify_otp_rejects_expired(monkeypatch):
    users = _build_users()
    users[1]["otp_code"] = "123456"
    users[1]["otp_expires_at"] = datetime.now(timezone.utc) - timedelta(minutes=1)

    def get_user_by_email(_conn, email):
        for user in users.values():
            if user["email"] == email:
                return user
        return None

    def clear_otp(_conn, user_id):
        users[user_id]["otp_code"] = None
        users[user_id]["otp_expires_at"] = None
        users[user_id]["otp_attempts"] = 0
        users[user_id]["otp_locked_until"] = None

    monkeypatch.setattr(authController, "get_db", lambda: FakeConn())
    monkeypatch.setattr(authController.auth_db, "get_user_by_email", get_user_by_email)
    monkeypatch.setattr(authController.auth_db, "clear_otp", clear_otp)

    client = TestClient(fastapi_app)
    response = client.post("/auth/verify-otp", json={"email": "player1@example.com", "otp": "123456"})

    assert response.status_code == 401


def test_admin_can_access_dashboard_endpoints(monkeypatch):
    admin_token = authController.create_access_token({"sub": "admin", "uid": 99, "role": "admin"})

    class AdminConn:
        def close(self):
            return None

    monkeypatch.setattr(stats_service, "get_stats", lambda _conn: {"status": "ok"})
    monkeypatch.setattr(events_service, "list_events", lambda _conn, node_id, event_class, limit: [])
    monkeypatch.setattr(nodes_service, "list_nodes", lambda _conn, node_id: [])
    monkeypatch.setattr(games_service, "list_games", lambda _conn, game_id: [])

    fastapi_app.dependency_overrides[get_conn] = lambda: AdminConn()
    client = TestClient(fastapi_app)
    client.cookies.set("access_token", admin_token)

    try:
        assert client.get("/stats").status_code == 200
        assert client.get("/events").status_code == 200
        assert client.get("/nodes").status_code == 200
        assert client.get("/games").status_code == 403
    finally:
        fastapi_app.dependency_overrides.pop(get_conn, None)


def test_player_is_blocked_from_dashboard_endpoints(monkeypatch):
    player_token = authController.create_access_token({"sub": "player1", "uid": 1, "role": "player"})

    class PlayerConn:
        def close(self):
            return None

    monkeypatch.setattr(games_service, "list_games", lambda _conn, game_id: [])

    fastapi_app.dependency_overrides[get_conn] = lambda: PlayerConn()
    client = TestClient(fastapi_app)
    client.cookies.set("access_token", player_token)

    try:
        assert client.get("/stats").status_code == 403
        assert client.get("/events").status_code == 403
        assert client.get("/nodes").status_code == 403
        assert client.get("/games").status_code == 200
    finally:
        fastapi_app.dependency_overrides.pop(get_conn, None)

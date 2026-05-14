from datetime import datetime
import psycopg2.extras


USER_FIELDS = """
    id,
    username,
    email,
    role,
    password_hash,
    login_attempts,
    login_locked_until,
    otp_code,
    otp_expires_at,
    otp_attempts,
    otp_locked_until
"""


def get_user_by_identifier(conn, identifier: str):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        f"""
        SELECT {USER_FIELDS}
        FROM users
        WHERE username = %s OR LOWER(email) = LOWER(%s)
        """,
        (identifier, identifier),
    )
    row = cur.fetchone()
    cur.close()
    return row


def get_user_by_email(conn, email: str):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        f"""
        SELECT {USER_FIELDS}
        FROM users
        WHERE LOWER(email) = LOWER(%s)
        """,
        (email,),
    )
    row = cur.fetchone()
    cur.close()
    return row


def update_login_attempts(conn, user_id: int, attempts: int, locked_until: datetime | None) -> None:
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE users
        SET login_attempts = %s,
            login_locked_until = %s
        WHERE id = %s
        """,
        (attempts, locked_until, user_id),
    )
    cur.close()


def reset_login_attempts(conn, user_id: int) -> None:
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE users
        SET login_attempts = 0,
            login_locked_until = NULL
        WHERE id = %s
        """,
        (user_id,),
    )
    cur.close()


def set_otp(conn, user_id: int, otp_code: str, otp_expires_at: datetime) -> None:
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE users
        SET otp_code = %s,
            otp_expires_at = %s,
            otp_attempts = 0,
            otp_locked_until = NULL
        WHERE id = %s
        """,
        (otp_code, otp_expires_at, user_id),
    )
    cur.close()


def update_otp_attempts(conn, user_id: int, attempts: int, locked_until: datetime | None) -> None:
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE users
        SET otp_attempts = %s,
            otp_locked_until = %s
        WHERE id = %s
        """,
        (attempts, locked_until, user_id),
    )
    cur.close()


def clear_otp(conn, user_id: int) -> None:
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE users
        SET otp_code = NULL,
            otp_expires_at = NULL,
            otp_attempts = 0,
            otp_locked_until = NULL
        WHERE id = %s
        """,
        (user_id,),
    )
    cur.close()

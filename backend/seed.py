import psycopg2
from controller.authController import hash_password
from config import DATABASE_URL


def run_seed():
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=5)
    cur = conn.cursor()

    # ── Node ─────────────────────────────────────────────────────────────
    cur.execute("INSERT INTO nodes (node_id, location) VALUES (1, 'Room A') ON CONFLICT (node_id) DO NOTHING")

    # ── Users ─────────────────────────────────────────────────────────────
    users = [
        (1, "admin", "admin123", "admin@gmail.com", "admin"),
        (2, "player1", "player1pass", "player1@gmail.com", "player"),
        (3, "player2", "player2pass", "player2@gmail.com", "player"),
    ]

    for user_id, username, password, email, role in users:
        cur.execute(
            """
            INSERT INTO users (id, username, email, role, password_hash)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, email = EXCLUDED.email, role = EXCLUDED.role
            """,
            (user_id, username, email, role, hash_password(password)),
        )

    # ── Event ─────────────────────────────────────────────────────────────
    cur.execute(
        """
        INSERT INTO events (id, node_id, event_class, confidence, sequence_num,
                            node_timestamp, peak_amplitude, rms_energy, zcr, decay_ms)
        VALUES (1, 1, 'attack'::event_class, 85, 1, 12345, 300.0, 150.0, 8, 45.0)
        ON CONFLICT (id) DO NOTHING
        """
    )

    cur.execute("SELECT setval(pg_get_serial_sequence('users', 'id'), MAX(id)) FROM users")

    cur.execute(
        """
        INSERT INTO games(id, user_id, end_reason)
        VALUES(1, 1, 'win')
        ON CONFLICT DO NOTHING
        """
    )

    cur.execute(
        """
        INSERT INTO games(id, user_id, end_reason) 
        VALUES(2, 2, 'win')
        ON CONFLICT DO NOTHING    
        """
    )

    cur.execute(
        """
        INSERT INTO tilt_readings(node_id, game_id, sequence_num, node_timestamp,
                                  lastx, lasty, lastz)
        VALUES (1, 1, 90124, 2, 3, 3, 3)
        ON CONFLICT DO NOTHING    
        """
    )

    cur.execute(
        """
        INSERT INTO tilt_readings(node_id, game_id, sequence_num, node_timestamp,
                                  lastx, lasty, lastz)
        VALUES (1, 2, 301231, 2, 4, 2, 3)
        ON CONFLICT DO NOTHING    
        """
    )

    conn.commit()
    conn.close()
    print("Seed complete: node 1, users (admin), event 1, tilt_reading 1")


if __name__ == "__main__":
    run_seed()

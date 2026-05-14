from service.tilt_readings import list_readings
from analysis.llm.calculation import compute_session_summary
from service.games import list_games


def get_game_summary(conn, game_id):
    cur = conn.cursor()
    cur.execute("SELECT * FROM game_summaries WHERE game_id = %s", (game_id,))
    row = cur.fetchone()
    if row is None:
        row = create_game_summary(conn, game_id)
    return row


def create_game_summary(conn, game_id):
    readings = list_readings(conn, date=None, game_id=game_id)
    stats = compute_session_summary(readings)
    game = list_games(conn, game_id)

    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO game_summaries (
            game_id, duration_seconds, avg_tilt_magnitude, x_bias,
            tilt_variance, sharp_reversals, max_tilt_angle_deg, packet_loss_rate, outcome
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            game_id,
            stats["duration_seconds"],
            stats["avg_tilt_magnitude"],
            stats["x_bias"],
            stats["tilt_variance"],
            stats["sharp_reversals"],
            stats["max_tilt_angle_deg"],
            stats["packet_loss_rate"],
            game[0]["end_reason"],
        ),
    )
    row = cur.fetchone()
    conn.commit()
    return row

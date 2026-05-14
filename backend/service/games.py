def list_games(conn, user_id, game_id=None):
    query = "SELECT * FROM games WHERE user_id = %s"
    params = [user_id]

    if game_id:
        query += " AND id = %s"
        params.append(game_id)

    cur = conn.cursor()
    cur.execute(query, params)
    return cur.fetchall()


def create_game(conn, user_id):
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO games (user_id, end_reason) VALUES (%s, %s) RETURNING *",
        (user_id, "not_finished"),
    )
    conn.commit()
    return cur.fetchone()


def change_game_status(conn, user_id, body):
    cur = conn.cursor()
    cur.execute(
        """UPDATE games SET end_reason = %s
            WHERE user_id = %s AND id = %s
        RETURNING *
        """,
        (
            body.end_reason,
            user_id,
            body.game_id,
        ),
    )
    conn.commit()
    return cur.fetchone()

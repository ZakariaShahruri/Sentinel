def list_readings(conn, date=None, game_id=None):
    query = "SELECT * FROM tilt_readings WHERE 1=1"
    params = []

    if date:
        query += " AND received_at::date = %s"
        params.append(date)

    if game_id:
        query += " AND game_id = %s"
        params.append(game_id)

    query += " ORDER BY received_at"

    cur = conn.cursor()
    cur.execute(query, params)
    return cur.fetchall()

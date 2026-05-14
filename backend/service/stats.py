def get_stats(conn):
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) AS n FROM events WHERE received_at >= NOW() - INTERVAL '24 hours'")
    events_today = cur.fetchone()["n"]

    cur.execute(
        "SELECT COUNT(*) AS n FROM events WHERE confidence >= 80 AND received_at >= NOW() - INTERVAL '24 hours'"
    )
    high_confidence = cur.fetchone()["n"]

    cur.execute("SELECT COUNT(*) AS n FROM nodes WHERE last_seen >= NOW() - INTERVAL '30 seconds'")
    active_nodes = cur.fetchone()["n"]

    return {
        "events_today": events_today,
        "high_confidence": high_confidence,
        "active_nodes": active_nodes,
    }

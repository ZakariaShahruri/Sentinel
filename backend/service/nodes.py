def list_nodes(conn, node_id=None):
    query = """
                SELECT *,
                       (last_seen IS NOT NULL AND last_seen >= NOW() - INTERVAL '30 seconds') AS online
                FROM   nodes
                WHERE 1=1
                
            """
    params = []

    if node_id:
        query += " AND node_id = %s"
        params.append(node_id)

    query += " ORDER BY node_id"

    cur = conn.cursor()
    cur.execute(query, params)
    return cur.fetchall()


def create_node(conn, body):
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO nodes (node_id, location) VALUES (%s, %s) ON CONFLICT DO NOTHING RETURNING *",
        (body.node_id, body.location),
    )
    row = cur.fetchone()
    if row is None:
        return None
    conn.commit()
    return row


def update_node(conn, node_id, location):
    cur = conn.cursor()
    cur.execute(
        "UPDATE nodes SET location = %s WHERE node_id = %s RETURNING *",
        (location, node_id),
    )
    row = cur.fetchone()
    if row is None:
        return None
    conn.commit()
    return row

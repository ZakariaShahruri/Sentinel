def list_users(conn):
    cur = conn.cursor()
    cur.execute("SELECT id, username, email, role FROM users ORDER BY id")
    return cur.fetchall()

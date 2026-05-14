from event_classifier import EventClassifier
from controller.schemas import EventCreate


def list_events(conn, node_id=None, event_class=None, limit=None):
    # 1=1 allows us to add AND clauses without special casing the first one.
    query = "SELECT * FROM events WHERE 1=1"
    params = []

    if node_id:
        query += " AND node_id = %s"
        params.append(node_id)
    if event_class:
        query += " AND event_class = %s::event_class"
        params.append(event_class)

    query += " ORDER BY received_at DESC LIMIT %s"
    params.append(limit)

    cur = conn.cursor()
    cur.execute(query, params)
    return cur.fetchall()


def get_event(conn, event_id=None):
    cur = conn.cursor()
    cur.execute("SELECT * FROM events WHERE id = %s", (event_id,))
    return cur.fetchone()


def create_event(conn, body):
    cur = conn.cursor()
    event_type = classify_event(body)

    cur.execute(
        """
        INSERT INTO events
            (node_id, event_class, confidence, sequence_num, node_timestamp,
             peak_amplitude, rms_energy, zcr, decay_ms, lastx, lasty, lastz)
        VALUES (%s, %s::event_class, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            body.node_id,
            event_type.value,
            body.confidence,
            body.sequence_num,
            body.node_timestamp,
            body.peak_amplitude,
            body.rms_energy,
            body.zcr,
            body.decay_ms,
            body.lastx,
            body.lasty,
            body.lastz,
        ),
    )
    row = cur.fetchone()
    conn.commit()
    return row


def classify_event(body: EventCreate):
    event_clsfr = EventClassifier()
    event_type = event_clsfr.classify_move(body.peak_amplitude, body.rms_energy, body.zcr, body.decay_ms)
    return event_type

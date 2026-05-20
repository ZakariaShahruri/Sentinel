import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import dash
from dash import dcc, html
from dash.dependencies import Input, Output
import plotly.express as px
import pandas as pd
import psycopg2
import psycopg2.extras
from config import DATABASE_URL

app = dash.Dash(__name__)


def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


app.layout = html.Div(
    [
        html.H1("Sentinel Dashboard"),
        dcc.Interval(id="refresh", interval=10_000),
        html.Div(
            [
                dcc.Graph(id="class-pie"),
                dcc.Graph(id="events-timeline"),
            ],
            style={"display": "flex"},
        ),
        html.Div(
            [
                dcc.Graph(id="confidence-hist"),
                dcc.Graph(id="feature-scatter"),
            ],
            style={"display": "flex"},
        ),
    ]
)


@app.callback(
    Output("class-pie", "figure"),
    Output("events-timeline", "figure"),
    Output("confidence-hist", "figure"),
    Output("feature-scatter", "figure"),
    Input("refresh", "n_intervals"),
)
def update(_):
    conn = get_conn()
    df = pd.read_sql("SELECT * FROM events ORDER BY received_at DESC LIMIT 500", conn)
    conn.close()

    pie = px.pie(df, names="event_class", title="Event Class Distribution")

    df["received_at"] = pd.to_datetime(df["received_at"])
    timeline = px.histogram(df, x="received_at", color="event_class", title="Events Over Time", nbins=30)

    conf = px.histogram(df, x="confidence", color="event_class", title="Confidence Distribution", nbins=20)

    scatter = px.scatter(
        df,
        x="peak_amplitude",
        y="rms_energy",
        color="event_class",
        hover_data=["confidence", "node_id"],
        title="Feature Space (Amplitude vs RMS)",
    )

    return pie, timeline, conf, scatter


if __name__ == "__main__":
    app.run(debug=True, port=8050)

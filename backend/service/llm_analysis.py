import os
from typing import AsyncIterator

import anthropic

_client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

_SYSTEM = (
    "You are a game performance analyst for Sentinel, a tilt-controlled marble balance game. "
    "The player steers a marble through a maze by physically tilting their device; the onboard "
    "accelerometer streams X/Y/Z readings over 433 MHz RF to a browser physics loop. "
    "Analyse the session statistics below and give concise, encouraging feedback in plain language."
)


def _prompt(summary: dict) -> str:
    outcome = summary.get("outcome") or "unknown"
    loss = summary.get("packet_loss_rate", 0)
    return f"""Session outcome: {outcome}

Statistics:
- Duration: {summary.get("duration_seconds")} s
- Average tilt magnitude: {summary.get("avg_tilt_magnitude")} g  (how hard the player tilted overall)
- X bias: {summary.get("x_bias")} g  (positive = leaned right on average)
- Tilt variance: {summary.get("tilt_variance")} g  (high = jerky/erratic control)
- Sharp reversals: {summary.get("sharp_reversals")}  (sudden direction flips > 90°)
- Max tilt angle: {summary.get("max_tilt_angle_deg")}°
- Packet loss rate: {loss:.1%}  (RF signal quality — values above 5 % may affect gameplay)

In 3–5 sentences explain:
1. How the player controlled the marble (smooth vs erratic, any left/right bias).
2. What most likely caused the outcome.
3. One concrete tip to improve next time."""


async def stream_game_analysis(summary: dict) -> AsyncIterator[str]:
    async with _client.messages.stream(
        model="claude-opus-4-7",
        max_tokens=512,
        thinking={"type": "adaptive"},
        system=_SYSTEM,
        messages=[{"role": "user", "content": _prompt(summary)}],
    ) as stream:
        async for chunk in stream.text_stream:
            yield chunk

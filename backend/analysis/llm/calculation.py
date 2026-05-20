import math


def compute_session_summary(readings: list[dict]) -> dict:
    readings = sorted(readings, key=lambda r: r["received_at"])
    n = len(readings)

    if not n:
        return {}

    # difference between first and last packet's server timestamp
    duration = (readings[-1]["received_at"] - readings[0]["received_at"]).total_seconds()

    # tilt magnitude per reading
    # horizontal component only (x and y), converted from mg to g
    # z is ~1g when flat and not useful for measuring how much the player tilted
    magnitudes = [
        math.sqrt(r["lastx"] ** 2 + r["lasty"] ** 2) / 1000
        for r in readings
        if r["lastx"] is not None and r["lasty"] is not None
    ]

    avg_magnitude = sum(magnitudes) / len(magnitudes) if magnitudes else 0

    # x bias
    # mean x across the session in g - positive measn player leaned right on average
    x_values = [r["lastx"] / 1000 for r in readings if r["lastx"] is not None]
    x_bias = sum(x_values) / len(x_values) if x_values else 0

    # tilt variance (standard deviation of magnitude)
    # high = jerky unpredictable control, low = smooth

    if magnitudes:
        mean_mag = sum(magnitudes) / len(magnitudes)
        tilt_variance = math.sqrt(sum((m - mean_mag) ** 2 for m in magnitudes) / len(magnitudes))
    else:
        tilt_variance = 0

    # max tilt of an angle between the device and a flat surface in degrees
    # atan2(horizontal_component, vertical_components)
    angles = []
    for r in readings:
        if all(r[k] is not None for k in ("lastx", "lasty", "lastz")):
            horiz = math.sqrt(r["lastx"] ** 2 + r["lasty"] ** 2)
            angles.append(math.degrees(math.atan2(horiz, abs(r["lastz"]))))
    max_angle = max(angles) if angles else 0

    # sharp reverals
    # counts frames where tilt direction reversed by >90 degrees
    # dot product of consecutive tilt vectors is negative when angle between them > 90°
    sharp_reversals = 0
    vectors = [(r["lastx"], r["lasty"]) for r in readings if r["lastx"] is not None and r["lasty"] is not None]
    for i in range(1, len(vectors)):
        x1, y1 = vectors[i - 1]
        x2, y2 = vectors[i]
        mag1 = math.sqrt(x1**2 + y1**2)
        mag2 = math.sqrt(x2**2 + y2**2)
        # ignore near-flat readings (< 100mg) to avoid noise counting as reversals
        if mag1 > 100 and mag2 > 100 and (x1 * x2 + y1 * y2) < 0:
            sharp_reversals += 1

    # packet loss rate
    # sequence_num is a rolling counter that wraps at 255
    # for each consecutive pair, the expected diff is 1
    # if diff > 1, those packets were lost
    seq = [r["sequence_num"] for r in readings]
    lost = sum(max(0, (seq[i] - seq[i - 1]) % 256 - 1) for i in range(1, len(seq)))
    total_expected = len(seq) + lost
    loss_rate = lost / total_expected if total_expected > 0 else 0

    return {
        "duration_seconds": round(duration, 1),
        "avg_tilt_magnitude": round(avg_magnitude, 3),
        "x_bias": round(x_bias, 3),
        "tilt_variance": round(tilt_variance, 3),
        "sharp_reversals": sharp_reversals,
        "max_tilt_angle_deg": round(max_angle, 1),
        "packet_loss_rate": round(loss_rate, 3),
    }

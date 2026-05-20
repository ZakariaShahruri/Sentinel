from controller.schemas import EventClass


class EventClassifier:
    def __init__(self):
        self.GATE = 200  # ignore background noise below this peak
        self.DECAY_ATTACK_SPLIT = 60  # ms
        self.ZCR_ATTACK_SPLIT = 6  # crossings

    def classify_move(self, peak, rms, zcr, decay_ms):
        if peak < self.GATE:
            return EventClass.background  # very likely a background noise

        attack_votes = 0
        if decay_ms < self.DECAY_ATTACK_SPLIT:
            attack_votes += 2
        if zcr > self.ZCR_ATTACK_SPLIT:
            attack_votes += 1
        if peak > rms * 2.5:
            attack_votes += 1

        return EventClass.attack if attack_votes >= 2 else EventClass.defense

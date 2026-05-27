from datetime import datetime, timezone

from service import otp


def test_generate_otp_is_six_digits():
    code = otp.generate_otp()
    assert len(code) == 6
    assert code.isdigit()


def test_expiration_time_uses_env(monkeypatch):
    monkeypatch.setenv("OTP_EXP_MINUTES", "5")
    expires = otp.expiration_time()
    now = datetime.now(timezone.utc)
    delta = expires - now
    assert 4 * 60 <= delta.total_seconds() <= 6 * 60


def test_is_valid_otp_constant_compare():
    assert otp.is_valid_otp("123456", "123456") is True
    assert otp.is_valid_otp("123456", "654321") is False

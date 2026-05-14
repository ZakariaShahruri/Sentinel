import os
import smtplib
from email.message import EmailMessage


def send_otp_email(to_email: str, otp: str) -> None:
    host = os.getenv("SMTP_HOST")
    if not host:
        raise RuntimeError("SMTP_HOST is not set")

    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASS", "")
    from_addr = os.getenv("SMTP_FROM", user or "noreply@sentinel.local")
    use_tls = os.getenv("SMTP_TLS", "true").lower() in {"1", "true", "yes"}
    otp_minutes = os.getenv("OTP_EXP_MINUTES", "10")

    msg = EmailMessage()
    msg["Subject"] = "Your Sentinel OTP"
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.set_content(
        "Your one-time code is {otp}. It expires in {minutes} minutes.".format(otp=otp, minutes=otp_minutes)
    )

    with smtplib.SMTP(host, port, timeout=10) as smtp:
        if use_tls:
            smtp.starttls()
        if user and password:
            smtp.login(user, password)
        smtp.send_message(msg)

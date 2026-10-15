import smtplib
from email.message import EmailMessage

from app.core.config import settings


class EmailDeliveryError(Exception):
    pass


def send_welcome_email(*, to_email: str, full_name: str | None, username: str | None, temporary_password: str) -> None:
    if not settings.smtp_host or not settings.smtp_from_email:
        raise EmailDeliveryError(
            "Email service is not configured. Set SMTP_HOST and SMTP_FROM_EMAIL (and related SMTP_* vars) in the backend .env."
        )

    greeting_name = full_name or username or to_email

    message = EmailMessage()
    message["Subject"] = "Your MURI account has been created"
    message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    message["To"] = to_email
    message.set_content(
        f"Hi {greeting_name},\n\n"
        "An account has been created for you on MURI.\n\n"
        f"Username: {username or to_email}\n"
        f"Temporary password: {temporary_password}\n\n"
        f"Log in at {settings.frontend_login_url} and change your password once you're in.\n\n"
        "If you weren't expecting this account, contact your IT administrator."
    )

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            if settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)
    except (smtplib.SMTPException, OSError) as exc:
        raise EmailDeliveryError(f"Failed to send welcome email: {exc}") from exc

import httpx
from sqlalchemy.orm import Session
from ..models import Notification, Channel, NotifyStatus
from datetime import datetime


def notify_telegram(
    db: Session,
    chat_id: str,
    bot_token: str,
    message: str,
    dedupe_key: str,
    ticker: str | None = None,
    parse_mode: str | None = None,
):
    # Idempotency
    existing = (
        db.query(Notification).filter(Notification.dedupe_key == dedupe_key).first()
    )
    if existing:
        return

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    status = NotifyStatus.sent
    error = None
    try:
        payload = {"chat_id": chat_id, "text": message}
        if parse_mode:
            payload["parse_mode"] = parse_mode
        with httpx.Client(timeout=10) as client:
            client.post(url, json=payload)
    except Exception as e:
        status = NotifyStatus.error
        error = str(e)

    db.add(
        Notification(
            channel=Channel.telegram,
            ticker=ticker,
            message=message,
            dedupe_key=dedupe_key,
            sent_at=datetime.utcnow(),
            status=status,
            error=error,
        )
    )
    db.commit()

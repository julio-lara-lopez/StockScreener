from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from ..db import SessionLocal
from ..services.filter import filter_and_score
from ..services.notify import notify_telegram
from ..models import CandidateFiltered
from ..config import settings

sched = BackgroundScheduler()


def on_new_batch(batch_id):
    db: Session = SessionLocal()
    try:
        top = filter_and_score(db, batch_id)
        # Notify Top-N once (dedupe per batch/ticker)
        for cf in top:
            reasons = cf.reasons_json or {}
            price = reasons.get("price")
            rvol = reasons.get("rvol")
            msg = f"TOP PICK {cf.ticker}: Px {price} RVOL {rvol} Score {float(cf.score):.2f}"
            dedupe = f"topN-{batch_id}-{cf.ticker}"
            notify_telegram(
                db,
                settings.TELEGRAM_CHAT_ID,
                settings.TELEGRAM_BOT_TOKEN,
                msg,
                dedupe,
                cf.ticker,
            )
            cf.notified_topn = True
            db.add(cf)
        db.commit()
    finally:
        db.close()


def start_schedules():
    # You can add other cron jobs here if needed
    pass

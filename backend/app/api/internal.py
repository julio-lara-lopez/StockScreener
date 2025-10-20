from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import RvolBatch, RvolCandidate
from ..schemas import IngestBatch, TestTelegramRequest
from ..workers.scheduler import on_new_batch
from ..services.notify import notify_telegram
from ..config import settings

router = APIRouter(prefix="/internal", tags=["internal"])

@router.post("/ingest-rvol-batch")
def ingest_rvol_batch(payload: IngestBatch, db: Session = Depends(get_db)):
    # create batch
    batch = RvolBatch(id=payload.batch_id)
    db.add(batch)
    db.commit()

    # insert rows
    for it in payload.items:
        db.add(RvolCandidate(
            batch_id=payload.batch_id,
            ticker=it.ticker.upper(),
            name=it.name,
            rvol=it.rvol,
            price=it.price,
            pct_change=it.pct_change,
            volume=it.volume,
            market_cap=it.market_cap,
            sector=it.sector,
            analyst_rating=it.analyst_rating,
        ))
    db.commit()

    # kick filtering + notifications synchronously for now
    on_new_batch(payload.batch_id)
    return {"status": "ok", "batch_id": str(payload.batch_id)}


@router.post("/test-telegram")
def test_telegram(
    payload: TestTelegramRequest | None = None, db: Session = Depends(get_db)
):
    if not settings.TELEGRAM_BOT_TOKEN or not settings.TELEGRAM_CHAT_ID:
        raise HTTPException(
            status_code=400, detail="Telegram credentials are not configured"
        )

    message = (
        payload.message
        if payload and payload.message
        else f"Test notification sent at {datetime.utcnow().isoformat()}Z"
    )
    dedupe_key = f"test-{uuid4()}"

    notify_telegram(
        db,
        settings.TELEGRAM_CHAT_ID,
        settings.TELEGRAM_BOT_TOKEN,
        message,
        dedupe_key,
    )

    return {"status": "sent", "message": message}

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import RvolBatch, RvolCandidate
from ..schemas import IngestBatch
from ..workers.scheduler import on_new_batch

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

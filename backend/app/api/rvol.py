from datetime import datetime, timedelta
from typing import Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from zoneinfo import ZoneInfo

from ..db import get_db
from ..models import RvolBatch, RvolCandidate
from ..schemas import ActiveRvolBatch, ActiveRvolCandidate


router = APIRouter(prefix="/api/rvol", tags=["rvol"])


def _day_bounds_utc(day: str | None, tz_name: str) -> tuple[datetime, datetime]:
    tz = ZoneInfo(tz_name)
    if day:
        year, month, day_num = map(int, day.split("-"))
        start_local = datetime(year, month, day_num, tzinfo=tz)
    else:
        now_local = datetime.now(tz)
        start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)

    end_local = start_local + timedelta(days=1)
    return start_local.astimezone(ZoneInfo("UTC")), end_local.astimezone(ZoneInfo("UTC"))


def _to_candidate_payload(row: RvolCandidate) -> ActiveRvolCandidate:
    def _maybe_float(value):
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    return ActiveRvolCandidate(
        ticker=row.ticker,
        name=row.name,
        rvol=_maybe_float(row.rvol),
        price=_maybe_float(row.price),
        pct_change=_maybe_float(row.pct_change),
        volume=row.volume,
        market_cap=row.market_cap,
        sector=row.sector,
        analyst_rating=row.analyst_rating,
    )


@router.get("/active-batches", response_model=List[ActiveRvolBatch])
def list_active_batches(
    limit: int = 5,
    day: str | None = None,
    tz: str = "America/Santiago",
    db: Session = Depends(get_db),
) -> List[ActiveRvolBatch]:
    """Return recently ingested RVOL batches with their filtered candidates."""

    if limit <= 0:
        return []

    start_utc, end_utc = _day_bounds_utc(day, tz)

    batches = (
        db.query(RvolBatch)
        .filter(RvolBatch.ingested_at >= start_utc, RvolBatch.ingested_at < end_utc)
        .order_by(RvolBatch.ingested_at.desc())
        .limit(limit)
        .all()
    )

    if not batches:
        return []

    batch_ids = [batch.id for batch in batches]

    items: Dict[UUID, List[ActiveRvolCandidate]] = {batch_id: [] for batch_id in batch_ids}

    for row in (
        db.query(RvolCandidate)
        .filter(RvolCandidate.batch_id.in_(batch_ids))
        .order_by(RvolCandidate.batch_id.desc(), RvolCandidate.rvol.desc())
    ):
        items.setdefault(row.batch_id, []).append(_to_candidate_payload(row))

    return [
        ActiveRvolBatch(
            batch_id=batch.id,
            ingested_at=batch.ingested_at,
            items=items.get(batch.id, []),
        )
        for batch in batches
    ]

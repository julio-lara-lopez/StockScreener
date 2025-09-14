# app/api/candidates.py
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..db import get_db
from ..models import CandidateFiltered
from ..schemas import CandidateDTO
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends

router = APIRouter(prefix="/api/candidates", tags=["candidates"])



def session_bounds_utc(
    day: str | None,
    market_tz: str = "America/New_York",
    open_time: str = "09:30",
    close_time: str = "16:00",
):
    """
    Returns (open_utc, close_utc) for the given market-local day.
    If day=None, uses 'today' in the market_tz.
    """
    tz = ZoneInfo(market_tz)
    if day:
        y, m, d = map(int, day.split("-"))
        base = datetime(y, m, d, 0, 0, 0, tzinfo=tz)
    else:
        now_local = datetime.now(tz)
        base = now_local.replace(hour=0, minute=0, second=0, microsecond=0)

    oh, om = map(int, open_time.split(":"))
    ch, cm = map(int, close_time.split(":"))

    open_local = base.replace(hour=oh, minute=om)
    close_local = base.replace(hour=ch, minute=cm)

    return open_local.astimezone(ZoneInfo("UTC")), close_local.astimezone(ZoneInfo("UTC"))

def day_bounds_utc(day: str | None, tz: str = "America/Santiago"):
    tzinfo = ZoneInfo(tz)
    if day:
        y, m, d = map(int, day.split("-"))
        start_local = datetime(y, m, d, 0, 0, 0, tzinfo=tzinfo)
    else:
        now_local = datetime.now(tzinfo)
        start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    end_local = start_local + timedelta(days=1)
    return start_local.astimezone(ZoneInfo("UTC")), end_local.astimezone(ZoneInfo("UTC"))

@router.get("", response_model=list[CandidateDTO])
def list_candidates(
    limit: int = 20,
    day: str | None = None,                 # market-local date; None = today
    market_tz: str = "America/New_York",    # US equities session
    open_time: str = "09:30",
    close_time: str = "16:00",
    db: Session = Depends(get_db),
):
    open_utc, close_utc = session_bounds_utc(day, market_tz, open_time, close_time)

    # latest record per ticker within the session window
    sub = (
        db.query(
            CandidateFiltered.ticker.label("ticker"),
            func.max(CandidateFiltered.last_seen_at).label("max_last"),
        )
        .filter(
            CandidateFiltered.last_seen_at >= open_utc,
            CandidateFiltered.last_seen_at <  close_utc,
        )
        .group_by(CandidateFiltered.ticker)
        .subquery()
    )

    q = (
        db.query(CandidateFiltered)
        .join(
            sub,
            (CandidateFiltered.ticker == sub.c.ticker)
            & (CandidateFiltered.last_seen_at == sub.c.max_last),
        )
        .order_by(CandidateFiltered.last_seen_at.desc(), CandidateFiltered.score.desc())
        .limit(limit)
    )

    out = []
    for r in q:
        rs = r.reasons_json or {}
        out.append(CandidateDTO(
            ticker=r.ticker,
            price=rs.get("price", 0.0),
            rvol=rs.get("rvol", 0.0),
            score=float(r.score),
            reasons=rs.get("rules", {})
        ))
    return out

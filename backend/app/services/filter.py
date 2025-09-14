from sqlalchemy.orm import Session
from ..models import RvolCandidate, CandidateFiltered
from ..config import settings
from datetime import datetime,timedelta
from typing import List, Dict
from zoneinfo import ZoneInfo


def passes_filters(row: RvolCandidate, cfg: Dict) -> bool:
    price_ok = cfg["price_min"] <= float(row.price) <= cfg["price_max"]
    rvol_ok = float(row.rvol) >= cfg["min_rvol"]
    vol_ok = (row.volume or 0) <= cfg["volume_cap"]
    return price_ok and rvol_ok and vol_ok


def score_row(row: RvolCandidate) -> float:
    # MVP: simple score = RVOL (later: z-scores, liquidity, news boost, etc.)
    return float(row.rvol)


def day_bounds_utc(day: datetime | None, tz_str="America/Santiago"):
    tz = ZoneInfo(tz_str)
    now_local = (day.astimezone(tz) if day else datetime.now(tz))
    start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    end_local = start_local + timedelta(days=1)
    return start_local.astimezone(ZoneInfo("UTC")), end_local.astimezone(ZoneInfo("UTC"))

def filter_and_score(db: Session, batch_id) -> list[CandidateFiltered]:
    # ... your passes_filters + score_row as before ...
    cfg = {...}
    q = db.query(RvolCandidate).filter(RvolCandidate.batch_id == batch_id)
    kept = [(row, score_row(row)) for row in q if passes_filters(row, cfg)]
    kept.sort(key=lambda x: x[1], reverse=True)
    top = kept[: cfg["topN"]]

    start_utc, end_utc = day_bounds_utc(None)  # "today" in America/Santiago
    now = datetime.utcnow()
    results = []

    for row, sc in top:
        # look for an existing candidate for THIS ticker TODAY
        existing = (db.query(CandidateFiltered)
                      .filter(
                          CandidateFiltered.ticker == row.ticker,
                          CandidateFiltered.first_seen_at >= start_utc,
                          CandidateFiltered.first_seen_at < end_utc,
                      )
                      .first())

        reasons = {
            "price": float(row.price),
            "rvol": float(row.rvol),
            "volume": int(row.volume or 0),
            "rules": {
                "price_range": [cfg["price_min"], cfg["price_max"]],
                "min_rvol": cfg["min_rvol"],
                "volume_cap": cfg["volume_cap"],
            },
        }

        if existing:
            # update recency and keep the best score seen today
            existing.last_seen_at = now
            if float(sc) > float(existing.score):
                existing.score = sc
                existing.reasons_json = reasons
            db.add(existing)
            results.append(existing)
        else:
            cf = CandidateFiltered(
                batch_id=batch_id,
                ticker=row.ticker,
                score=sc,
                reasons_json=reasons,
                first_seen_at=now,
                last_seen_at=now,
                notified_topn=False,
            )
            db.add(cf)
            results.append(cf)

    db.commit()
    return results

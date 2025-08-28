from sqlalchemy.orm import Session
from ..models import RvolCandidate, CandidateFiltered
from ..config import settings
from datetime import datetime
from typing import List, Dict


def passes_filters(row: RvolCandidate, cfg: Dict) -> bool:
    price_ok = cfg["price_min"] <= float(row.price) <= cfg["price_max"]
    rvol_ok = float(row.rvol) >= cfg["min_rvol"]
    vol_ok = (row.volume or 0) <= cfg["volume_cap"]
    return price_ok and rvol_ok and vol_ok


def score_row(row: RvolCandidate) -> float:
    # MVP: simple score = RVOL (later: z-scores, liquidity, news boost, etc.)
    return float(row.rvol)


def filter_and_score(db: Session, batch_id) -> List[CandidateFiltered]:
    cfg = {
        "price_min": settings.PRICE_MIN,
        "price_max": settings.PRICE_MAX,
        "min_rvol": settings.MIN_RVOL,
        "volume_cap": settings.VOLUME_CAP,
        "topN": settings.TOPN_PER_BATCH,
    }
    q = db.query(RvolCandidate).filter(RvolCandidate.batch_id == batch_id)
    kept = []
    for row in q:
        if passes_filters(row, cfg):
            kept.append((row, score_row(row)))

    kept.sort(key=lambda x: x[1], reverse=True)
    top = kept[: cfg["topN"]]

    results = []
    now = datetime.utcnow()
    for row, sc in top:
        cf = CandidateFiltered(
            batch_id=batch_id,
            ticker=row.ticker,
            score=sc,
            reasons_json={
                "price": float(row.price),
                "rvol": float(row.rvol),
                "volume": int(row.volume or 0),
                "rules": {
                    "price_range": [cfg["price_min"], cfg["price_max"]],
                    "min_rvol": cfg["min_rvol"],
                    "volume_cap": cfg["volume_cap"],
                },
            },
            first_seen_at=now,
            last_seen_at=now,
            notified_topn=False,
        )
        db.add(cf)
        results.append(cf)
    db.commit()
    return results

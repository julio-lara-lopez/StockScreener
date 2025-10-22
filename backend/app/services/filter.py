from sqlalchemy.orm import Session
from ..models import RvolCandidate, CandidateFiltered
from ..services.app_settings import load_app_settings
from datetime import datetime, timedelta
from typing import Dict
from zoneinfo import ZoneInfo


def passes_filters(row: RvolCandidate, cfg: Dict) -> bool:
    price_ok = cfg["price_min"] <= float(row.price) <= cfg["price_max"]
    rvol_ok = float(row.rvol) >= cfg["min_rvol"]
    vol_ok = (row.volume or 0) <= cfg["volume_cap"]
    try:
        pct_change_value = float(row.pct_change)
    except (TypeError, ValueError):
        pct_change_value = None
    pct_change_ok = (
        pct_change_value is not None and pct_change_value >= cfg["min_pct_change"]
    )
    return price_ok and rvol_ok and vol_ok and pct_change_ok


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
    """Filter candidates for a batch and return the top scored ones.

    Configuration comes from environment defaults (``settings``) with optional
    overrides stored in the ``app_settings`` table.  Any keys found in the DB
    that match our expected configuration fields will override the defaults.
    """

    # Default configuration from environment variables
    settings_cfg = load_app_settings(db)
    cfg: Dict[str, float | int] = {
        "price_min": float(settings_cfg.get("price_min", 0.0)),
        "price_max": float(settings_cfg.get("price_max", 0.0)),
        "min_rvol": float(settings_cfg.get("min_rvol", 0.0)),
        "min_pct_change": float(settings_cfg.get("min_pct_change", 0.0)),
        "volume_cap": int(settings_cfg.get("volume_cap", 0)),
        "topN": int(settings_cfg.get("topN", 0)),
    }
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
            "pct_change": float(row.pct_change)
            if row.pct_change is not None
            else None,
            "volume": int(row.volume or 0),
            "rules": {
                "price_range": [cfg["price_min"], cfg["price_max"]],
                "min_rvol": cfg["min_rvol"],
                "min_pct_change": cfg["min_pct_change"],
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

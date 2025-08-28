import time
from sqlalchemy.orm import Session
from ..db import SessionLocal
from ..models import PriceAlert, Position
from ..services.finnhub import get_quote
from ..services.rates import TokenBucket
from ..services.notify import notify_telegram
from ..config import settings


def should_trigger(
    kind: str, entry: float | None, price: float, threshold: float
) -> bool:
    if kind == "target_pct":
        if entry is None:
            return False
        return ((price - entry) / entry) * 100.0 >= threshold
    if kind == "target_abs":
        if entry is None:
            return False
        return (price - entry) >= threshold
    if kind == "stop":
        if entry is None:
            return False
        return price <= threshold
    return False


def run_price_poller():
    bucket = TokenBucket(60)
    while True:
        db: Session = SessionLocal()
        try:
            # Build watchlist from active alerts + positions
            alerts = db.query(PriceAlert).filter(PriceAlert.active == True).all()
            pos = db.query(Position).all()
            entries = {p.ticker: float(p.entry_price) for p in pos}

            tickers = sorted(set([a.ticker for a in alerts] + list(entries.keys())))[
                :60
            ]

            prices = {}
            for t in tickers:
                if bucket.take(1):
                    try:
                        q = get_quote(t)
                        prices[t] = float(q.get("c") or 0.0)
                    except Exception:
                        pass
                else:
                    time.sleep(0.5)  # wait for tokens

            # Evaluate alerts
            for a in alerts:
                px = prices.get(a.ticker)
                if not px:
                    continue
                entry = entries.get(a.ticker)
                if should_trigger(
                    a.kind.value if hasattr(a.kind, "value") else a.kind,
                    entry,
                    px,
                    float(a.threshold_value),
                ):
                    dedupe = f"alert-{a.id}-{time.strftime('%Y%m%d-%H%M')}"
                    msg = f"ALERT {a.ticker}: {a.kind} hit at {px:.2f} (entry {entry or '-'}, thr {a.threshold_value})"
                    notify_telegram(
                        db,
                        settings.TELEGRAM_CHAT_ID,
                        settings.TELEGRAM_BOT_TOKEN,
                        msg,
                        dedupe,
                        a.ticker,
                    )
                    a.last_triggered_at = a.last_triggered_at or None
                    db.add(a)
            db.commit()

        finally:
            db.close()
        time.sleep(5)  # small cycle; bucket enforces real rate

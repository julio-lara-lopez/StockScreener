import time
from datetime import datetime

from sqlalchemy.orm import Session

from ..db import SessionLocal

from ..models import PriceAlert, Position
from app.services.finhub import get_quote
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
            alerts = db.query(PriceAlert).filter(PriceAlert.active.is_(True)).all()
            positions = db.query(Position).all()
            open_positions = [p for p in positions if p.closed_at is None]
            positions_by_ticker = {p.ticker: p for p in open_positions}

            tickers = sorted(
                set([a.ticker for a in alerts] + [p.ticker for p in open_positions])
            )[:60]

            prices = {}
            for t in tickers:
                if bucket.take(1):
                    try:
                        q = get_quote(t)
                        current = q.get("c")
                        if current in (None, 0):
                            current = q.get("pc")
                        prices[t] = float(current) if current is not None else None
                    except Exception:
                        pass
                else:
                    time.sleep(0.5)  # wait for tokens

            for position in open_positions:
                px = prices.get(position.ticker)
                if px is not None:
                    position.current_price = px
                    db.add(position)

            # Evaluate alerts
            for a in alerts:
                px = prices.get(a.ticker)
                if px is None:
                    continue
                position = positions_by_ticker.get(a.ticker)
                if position is None:
                    continue
                entry = (
                    float(position.entry_price)
                    if position.entry_price is not None
                    else None
                )
                if should_trigger(
                    a.kind.value if hasattr(a.kind, "value") else a.kind,
                    entry,
                    px,
                    float(a.threshold_value),
                ):
                    dedupe = f"alert-{a.id}-{time.strftime('%Y%m%d-%H%M')}"
                    qty = float(position.qty) if position.qty is not None else None
                    side = (position.side or "long").lower()
                    pnl_abs = None
                    pnl_pct = None
                    if entry is not None and qty is not None:
                        if side == "short":
                            delta = entry - px
                        else:
                            delta = px - entry
                        pnl_abs = delta * qty
                        if entry != 0:
                            pnl_pct = (delta / entry) * 100

                    kind_value = (
                        a.kind.value if hasattr(a.kind, "value") else str(a.kind)
                    )
                    lines = [f"*Alert Triggered* `{a.ticker}`"]
                    if entry is not None:
                        lines.append(f"Entry: ${entry:.2f}")
                    lines.append(f"Current: ${px:.2f}")
                    if pnl_abs is not None and pnl_pct is not None:
                        lines.append(
                            f"PnL: ${pnl_abs:+.2f} ({pnl_pct:+.2f}%)"
                        )
                    threshold = (
                        float(a.threshold_value)
                        if a.threshold_value is not None
                        else None
                    )
                    if threshold is not None:
                        lines.append(f"Alert: `{kind_value}` @ {threshold:.2f}")
                    else:
                        lines.append(f"Alert: `{kind_value}`")
                    msg = "\n".join(lines)
                    notify_telegram(
                        db,
                        settings.TELEGRAM_CHAT_ID,
                        settings.TELEGRAM_BOT_TOKEN,
                        msg,
                        dedupe,
                        a.ticker,
                        parse_mode="Markdown",
                    )
                    a.last_triggered_at = datetime.utcnow()
                    db.add(a)
            db.commit()

        finally:
            db.close()
        time.sleep(60)

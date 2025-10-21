from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Tuple

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Position
from ..schemas import PortfolioPoint, PortfolioSummary
from ..services.app_settings import load_app_settings

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


def _calc_realized(position: Position) -> float:
    if position.exit_price is None:
        return 0.0

    qty = float(position.qty)
    entry_price = float(position.entry_price)
    exit_price = float(position.exit_price)

    if position.side == "short":
        return (entry_price - exit_price) * qty
    return (exit_price - entry_price) * qty


def _calc_unrealized(position: Position) -> float:
    if position.closed_at is not None:
        return 0.0

    current_price = (
        float(position.current_price)
        if position.current_price is not None
        else float(position.entry_price)
    )
    qty = float(position.qty)
    entry_price = float(position.entry_price)

    if position.side == "short":
        return (entry_price - current_price) * qty
    return (current_price - entry_price) * qty


@router.get("/summary", response_model=PortfolioSummary)
def get_portfolio_summary(db: Session = Depends(get_db)) -> PortfolioSummary:
    positions: List[Position] = (
        db.query(Position).order_by(Position.created_at.asc()).all()
    )
    app_settings = load_app_settings(db)
    starting_capital = float(app_settings.get("starting_capital", 0.0))
    now = datetime.now(timezone.utc)

    realized_total = 0.0
    unrealized_total = 0.0

    for position in positions:
        realized_total += _calc_realized(position)
        unrealized_total += _calc_unrealized(position)

    if not positions:
        equity_series = [
            PortfolioPoint(
                timestamp=now,
                label="Start",
                realized=0.0,
                unrealized=0.0,
                equity=starting_capital,
            )
        ]
        equity_series.append(
            PortfolioPoint(
                timestamp=now,
                label="Now",
                realized=0.0,
                unrealized=0.0,
                equity=starting_capital,
            )
        )
    else:
        first_timestamp = min(
            (p.created_at for p in positions if p.created_at is not None),
            default=now,
        )
        equity_series: List[PortfolioPoint] = [
            PortfolioPoint(
                timestamp=first_timestamp,
                label="Start",
                realized=0.0,
                unrealized=0.0,
                equity=starting_capital,
            )
        ]

        closed_events: Dict[datetime, List[Tuple[str, float]]] = defaultdict(list)

        for position in positions:
            if position.closed_at is None:
                continue
            closed_events[position.closed_at].append(
                (position.ticker, _calc_realized(position))
            )

        cumulative_realized = 0.0
        for timestamp in sorted(closed_events.keys()):
            entries = closed_events[timestamp]
            realized_delta = sum(value for _, value in entries)
            cumulative_realized += realized_delta
            tickers = sorted({ticker for ticker, _ in entries})
            label = "Closed " + ", ".join(tickers) if tickers else "Closed"
            equity_series.append(
                PortfolioPoint(
                    timestamp=timestamp,
                    label=label,
                    realized=cumulative_realized,
                    unrealized=0.0,
                    equity=starting_capital + cumulative_realized,
                )
            )

        equity_series.append(
            PortfolioPoint(
                timestamp=now,
                label="Now",
                realized=cumulative_realized,
                unrealized=unrealized_total,
                equity=starting_capital + cumulative_realized + unrealized_total,
            )
        )

    return PortfolioSummary(
        starting_capital=starting_capital,
        current_capital=starting_capital + realized_total + unrealized_total,
        realized_pnl=realized_total,
        unrealized_pnl=unrealized_total,
        equity_series=equity_series,
    )

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Literal
from ..db import get_db
from ..models import Position
from ..schemas import PositionCreate, PositionOut, PositionUpdate

router = APIRouter(prefix="/api/positions", tags=["positions"])


def serialize_position(position: Position) -> PositionOut:
    exit_price = (
        float(position.exit_price) if position.exit_price is not None else None
    )
    current_price = (
        float(position.current_price) if position.current_price is not None else None
    )
    qty = float(position.qty)
    entry_price = float(position.entry_price)

    unrealized_pnl = None
    unrealized_pct = None

    if position.closed_at is None and current_price is not None:
        side = (position.side or "").lower()
        if side == "short":
            unrealized_pnl = (entry_price - current_price) * qty
            if entry_price:
                unrealized_pct = ((entry_price - current_price) / entry_price) * 100.0
        else:
            unrealized_pnl = (current_price - entry_price) * qty
            if entry_price:
                unrealized_pct = ((current_price - entry_price) / entry_price) * 100.0

    return PositionOut(
        id=position.id,
        created_at=position.created_at,
        ticker=position.ticker,
        side=position.side,
        qty=float(position.qty),
        entry_price=float(position.entry_price),
        current_price=current_price,
        exit_price=exit_price,
        notes=position.notes,
        closed_at=position.closed_at,
        status="closed" if position.closed_at else "open",
        unrealized_pnl=unrealized_pnl,
        unrealized_pct=unrealized_pct,
    )


@router.post("", response_model=PositionOut)
def create_position(payload: PositionCreate, db: Session = Depends(get_db)):
    data = payload.dict(exclude_unset=True)
    if data.get("current_price") is None:
        data["current_price"] = data["entry_price"]
    p = Position(**data)
    db.add(p)
    db.commit()
    db.refresh(p)
    return serialize_position(p)


@router.get("", response_model=list[PositionOut])
def list_positions(
    status: Literal["open", "closed", "all"] = Query("open"),
    db: Session = Depends(get_db),
):
    query = db.query(Position).order_by(Position.created_at.desc())

    if status == "open":
        query = query.filter(Position.closed_at.is_(None))
    elif status == "closed":
        query = query.filter(Position.closed_at.isnot(None))

    rows = query.all()
    return [serialize_position(r) for r in rows]


@router.put("/{position_id}", response_model=PositionOut)
def update_position(
    position_id: int, payload: PositionUpdate, db: Session = Depends(get_db)
):
    position = db.query(Position).filter(Position.id == position_id).first()
    if position is None:
        raise HTTPException(status_code=404, detail="Position not found")

    data = payload.dict(exclude_unset=True)
    if data.get("current_price") is None and data.get("entry_price") is not None:
        data["current_price"] = data["entry_price"]
    if data.get("exit_price") is not None:
        data["current_price"] = data["exit_price"]

    for field, value in data.items():
        setattr(position, field, value)

    db.commit()
    db.refresh(position)

    return serialize_position(position)

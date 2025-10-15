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
    return PositionOut(
        id=position.id,
        created_at=position.created_at,
        ticker=position.ticker,
        side=position.side,
        qty=float(position.qty),
        entry_price=float(position.entry_price),
        exit_price=exit_price,
        notes=position.notes,
        closed_at=position.closed_at,
        status="closed" if position.closed_at else "open",
    )


@router.post("", response_model=PositionOut)
def create_position(payload: PositionCreate, db: Session = Depends(get_db)):
    p = Position(**payload.dict())
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

    for field, value in payload.dict().items():
        setattr(position, field, value)

    db.commit()
    db.refresh(position)

    return serialize_position(position)

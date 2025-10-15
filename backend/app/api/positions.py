from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Position
from ..schemas import PositionIn, PositionOut

router = APIRouter(prefix="/api/positions", tags=["positions"])


@router.post("", response_model=PositionOut)
def create_position(payload: PositionIn, db: Session = Depends(get_db)):
    p = Position(**payload.dict())
    db.add(p)
    db.commit()
    db.refresh(p)
    return PositionOut(id=p.id, created_at=p.created_at, **payload.dict())


@router.get("", response_model=list[PositionOut])
def list_positions(db: Session = Depends(get_db)):
    rows = db.query(Position).order_by(Position.created_at.desc()).all()
    return [
        PositionOut(
            id=r.id,
            created_at=r.created_at,
            ticker=r.ticker,
            side=r.side,
            qty=float(r.qty),
            entry_price=float(r.entry_price),
            notes=r.notes,
        )
        for r in rows
    ]


@router.put("/{position_id}", response_model=PositionOut)
def update_position(
    position_id: int, payload: PositionIn, db: Session = Depends(get_db)
):
    position = db.query(Position).filter(Position.id == position_id).first()
    if position is None:
        raise HTTPException(status_code=404, detail="Position not found")

    for field, value in payload.dict().items():
        setattr(position, field, value)

    db.commit()
    db.refresh(position)

    return PositionOut(
        id=position.id,
        created_at=position.created_at,
        ticker=position.ticker,
        side=position.side,
        qty=float(position.qty),
        entry_price=float(position.entry_price),
        notes=position.notes,
    )

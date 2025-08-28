from fastapi import APIRouter, Depends
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

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import AlertKind, PriceAlert
from ..schemas import AlertIn, AlertOut

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.post("", response_model=AlertOut)
def create_alert(payload: AlertIn, db: Session = Depends(get_db)):
    a = PriceAlert(
        ticker=payload.ticker.upper(),
        kind=payload.kind,
        threshold_value=payload.threshold_value,
        trailing=payload.trailing,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return AlertOut(
        id=a.id,
        active=a.active,
        created_at=a.created_at,
        last_triggered_at=a.last_triggered_at,
        **payload.dict(),
    )


@router.get("", response_model=list[AlertOut])
def list_alerts(
    active: bool | None = None,
    ticker: str | None = Query(default=None, min_length=1),
    kind: AlertKind | None = None,
    threshold_value: float | None = None,
    trailing: bool | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(PriceAlert)
    if active is not None:
        q = q.filter(PriceAlert.active == active)
    if ticker:
        q = q.filter(PriceAlert.ticker == ticker.upper())
    if kind is not None:
        q = q.filter(PriceAlert.kind == kind)
    if threshold_value is not None:
        q = q.filter(PriceAlert.threshold_value == threshold_value)
    if trailing is not None:
        q = q.filter(PriceAlert.trailing == trailing)
    rows = q.order_by(PriceAlert.created_at.desc()).all()
    return [
        AlertOut(
            id=r.id,
            ticker=r.ticker,
            kind=r.kind.value if hasattr(r.kind, "value") else r.kind,
            threshold_value=float(r.threshold_value),
            trailing=r.trailing,
            active=r.active,
            created_at=r.created_at,
            last_triggered_at=r.last_triggered_at,
        )
        for r in rows
    ]

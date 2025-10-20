from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import AlertKind, PriceAlert
from ..schemas import AlertIn, AlertOut

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


def _serialize_alert(alert: PriceAlert) -> AlertOut:
    kind = alert.kind.value if hasattr(alert.kind, "value") else alert.kind
    return AlertOut(
        id=alert.id,
        ticker=alert.ticker,
        kind=kind,
        threshold_value=float(alert.threshold_value),
        trailing=alert.trailing,
        active=alert.active,
        created_at=alert.created_at,
        last_triggered_at=alert.last_triggered_at,
    )


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
    return _serialize_alert(a)


@router.post("/activate", response_model=AlertOut)
def activate_alert(payload: AlertIn, db: Session = Depends(get_db)):
    normalized_ticker = payload.ticker.upper()

    existing = (
        db.query(PriceAlert)
        .filter(
            PriceAlert.ticker == normalized_ticker,
            PriceAlert.kind == payload.kind,
            PriceAlert.threshold_value == payload.threshold_value,
            PriceAlert.trailing == payload.trailing,
        )
        .order_by(PriceAlert.created_at.desc())
        .first()
    )

    if existing:
        if not existing.active:
            existing.active = True
            db.add(existing)
        db.commit()
        db.refresh(existing)
        return _serialize_alert(existing)

    new_alert = PriceAlert(
        ticker=normalized_ticker,
        kind=payload.kind,
        threshold_value=payload.threshold_value,
        trailing=payload.trailing,
    )
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)
    return _serialize_alert(new_alert)


@router.post("/deactivate", response_model=AlertOut)
def deactivate_alert(payload: AlertIn, db: Session = Depends(get_db)):
    normalized_ticker = payload.ticker.upper()

    existing = (
        db.query(PriceAlert)
        .filter(
            PriceAlert.ticker == normalized_ticker,
            PriceAlert.kind == payload.kind,
            PriceAlert.threshold_value == payload.threshold_value,
            PriceAlert.trailing == payload.trailing,
        )
        .order_by(PriceAlert.created_at.desc())
        .first()
    )

    if existing is None:
        raise HTTPException(status_code=404, detail="Alert not found.")

    if existing.active:
        existing.active = False
        db.add(existing)
        db.commit()
        db.refresh(existing)
    else:
        db.commit()

    return _serialize_alert(existing)


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
    return [_serialize_alert(r) for r in rows]

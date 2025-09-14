from pydantic import BaseModel
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime


class RVOLItem(BaseModel):
    ticker: str
    name: Optional[str] = None
    rvol: float
    price: float
    pct_change: Optional[float] = None
    volume: Optional[int] = None
    market_cap: Optional[int] = None
    sector: Optional[str] = None
    analyst_rating: Optional[str] = None


class IngestBatch(BaseModel):
    batch_id: UUID
    items: List[RVOLItem]


class CandidateDTO(BaseModel):
    ticker: str
    price: float
    rvol: float
    score: float
    reasons: Any


class PositionIn(BaseModel):
    ticker: str
    side: str
    qty: float
    entry_price: float
    notes: Optional[str] = None


class PositionOut(PositionIn):
    id: int
    created_at: datetime


class AlertIn(BaseModel):
    ticker: str
    kind: str  # target_pct | target_abs | stop
    threshold_value: float
    trailing: bool = False


class AlertOut(AlertIn):
    id: int
    active: bool
    created_at: datetime
    last_triggered_at: Optional[datetime]

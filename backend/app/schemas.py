from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Any, Literal
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


class ActiveRvolCandidate(BaseModel):
    ticker: str
    name: Optional[str] = None
    rvol: Optional[float] = None
    price: Optional[float] = None
    pct_change: Optional[float] = None
    volume: Optional[int] = None
    market_cap: Optional[int] = None
    sector: Optional[str] = None
    analyst_rating: Optional[str] = None


class ActiveRvolBatch(BaseModel):
    batch_id: UUID
    ingested_at: datetime
    items: List[ActiveRvolCandidate]


class TestTelegramRequest(BaseModel):
    message: Optional[str] = None


class CandidateDTO(BaseModel):
    ticker: str
    price: float
    rvol: float
    score: float
    reasons: Any


class PositionBase(BaseModel):
    ticker: str
    side: str
    qty: float
    entry_price: float
    current_price: Optional[float] = None
    notes: Optional[str] = None


class PositionCreate(PositionBase):
    pass


class PositionUpdate(PositionBase):
    exit_price: Optional[float] = None
    closed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class PositionOut(PositionBase):
    id: int
    created_at: datetime
    exit_price: Optional[float] = None
    closed_at: Optional[datetime] = None
    status: Literal["open", "closed"]
    unrealized_pnl: Optional[float] = None
    unrealized_pct: Optional[float] = None


class PortfolioPoint(BaseModel):
    timestamp: datetime
    label: str
    realized: float
    unrealized: float
    equity: float


class PortfolioSummary(BaseModel):
    starting_capital: float
    current_capital: float
    realized_pnl: float
    unrealized_pnl: float
    equity_series: List[PortfolioPoint]


class ThemeSettings(BaseModel):
    mode: Literal["light", "dark"] = "light"
    primary_color: str = Field(
        "#1976d2", pattern=r"^#[0-9a-fA-F]{6}$"
    )


class AppSettingsResponse(BaseModel):
    price_min: float
    price_max: float
    min_rvol: float
    min_pct_change: float
    volume_cap: int
    starting_capital: float
    theme: ThemeSettings


class AppSettingsUpdate(BaseModel):
    price_min: Optional[float] = Field(None, ge=0)
    price_max: Optional[float] = Field(None, ge=0)
    min_rvol: Optional[float] = Field(None, ge=0)
    min_pct_change: Optional[float] = Field(None, ge=0)
    volume_cap: Optional[int] = Field(None, ge=0)
    starting_capital: Optional[float] = Field(None, ge=0)
    theme: Optional[ThemeSettings]

    @model_validator(mode="after")
    def validate_price_bounds(self):
        price_min = self.price_min
        price_max = self.price_max
        if (
            price_min is not None
            and price_max is not None
            and price_min > price_max
        ):
            raise ValueError("price_min cannot be greater than price_max")
        return self


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

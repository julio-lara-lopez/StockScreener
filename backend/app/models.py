from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func
from .db import Base
import enum


class AlertKind(str, enum.Enum):
    target_pct = "target_pct"
    target_abs = "target_abs"
    stop = "stop"


class Channel(str, enum.Enum):
    telegram = "telegram"
    gmail = "gmail"
    desktop = "desktop"


class NotifyStatus(str, enum.Enum):
    sent = "sent"
    error = "error"


class Regime(str, enum.Enum):
    hot = "hot"
    cold = "cold"


class AppSetting(Base):
    __tablename__ = "app_settings"
    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, nullable=False)
    value_json = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class MarketRegime(Base):
    __tablename__ = "market_regime"
    id = Column(Integer, primary_key=True)
    for_date = Column(Date, unique=True, nullable=False)
    regime = Column(Enum(Regime), nullable=False, default=Regime.hot)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RvolBatch(Base):
    __tablename__ = "rvol_batches"
    id = Column(UUID(as_uuid=True), primary_key=True)
    ingested_at = Column(DateTime(timezone=True), server_default=func.now())
    source_hash = Column(Text)


class RvolCandidate(Base):
    __tablename__ = "rvol_candidates"
    id = Column(BigInteger, primary_key=True)
    batch_id = Column(
        UUID(as_uuid=True),
        ForeignKey("rvol_batches.id", ondelete="CASCADE"),
        nullable=False,
    )
    ticker = Column(String, nullable=False)
    name = Column(Text)
    rvol = Column(Numeric(10, 2), nullable=False)
    price = Column(Numeric(12, 4), nullable=False)
    pct_change = Column(Numeric(7, 3))
    volume = Column(BigInteger)
    market_cap = Column(BigInteger)
    sector = Column(Text)
    analyst_rating = Column(Text)
    seen_at = Column(DateTime(timezone=True), server_default=func.now())


class CandidateFiltered(Base):
    __tablename__ = "candidates_filtered"
    __table_args__ = (
        UniqueConstraint("batch_id", "ticker", name="unique_batch_ticker"),
    )
    id = Column(BigInteger, primary_key=True)
    batch_id = Column(
        UUID(as_uuid=True),
        ForeignKey("rvol_batches.id", ondelete="CASCADE"),
        nullable=False,
    )
    ticker = Column(String, nullable=False)
    score = Column(Numeric(12, 6), nullable=False, default=0)
    reasons_json = Column(JSONB)
    first_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    notified_topn = Column(Boolean, nullable=False, default=False)


class Position(Base):
    __tablename__ = "positions"
    id = Column(BigInteger, primary_key=True)
    ticker = Column(String, nullable=False)
    side = Column(String, nullable=False)  # "long"/"short"
    qty = Column(Numeric(18, 4), nullable=False)
    entry_price = Column(Numeric(12, 4), nullable=False)
    exit_price = Column(Numeric(12, 4))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    closed_at = Column(DateTime(timezone=True))
    notes = Column(Text)


class PriceAlert(Base):
    __tablename__ = "price_alerts"
    id = Column(BigInteger, primary_key=True)
    ticker = Column(String, nullable=False)
    kind = Column(Enum(AlertKind), nullable=False)
    threshold_value = Column(Numeric(12, 4), nullable=False)
    trailing = Column(Boolean, nullable=False, default=False)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_triggered_at = Column(DateTime(timezone=True))


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(BigInteger, primary_key=True)
    channel = Column(Enum(Channel), nullable=False)
    ticker = Column(String)
    message = Column(Text, nullable=False)
    dedupe_key = Column(Text, nullable=False, unique=True)
    sent_at = Column(DateTime(timezone=True))
    status = Column(Enum(NotifyStatus), nullable=False)
    error = Column(Text)

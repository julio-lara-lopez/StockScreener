from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict

from sqlalchemy.orm import Session

from ..config import settings as env_settings
from ..models import AppSetting

APP_CONFIG_KEY = "app_config"

DEFAULT_PRIMARY_COLOR = "#1976d2"

DEFAULT_SETTINGS: Dict[str, Any] = {
    "price_min": env_settings.PRICE_MIN,
    "price_max": env_settings.PRICE_MAX,
    "min_rvol": env_settings.MIN_RVOL,
    "volume_cap": env_settings.VOLUME_CAP,
    "topN": env_settings.TOPN_PER_BATCH,
    "starting_capital": env_settings.STARTING_CAPITAL,
    "theme_mode": "light",
    "theme_primary": DEFAULT_PRIMARY_COLOR,
}


def _query_all_settings(db: Session) -> list[AppSetting]:
    return db.query(AppSetting).all()


def load_app_settings(db: Session) -> Dict[str, Any]:
    """Return application settings merging DB overrides with defaults."""

    config: Dict[str, Any] = deepcopy(DEFAULT_SETTINGS)

    for row in _query_all_settings(db):
        value = row.value_json
        if isinstance(value, dict):
            config.update(value)
        elif row.key:
            config[row.key] = value

    return config


def save_app_settings(db: Session, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Persist a set of updates and return the merged configuration."""

    record = db.query(AppSetting).filter(AppSetting.key == APP_CONFIG_KEY).first()

    if record is None:
        record = AppSetting(key=APP_CONFIG_KEY, value_json={})

    existing: Dict[str, Any] = {}
    if isinstance(record.value_json, dict):
        existing.update(record.value_json)

    existing.update(updates)
    record.value_json = existing

    db.add(record)
    db.commit()
    db.refresh(record)

    return load_app_settings(db)

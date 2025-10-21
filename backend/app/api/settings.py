from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..schemas import AppSettingsResponse, AppSettingsUpdate
from ..services.app_settings import load_app_settings, save_app_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _format_response(config: Dict[str, Any]) -> AppSettingsResponse:
    theme_config = config.get("theme")

    if not isinstance(theme_config, dict):
        theme_config = {}

    theme_mode = theme_config.get("mode") or config.get("theme_mode") or "light"
    primary_color = theme_config.get("primary_color") or config.get("theme_primary") or "#1976d2"

    return AppSettingsResponse(
        price_min=float(config.get("price_min", 0)),
        price_max=float(config.get("price_max", 0)),
        min_rvol=float(config.get("min_rvol", 0)),
        volume_cap=int(config.get("volume_cap", 0)),
        starting_capital=float(config.get("starting_capital", 0)),
        theme={
            "mode": theme_mode,
            "primary_color": primary_color,
        },
    )


@router.get("", response_model=AppSettingsResponse)
def get_settings(db: Session = Depends(get_db)) -> AppSettingsResponse:
    config = load_app_settings(db)
    return _format_response(config)


@router.put("", response_model=AppSettingsResponse)
def update_settings(
    payload: AppSettingsUpdate, db: Session = Depends(get_db)
) -> AppSettingsResponse:
    data = payload.dict(exclude_unset=True)

    updates: Dict[str, Any] = {}

    for key in ("price_min", "price_max", "min_rvol", "starting_capital"):
        if key in data:
            updates[key] = float(data[key])

    if "volume_cap" in data:
        updates["volume_cap"] = int(data["volume_cap"])

    if "theme" in data:
        theme_data = data["theme"] or {}
        if "mode" in theme_data:
            updates["theme_mode"] = theme_data["mode"]
        if "primary_color" in theme_data:
            updates["theme_primary"] = theme_data["primary_color"]

    if not updates:
        raise HTTPException(status_code=400, detail="No settings provided for update")

    config = save_app_settings(db, updates)
    return _format_response(config)

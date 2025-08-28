from fastapi import APIRouter

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
def get_settings():
    # For MVP, just return env defaults (persist in DB later)
    from ..config import settings

    return {
        "price_min": settings.PRICE_MIN,
        "price_max": settings.PRICE_MAX,
        "min_rvol": settings.MIN_RVOL,
        "volume_cap": settings.VOLUME_CAP,
        "topN": settings.TOPN_PER_BATCH,
    }

import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL = os.getenv(
        "DATABASE_URL", "postgresql+psycopg://app:app@localhost:5432/screener"
    )
    FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "")
    TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
    TOPN_PER_BATCH = int(os.getenv("TOPN_PER_BATCH", "5"))

    # Defaults (can be overridden from DB app_settings)
    PRICE_MIN = float(os.getenv("PRICE_MIN", "5"))
    PRICE_MAX = float(os.getenv("PRICE_MAX", "20"))
    MIN_RVOL = float(os.getenv("MIN_RVOL", "5"))
    VOLUME_CAP = int(os.getenv("VOLUME_CAP", "20000000"))  # using 'hot' cap by default


settings = Settings()

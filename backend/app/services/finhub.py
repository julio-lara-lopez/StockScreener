import httpx
from ..config import settings


def get_quote(ticker: str) -> dict:
    # Finnhub free tier: 60 req/min
    url = "https://finnhub.io/api/v1/quote"
    with httpx.Client(timeout=8) as client:
        r = client.get(
            url, params={"symbol": ticker, "token": settings.FINNHUB_API_KEY}
        )
        r.raise_for_status()
        return r.json()  # { c, d, dp, h, l, o, pc, t }

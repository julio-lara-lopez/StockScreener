from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import (
    internal,
    candidates,
    positions,
    alerts,
    settings as settings_api,
    portfolio,
    rvol,
)
from .workers.poller import run_price_poller
import threading
from .db import engine, Base

Base.metadata.create_all(engine)  # DEV ONLY; use Alembic later

app = FastAPI(title="RVOL Screener")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(internal.router)
app.include_router(candidates.router)
app.include_router(positions.router)
app.include_router(alerts.router)
app.include_router(settings_api.router)
app.include_router(portfolio.router)
app.include_router(rvol.router)
# in app/main.py
ENABLE_POLLER = True


# Start background price poller (simple thread for MVP)
@app.on_event("startup")
def startup():
    if ENABLE_POLLER:
        t = threading.Thread(target=run_price_poller, daemon=True)
        t.start()

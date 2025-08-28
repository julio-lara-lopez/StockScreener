from fastapi import FastAPI
from .api import internal, candidates, positions, alerts, settings as settings_api
from .workers.poller import run_price_poller
import threading

app = FastAPI(title="RVOL Screener")

app.include_router(internal.router)
app.include_router(candidates.router)
app.include_router(positions.router)
app.include_router(alerts.router)
app.include_router(settings_api.router)


# Start background price poller (simple thread for MVP)
@app.on_event("startup")
def startup():
    t = threading.Thread(target=run_price_poller, daemon=True)
    t.start()

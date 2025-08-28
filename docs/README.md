# High-level architecture

## Frontend (React + TS)

- Dashboard: live list of “Hot” stocks (RVOL feed filtered by your rules)

- Watchlist / Positions: set entries, size, stop loss, profit targets (absolute $ or %)

- Alerts panel: history + status

- Settings: market regime (hot/cold), thresholds, notification channels

## Backend (FastAPI)

- REST + WebSocket (for push updates to the UI)

- Ingestion workers (every 5 min) to pull your “unusual volume (RVOL>1)” list

- Filtering/scoring pipeline

- Price tracking workers (poll Finnhub within 60 req/min cap)

- Optional news checker (phase 2)

- Notification service (Telegram Bot + Gmail)

- Idempotent “notify once per symbol/condition” logic

## Data

- Postgres for durable state

- Redis for queues, rate limiting buckets, and short-lived caches

## Infra

- Docker Compose (api, web, db, redis, worker, scheduler)

- `.env` for secrets (Finnhub, Telegram bot token, Gmail creds/App Password)

- Logging/metrics (structlog + Prometheus/Grafana later if you want)

# Data model (tables)

- `symbols`(id, ticker, name, exchange, is_active)

- `market_regime`(id, date, regime ENUM[hot,cold], notes) — or store current in app_settings

- `rvol_candidates`(id, ticker, source_batch_id, rvol, price, volume, pct_change, ts_ingested)

- `filters`(id, name, params_json, enabled)

- `candidates_filtered`(id, ticker, score, reasons_json, first_seen_at, last_seen_at, notified_topN BOOLEAN)

- `positions`(id, ticker, side, qty, entry_price, created_at, notes)

- `price_alerts`(id, ticker, kind ENUM[target%, target$, stop], threshold_value, trailing BOOLEAN, active BOOLEAN, last_triggered_at)

- `news_cache`(id, ticker, headline, url, published_at, provider, hash) ← phase 2

- `notifications`(id, channel ENUM[telegram,gmail,desktop], ticker, message, dedupe_key, sent_at, status, error)

- `app_settings`(id, key, value_json) — e.g., price range, volume caps, RVOL min, topN, throttle settings, user email/chat id

Indexes you’ll want: `(ticker)` on most tables, `(dedupe_key)` unique on notifications, time indexes on ingestion tables.

# Filtering & scoring

**Input**: your 5-min feed (top ~100 RVOL>1 names).

**Filters** (configurable in UI):

- Price between `$min_price..$max_price` (e.g. 5–10)

- Volume cap depends on regime:

  - hot: volume < 20M

  - cold: volume < 10M

- % change today between `[min_pct_change, max_pct_change]`

- RVOL >= 5 (or whatever you set)

- (Phase 2) “Has recent news” flag (last N hours)

**Score** (for top-N): simple weighted sum; e.g.
```
score = w1*standardize(RVOL) + w2*standardize(%change) + w3*liquidity_score + w4*news_boost
```


Persist reasons in `reasons_json` for explainability.

Notify top-N per batch (e.g., top 5). `Use dedupe_key = f"{date}-{batch}-{ticker}-topN"` so you never double-notify.

# Price tracking & alerts (Finnhub, 60 req/min)

**Goal**: watch only symbols that matter:

- All symbols in positions

- Any symbol with active price_alerts

- (Optional) active candidates for a short grace period

**Scheduling** strategy (respect 60/min):

Build a dynamic queue each minute: de-dup tickers, priority order:

1. tickers near an alert threshold (within X bps)

2. open positions

3. newly added alerts

- Poll prices via  `/quote` at a cadence that fits the count:

  - e.g., 30 tickers → poll each twice per minute

  - 60 tickers → poll each once/min
  - 60 → downsample less important ones (every 2–3 min) and/or ask user to reduce watchlist


- Maintain per-ticker moving windows in Redis for “near-threshold” detection to increase sampling if price approaches target/stop.

**Alert triggers**

- Absolute: profit target $ (entry_price * qty → desired P&L)

- Percent: e.g., +10% or −3% from entry

- Trailing stop (optional): update stop as price makes new highs

- On crossing, create notification with dedupe key `f"{ticker}-{alert_id}-{date}-{bucket}"` and mark `last_triggered_at`.

# Notifications

## Telegram

- Create bot via BotFather, store TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID

- Send compact messages:

  - Top-N candidate: TICKER $Px RVOL %chg Vol [News?] Reasons: …

  - Alert: ALERT: TICKER hit +10% target (Px=X.X, Entry=Y.Y, P&L=$Z)

## Gmail

- Use OAuth + refresh token or App Password (simpler if account allows)

- Same dedupe semantics

- Optionally include TradingView link https://www.tradingview.com/chart/?symbol=NASDAQ:TICKER

## Desktop (local)

If you run the UI locally, use web notifications via the browser (permission-based)

Or a tiny Electron tray notifier (optional)

# API surface (FastAPI)

**Public endpoints (JWT protected)**:

- GET /api/candidates?limit=&has_news=&min_score= — list filtered/scored

- POST /api/positions — body: {ticker, qty, entry_price, side}

- GET /api/positions

- POST /api/alerts — body: {ticker, kind, threshold_value, trailing?}

- GET /api/alerts?active=true

- POST /api/settings — thresholds, regime, channels

- GET /api/notifications?since=...

- WS /ws/stream — push new top-N and alert triggers to the dashboard

**Internal/worker endpoints (or direct db with a job runner)**:

- POST /internal/ingest-rvol-batch — your 5-min feed as JSON

- POST /internal/price-tick — (optional) if you move polling outside the app

# Workers & scheduling

- APScheduler (simple) or Celery/RQ + Redis (scales better)

  - rvol_ingest_job (/5 minutes)

  - filter_and_score_job (after ingest)

  - notify_topN_job (after scoring)

  - price_tracking_job (every 5–10 seconds building the minute queue; poll in bursts within the minute cap)

  - news_refresh_job (phase 2, e.g., every 10–15 min)

**Rate-limit guard**
- Redis token bucket: finnhub_tokens:current

- Refilled every second (1 token/second) → 60/min

- Each quote call consumes one token; if empty, worker sleeps briefly

# Frontend (React + TS)

- Pages

  - Hot list: table with sortable columns (RVOL, %chg, Vol, Px)

  - Positions: CRUD positions; quick “Add alert” actions

  - Alerts: active + history, toggle on/off

  - Settings: all thresholds + notification test buttons

- Components

  - SymbolTag, ScoreBadge, NewsPill (phase 2), AlertEditor modal

- Live updates via WebSocket; fall back to polling

# Docker Compose (outline)
```yaml
version: "3.9"
services:
  api:
    build: ./backend
    env_file: .env
    depends_on: [db, redis]
    ports: ["8000:8000"]
  worker:
    build: ./backend
    command: ["python", "-m", "app.worker"]
    env_file: .env
    depends_on: [db, redis]
  web:
    build: ./frontend
    ports: ["3000:3000"]
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: screener
    volumes: ["pgdata:/var/lib/postgresql/data"]
  redis:
    image: redis:7
volumes:
  pgdata:
```
# MVP milestones (2–3 short sprints)

**Sprint 1 (MVP ingestion + UI)**
- DB schema + migrations

- Ingest 5-min RVOL feed → store rvol_candidates

- Filtering + scoring → candidates_filtered

- React dashboard listing top-N

- Basic settings UI (price range, RVOL min, volumes caps, regime)

**Sprint 2 (Alerts + Finnhub)**

- Positions + price alerts CRUD

- Finnhub polling with token bucket

- Trigger alerts and Telegram/Gmail notifications

- WebSocket updates to UI

- Notification dedupe + history

**Sprint 3 (Polish + Optional News)**

- News cache + “has news” filter toggle (add later)

- Better ranking formula and “explanations”

- Unit tests + e2e happy path

- Error dashboards, retries, and timeouts

- Export CSV of daily top-N and alerts

# Testing & safety rails

- Backfill tests with recorded Finnhub JSON (VCR-style) to avoid rate waste

- Guardrails:

  - Per-minute global token bucket

  - Per-ticker cooldown (e.g., don’t alert same threshold more than once per X minutes)

  - Daily idempotency keys for top-N batch notifications

- Clock skew handling for market open/close (skip polling after hours unless enabled)
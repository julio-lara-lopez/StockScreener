CREATE TYPE "alert_kind" AS ENUM (
  'target_pct',
  'target_abs',
  'stop'
);

CREATE TYPE "channel" AS ENUM (
  'telegram',
  'gmail',
  'desktop'
);

CREATE TYPE "notify_status" AS ENUM (
  'sent',
  'error'
);

CREATE TYPE "regime" AS ENUM (
  'hot',
  'cold'
);

CREATE TABLE "app_settings" (
  "id" serial PRIMARY KEY,
  "key" text UNIQUE NOT NULL,
  "value_json" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT (now()),
  "updated_at" timestamptz DEFAULT (now())
);

CREATE TABLE "market_regime" (
  "id" serial PRIMARY KEY,
  "for_date" date UNIQUE NOT NULL,
  "regime" regime NOT NULL DEFAULT 'hot',
  "notes" text,
  "created_at" timestamptz DEFAULT (now())
);

CREATE TABLE "rvol_batches" (
  "id" uuid PRIMARY KEY,
  "ingested_at" timestamptz NOT NULL DEFAULT (now()),
  "source_hash" text
);

CREATE TABLE "rvol_candidates" (
  "id" bigserial PRIMARY KEY,
  "batch_id" uuid NOT NULL,
  "ticker" text NOT NULL,
  "name" text,
  "rvol" numeric(10,2) NOT NULL,
  "price" numeric(12,4) NOT NULL,
  "pct_change" numeric(7,3),
  "volume" bigint,
  "market_cap" bigint,
  "sector" text,
  "analyst_rating" text,
  "seen_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "candidates_filtered" (
  "id" bigserial PRIMARY KEY,
  "batch_id" uuid NOT NULL,
  "ticker" text NOT NULL,
  "score" numeric(12,6) NOT NULL DEFAULT 0,
  "reasons_json" jsonb,
  "first_seen_at" timestamptz NOT NULL DEFAULT (now()),
  "last_seen_at" timestamptz NOT NULL DEFAULT (now()),
  "notified_topn" boolean NOT NULL DEFAULT false
);

CREATE TABLE "positions" (
  "id" bigserial PRIMARY KEY,
  "ticker" text NOT NULL,
  "side" text NOT NULL,
  "qty" numeric(18,4) NOT NULL,
  "entry_price" numeric(12,4) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "notes" text
);

CREATE TABLE "price_alerts" (
  "id" bigserial PRIMARY KEY,
  "ticker" text NOT NULL,
  "kind" alert_kind NOT NULL,
  "threshold_value" numeric(12,4) NOT NULL,
  "trailing" boolean NOT NULL DEFAULT false,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "last_triggered_at" timestamptz
);

CREATE TABLE "notifications" (
  "id" bigserial PRIMARY KEY,
  "channel" channel NOT NULL,
  "ticker" text,
  "message" text NOT NULL,
  "dedupe_key" text UNIQUE NOT NULL,
  "sent_at" timestamptz,
  "status" notify_status NOT NULL,
  "error" text
);

CREATE TABLE "news_cache" (
  "id" bigserial PRIMARY KEY,
  "ticker" text NOT NULL,
  "headline" text NOT NULL,
  "url" text,
  "provider" text,
  "published_at" timestamptz NOT NULL,
  "hash" text UNIQUE NOT NULL,
  "created_at" timestamptz DEFAULT (now())
);

CREATE INDEX ON "positions" ("ticker");

CREATE INDEX ON "positions" ("created_at");

CREATE INDEX ON "news_cache" ("ticker");

CREATE INDEX ON "news_cache" ("published_at");

COMMENT ON COLUMN "app_settings"."value_json" IS 'Arbitrary config in JSON';

COMMENT ON COLUMN "rvol_batches"."source_hash" IS 'hash of source payload for dedupe (optional)';

COMMENT ON COLUMN "positions"."side" IS 'long/short';

COMMENT ON COLUMN "price_alerts"."threshold_value" IS 'For target_pct use % like 10.0';

ALTER TABLE "rvol_candidates" ADD FOREIGN KEY ("batch_id") REFERENCES "rvol_batches" ("id");

ALTER TABLE "candidates_filtered" ADD FOREIGN KEY ("batch_id") REFERENCES "rvol_batches" ("id");

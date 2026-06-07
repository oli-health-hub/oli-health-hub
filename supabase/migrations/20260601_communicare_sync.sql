-- ─────────────────────────────────────────────────────────────────────────────
-- Communicare Sync Infrastructure
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds sync tracking columns to patients + creates a queue table for
-- background sync jobs. CC is master for cadastro; OLI syncs silently.
-- UI only shows 'synced' or 'pending' (errors handled via internal retry).
-- ─────────────────────────────────────────────────────────────────────────────

-- patients: sync state columns
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS sync_status       text   DEFAULT 'pending'
    CHECK (sync_status IN ('synced','pending')),
  ADD COLUMN IF NOT EXISTS sync_progress     int    DEFAULT 0
    CHECK (sync_progress BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS sync_attempt_count int   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS synced_at         timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_error   text;  -- internal, never shown to user

-- profiles: SSO token cache + CC professional ID
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS communicare_id        text,
  ADD COLUMN IF NOT EXISTS communicare_jwt       text,
  ADD COLUMN IF NOT EXISTS communicare_jwt_exp   timestamptz;

-- reservations: link to CC schedule (when CC agenda API arrives)
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS communicare_schedule_id text,
  ADD COLUMN IF NOT EXISTS sync_status             text DEFAULT 'pending'
    CHECK (sync_status IN ('synced','pending'));

-- ─── communicare_sync_queue ──────────────────────────────────────────────────
-- Background job queue. Processed by Edge Function on cron + on-demand from app.
CREATE TABLE IF NOT EXISTS communicare_sync_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     text NOT NULL CHECK (entity_type IN ('patient','reservation','profile')),
  entity_id       uuid NOT NULL,
  action          text NOT NULL CHECK (action IN ('create','update','delete')),
  payload         jsonb NOT NULL,
  attempt_count   int  DEFAULT 0,
  next_attempt_at timestamptz DEFAULT now(),
  last_error      text,
  created_at      timestamptz DEFAULT now(),
  processed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_pending
  ON communicare_sync_queue (next_attempt_at)
  WHERE processed_at IS NULL;

-- RLS: only service role touches the queue
ALTER TABLE communicare_sync_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only_sync_queue" ON communicare_sync_queue
  FOR ALL USING (false);

-- Index for fast dedup-by-CPF lookups on CC side
CREATE INDEX IF NOT EXISTS idx_patients_communicare_id
  ON patients (communicare_id)
  WHERE communicare_id IS NOT NULL;

-- ─── communicare_webhook_events ──────────────────────────────────────────────
-- Auditoria + replay de webhooks recebidos do CC.
CREATE TABLE IF NOT EXISTS communicare_webhook_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   text NOT NULL,
  payload      jsonb NOT NULL,
  processed_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_type
  ON communicare_webhook_events (event_type, created_at DESC);

ALTER TABLE communicare_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only_webhook_events" ON communicare_webhook_events
  FOR ALL USING (false);

-- Initial state: patients already in DB are marked pending so the sync job
-- picks them up on first migration run.
UPDATE patients
SET sync_status = 'pending', sync_progress = 0
WHERE communicare_id IS NULL AND sync_status IS NULL;

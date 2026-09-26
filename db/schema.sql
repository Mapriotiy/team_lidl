-- Orange Signal :: schema
-- Design note: `documents` holds raw evidence, `signal_answers` holds one
-- evidence-backed verdict per (company, question), and `lead_scores` is derived
-- deterministically from those answers. The LLM never emits a score.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS companies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  domain         text NOT NULL UNIQUE,
  country        text,
  industry       text,
  employee_count integer,
  revenue_band   text,
  hq_city        text,
  founded_year   integer,
  description    text,
  careers_url    text,
  ats_provider   text,
  ats_slug       text,
  external_ids   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Raw scraped evidence. content_hash dedupes re-crawls of unchanged pages.
CREATE TABLE IF NOT EXISTS documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_kind  text NOT NULL,            -- website | jobs | news | firmographics
  source_name  text NOT NULL,            -- greenhouse | lever | gdelt | google_news | website ...
  url          text NOT NULL,
  title        text,
  published_at timestamptz,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  lang         text,
  content      text NOT NULL,
  content_hash text NOT NULL,
  meta         jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (company_id, content_hash)
);
CREATE INDEX IF NOT EXISTS documents_company_idx ON documents (company_id, source_kind, published_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS services (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  value_prop  text,
  active      boolean NOT NULL DEFAULT true
);

-- The configurable core of the product. Sales edits these rows, not the code.
CREATE TABLE IF NOT EXISTS signal_questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id     uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  key            text NOT NULL,
  text           text NOT NULL,          -- the business question, in sales' own words
  weight         text NOT NULL DEFAULT 'medium'   CHECK (weight IN ('high','medium','low')),
  polarity       text NOT NULL DEFAULT 'positive' CHECK (polarity IN ('positive','negative','disqualifier')),
  source_kinds   text[] NOT NULL DEFAULT ARRAY['website','jobs','news'],
  half_life_days integer NOT NULL DEFAULT 180,    -- evidence older than this counts for half
  enabled        boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, key)
);

CREATE TABLE IF NOT EXISTS icp_profiles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id     uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name           text NOT NULL,
  countries      text[] NOT NULL DEFAULT '{}',
  industries     text[] NOT NULL DEFAULT '{}',
  min_employees  integer,
  max_employees  integer,
  exclude_industries text[] NOT NULL DEFAULT '{}',
  fit_weight     numeric NOT NULL DEFAULT 0.30,   -- share of total score from firmographic fit
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- One verdict per company per question, always carrying its evidence.
CREATE TABLE IF NOT EXISTS signal_answers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  question_id   uuid NOT NULL REFERENCES signal_questions(id) ON DELETE CASCADE,
  verdict       text NOT NULL CHECK (verdict IN ('yes','no','unknown')),
  confidence    numeric NOT NULL DEFAULT 0,
  rationale     text,
  evidence      jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{quote,url,title,published_at,verified}]
  model         text,
  evaluated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, question_id)
);

CREATE TABLE IF NOT EXISTS lead_scores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_id    uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  fit_score     numeric NOT NULL DEFAULT 0,
  intent_score  numeric NOT NULL DEFAULT 0,
  penalty       numeric NOT NULL DEFAULT 0,
  total         numeric NOT NULL DEFAULT 0,
  band          text NOT NULL DEFAULT 'cold',
  disqualified  boolean NOT NULL DEFAULT false,
  breakdown     jsonb NOT NULL DEFAULT '{}'::jsonb,  -- full per-question audit trail
  computed_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, service_id)
);

CREATE TABLE IF NOT EXISTS outreach_drafts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  channel    text NOT NULL,
  subject    text,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Every fetch attempt, so a failed crawl is visible rather than silent.
CREATE TABLE IF NOT EXISTS crawl_log (
  id          bigserial PRIMARY KEY,
  company_id  uuid REFERENCES companies(id) ON DELETE CASCADE,
  source_name text NOT NULL,
  url         text NOT NULL,
  status      text NOT NULL,
  detail      text,
  docs_added  integer NOT NULL DEFAULT 0,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crawl_log_at_idx ON crawl_log (at DESC);

-- ===========================================================================
-- Workspace tables.
--
-- Everything above is the scoring pipeline. Everything below exists so the
-- dashboard can be operated instead of only read: which adapters run, which
-- sequences are enrolled, who is on the team. None of it feeds a score.
-- ===========================================================================

-- Which ingest adapters are allowed to run. src/pipeline/ingest.ts reads this
-- before each block, so switching a source off in the UI genuinely stops the
-- crawler touching it rather than only hiding it.
CREATE TABLE IF NOT EXISTS source_settings (
  source_kind text PRIMARY KEY CHECK (source_kind IN ('website','jobs','news','firmographics')),
  enabled     boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO source_settings (source_kind) VALUES ('firmographics'), ('jobs'), ('news'), ('website')
  ON CONFLICT (source_kind) DO NOTHING;

-- An outreach sequence is a saved audience plus an ordered list of steps.
-- The audience is a lead_scores query, not a frozen list, so it stays live.
CREATE TABLE IF NOT EXISTS outreach_sequences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  min_score     numeric NOT NULL DEFAULT 0,      -- audience: lead_scores.total >= this
  band          text,                            -- audience: lead_scores.band = this, or any
  steps         jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{day, channel, label}]
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, name)
);

-- One row per company pulled into a sequence. Kept rather than recomputed so
-- "enrolled on" survives a company later dropping out of the audience.
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES outreach_sequences(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled','removed')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, company_id)
);

CREATE TABLE IF NOT EXISTS report_schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  uuid REFERENCES services(id) ON DELETE CASCADE,
  name        text NOT NULL,
  cadence     text NOT NULL DEFAULT 'weekly' CHECK (cadence IN ('daily','weekly','monthly')),
  recipients  text[] NOT NULL DEFAULT '{}',
  enabled     boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text NOT NULL UNIQUE,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Server-managed secrets, currently just the key that encrypts the LLM API key.
-- Set APP_SECRET in the environment to manage that key yourself instead; this
-- table is the fallback so a fresh install works without extra setup.
CREATE TABLE IF NOT EXISTS app_secrets (
  name       text PRIMARY KEY,
  value      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Which model answers the signal questions and writes outreach.
--
-- Any OpenAI-compatible gateway works: AgentRouter (the default), OpenAI
-- itself, OpenRouter, or a local Ollama. The API key is stored encrypted and is
-- never returned to the browser - only whether one is set, and its last four
-- characters, so an operator can tell which key is installed.
CREATE TABLE IF NOT EXISTS llm_settings (
  id             boolean PRIMARY KEY DEFAULT true CHECK (id),
  base_url       text NOT NULL DEFAULT 'https://agentrouter.org/v1',
  model          text NOT NULL DEFAULT 'claude-opus-5',
  api_key_cipher text,
  api_key_hint   text,
  max_tokens     integer NOT NULL DEFAULT 8000,
  temperature    numeric NOT NULL DEFAULT 0.2,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
INSERT INTO llm_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- Extra request headers, sent with every call to the gateway.
--
-- Gateways differ in what they require beyond the key: OpenRouter asks for
-- HTTP-Referer and X-Title, a corporate proxy may want its own token, and some
-- refuse requests that do not identify the client at all. Keeping this as
-- operator-editable data means a gateway's requirements are a setting rather
-- than a patch.
--
-- CREATE TABLE IF NOT EXISTS above will not add a column to a database that
-- already has this table, so the column is added separately.
ALTER TABLE llm_settings
  ADD COLUMN IF NOT EXISTS extra_headers jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Single-row table: the CHECK plus the default make a second row impossible.
CREATE TABLE IF NOT EXISTS workspace_settings (
  id            boolean PRIMARY KEY DEFAULT true CHECK (id),
  name          text NOT NULL DEFAULT 'Orange Systems',
  slug          text NOT NULL DEFAULT 'orange-systems',
  timezone      text NOT NULL DEFAULT 'Europe/Chisinau',
  notifications jsonb NOT NULL DEFAULT
    '{"hot_lead":true,"weekly_digest":true,"crawl_failures":true,"product_updates":false}'::jsonb,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
INSERT INTO workspace_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- =============================================
-- Migration: Add Epic 1 schema to existing database
-- Run this against an existing database that only has
-- the original requests + messages tables.
-- =============================================

-- 1. New enum types
DO $$ BEGIN
  CREATE TYPE request_status AS ENUM (
    'Draft', 'PRD Generated', 'Business Approved', 'IS Review',
    'Q&A Sent', 'Epic Planning', 'In Progress', 'Complete'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE request_classification AS ENUM (
    'New Application', 'Feature Enhancement'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE epic_status AS ENUM ('Not Started', 'In Progress', 'Complete');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE change_request_status AS ENUM ('Draft', 'Submitted', 'Approved', 'Applied');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add columns to requests table
ALTER TABLE requests ADD COLUMN IF NOT EXISTS status request_status NOT NULL DEFAULT 'Draft';
ALTER TABLE requests ADD COLUMN IF NOT EXISTS classification request_classification;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS application_name TEXT;

-- 3. New tables
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entra_id TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('Business Requester', 'IS Reviewer', 'IS Engineer', 'Admin')),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  from_status request_status,
  to_status request_status NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS epics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status epic_status NOT NULL DEFAULT 'Not Started',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS epic_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epic_id UUID NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status epic_status NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_reason TEXT
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  asked_by_user_id UUID REFERENCES users(id),
  question TEXT NOT NULL,
  answer TEXT,
  sent_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  conversation_history JSONB NOT NULL DEFAULT '[]',
  status change_request_status NOT NULL DEFAULT 'Draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

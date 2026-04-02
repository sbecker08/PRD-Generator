-- =============================================
-- IS Intake Assistant — Full Schema
-- =============================================

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entra_id TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User roles
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('Business Requester', 'IS Reviewer', 'IS Engineer', 'Admin')),
  PRIMARY KEY (user_id, role)
);

-- Request status enum
DO $$ BEGIN
  CREATE TYPE request_status AS ENUM (
    'Draft',
    'PRD Generated',
    'Business Approved',
    'IS Review',
    'Q&A Sent',
    'PRD Updated',
    'Epic Planning',
    'In Progress',
    'Complete'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Request classification enum
DO $$ BEGIN
  CREATE TYPE request_classification AS ENUM (
    'New Application',
    'Feature Enhancement'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Requests
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  status request_status NOT NULL DEFAULT 'Draft',
  classification request_classification,
  application_name TEXT,
  created_by_user_id UUID REFERENCES users(id),
  approved_prd_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PRD version status enum
DO $$ BEGIN
  CREATE TYPE prd_version_status AS ENUM ('Pending Approval', 'Approved', 'Superseded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- PRD versions (versioned history of the Product Requirements Document)
CREATE TABLE IF NOT EXISTS prd_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  content TEXT NOT NULL,
  change_summary TEXT,
  status prd_version_status NOT NULL DEFAULT 'Pending Approval',
  approved_by_user_id UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, version_number)
);

-- Messages (chat history)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Status change history for cycle time tracking
CREATE TABLE IF NOT EXISTS status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  from_status request_status,
  to_status request_status NOT NULL,
  changed_by_user_id UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Epics
DO $$ BEGIN
  CREATE TYPE epic_status AS ENUM ('Not Started', 'In Progress', 'Complete');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

-- Epic history (for change request tracking)
CREATE TABLE IF NOT EXISTS epic_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epic_id UUID NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status epic_status NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_reason TEXT
);

-- Questions (IS Review Q&A)
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

-- Change requests
DO $$ BEGIN
  CREATE TYPE change_request_status AS ENUM ('Draft', 'Submitted', 'Approved', 'Applied');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  conversation_history JSONB NOT NULL DEFAULT '[]',
  status change_request_status NOT NULL DEFAULT 'Draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deferred FK: requests.approved_prd_version_id → prd_versions.id
-- (prd_versions references requests, so the FK must be added after both tables exist)
DO $$ BEGIN
  ALTER TABLE requests ADD CONSTRAINT fk_approved_prd_version
    FOREIGN KEY (approved_prd_version_id) REFERENCES prd_versions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

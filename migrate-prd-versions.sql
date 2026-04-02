-- Migration: Add PRD versioning
-- Run this against your existing database.
-- init.sql already contains the full schema for fresh installs.

-- 1. Add PRD Updated to the request_status enum
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'PRD Updated' AFTER 'Q&A Sent';

-- 2. Add prd_version_status enum
DO $$ BEGIN
  CREATE TYPE prd_version_status AS ENUM ('Pending Approval', 'Approved', 'Superseded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Add prd_versions table
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

-- 4. Add approved_prd_version_id column to requests
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS approved_prd_version_id UUID REFERENCES prd_versions(id) ON DELETE SET NULL;

-- 5. Backfill prd_versions v1 for existing requests that have a PRD in messages
--    (sets status=Approved if already past PRD Generated, else Pending Approval)
INSERT INTO prd_versions (request_id, version_number, content, status, generated_at)
SELECT DISTINCT ON (m.request_id)
  m.request_id,
  1 AS version_number,
  m.content,
  CASE
    WHEN r.status IN ('Business Approved','IS Review','Q&A Sent','PRD Updated','Epic Planning','In Progress','Complete')
      THEN 'Approved'::prd_version_status
    ELSE 'Pending Approval'::prd_version_status
  END AS status,
  m.created_at AS generated_at
FROM messages m
JOIN requests r ON r.id = m.request_id
WHERE m.role = 'assistant'
  AND (
    m.content LIKE '%# Product Requirements Document%'
    OR m.content LIKE '%## 1. Executive Summary%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM prd_versions pv WHERE pv.request_id = m.request_id
  )
ORDER BY m.request_id, m.created_at ASC;

-- 6. Set approved_prd_version_id on requests that already have an approved v1
UPDATE requests r
SET approved_prd_version_id = pv.id
FROM prd_versions pv
WHERE pv.request_id = r.id
  AND pv.version_number = 1
  AND pv.status = 'Approved'
  AND r.approved_prd_version_id IS NULL;

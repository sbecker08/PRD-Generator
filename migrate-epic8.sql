-- Epic 8: Change Requests — schema additions
-- Add ownership and summary to change_requests table

ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id);
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

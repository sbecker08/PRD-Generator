-- Epic 4: PRD Approval — schema additions
-- Add request ownership tracking
ALTER TABLE requests ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id);

-- Track who made each status transition (for approval audit trail)
ALTER TABLE status_history ADD COLUMN IF NOT EXISTS changed_by_user_id UUID REFERENCES users(id);

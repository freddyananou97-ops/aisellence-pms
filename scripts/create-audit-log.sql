-- Audit log table for tracking all important actions
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp timestamptz DEFAULT now(),
  user_name text NOT NULL,
  user_role text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb DEFAULT '{}'::jsonb
);

ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON audit_log FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log (entity_type, entity_id);

-- Add pin_hash column to employees (for migration)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pin_hash text;

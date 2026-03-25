-- Create guest_display_sessions table for two-device check-in/invoice system
CREATE TABLE IF NOT EXISTS guest_display_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('checkin', 'invoice')),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'signed', 'awaiting_cash', 'paid')),
  room text NOT NULL,
  booking_id text,
  guest_name text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  signature text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 minutes')
);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE guest_display_sessions;

-- RLS policies (allow all for anon — same pattern as other PMS tables)
ALTER TABLE guest_display_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON guest_display_sessions FOR ALL USING (true) WITH CHECK (true);

-- Index for quick active session lookups
CREATE INDEX IF NOT EXISTS idx_guest_display_sessions_status ON guest_display_sessions (status);
CREATE INDEX IF NOT EXISTS idx_guest_display_sessions_created ON guest_display_sessions (created_at DESC);

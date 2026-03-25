-- Guest feedback collected after checkout on guest display
CREATE TABLE IF NOT EXISTS guest_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id text,
  guest_name text,
  room text,
  rating int CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

ALTER PUBLICATION supabase_realtime ADD TABLE guest_feedback;
ALTER TABLE guest_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON guest_feedback FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_guest_feedback_created ON guest_feedback (created_at DESC);

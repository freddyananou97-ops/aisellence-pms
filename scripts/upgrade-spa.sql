-- ============================================================
-- SPA MODULE UPGRADE
-- ============================================================

-- Spa rooms table (replaces hardcoded ROOMS array)
CREATE TABLE IF NOT EXISTS spa_rooms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text,
  active boolean DEFAULT true,
  sort_order int DEFAULT 0
);

-- Seed default rooms
INSERT INTO spa_rooms (name, type, sort_order) VALUES
  ('Raum 1 — Massage', 'massage', 1),
  ('Raum 2 — Gesicht', 'gesicht', 2),
  ('Raum 3 — Beauty', 'beauty', 3),
  ('Sauna', 'wellness', 4)
ON CONFLICT DO NOTHING;

-- Spa therapists table
CREATE TABLE IF NOT EXISTS spa_therapists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  specializations text[],
  active boolean DEFAULT true
);

-- Seed demo therapists
INSERT INTO spa_therapists (name, specializations) VALUES
  ('Lisa Meier', ARRAY['massage', 'wellness']),
  ('Anna Schmidt', ARRAY['gesicht', 'beauty']),
  ('Thomas Huber', ARRAY['massage', 'wellness'])
ON CONFLICT DO NOTHING;

-- Add new columns to spa_bookings
ALTER TABLE spa_bookings ADD COLUMN IF NOT EXISTS status text DEFAULT 'confirmed';
ALTER TABLE spa_bookings ADD COLUMN IF NOT EXISTS therapist_id uuid REFERENCES spa_therapists(id);
ALTER TABLE spa_bookings ADD COLUMN IF NOT EXISTS therapist_name text;
ALTER TABLE spa_bookings ADD COLUMN IF NOT EXISTS room_number text;
ALTER TABLE spa_bookings ADD COLUMN IF NOT EXISTS booking_id text;
ALTER TABLE spa_bookings ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE spa_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE spa_therapists;

-- RLS
ALTER TABLE spa_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON spa_rooms FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE spa_therapists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON spa_therapists FOR ALL USING (true) WITH CHECK (true);

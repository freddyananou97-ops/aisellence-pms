-- Add blocking fields to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS blocked_until date;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS blocked_reason text;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS blocked_by text;

-- Create room_blocks history table
CREATE TABLE IF NOT EXISTS room_blocks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room text NOT NULL,
  reason text NOT NULL,
  blocked_by text,
  blocked_at timestamptz DEFAULT now(),
  unblocked_at timestamptz,
  block_type text NOT NULL CHECK (block_type IN ('until_date', 'indefinite')),
  blocked_until date
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE room_blocks;

-- RLS
ALTER TABLE room_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON room_blocks FOR ALL USING (true) WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_room_blocks_room ON room_blocks (room);
CREATE INDEX IF NOT EXISTS idx_room_blocks_active ON room_blocks (unblocked_at) WHERE unblocked_at IS NULL;

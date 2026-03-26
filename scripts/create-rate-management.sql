-- ============================================================
-- RATE MANAGEMENT TABLES
-- ============================================================

-- Room categories with base pricing
CREATE TABLE IF NOT EXISTS room_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  base_price numeric NOT NULL DEFAULT 0,
  description text,
  max_occupancy int DEFAULT 2,
  beds24_room_id text,
  active boolean DEFAULT true
);

INSERT INTO room_categories (name, base_price, max_occupancy, description) VALUES
  ('Einzelzimmer', 89, 1, 'Standard Einzelzimmer'),
  ('Doppelzimmer', 129, 2, 'Standard Doppelzimmer'),
  ('Junior Suite', 189, 2, 'Junior Suite mit Sitzbereich'),
  ('Suite', 279, 3, 'Große Suite mit separatem Wohnzimmer')
ON CONFLICT DO NOTHING;

-- Rate rules (season, special, event pricing)
CREATE TABLE IF NOT EXISTS rate_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  category_id uuid REFERENCES room_categories(id),
  type text NOT NULL CHECK (type IN ('season', 'special', 'event')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  price_type text NOT NULL CHECK (price_type IN ('fixed', 'percentage')),
  price_value numeric NOT NULL,
  priority int DEFAULT 0,
  event_id uuid,
  active boolean DEFAULT true,
  created_by text,
  created_at timestamptz DEFAULT now(),
  synced_to_beds24 boolean DEFAULT false
);

-- Competitor prices from scraping
CREATE TABLE IF NOT EXISTS competitor_prices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_name text NOT NULL,
  price numeric,
  date_checked date NOT NULL,
  scraped_at timestamptz DEFAULT now(),
  source text DEFAULT 'booking.com',
  room_type text DEFAULT 'Doppelzimmer'
);

-- Competitor hotel config (which hotels to scrape)
CREATE TABLE IF NOT EXISTS competitor_hotels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_name text NOT NULL,
  booking_url text NOT NULL,
  active boolean DEFAULT true
);

INSERT INTO competitor_hotels (hotel_name, booking_url) VALUES
  ('NH Hotel Ingolstadt', 'https://www.booking.com/hotel/de/nh-ingolstadt.de.html'),
  ('IntercityHotel Ingolstadt', 'https://www.booking.com/hotel/de/intercityhotel-ingolstadt.de.html'),
  ('Hotel Rappensberger', 'https://www.booking.com/hotel/de/rappensberger.de.html'),
  ('BLOCK Hotel Ingolstadt', 'https://www.booking.com/hotel/de/block-hotel-ingolstadt.de.html')
ON CONFLICT DO NOTHING;

-- Realtime + RLS
ALTER PUBLICATION supabase_realtime ADD TABLE room_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE rate_rules;
ALTER PUBLICATION supabase_realtime ADD TABLE competitor_prices;
ALTER PUBLICATION supabase_realtime ADD TABLE competitor_hotels;

ALTER TABLE room_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_hotels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON room_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON rate_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON competitor_prices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON competitor_hotels FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_rate_rules_dates ON rate_rules (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_competitor_prices_date ON competitor_prices (date_checked DESC);

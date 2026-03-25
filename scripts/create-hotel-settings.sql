-- Hotel settings table
CREATE TABLE IF NOT EXISTS hotel_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- Seed default values
INSERT INTO hotel_settings (key, value) VALUES
  ('name', 'Maritim Hotel Ingolstadt'),
  ('street', 'Am Congress Centrum 1'),
  ('zip', '85049'),
  ('city', 'Ingolstadt'),
  ('country', 'Deutschland'),
  ('phone', '+49 841 49050'),
  ('email', 'info@maritim-ingolstadt.de'),
  ('taxId', 'DE 123 456 789'),
  ('iban', 'DE89 3704 0044 0532 0130 00'),
  ('bic', 'COBADEFFXXX')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE hotel_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON hotel_settings FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF to_regnamespace('storage') IS NULL THEN
    RAISE NOTICE 'storage bucket skipped';
    RETURN;
  END IF;
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('barber-media', 'barber-media', true)
  ON CONFLICT (id) DO NOTHING;
END $$;

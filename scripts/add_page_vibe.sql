-- Slice D: the saved page atmosphere, independent from curriculum answers.
-- Jai reviews and runs this before authenticated Vibe saves are tested.
-- No default or backfill: existing null values render as Glow in the client.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS page_vibe text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_page_vibe_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_page_vibe_check
      CHECK (
        page_vibe IS NULL OR
        page_vibe IN ('glow', 'stained-glass', 'kaleidoscope', 'mandala')
      );
  END IF;
END;
$$;

COMMENT ON COLUMN public.profiles.page_vibe IS
  'Page atmosphere: glow, stained-glass, kaleidoscope, or mandala. Null renders as Glow.';

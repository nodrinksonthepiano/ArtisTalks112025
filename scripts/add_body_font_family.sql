-- Fonts A (minimal): body typography beside existing headline font_family.
-- Run once in Supabase SQL Editor before relying on body font restore.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS body_font_family text;

COMMENT ON COLUMN public.profiles.body_font_family IS
  'Body/sanctuary copy font. Null falls back to Geist. Headline remains profiles.font_family.';

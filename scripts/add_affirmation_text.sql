-- Artist-edited Living Affirmation. Run once in Supabase SQL Editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS affirmation_text text;

COMMENT ON COLUMN public.profiles.affirmation_text IS
  'Artist-edited Living Affirmation. Null falls back to assembled version. Source curriculum_answers are never rewritten.';

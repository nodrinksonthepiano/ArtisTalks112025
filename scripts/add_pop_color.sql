-- Slice C: optional 10% Pop role beside existing Main and Support colors.
-- Jai runs this in Supabase SQL Editor before authenticated Pop saves are tested.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pop_color text;

COMMENT ON COLUMN public.profiles.pop_color IS
  'Optional 10% palette role. Null preserves the existing two-color visual treatment.';

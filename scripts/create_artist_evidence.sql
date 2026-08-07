-- Append-only evidence stack. Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.artist_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journey_stage text,
  text text,
  evidence_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS artist_evidence_user_created_idx
  ON public.artist_evidence (user_id, created_at DESC);

ALTER TABLE public.artist_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY artist_evidence_select_own ON public.artist_evidence
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY artist_evidence_insert_own ON public.artist_evidence
  FOR INSERT WITH CHECK (auth.uid() = user_id);

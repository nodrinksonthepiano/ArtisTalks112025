import { StepId } from '@/lib/curriculum'

export const DRAFT_STORAGE_KEY = 'artistalks_anonymous_draft_v1'

export interface DraftAnswer {
  question_key: string
  answer_data: Record<string, unknown>
  created_at: string
}

export interface DraftProfilePreview {
  artist_name?: string | null
  /** Artist-edited Living Affirmation before OTP save. Migrates to profiles.affirmation_text. */
  affirmation_text?: string | null
  mission_statement?: string | null
  primary_color?: string | null
  accent_color?: string | null
  brand_color?: string | null
  font_family?: string | null
  body_font_family?: string | null
  logo_url?: string | null
  logo_use_background?: boolean | null
}

export interface AnonymousDraft {
  version: 1
  currentStepId: StepId
  answers: DraftAnswer[]
  profilePreview: DraftProfilePreview
}

function emptyDraft(): AnonymousDraft {
  return {
    version: 1,
    currentStepId: 'INIT',
    answers: [],
    profilePreview: {},
  }
}

export function loadDraft(): AnonymousDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AnonymousDraft
    if (parsed?.version !== 1) return null
    return parsed
  } catch {
    return null
  }
}

export function saveDraft(draft: AnonymousDraft): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
}

export function getOrCreateDraft(): AnonymousDraft {
  return loadDraft() ?? emptyDraft()
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(DRAFT_STORAGE_KEY)
}

export function setDraftCurrentStepId(stepId: StepId): void {
  const draft = getOrCreateDraft()
  draft.currentStepId = stepId
  saveDraft(draft)
}

export function setDraftProfilePreview(updates: DraftProfilePreview): void {
  const draft = getOrCreateDraft()
  draft.profilePreview = { ...draft.profilePreview, ...updates }
  saveDraft(draft)
}

export function upsertDraftAnswer(
  question_key: string,
  answer_data: Record<string, unknown>
): void {
  const draft = getOrCreateDraft()
  const created_at = new Date().toISOString()
  const idx = draft.answers.findIndex((a) => a.question_key === question_key)
  if (idx === -1) {
    draft.answers.push({ question_key, answer_data, created_at })
  } else {
    draft.answers[idx] = { question_key, answer_data, created_at }
  }
  saveDraft(draft)
}

export function getDraftAnsweredKeys(): Set<string> {
  const draft = loadDraft()
  if (!draft) return new Set()
  return new Set(draft.answers.map((a) => a.question_key))
}

export function getDraftAnswerData(
  question_key: string
): Record<string, unknown> | null {
  const draft = loadDraft()
  const answer = draft?.answers.find((a) => a.question_key === question_key)
  if (!answer?.answer_data || typeof answer.answer_data !== 'object') return null
  return answer.answer_data
}

export function getDraftAnswerText(question_key: string): string {
  const data = getDraftAnswerData(question_key)
  if (!data) return ''
  const label = typeof data.label === 'string' ? data.label : ''
  const text = typeof data.text === 'string' ? data.text : ''
  return label || text
}

/**
 * Clear only the attempted artist_name answer + profile preview name.
 * Used when a claimed name is rejected locally ("Use a different artist name").
 * No Supabase writes.
 */
export function clearDraftArtistNameAttempt(): void {
  if (typeof window === 'undefined') return
  const draft = loadDraft()
  if (!draft) return

  draft.answers = draft.answers.filter((a) => a.question_key !== 'artist_name')
  if (draft.profilePreview) {
    draft.profilePreview = { ...draft.profilePreview, artist_name: null }
  }
  draft.currentStepId = 'INIT'
  saveDraft(draft)
}

import { StepId } from '@/lib/curriculum'
import type { PageVibe } from '@/utils/vibeAppearance'
import { clearDraftLogoAssets, getCachedDraftLogoUrl, getDraftLogoAssetId } from '@/lib/draftLogoAsset'

export const DRAFT_STORAGE_KEY = 'artistalks_anonymous_draft_v1'

export interface DraftAnswer {
  question_key: string
  answer_data: Record<string, unknown>
  created_at: string
}

export interface DraftProfilePreview {
  artist_name?: string | null
  affirmation_text?: string | null
  mission_statement?: string | null
  primary_color?: string | null
  accent_color?: string | null
  pop_color?: string | null
  page_vibe?: PageVibe | null
  brand_color?: string | null
  font_family?: string | null
  body_font_family?: string | null
  logo_url?: string | null
  logo_asset_id?: string | null
  logo_removed?: boolean
  logo_missing?: boolean
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

function encodeLogo(url: unknown, assetId: unknown) {
  const id = typeof url === 'string' ? getDraftLogoAssetId(url) : null
  const savedId = id || (typeof assetId === 'string' ? assetId : null)
  if (typeof url === 'string' && url && !url.startsWith('blob:')) return { url, id: null, missing: false }
  return { url: null, id: savedId, missing: !savedId && typeof url === 'string' && url.startsWith('blob:') }
}

function serializeDraft(draft: AnonymousDraft): AnonymousDraft {
  const preview = { ...draft.profilePreview }
  const logo = encodeLogo(preview.logo_url, preview.logo_asset_id)
  preview.logo_url = preview.logo_removed ? null : logo.url
  preview.logo_asset_id = preview.logo_removed ? null : logo.id
  preview.logo_missing = !preview.logo_removed && (logo.missing || preview.logo_missing === true)
  return {
    ...draft, profilePreview: preview,
    answers: draft.answers.map(answer => {
      if (answer.question_key !== 'logo_uploaded') return answer
      const data = { ...answer.answer_data }
      const image = encodeLogo(data.url ?? data.imageUrl ?? data.image_url, data.asset_id)
      delete data.imageUrl
      delete data.image_url
      data.url = image.url
      data.asset_id = image.id
      data.asset_missing = image.missing || data.asset_missing === true
      return { ...answer, answer_data: data }
    }),
  }
}

export function loadDraft(): AnonymousDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AnonymousDraft
    if (parsed?.version !== 1) return null
    const draft = serializeDraft(parsed)
    if (draft.profilePreview.logo_asset_id && !draft.profilePreview.logo_removed) {
      draft.profilePreview.logo_url = getCachedDraftLogoUrl(draft.profilePreview.logo_asset_id)
    }
    for (const answer of draft.answers) {
      if (answer.question_key === 'logo_uploaded' && typeof answer.answer_data.asset_id === 'string') {
        answer.answer_data.url = getCachedDraftLogoUrl(answer.answer_data.asset_id)
      }
    }
    return draft
  } catch {
    return null
  }
}

export function saveDraft(draft: AnonymousDraft): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(serializeDraft(draft)))
}

export function getOrCreateDraft(): AnonymousDraft {
  return loadDraft() ?? emptyDraft()
}

export async function clearDraft(): Promise<void> {
  if (typeof window === 'undefined') return
  localStorage.removeItem(DRAFT_STORAGE_KEY)
  await clearDraftLogoAssets()
}

export function setDraftCurrentStepId(stepId: StepId): void {
  const draft = getOrCreateDraft()
  draft.currentStepId = stepId
  saveDraft(draft)
}

export function setDraftProfilePreview(updates: DraftProfilePreview): void {
  const draft = getOrCreateDraft()
  const normalized = { ...updates }
  if (updates.logo_url !== undefined) {
    normalized.logo_asset_id = getDraftLogoAssetId(updates.logo_url)
    normalized.logo_removed = updates.logo_url === null
    normalized.logo_missing = false
  }
  draft.profilePreview = { ...draft.profilePreview, ...normalized }
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

/** Returns null when affirmation_text was never stored in the draft preview. */
export function getDraftAffirmationText(): string | null {
  const draft = loadDraft()
  if (!draft || !('affirmation_text' in draft.profilePreview)) return null
  return draft.profilePreview.affirmation_text ?? ''
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

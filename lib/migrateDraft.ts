import { createClient } from '@/utils/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@/hooks/useProfile'
import {
  clearDraft,
  getDraftAnswerText,
  loadDraft,
  type AnonymousDraft,
  type DraftProfilePreview,
} from '@/lib/draft'
import { assembleLivingAffirmation } from '@/lib/livingAffirmation'

export interface MigrateDraftResult {
  skipped: boolean
  migratedAnswerKeys: string[]
  profileFieldsWritten: string[]
}

function hasDraftContent(draft: AnonymousDraft): boolean {
  if (draft.answers.length > 0) return true
  const p = draft.profilePreview
  return Boolean(
    p.artist_name ||
      p.affirmation_text ||
      p.mission_statement ||
      p.primary_color ||
      p.accent_color ||
      p.brand_color ||
      p.font_family ||
      p.logo_url
  )
}

function isBlank(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '')
}

function formatSupabaseError(
  action: string,
  questionKey: string | null,
  err: { message?: string; code?: string; details?: string; hint?: string } | null
): Error {
  const parts = [
    questionKey ? `${action} for ${questionKey}` : action,
    err?.code ? `code=${err.code}` : null,
    err?.message ? `message=${err.message}` : null,
    err?.details ? `details=${err.details}` : null,
    err?.hint ? `hint=${err.hint}` : null,
  ].filter(Boolean)
  return new Error(parts.join(' | '))
}

function buildProfileFill(
  existing: Profile | null,
  preview: DraftProfilePreview,
  email: string | null
): Partial<Profile> {
  const fill: Partial<Profile> = { id: existing?.id }

  const artistName =
    preview.artist_name?.trim() || getDraftAnswerText('artist_name').trim()
  if (isBlank(existing?.artist_name) && artistName) {
    fill.artist_name = artistName
  }

  const mission =
    preview.mission_statement?.trim() || getDraftAnswerText('gift_to_world').trim()
  if (isBlank(existing?.mission_statement) && mission) {
    fill.mission_statement = mission
  }

  if (isBlank(existing?.primary_color) && preview.primary_color) {
    fill.primary_color = preview.primary_color
  }
  if (isBlank(existing?.accent_color) && preview.accent_color) {
    fill.accent_color = preview.accent_color
  }
  if (isBlank(existing?.brand_color) && preview.brand_color) {
    fill.brand_color = preview.brand_color
  }
  if (isBlank(existing?.font_family) && preview.font_family) {
    fill.font_family = preview.font_family
  }
  if (isBlank(existing?.body_font_family) && preview.body_font_family) {
    fill.body_font_family = preview.body_font_family
  }
  if (isBlank(existing?.logo_url) && preview.logo_url) {
    fill.logo_url = preview.logo_url
  }
  if (
    (existing?.logo_use_background == null || existing?.logo_use_background === undefined) &&
    preview.logo_use_background != null
  ) {
    fill.logo_use_background = preview.logo_use_background
  }

  if (isBlank(existing?.email) && email) {
    fill.email = email
  }

  if (isBlank(existing?.affirmation_text)) {
    if ('affirmation_text' in preview) {
      fill.affirmation_text = preview.affirmation_text ?? ''
    } else {
      const assembled = assembleLivingAffirmation({
        artist_name: getDraftAnswerText('artist_name'),
        genre_associations: getDraftAnswerText('genre_associations'),
        business_type_products_services: getDraftAnswerText('business_type_products_services'),
        known_for_expression: getDraftAnswerText('known_for_expression'),
        known_for_legacy: getDraftAnswerText('known_for_legacy'),
      })
      if (assembled) {
        fill.affirmation_text = assembled
      }
    }
  }

  return fill
}

async function insertAnswerIfMissing(
  supabase: SupabaseClient,
  userId: string,
  question_key: string,
  answer_data: Record<string, unknown>
): Promise<boolean> {
  const { data: existing, error: checkError } = await supabase
    .from('curriculum_answers')
    .select('id')
    .eq('user_id', userId)
    .eq('question_key', question_key)
    .is('project_id', null)
    .maybeSingle()

  if (checkError) {
    throw formatSupabaseError('Failed checking answer', question_key, checkError)
  }

  if (existing) return false

  const { error: insertError } = await supabase.from('curriculum_answers').insert({
    user_id: userId,
    question_key,
    answer_data,
    project_id: null,
  })

  if (insertError) {
    throw formatSupabaseError('Failed inserting answer', question_key, insertError)
  }

  return true
}

/**
 * Migrate anonymous local draft into Supabase after OTP login.
 * Existing Supabase profile fields and curriculum_answers rows always win.
 * Clears local draft only after profile writes succeed and every draft answer
 * is confirmed inserted or already present. Never clears on zero source answers.
 * Uses one browser client for getUser, profile upsert, and all answer ops.
 */
export async function migrateAnonymousDraft(userId: string): Promise<MigrateDraftResult> {
  const draft = loadDraft()
  if (!draft || !hasDraftContent(draft)) {
    return { skipped: true, migratedAnswerKeys: [], profileFieldsWritten: [] }
  }

  const supabase = createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user || user.id !== userId) {
    throw new Error('Cannot migrate draft: auth user mismatch')
  }

  const { data: existingProfile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    throw formatSupabaseError('Failed loading profile', null, profileError)
  }

  const profileFill = buildProfileFill(
    existingProfile as Profile | null,
    draft.profilePreview,
    user.email ?? null
  )

  const profileFieldsWritten: string[] = []
  const fieldsToWrite = { ...profileFill }
  delete (fieldsToWrite as { id?: string }).id

  if (Object.keys(fieldsToWrite).length > 0) {
    const row = {
      id: userId,
      artist_name: existingProfile?.artist_name ?? null,
      affirmation_text: existingProfile?.affirmation_text ?? null,
      mission_statement: existingProfile?.mission_statement ?? null,
      email: existingProfile?.email ?? user.email ?? null,
      primary_color: existingProfile?.primary_color ?? null,
      accent_color: existingProfile?.accent_color ?? null,
      brand_color: existingProfile?.brand_color ?? null,
      font_family: existingProfile?.font_family ?? null,
      logo_url: existingProfile?.logo_url ?? null,
      logo_use_background: existingProfile?.logo_use_background ?? null,
      ...fieldsToWrite,
    }

    const { error: upsertError } = await supabase.from('profiles').upsert(row)
    if (upsertError) {
      throw formatSupabaseError('Failed upserting profile', null, upsertError)
    }

    profileFieldsWritten.push(...Object.keys(fieldsToWrite))
  } else if (!existingProfile) {
    const { error: insertError } = await supabase.from('profiles').upsert({
      id: userId,
      email: user.email ?? null,
      artist_name: null,
      mission_statement: null,
    })
    if (insertError) {
      throw formatSupabaseError('Failed creating profile row', null, insertError)
    }
  }

  // Never treat profile-only content as a completed sanctuary save.
  // Clearing the draft with zero source answers was the silent-loss path.
  if (draft.answers.length === 0) {
    throw new Error(
      'Cannot finish sanctuary save: draft has no curriculum answers to store. Your work is still in this browser.'
    )
  }

  const migratedAnswerKeys: string[] = []
  const confirmedAnswerKeys: string[] = []

  for (const answer of draft.answers) {
    if (!answer?.question_key) {
      throw new Error('Cannot finish sanctuary save: draft contains an answer without a question key.')
    }
    const inserted = await insertAnswerIfMissing(
      supabase,
      userId,
      answer.question_key,
      answer.answer_data ?? {}
    )
    if (inserted) migratedAnswerKeys.push(answer.question_key)
    confirmedAnswerKeys.push(answer.question_key)
  }

  const expectedKeys = draft.answers.map((a) => a.question_key)
  const confirmedSet = new Set(confirmedAnswerKeys)
  const missingKeys = expectedKeys.filter((key) => !confirmedSet.has(key))
  if (missingKeys.length > 0) {
    throw new Error(
      `Cannot finish sanctuary save: missing confirmed answers for ${missingKeys.join(', ')}`
    )
  }

  // Clear local draft only after profile writes and every draft answer is confirmed.
  clearDraft()

  return {
    skipped: false,
    migratedAnswerKeys,
    profileFieldsWritten,
  }
}

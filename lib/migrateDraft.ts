import { createClient } from '@/utils/supabase/client'
import type { Profile } from '@/hooks/useProfile'
import {
  clearDraft,
  getDraftAnswerText,
  loadDraft,
  type AnonymousDraft,
  type DraftProfilePreview,
} from '@/lib/draft'

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

  return fill
}

async function insertAnswerIfMissing(
  userId: string,
  question_key: string,
  answer_data: Record<string, unknown>
): Promise<boolean> {
  const supabase = createClient()

  const { data: existing, error: checkError } = await supabase
    .from('curriculum_answers')
    .select('id')
    .eq('user_id', userId)
    .eq('question_key', question_key)
    .maybeSingle()

  if (checkError) {
    throw new Error(`Failed checking answer ${question_key}: ${checkError.message}`)
  }

  if (existing) return false

  const { error: insertError } = await supabase.from('curriculum_answers').insert({
    user_id: userId,
    question_key,
    answer_data,
    project_id: null,
  })

  if (insertError) {
    throw new Error(`Failed inserting answer ${question_key}: ${insertError.message}`)
  }

  return true
}

/**
 * Migrate anonymous local draft into Supabase after OTP login.
 * Existing Supabase profile fields and curriculum_answers rows always win.
 * Clears local draft only after all writes succeed.
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
    throw new Error(`Failed loading profile: ${profileError.message}`)
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
      throw new Error(`Failed upserting profile: ${upsertError.message}`)
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
      throw new Error(`Failed creating profile row: ${insertError.message}`)
    }
  }

  const migratedAnswerKeys: string[] = []
  for (const answer of draft.answers) {
    const inserted = await insertAnswerIfMissing(
      userId,
      answer.question_key,
      answer.answer_data
    )
    if (inserted) migratedAnswerKeys.push(answer.question_key)
  }

  clearDraft()

  return {
    skipped: false,
    migratedAnswerKeys,
    profileFieldsWritten,
  }
}

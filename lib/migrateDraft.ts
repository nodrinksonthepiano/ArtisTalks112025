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
import { normalizePageVibe } from '@/utils/vibeAppearance'
import {
  getDraftLogoGeneration,
  readDraftLogoAsset,
  readDraftLogoUpload,
  readSessionLogoFile,
  readSessionLogoUpload,
  rememberSessionLogoUpload,
  saveDraftLogoUpload,
} from '@/lib/draftLogoAsset'

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
      p.pop_color ||
      p.page_vibe ||
      p.brand_color ||
      p.font_family ||
      p.logo_url ||
      p.logo_asset_id
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
  if (isBlank(existing?.pop_color) && preview.pop_color) {
    fill.pop_color = preview.pop_color
  }
  // A missing value renders as Glow but must not become a migration write.
  // Validate browser draft data before filling an unset account preference.
  if (
    isBlank(existing?.page_vibe) &&
    typeof preview.page_vibe === 'string' &&
    normalizePageVibe(preview.page_vibe) === preview.page_vibe
  ) {
    fill.page_vibe = preview.page_vibe
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

function isDurableLogoUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value)
}

/** Runtime object URLs are not part of the persisted identity of this draft. */
function draftSignature(draft: AnonymousDraft): string {
  return JSON.stringify(draft, (_key, value: unknown) =>
    typeof value === 'string' && value.startsWith('blob:') ? null : value
  )
}

async function answerExists(
  supabase: SupabaseClient,
  userId: string,
  questionKey: string
): Promise<boolean> {
  const { data: existing, error } = await supabase
    .from('curriculum_answers')
    .select('id')
    .eq('user_id', userId)
    .eq('question_key', questionKey)
    .is('project_id', null)
    .maybeSingle()

  if (error) throw formatSupabaseError('Failed checking answer', questionKey, error)
  return Boolean(existing)
}

async function insertAnswerIfMissing(
  supabase: SupabaseClient,
  userId: string,
  question_key: string,
  answer_data: Record<string, unknown>,
  assertCurrentDraft: () => void
): Promise<boolean> {
  // Recheck after upload/profile work so an existing account answer still wins.
  const existing = await answerExists(supabase, userId, question_key)
  assertCurrentDraft()
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
  assertCurrentDraft()
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

  // Refuse a profile-only save before uploading bytes or writing account data.
  if (draft.answers.length === 0) {
    throw new Error(
      'Cannot finish sanctuary save: draft has no curriculum answers to store. Your work is still in this browser.'
    )
  }

  const generation = getDraftLogoGeneration()
  const sourceSignature = draftSignature(draft)
  const assertCurrentDraft = () => {
    const latest = loadDraft()
    if (
      getDraftLogoGeneration() !== generation ||
      !latest ||
      draftSignature(latest) !== sourceSignature
    ) {
      throw new Error('Your draft changed while saving. Your current work remains in this browser. Try saving again.')
    }
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

  assertCurrentDraft()

  // Know which references need migration before uploading anything. Existing
  // account profile fields and answer rows retain their current values.
  const existingAnswerKeys = new Set<string>()
  for (const answer of draft.answers) {
    if (!answer?.question_key) {
      throw new Error('Cannot finish sanctuary save: draft contains an answer without a question key.')
    }
    if (await answerExists(supabase, userId, answer.question_key)) {
      existingAnswerKeys.add(answer.question_key)
    }
    assertCurrentDraft()
  }

  const resolvedUploads = new Map<string, string>()
  const resolveLogo = async (url: unknown, assetId: unknown): Promise<string | undefined> => {
    if (typeof assetId === 'string' && assetId) {
      const alreadyResolved = resolvedUploads.get(assetId)
      if (alreadyResolved) return alreadyResolved

      const sessionFile = readSessionLogoFile(assetId)
      let uploadedUrl: string | null = null
      try {
        uploadedUrl = await readDraftLogoUpload(assetId, userId)
      } catch (error) {
        uploadedUrl = readSessionLogoUpload(assetId, userId)
        if (!uploadedUrl && !sessionFile) throw error
      }
      assertCurrentDraft()
      if (isDurableLogoUrl(uploadedUrl)) {
        resolvedUploads.set(assetId, uploadedUrl)
        return uploadedUrl
      }

      let blob: Blob | null = null
      let name = 'logo'
      let fromSession = false
      try {
        const asset = await readDraftLogoAsset(assetId)
        assertCurrentDraft()
        if (asset) {
          blob = asset.blob
          name = asset.name
        }
      } catch (error) {
        assertCurrentDraft()
        if (!sessionFile) throw error
      }
      if (!blob && sessionFile) {
        blob = sessionFile
        name = sessionFile.name || 'logo'
        fromSession = true
      }
      if (!blob) {
        throw new Error('Your saved logo file is not available in this browser. Choose it again before saving your sanctuary.')
      }
      const formData = new FormData()
      formData.append('file', blob, name)
      formData.append('userId', userId)
      const response = await fetch('/api/uploadLogo', { method: 'POST', body: formData })
      const result = await response.json() as { success?: boolean; logoUrl?: unknown }
      assertCurrentDraft()
      if (!response.ok || !result.success || !isDurableLogoUrl(result.logoUrl)) {
        throw new Error('Your logo could not be uploaded. Your work remains in this browser. Try saving again.')
      }

      // Keep original bytes and an account-scoped receipt until the entire
      // migration succeeds. A retry, including after reload, reuses this URL.
      // A same-tab session File uses that same upload, then drops its bytes.
      try {
        await saveDraftLogoUpload(assetId, userId, result.logoUrl)
      } catch (error) {
        if (!fromSession) throw error
        rememberSessionLogoUpload(assetId, userId, result.logoUrl)
      }
      if (fromSession) rememberSessionLogoUpload(assetId, userId, result.logoUrl)
      assertCurrentDraft()
      resolvedUploads.set(assetId, result.logoUrl)
      return result.logoUrl
    }
    if (url == null || url === '') return undefined
    if (isDurableLogoUrl(url)) return url
    throw new Error('Your logo needs to be selected again before saving your sanctuary. Your other work remains in this browser.')
  }

  const profilePreview: DraftProfilePreview = { ...draft.profilePreview }
  // Resolve profile and answer references independently: a later unsaved Logo
  // choice may differ from the Logo answer already completed in the draft.
  if (isBlank(existingProfile?.logo_url) && !profilePreview.logo_removed) {
    if (profilePreview.logo_missing) throw new Error('Select your logo again before saving your sanctuary. Your other work remains in this browser.')
    profilePreview.logo_url = await resolveLogo(
      profilePreview.logo_url,
      profilePreview.logo_asset_id
    )
  } else {
    delete profilePreview.logo_url
  }

  const preparedAnswers = new Map<string, Record<string, unknown>>()
  for (const answer of draft.answers) {
    if (existingAnswerKeys.has(answer.question_key)) continue
    const data = { ...answer.answer_data }
    if (answer.question_key === 'logo_uploaded') {
      const assetId = data.asset_id
      delete data.asset_id
      if (data.asset_missing && data.skipped !== true && !draft.profilePreview.logo_removed) throw new Error('Select your logo again and Save Logo before saving your sanctuary.')
      delete data.asset_missing
      if (data.skipped === true || draft.profilePreview.logo_removed) {
        delete data.url
      } else {
        const durableUrl = await resolveLogo(data.url, assetId)
        if (durableUrl) data.url = durableUrl
        else delete data.url
      }
    }
    preparedAnswers.set(answer.question_key, data)
  }
  assertCurrentDraft()

  const profileFill = buildProfileFill(
    existingProfile as Profile | null,
    profilePreview,
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
      pop_color: existingProfile?.pop_color ?? null,
      brand_color: existingProfile?.brand_color ?? null,
      font_family: existingProfile?.font_family ?? null,
      ...(isDurableLogoUrl(existingProfile?.logo_url)
        ? { logo_url: existingProfile.logo_url }
        : {}),
      logo_use_background: existingProfile?.logo_use_background ?? null,
      ...fieldsToWrite,
    }

    const { error: upsertError } = await supabase.from('profiles').upsert(row)
    if (upsertError) {
      throw formatSupabaseError('Failed upserting profile', null, upsertError)
    }

    assertCurrentDraft()
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
    assertCurrentDraft()
  }

  const migratedAnswerKeys: string[] = []
  const confirmedAnswerKeys: string[] = []

  for (const answer of draft.answers) {
    assertCurrentDraft()
    if (existingAnswerKeys.has(answer.question_key)) {
      confirmedAnswerKeys.push(answer.question_key)
      continue
    }
    const inserted = await insertAnswerIfMissing(
      supabase,
      userId,
      answer.question_key,
      preparedAnswers.get(answer.question_key) ?? {},
      assertCurrentDraft
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
  assertCurrentDraft()
  await clearDraft()

  return {
    skipped: false,
    migratedAnswerKeys,
    profileFieldsWritten,
  }
}

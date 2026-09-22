'use client'

import { useCallback, useEffect, useState } from 'react'
import { resolveDraftLogoUrl, getDraftLogoGeneration } from '@/lib/draftLogoAsset'
import {
  DraftProfilePreview,
  getOrCreateDraft,
  loadDraft,
  saveDraft,
  setDraftProfilePreview,
  type AnonymousDraft,
} from '@/lib/draft'

export function useDraft() {
  const [draft, setDraft] = useState<AnonymousDraft | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [logoRestoreError, setLogoRestoreError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const generation = getDraftLogoGeneration()
    const initial = loadDraft() ?? getOrCreateDraft()
    const ids = new Set<string>()
    if (initial.profilePreview.logo_asset_id) ids.add(initial.profilePreview.logo_asset_id)
    for (const answer of initial.answers) {
      if (answer.question_key === 'logo_uploaded' && typeof answer.answer_data.asset_id === 'string') ids.add(answer.answer_data.asset_id)
    }
    void Promise.allSettled([...ids].map(resolveDraftLogoUrl)).then(results => {
      if (!active || generation !== getDraftLogoGeneration()) return
      const missing = initial.profilePreview.logo_missing || results.some(result => result.status === 'rejected' || !result.value)
      if (missing) setLogoRestoreError('Your other work is restored, but a logo image could not be loaded. Open Logo to select it again.')
      setDraft(loadDraft() ?? getOrCreateDraft())
      setHydrated(true)
    })
    return () => { active = false }
  }, [])

  const refreshDraft = useCallback(() => {
    const next = loadDraft() ?? getOrCreateDraft()
    setDraft(next)
    if (next.profilePreview.logo_url || next.profilePreview.logo_removed) setLogoRestoreError(null)
  }, [])

  const updateProfilePreview = useCallback(
    (updates: DraftProfilePreview) => {
      setDraftProfilePreview(updates)
      refreshDraft()
    },
    [refreshDraft]
  )

  const replaceDraft = useCallback(
    (next: AnonymousDraft) => {
      saveDraft(next)
      refreshDraft()
    },
    [refreshDraft]
  )

  return {
    draft,
    hydrated,
    logoRestoreError,
    refreshDraft,
    updateProfilePreview,
    replaceDraft,
  }
}

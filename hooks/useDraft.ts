'use client'

import { useCallback, useEffect, useState } from 'react'
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

  useEffect(() => {
    setDraft(loadDraft() ?? getOrCreateDraft())
    setHydrated(true)
  }, [])

  const refreshDraft = useCallback(() => {
    setDraft(loadDraft() ?? getOrCreateDraft())
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
    refreshDraft,
    updateProfilePreview,
    replaceDraft,
  }
}

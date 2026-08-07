import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { PillarChoice } from '@/lib/curriculum'

export interface ArtistEvidence {
  id: string
  user_id: string
  journey_stage: string | null
  text: string | null
  evidence_url: string | null
  created_at: string
}

export function useArtistEvidence(userId: string | null) {
  const [items, setItems] = useState<ArtistEvidence[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const reload = useCallback(async () => {
    if (!userId) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('artist_evidence')
        .select('id, user_id, journey_stage, text, evidence_url, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setItems((data as ArtistEvidence[]) ?? [])
    } catch (err) {
      console.error('Evidence load error:', err)
    } finally {
      setLoading(false)
    }
  }, [userId, supabase])

  useEffect(() => {
    void reload()
  }, [reload])

  const addEvidence = useCallback(
    async (
      text: string,
      journeyStage: PillarChoice | null,
      evidenceUrl?: string | null
    ): Promise<{ error: string | null }> => {
      if (!userId) return { error: 'Not signed in' }

      const trimmed = text.trim()
      const url = evidenceUrl?.trim() || null
      if (!trimmed && !url) return { error: 'Add text or a link' }

      try {
        const { error } = await supabase.from('artist_evidence').insert({
          user_id: userId,
          journey_stage: journeyStage,
          text: trimmed || null,
          evidence_url: url,
        })

        if (error) throw error
        await reload()
        return { error: null }
      } catch (err) {
        console.error('Evidence insert error:', err)
        return {
          error: err instanceof Error ? err.message : 'Could not save evidence',
        }
      }
    },
    [userId, supabase, reload]
  )

  return {
    items,
    count: items.length,
    loading,
    reload,
    addEvidence,
  }
}

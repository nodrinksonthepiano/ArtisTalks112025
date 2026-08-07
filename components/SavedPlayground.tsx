'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  PILLAR_SELECT_OPTIONS,
  getStep,
  getSelectLabel,
  getCheckpointPrompt,
  type PillarChoice,
} from '@/lib/curriculum'
import { assembleLivingAffirmation, LIVING_AFFIRMATION_KEYS } from '@/lib/livingAffirmation'
import { Profile } from '@/hooks/useProfile'
import { getDraftAnswerText } from '@/lib/draft'
import { upsertCurriculumAnswer } from '@/lib/upsertCurriculumAnswer'
import LivingAffirmation from '@/components/LivingAffirmation'
import InlineSelectPicker from '@/components/InlineSelectPicker'
import EvidenceStack from '@/components/EvidenceStack'
import { useArtistEvidence } from '@/hooks/useArtistEvidence'

interface SavedPlaygroundProps {
  userId: string
  profile: Profile | null
  answeredKeys: Set<string>
  onProfileUpdate?: (updates: Partial<Profile>) => void
  onPillarSaved: (key: string) => void
}

function answerTextFromData(data: Record<string, unknown> | null): string {
  if (!data) return ''
  const label = typeof data.label === 'string' ? data.label : ''
  const text = typeof data.text === 'string' ? data.text : ''
  return label || text
}

export default function SavedPlayground({
  userId,
  profile,
  answeredKeys,
  onProfileUpdate,
  onPillarSaved,
}: SavedPlaygroundProps) {
  const supabase = createClient()
  const pillarStep = getStep('CURRENT_FOCUS_PILLAR')
  const { items, count, loading, addEvidence } = useArtistEvidence(userId)

  const [slotTexts, setSlotTexts] = useState<Record<string, string>>({})
  const [pillarValue, setPillarValue] = useState<PillarChoice | null>(null)
  const [pillarSaving, setPillarSaving] = useState(false)
  const [pillarError, setPillarError] = useState('')
  const [affirmationEdit, setAffirmationEdit] = useState('')
  const [affirmationReady, setAffirmationReady] = useState(false)

  const artistName =
    profile?.artist_name?.trim() || getDraftAnswerText('artist_name').trim()

  const assembledFallback = useMemo(() => {
    const slots = {
      artist_name: artistName,
      genre_associations: slotTexts.genre_associations || '',
      business_type_products_services: slotTexts.business_type_products_services || '',
      known_for_expression: slotTexts.known_for_expression || '',
      known_for_legacy: slotTexts.known_for_legacy || '',
    }
    return assembleLivingAffirmation(slots)
  }, [artistName, slotTexts])

  const displayAffirmation =
    profile?.affirmation_text?.trim() || affirmationEdit || assembledFallback

  // Load curriculum slots and pillar for assembly + journey display
  useEffect(() => {
    let cancelled = false

    async function load() {
      const keys = LIVING_AFFIRMATION_KEYS.filter((k) => k !== 'artist_name')
      const { data, error } = await supabase
        .from('curriculum_answers')
        .select('question_key, answer_data')
        .eq('user_id', userId)
        .in('question_key', [...keys, 'current_focus_pillar'])

      if (cancelled) return
      if (error) {
        console.error('SavedPlayground load error:', error)
        setAffirmationReady(true)
        return
      }

      const texts: Record<string, string> = {}
      let pillar: PillarChoice | null = null

      for (const row of data ?? []) {
        const ad = row.answer_data as Record<string, unknown>
        if (row.question_key === 'current_focus_pillar') {
          const raw = typeof ad?.text === 'string' ? ad.text : ''
          if (
            raw === 'creating_new' ||
            raw === 'finishing' ||
            raw === 'promoting' ||
            raw === 'not_sure'
          ) {
            pillar = raw
          }
        } else {
          texts[row.question_key] = answerTextFromData(ad)
        }
      }

      setSlotTexts(texts)
      setPillarValue(pillar)
      if (!profile?.affirmation_text?.trim()) {
        setAffirmationEdit(
          assembleLivingAffirmation({
            artist_name: artistName,
            genre_associations: texts.genre_associations || '',
            business_type_products_services: texts.business_type_products_services || '',
            known_for_expression: texts.known_for_expression || '',
            known_for_legacy: texts.known_for_legacy || '',
          })
        )
      } else {
        setAffirmationEdit(profile.affirmation_text.trim())
      }
      setAffirmationReady(true)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [userId, supabase, artistName, profile?.affirmation_text])

  const handleAffirmationChange = useCallback(
    (value: string) => {
      setAffirmationEdit(value)
    },
    []
  )

  const saveAffirmation = useCallback(
    async (value: string) => {
      if (onProfileUpdate) {
        await onProfileUpdate({ affirmation_text: value.trim() || null })
      }
    },
    [onProfileUpdate]
  )

  useEffect(() => {
    if (!affirmationReady) return
    const timer = setTimeout(() => {
      void saveAffirmation(affirmationEdit)
    }, 600)
    return () => clearTimeout(timer)
  }, [affirmationEdit, affirmationReady, saveAffirmation])

  async function handlePillarSelect(value: string) {
    setPillarSaving(true)
    setPillarError('')
    const label = getSelectLabel(pillarStep, value) ?? value
    const { error } = await upsertCurriculumAnswer(
      supabase,
      userId,
      'current_focus_pillar',
      {
        text: value,
        label,
        step_id: 'CURRENT_FOCUS_PILLAR',
      }
    )
    if (error) {
      setPillarError(error.message)
      setPillarSaving(false)
      return
    }
    setPillarValue(value as PillarChoice)
    onPillarSaved('current_focus_pillar')
    setPillarSaving(false)
  }

  const showJourney = !answeredKeys.has('current_focus_pillar') && !pillarValue
  const activePillar = pillarValue

  return (
    <div className="w-full">
      {affirmationReady ? (
        <LivingAffirmation
          artistName={artistName}
          text={displayAffirmation}
          editable
          onTextChange={handleAffirmationChange}
        />
      ) : null}

      {showJourney ? (
        <div style={{ marginBottom: '16px' }}>
          <h2
            className="gold-etched text-lg"
            style={{ marginTop: 0, marginBottom: '12px' }}
          >
            {pillarStep.question}
          </h2>
          <InlineSelectPicker
            options={PILLAR_SELECT_OPTIONS}
            value={null}
            onChange={(v) => void handlePillarSelect(v)}
            disabled={pillarSaving}
          />
          {pillarError ? (
            <p className="text-red-400 text-sm text-center mt-2">{pillarError}</p>
          ) : null}
        </div>
      ) : null}

      {activePillar ? (
        <div style={{ marginBottom: '8px' }}>
          <h2
            className="gold-etched text-lg"
            style={{ marginTop: 0, marginBottom: '12px' }}
          >
            {getCheckpointPrompt(activePillar)}
          </h2>
          <EvidenceStack
            items={items}
            count={count}
            loading={loading}
            journeyStage={activePillar}
            onAdd={(text, url) => addEvidence(text, activePillar, url)}
          />
        </div>
      ) : null}
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'

export type SaasSubscriptionStatus =
  | 'inactive'
  | 'active'
  | 'past_due'
  | 'comped'

export interface Profile {
  id: string
  artist_name: string | null
  affirmation_text?: string | null
  mission_statement: string | null
  email: string | null
  logo_url?: string | null
  primary_color?: string | null
  accent_color?: string | null
  /** Headline font (artist name, titles, card titles). */
  font_family?: string | null
  /** Body font (mission, answers, longer copy). Falls back to Geist when null. */
  body_font_family?: string | null
  logo_use_background?: boolean | null
  brand_color?: string | null
  saas_subscription_status?: SaasSubscriptionStatus | null
}

function stripServerControlledProfileFields(
  updates: Partial<Profile>
): Partial<Profile> {
  const safeUpdates = { ...updates }
  delete safeUpdates.saas_subscription_status
  return safeUpdates
}

export function useProfile(userId: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const reloadProfile = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!userId) {
        setProfile(null)
        setLoading(false)
        return null
      }

      const quiet = opts?.quiet === true
      if (!quiet) setLoading(true)
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle()

        if (error) throw error

        if (data) {
          setProfile(data as Profile)
          return data as Profile
        }

        const {
          data: { user },
        } = await supabase.auth.getUser()
        const fallback: Profile = {
          id: userId,
          artist_name: null,
          affirmation_text: null,
          mission_statement: null,
          email: user?.email || null,
          saas_subscription_status: 'inactive',
        }
        setProfile(fallback)
        return fallback
      } catch (e) {
        console.error('Profile load error:', e)
        return null
      } finally {
        if (!quiet) setLoading(false)
      }
    },
    [userId, supabase]
  )

  useEffect(() => {
    void reloadProfile()
  }, [reloadProfile])

  const updateProfile = async (updates: Partial<Profile>) => {
    const safeUpdates = stripServerControlledProfileFields(updates)
    if (Object.keys(safeUpdates).length === 0) return

    if (!userId) {
      console.warn('⚠️ Cannot update profile: no user logged in')
      return
    }

    if (!profile) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const newProfile: Profile = {
        id: userId,
        artist_name: null,
        affirmation_text: null,
        mission_statement: null,
        email: user?.email || null,
        saas_subscription_status: 'inactive',
        ...safeUpdates,
      }
      setProfile(newProfile)
      try {
        const { error } = await supabase.from('profiles').upsert(newProfile)
        if (error) throw error
      } catch (err) {
        console.error('❌ Save NEW failed:', err)
      }
      return
    }

    const newProfile = { ...profile, ...safeUpdates }
    setProfile(newProfile)

    try {
      const { error } = await supabase.from('profiles').upsert({
        id: profile.id,
        ...safeUpdates,
      })
      if (error) throw error
    } catch (err) {
      console.error('❌ Save UPDATE failed:', err)
    }
  }

  return {
    profile,
    loading,
    updateProfile,
    reloadProfile,
  }
}

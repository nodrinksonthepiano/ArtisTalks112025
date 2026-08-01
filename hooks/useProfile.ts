import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'

export interface Profile {
  id: string
  artist_name: string | null
  mission_statement: string | null
  email: string | null
  logo_url?: string | null
  primary_color?: string | null
  accent_color?: string | null
  font_family?: string | null
  logo_use_background?: boolean | null
  brand_color?: string | null
}

export function useProfile(userId: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const reloadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      setLoading(false)
      return null
    }

    setLoading(true)
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
        mission_statement: null,
        email: user?.email || null,
      }
      setProfile(fallback)
      return fallback
    } catch (e) {
      console.error('Profile load error:', e)
      return null
    } finally {
      setLoading(false)
    }
  }, [userId, supabase])

  useEffect(() => {
    void reloadProfile()
  }, [reloadProfile])

  const updateProfile = async (updates: Partial<Profile>) => {
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
        mission_statement: null,
        email: user?.email || null,
        ...updates,
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

    const newProfile = { ...profile, ...updates }
    setProfile(newProfile)

    try {
      const { error } = await supabase.from('profiles').upsert({
        id: profile.id,
        ...updates,
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

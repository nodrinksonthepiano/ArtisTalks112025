import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

export interface Profile {
  id: string
  artist_name: string | null
  mission_statement: string | null
  email: string | null
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // 1. Load Profile on Mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (data) {
          console.log("✅ Profile loaded from DB:", data)
          setProfile(data)
        } else {
          console.log("⚠️ No profile in DB, using default.")
          setProfile({
            id: user.id,
            artist_name: null,
            mission_statement: null,
            email: user.email || null
          })
        }
      } catch (e) {
        console.error('Profile load error:', e)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

  // 2. Optimistic Update Function
  const updateProfile = async (updates: Partial<Profile>) => {
    console.log("🔄 updateProfile called with:", updates)

    // CRITICAL FIX: Handle null profile case (brand new user)
    // If profile is null, we must create a new profile object instead of staying null
    if (!profile) {
       const { data: { user } } = await supabase.auth.getUser()
       if (!user) {
         console.warn("⚠️ Cannot update profile: no user logged in")
         return
       }
       
       // Create new profile object with defaults merged with updates
       const newProfile: Profile = {
            id: user.id,
            artist_name: null,
            mission_statement: null,
            email: user.email || null,
            ...updates  // Updates override defaults
       }
       
       // Update state immediately (optimistic)
       setProfile(newProfile)
       
       // Save to database
       try {
            const { error } = await supabase.from('profiles').upsert(newProfile)
            if (error) throw error
            console.log("✅ Saved NEW profile to DB:", newProfile)
       } catch (err) { 
         console.error("❌ Save NEW failed:", err)
         // On error, we could revert state, but for now we keep optimistic update
       }
       return
    }

    // Normal Case: Profile exists, merge updates
    const newProfile = { ...profile, ...updates }
    
    // Update state immediately (optimistic)
    setProfile(newProfile)

    // Save to database
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          id: profile.id,
          ...updates
        })

      if (error) throw error
      console.log("✅ Saved UPDATE to DB")
    } catch (err) {
      console.error("❌ Save UPDATE failed:", err)
      // On error, we could revert to previous state, but for now we keep optimistic update
    }
  }

  return {
    profile,
    loading,
    updateProfile
  }
}

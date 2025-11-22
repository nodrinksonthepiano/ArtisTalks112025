'use client'

import { useEffect, useState } from 'react'
import EmeraldChat from "@/components/EmeraldChat";
import AuthPanel from "@/components/AuthPanel";
import DataReset from "@/components/DataReset";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Lifted State: Profile Data
  const { profile, updateProfile } = useProfile()

  useEffect(() => {
    const supabase = createClient()

    // 1. Check active session on load
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    checkUser()

    // 2. Listen for changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    // Simple loading spinner while checking auth
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-emerald-500">
        <div className="animate-pulse">Loading Sanctuary...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-50 selection:bg-emerald-500/30">
      <main className="flex flex-col items-center gap-8 w-full px-4">
        <div className="text-center space-y-2 mb-4">
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-emerald-200 to-emerald-600 tracking-tight transition-all duration-500">
            {/* Live Update: Show Artist Name if available, else default */}
            {profile?.artist_name || "ArtisTalks"}
          </h1>
          <p className="text-zinc-400 text-lg transition-all duration-500">
            {/* Live Update: Show Mission if available, else default */}
            {profile?.mission_statement || "The Champion is ready for you."}
          </p>
        </div>
        
        {user ? (
          <>
            <DataReset />
            <EmeraldChat onProfileUpdate={updateProfile} />
          </>
        ) : (
          <AuthPanel />
        )}
      </main>
    </div>
  );
}

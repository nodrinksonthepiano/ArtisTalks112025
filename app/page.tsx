'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import EmeraldChat from "@/components/EmeraldChat";
import AuthPanel from "@/components/AuthPanel";
import DataReset from "@/components/DataReset";
import FeaturedContent from "@/components/FeaturedContent";
import ArtisTalksOrbitRenderer from "@/components/ArtisTalksOrbitRenderer";
import LogoPanel from "@/components/LogoPanel";
import ColorPanel from "@/components/ColorPanel";
import FontPanel from "@/components/FontPanel";
import OvalGlowBackdrop from "@/components/OvalGlowBackdrop";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useCurriculumProgress } from "@/hooks/useCurriculumProgress";
import { applyLogoBackground } from "@/utils/themeBackground";

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Lifted State: Profile Data
  const { profile, updateProfile, loading: profileLoading } = useProfile()
  
  // Curriculum Progress (single source of truth)
  const progress = useCurriculumProgress(user?.id ?? null)
  
  // Active Module State (which phase we're working on)
  const [activeModule, setActiveModule] = useState<'pre' | 'prod' | 'post' | 'legacy'>('pre')
  
  // Panel state (like Zeyoda's appMode)
  const [activePanel, setActivePanel] = useState<'logo' | 'colors' | 'font' | 'asset' | null>(null)
  
  // Temporary preview state for live background updates (unified for logo + colors)
  const [previewOverrides, setPreviewOverrides] = useState<{
    primary_color?: string
    accent_color?: string
    logo_url?: string
    logo_use_background?: boolean
  } | null>(null)
  
  // Legacy logo preview state (keep for backward compatibility with LogoPanel)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [logoPreviewUseBackground, setLogoPreviewUseBackground] = useState(false)
  
  // Refs for orbit positioning (like Zeyoda's videoContainerRef pattern)
  const featuredContentRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const isOrbitAnimationPaused = useRef(false)

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

  // Compute merged profile from profile + preview overrides (Zeyoda pattern)
  const mergedProfile = useMemo(() => {
    if (!previewOverrides) return profile
    return { ...profile, ...previewOverrides } as Profile | null
  }, [profile, previewOverrides])

  // Get current primary color for halo (Zeyoda pattern: livePrimaryColor || config || default)
  // In Zeyoda: currentPrimaryColor = livePrimaryColor || artistConfig?.theme?.primaryColor || '#0a1a3b'
  const currentPrimaryColor = mergedProfile?.primary_color || mergedProfile?.brand_color || profile?.primary_color || profile?.brand_color || '#0a0a0a'

  // Apply logo background when profile or preview changes (Zeyoda pattern)
  // Zeyoda calls applyArtistBackground(artistConfig) directly - no loading guards
  useEffect(() => {
    // TEMPORARY DIAGNOSTIC LOG - Step 1A
    console.log('[BG EFFECT] Firing', {
      primary_color: mergedProfile?.primary_color,
      accent_color: mergedProfile?.accent_color,
      logo_use_background: mergedProfile?.logo_use_background,
      logo_url: mergedProfile?.logo_url,
      brand_color: mergedProfile?.brand_color,
      previewOverrides: previewOverrides,
      mergedProfileExists: !!mergedProfile
    });
    
    // Use mergedProfile which includes preview overrides
    const previewUrl = previewOverrides?.logo_url !== undefined ? previewOverrides.logo_url : undefined
    const previewUseBg = previewOverrides?.logo_use_background !== undefined ? previewOverrides.logo_use_background : undefined
    applyLogoBackground(mergedProfile, previewUrl, previewUseBg)
  }, [mergedProfile, previewOverrides])

  if (loading) {
    // Simple loading spinner while checking auth
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-emerald-500">
        <div className="animate-pulse">Loading Sanctuary...</div>
      </div>
    )
  }

  return (
    <div 
      className="flex min-h-screen flex-col items-center justify-between pt-10 px-6 pb-6 relative text-zinc-50 font-sans selection:bg-emerald-500/30"
    >
      {user && <DataReset />}
      <main className={`app-main ${!user ? 'login-view' : ''}`}>
        <div className="text-center">
          {user ? (
            <>
              <h1 
                className="text-4xl md:text-5xl font-bold tracking-wider mt-1 md:mt-2 mb-3 md:mb-3 cursor-pointer hover:opacity-80 transition-opacity" 
                style={{ 
                  fontFamily: mergedProfile?.font_family || 'Geist Sans, sans-serif', 
                  color: mergedProfile?.accent_color || mergedProfile?.brand_color || '#10b981',
                  position: 'relative',
                  zIndex: 100,
                  pointerEvents: 'none',
                  maxWidth: '85%',
                  margin: '0 auto',
                  lineHeight: '1.1'
                }}
              >
                {profile?.artist_name || "ArtisTalks"}
              </h1>
              
              {/* Edit Branding Buttons - Manual Panel Triggers (Zeyoda pattern: buttons that set appMode/activePanel) */}
              {user && profile && (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <button
                    onClick={() => setActivePanel('logo')}
                    className="border border-emerald-500/60 bg-black/40 hover:bg-emerald-500/10 px-3 py-1.5 rounded text-emerald-100 text-xs font-medium transition-colors flex items-center gap-1"
                    title="Edit logo"
                  >
                    🎨 Logo
                  </button>
                  <button
                    onClick={() => setActivePanel('colors')}
                    className="border border-emerald-500/60 bg-black/40 hover:bg-emerald-500/10 px-3 py-1.5 rounded text-emerald-100 text-xs font-medium transition-colors flex items-center gap-1"
                    title="Edit colors"
                  >
                    🎨 Colors
                  </button>
                  <button
                    onClick={() => setActivePanel('font')}
                    className="border border-emerald-500/60 bg-black/40 hover:bg-emerald-500/10 px-3 py-1.5 rounded text-emerald-100 text-xs font-medium transition-colors flex items-center gap-1"
                    title="Edit font"
                  >
                    ✏️ Font
                  </button>
                </div>
              )}
              
              {/* Band A: Stage (FeaturedContent + Orbiting Tokens) */}
              <div className="relative w-full max-w-5xl mx-auto mt-6 md:mt-14 mb-12 md:mb-16">
              {/* Halo effect around FeaturedContent - uses primary color, updates live */}
              {/* Halo effect - Zeyoda pattern: zIndex={1} for normal mode, before carousel */}
              <OvalGlowBackdrop
                containerRef={featuredContentRef}
                primaryColor={currentPrimaryColor}
                intensity={0.95}
                zIndex={1}
              />
              
              {/* FeaturedContent card - THIS is the orbit center */}
              <FeaturedContent 
                ref={featuredContentRef}
                profile={profile}
                currentModule={progress.currentModule}
                brandColor={profile?.brand_color}
              />
              
              {/* Tokens orbiting around FeaturedContent */}
              <ArtisTalksOrbitRenderer
                featuredContentRef={featuredContentRef}
                chatRef={chatRef}
                isOrbitAnimationPaused={isOrbitAnimationPaused}
                phaseTokens={[
                  { id: 'pre', label: 'PRE', progress: progress.preProgress },
                  { id: 'prod', label: 'PROD', progress: progress.proProgress },
                  { id: 'post', label: 'POST', progress: progress.postProgress },
                  { id: 'legacy', label: 'LEGACY', progress: progress.loopProgress },
                ]}
                brandColor={profile?.brand_color}
              />
              </div>
            </>
          ) : null}
        </div>
        
        {/* Band C: Action section - OUTSIDE text-center, matches Zeyoda structure */}
        <div className="action-section text-center mb-4">
          {!user && (
            <div id="login-prompts-container" className="login-prompts mt-6">
              <AuthPanel />
            </div>
          )}
        </div>
        
        {/* Panels - Appear above chat, matches Zeyoda pattern (OnboardingPanel positioning) */}
        {activePanel === 'logo' && (
          <div className="onboarding-panel bg-gray-800 bg-opacity-90 rounded-lg p-6 mt-8 max-w-2xl mx-auto backdrop-blur-sm border border-gray-600" style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(51, 65, 85, 0.95) 100%)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
          }}>
            <LogoPanel
              profile={profile}
              onSave={async (updates) => {
                await updateProfile(updates)
                // After profile is saved, apply background using saved profile values
                // Clear preview state so useEffect will use profile values
                setLogoPreviewUrl(null)
                setLogoPreviewUseBackground(false)
                setPreviewOverrides(prev => {
                  const updated = { ...prev }
                  delete updated.logo_url
                  delete updated.logo_use_background
                  return Object.keys(updated).length > 0 ? updated : null
                })
                // Apply background immediately using the updated profile values
                // This ensures persistence even if profile refresh is delayed
                const updatedProfile = { ...profile, ...updates }
                applyLogoBackground(updatedProfile, undefined, undefined)
              }}
              onPreviewChange={(previewUrl, useBackground) => {
                setLogoPreviewUrl(previewUrl)
                setLogoPreviewUseBackground(useBackground)
                // Also update unified previewOverrides
                setPreviewOverrides(prev => ({
                  ...prev,
                  logo_url: previewUrl || undefined,
                  logo_use_background: useBackground
                }))
              }}
              onClose={() => {
                setLogoPreviewUrl(null)
                setLogoPreviewUseBackground(false)
                setPreviewOverrides(prev => {
                  const updated = { ...prev }
                  delete updated.logo_url
                  delete updated.logo_use_background
                  return Object.keys(updated).length > 0 ? updated : null
                })
                setActivePanel(null)
              }}
            />
          </div>
        )}
        
        {activePanel === 'colors' && (
          <div className="onboarding-panel bg-gray-800 bg-opacity-90 rounded-lg p-6 mt-8 max-w-2xl mx-auto backdrop-blur-sm border border-gray-600" style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(51, 65, 85, 0.95) 100%)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
          }}>
            <ColorPanel
              profile={profile}
              onSave={(updates) => {
                updateProfile(updates)
                // Clear preview overrides on save
                setPreviewOverrides(prev => {
                  const updated = { ...prev }
                  delete updated.primary_color
                  delete updated.accent_color
                  return Object.keys(updated).length > 0 ? updated : null
                })
                window.dispatchEvent(new CustomEvent('panelComplete', { 
                  detail: { stepId: 'COLORS_PANEL' } 
                }))
                setActivePanel(null)
              }}
              onPreviewChange={(preview) => {
                setPreviewOverrides(prev => ({ ...prev, ...preview }))
              }}
              onClose={() => {
                // Clear color preview overrides on close
                setPreviewOverrides(prev => {
                  const updated = { ...prev }
                  delete updated.primary_color
                  delete updated.accent_color
                  return Object.keys(updated).length > 0 ? updated : null
                })
                setActivePanel(null)
              }}
            />
          </div>
        )}
        
        {activePanel === 'font' && (
          <div className="onboarding-panel bg-gray-800 bg-opacity-90 rounded-lg p-6 mt-8 max-w-2xl mx-auto backdrop-blur-sm border border-gray-600" style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(51, 65, 85, 0.95) 100%)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
          }}>
            <FontPanel
              profile={profile}
              onSave={(updates) => {
                updateProfile(updates)
                window.dispatchEvent(new CustomEvent('panelComplete', { 
                  detail: { stepId: 'FONT_PANEL' } 
                }))
                setActivePanel(null)
              }}
              onClose={() => setActivePanel(null)}
            />
          </div>
        )}
        
        {/* Chat input container - ALWAYS at bottom, matches Zeyoda pattern (line 2458) */}
        <div className={`unified-input-container mock-ui-section p-4 border-t-2 border-gray-700 mt-8`} style={{ marginTop: 'auto' }}>
          {user && (
            <>
              <h3 className="text-xl font-semibold mb-3 text-center">Chat / Command</h3>
              <div ref={chatRef} className="w-full">
                <EmeraldChat 
                  onProfileUpdate={updateProfile}
                  onTriggerPanel={setActivePanel}
                />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

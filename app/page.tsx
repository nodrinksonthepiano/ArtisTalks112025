'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import EmeraldChat from "@/components/EmeraldChat";
import AuthPanel from "@/components/AuthPanel";
import DataReset from "@/components/DataReset";
import OrbitPeekCarousel from "@/components/OrbitPeekCarousel";
import ArtisTalksOrbitRenderer from "@/components/ArtisTalksOrbitRenderer";
import LogoPanel from "@/components/LogoPanel";
import ColorPanel from "@/components/ColorPanel";
import FontPanel from "@/components/FontPanel";
import OvalGlowBackdrop from "@/components/OvalGlowBackdrop";
import { createClient } from "@/utils/supabase/client";
import { useProfile, type Profile } from "@/hooks/useProfile";
import { useCurriculumProgress } from "@/hooks/useCurriculumProgress";
import { useCarouselItems } from "@/hooks/useCarouselItems";
import { applyLogoBackground } from "@/utils/themeBackground";
import { StepId, getStep } from "@/lib/curriculum";

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Lifted State: Profile Data
  const { profile, updateProfile, loading: profileLoading } = useProfile()
  
  // Apply background immediately on mount (before profile loads) to prevent black flash
  useEffect(() => {
    if (typeof document !== 'undefined' && !user) {
      // Apply preset logo background for landing page (nodrinks look)
      // Uses Zeyoda's applyLogoBackground function with preset values
      const presetLogoUrl = encodeURI('/CreationCreator_Logo_Color copy.png')
      // Create a temporary profile object for applyLogoBackground
      const tempProfile = {
        logo_url: presetLogoUrl,
        logo_use_background: true,
        primary_color: '#0a0a0a',
        brand_color: '#0a0a0a'
      } as Profile
      applyLogoBackground(tempProfile, presetLogoUrl, true)
      // Override background-size for landing page ONLY to make logo bigger
      document.body.style.setProperty("background-size", "350%", "important")
    } else if (typeof document !== 'undefined' && user) {
      // When user logs in, ensure logo is fit to screen (cover) - remove landing page override
      // The themeBackground.ts will handle this, but we ensure it's reset here
      const currentBgImage = document.body.style.backgroundImage
      if (currentBgImage && currentBgImage.includes('CreationCreator_Logo_Color')) {
        document.body.style.setProperty("background-size", "cover", "important")
      }
    }
  }, [user])
  
  // Curriculum Progress (single source of truth)
  const progress = useCurriculumProgress(user?.id ?? null)
  
  // Active Module State (which phase we're working on)
  const [activeModule, setActiveModule] = useState<'pre' | 'prod' | 'post' | 'legacy'>('pre')
  
  // Panel state (like Zeyoda's appMode)
  const [activePanel, setActivePanel] = useState<'logo' | 'colors' | 'font' | 'asset' | null>(null)
  
  // Carousel state: current typing input for live card updates
  const [currentTypingInput, setCurrentTypingInput] = useState<string>('')
  const [currentTypingStepId, setCurrentTypingStepId] = useState<StepId | null>(null)
  const [currentQuestionStepId, setCurrentQuestionStepId] = useState<StepId | null>(null) // Current question being asked
  const [carouselIndex, setCarouselIndex] = useState(0)
  const prevQuestionRef = useRef<StepId | null>(null)
  
  // Carousel items from curriculum answers + current question card
  const carouselItems = useCarouselItems(user?.id ?? null, currentTypingInput, currentTypingStepId, currentQuestionStepId)
  
  // Stabilize phaseTokens array reference to prevent unnecessary effect re-runs
  const phaseTokens = useMemo(() => [
    { id: 'pre' as const, label: 'PRE', progress: progress.preProgress },
    { id: 'prod' as const, label: 'PROD', progress: progress.proProgress },
    { id: 'post' as const, label: 'POST', progress: progress.postProgress },
    { id: 'legacy' as const, label: 'LEGACY', progress: progress.loopProgress },
  ], [progress.preProgress, progress.proProgress, progress.postProgress, progress.loopProgress])
  
  // Reset carousel index when user changes
  useEffect(() => {
    setCarouselIndex(0)
    prevQuestionRef.current = null
  }, [user?.id])
  
  // Auto-advance to new question card when question changes
  useEffect(() => {
    // Only move if question actually changed and we have items
    if (currentQuestionStepId && currentQuestionStepId !== prevQuestionRef.current && carouselItems.length > 0) {
      // Wait for items to regenerate with new question card at the end
      // Check that last item matches the new question
      const lastItem = carouselItems[carouselItems.length - 1]
      if (lastItem && lastItem.stepId === currentQuestionStepId) {
        // New question card is ready at the end
        const lastIndex = carouselItems.length - 1
        setCarouselIndex(lastIndex)
        prevQuestionRef.current = currentQuestionStepId
      } else {
        // Items haven't regenerated yet, wait a bit and retry
        const timeoutId = setTimeout(() => {
          const updatedLastItem = carouselItems[carouselItems.length - 1]
          if (updatedLastItem && updatedLastItem.stepId === currentQuestionStepId) {
            const lastIndex = carouselItems.length - 1
            setCarouselIndex(lastIndex)
            prevQuestionRef.current = currentQuestionStepId
          }
        }, 100)
        return () => clearTimeout(timeoutId)
      }
    }
  }, [currentQuestionStepId, carouselItems])

  // CRITICAL: Set currentQuestionStepId immediately when user logs in (before EmeraldChat initializes)
  // This ensures the card is generated immediately, preventing "no card on login" issue
  useEffect(() => {
    if (user && !currentQuestionStepId) {
      // Set to INIT immediately - EmeraldChat will update it if needed
      setCurrentQuestionStepId('INIT')
    } else if (!user) {
      // Clear when user logs out
      setCurrentQuestionStepId(null)
    }
  }, [user, currentQuestionStepId])
  
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
  const haloContainerRef = useRef<HTMLDivElement>(null) // Separate container for halo (below mission, above FeaturedContent)
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
  // Debounced to prevent glitching during typing
  const logoBgTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastLogoBgRef = useRef<string>('')
  useEffect(() => {
    // Create a signature of the current background state to prevent unnecessary reapplications
    const bgSignature = JSON.stringify({
      logo_url: mergedProfile?.logo_url,
      logo_use_background: mergedProfile?.logo_use_background,
      preview_logo_url: previewOverrides?.logo_url,
      preview_logo_use_bg: previewOverrides?.logo_use_background,
      user: !!user
    })
    
    // Only apply if signature changed (prevents reapplying same background)
    if (bgSignature === lastLogoBgRef.current) {
      return
    }
    
    // Debounce rapid changes (e.g., during typing)
    if (logoBgTimeoutRef.current) clearTimeout(logoBgTimeoutRef.current)
    logoBgTimeoutRef.current = setTimeout(() => {
      // Keep preset logo background if user hasn't uploaded one
      if (!mergedProfile?.logo_url && user) {
        applyLogoBackground(null, encodeURI('/CreationCreator_Logo_Color copy.png'), true)
        lastLogoBgRef.current = bgSignature
        return
      }
      
      // Use mergedProfile which includes preview overrides
      const previewUrl = previewOverrides?.logo_url !== undefined ? previewOverrides.logo_url : undefined
      const previewUseBg = previewOverrides?.logo_use_background !== undefined ? previewOverrides.logo_use_background : undefined
      applyLogoBackground(mergedProfile, previewUrl, previewUseBg)
      lastLogoBgRef.current = bgSignature
    }, 200) // Debounce background updates
    
    return () => {
      if (logoBgTimeoutRef.current) clearTimeout(logoBgTimeoutRef.current)
    }
  }, [mergedProfile, previewOverrides, user])

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
      className="flex min-h-screen flex-col items-center pt-10 px-6 pb-6 relative text-zinc-50 font-sans selection:bg-emerald-500/30"
    >
      {user && <DataReset />}
      <main className={`app-main ${!user ? 'login-view' : ''}`}>
        <div className="text-center">
          {user ? (
            <>
              <h1 
                className="text-4xl md:text-5xl font-bold tracking-wider mt-0 mb-1 cursor-pointer hover:opacity-80 transition-opacity" 
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
              
              {/* Mission Statement - Display under artist name */}
              <p 
                className="text-lg md:text-xl text-zinc-400 mt-1 mb-2 font-light transition-all duration-500"
                style={{ 
                  fontFamily: mergedProfile?.font_family || 'Geist Sans, sans-serif',
                  color: mergedProfile?.accent_color || mergedProfile?.brand_color || '#a1a1aa',
                  opacity: profile?.mission_statement ? 1 : 0.5,
                  position: 'relative',
                  zIndex: 101, // Higher than artist name (100) and halo (1) to prevent coverage
                }}
              >
                {profile?.mission_statement || "The Champion is ready for you."}
              </p>
              
              {/* Halo Container with Carousel ON it (Zeyoda pattern) */}
              {/* overflow: visible allows peek cards to show above/below halo */}
              {/* Container matches Zeyoda: relative, max-w-5xl constraint (Zeyoda pattern) */}
              {/* Only render when we have items (Zeyoda pattern - prevents halo from measuring empty carousel) */}
              {(carouselItems && carouselItems.length >= 1) ? (
                <div 
                  ref={haloContainerRef}
                  className="relative w-full max-w-5xl mx-auto"
                  style={{ marginTop: '24px', marginBottom: '16px', overflow: 'visible' }}
                >
                  {/* Halo effect - uses primary color, updates live */}
                  {/* containerRef must point to the carousel element (featuredContentRef), not the wrapper */}
                  <OvalGlowBackdrop
                    containerRef={featuredContentRef}
                    primaryColor={currentPrimaryColor}
                    intensity={0.95}
                    zIndex={1}
                  />
                  
                  {/* Carousel - renders directly, no wrapper (Zeyoda pattern) */}
                  <OrbitPeekCarousel
                    items={carouselItems}
                    index={carouselIndex}
                    onIndexChange={setCarouselIndex}
                    containerRef={featuredContentRef}
                    theme={{
                      fontFamily: mergedProfile?.font_family || undefined,
                      primaryColor: mergedProfile?.primary_color || mergedProfile?.brand_color || undefined,
                      accentColor: mergedProfile?.accent_color || mergedProfile?.brand_color || undefined
                    }}
                  />
                  
                  {/* Tokens orbiting around carousel */}
                  <ArtisTalksOrbitRenderer
                    featuredContentRef={featuredContentRef}
                    chatRef={chatRef}
                    isOrbitAnimationPaused={isOrbitAnimationPaused}
                    phaseTokens={phaseTokens}
                    brandColor={profile?.brand_color || undefined}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        
        {/* Band C: Action section - OUTSIDE text-center, matches Zeyoda structure */}
        <div className="action-section text-center" style={{ width: '100%', maxWidth: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: !user ? '100vh' : 'auto' }}>
          {!user && (
            <div id="login-prompts-container" className="login-prompts" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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
                const updatedProfile = profile ? { ...profile, ...updates } : null
                if (updatedProfile) {
                  applyLogoBackground(updatedProfile, undefined, undefined)
                }
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
        
        {/* Chat input container - Minimal spacing, seamless from landing page (Zeyoda pattern: 16px margin) */}
        <div className="flex justify-center" style={{ marginTop: '16px', marginBottom: '16px' }}>
          {user && (
            <div ref={chatRef} className="w-full flex justify-center">
              <EmeraldChat 
                  onProfileUpdate={updateProfile}
                  onTriggerPanel={setActivePanel}
                  onTypingUpdate={(input, stepId) => {
                    setCurrentTypingInput(input)
                    setCurrentTypingStepId(stepId)
                  }}
                  onCurrentStepChange={(stepId) => {
                    setCurrentQuestionStepId(stepId)
                  }}
                  onSubmitCard={(answer, stepId) => {
                    // Clear typing state immediately
                    setCurrentTypingInput('')
                    setCurrentTypingStepId(null)
                    // Carousel auto-advance is handled by useEffect watching currentQuestionStepId
                  }}
                />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

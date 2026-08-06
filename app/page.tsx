'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import EmeraldChat from "@/components/EmeraldChat";
import DataReset from "@/components/DataReset";
import OrbitPeekCarousel from "@/components/OrbitPeekCarousel";
import ArtisTalksOrbitRenderer from "@/components/ArtisTalksOrbitRenderer";
import LogoPanel from "@/components/LogoPanel";
import ColorPanel from "@/components/ColorPanel";
import FontPanel from "@/components/FontPanel";
import OvalGlowBackdrop from "@/components/OvalGlowBackdrop";
import SanctuaryAccordion from "@/components/SanctuaryAccordion";
import { createClient } from "@/utils/supabase/client";
import { useProfile, type Profile } from "@/hooks/useProfile";
import { useCurriculumProgress } from "@/hooks/useCurriculumProgress";
import { useCarouselItems } from "@/hooks/useCarouselItems";
import { useAnsweredKeys } from "@/hooks/useAnsweredKeys";
import { useSanctuaryAnswers } from "@/hooks/useSanctuaryAnswers";
import { applyLogoBackground } from "@/utils/themeBackground";
import { loadDraft, getDraftAnsweredKeys, getDraftAnswerText, clearDraft } from '@/lib/draft'
import { migrateAnonymousDraft } from '@/lib/migrateDraft'
import {
  clearReturningClaimMarker,
  hasReturningClaimMarker,
} from '@/lib/returningClaim'
import { useDraft } from '@/hooks/useDraft'
import {
  StepId,
  FREE_TASTE_LAST_STEP_ID,
  findFirstUnansweredInFreeTaste,
  isBeyondFreeTaste,
  isFreeTasteGateReached,
  withProfileSatisfiedArtistName,
} from "@/lib/curriculum";

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [migrating, setMigrating] = useState(false)
  /** Account connected but sanctuary draft not fully stored — draft kept for retry. */
  const [sanctuarySaveError, setSanctuarySaveError] = useState<string | null>(null)
  const [sanctuarySaveRetrying, setSanctuarySaveRetrying] = useState(false)
  
  // Lifted State: Profile Data
  const { profile, updateProfile, loading: profileLoading, reloadProfile } = useProfile(user?.id ?? null)
  
  const { draft, hydrated, refreshDraft, updateProfilePreview } = useDraft()
  
  const [answeredKeys, setAnsweredKeys, reloadAnsweredKeys, answeredKeysReady] =
    useAnsweredKeys(user?.id ?? null)
  const sanctuaryAnswers = useSanctuaryAnswers(user?.id ?? null, draft)
  
  const handleDraftRefresh = () => {
    refreshDraft()
    if (!user) {
      setAnsweredKeys(getDraftAnsweredKeys())
    }
  }
  
  // Curriculum Progress (single source of truth)
  // CRITICAL: Pass answeredKeys for immediate progress updates (coins fill as user progresses)
  const progress = useCurriculumProgress(user?.id ?? null, answeredKeys)
  
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
  
  // Active Module State (which phase we're working on)
  const [activeModule, setActiveModule] = useState<'pre' | 'prod' | 'post' | 'legacy'>('pre')
  
  // Panel state (like Zeyoda's appMode)
  const [activePanel, setActivePanel] = useState<'logo' | 'colors' | 'font' | 'asset' | null>(null)
  
  // Carousel state: current typing input for live card updates
  const [currentTypingInput, setCurrentTypingInput] = useState<string>('')
  const [activeStepId, setActiveStepId] = useState<StepId | null>(null) // Single source of truth for both chat and carousel
  const [isEditMode, setIsEditMode] = useState(false) // Track if we're editing an answered card
  const [carouselIndex, setCarouselIndex] = useState(0)
  const carouselIndexRef = useRef<number>(0)
  const prevQuestionRef = useRef<StepId | null>(null)
  const isUserSwipeRef = useRef<boolean>(false)
  
  // Carousel items from curriculum answers + current question card
  const carouselItems = useCarouselItems(user?.id ?? null, currentTypingInput, activeStepId, activeStepId, isEditMode, answeredKeys)
  
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
  
  // Auto-advance to current question card (always at index 0)
  // CRITICAL: Respect edit mode and user swipes
  // Navigation (cardNavigate) updates activeStepId without edit mode, so auto-center can work
  // Editing (cardEdit) sets edit mode, so auto-center is blocked
  useEffect(() => {
    if (!activeStepId) return
    
    // CRITICAL: In edit mode, NEVER auto-center - stay on the edited card
    if (isEditMode) {
      return // Exit early - don't touch carousel at all
    }
    
    // CRITICAL: A step change can be USER-initiated (swipe/pencil dispatch cardNavigate/cardEdit,
    // which set isUserSwipeRef before updating activeStepId) or APP-initiated (submit/resume).
    // If the user caused it, consume the flag and do NOT auto-center - snapping to index 0
    // here is what made the carousel fight every swipe.
    if (isUserSwipeRef.current) {
      isUserSwipeRef.current = false
      prevQuestionRef.current = activeStepId
      return
    }
    
    // App-initiated transition (submit advance, resume): center on current question card (index 0)
    if (carouselIndexRef.current !== 0 || prevQuestionRef.current !== activeStepId) {
      setCarouselIndex(0)
      carouselIndexRef.current = 0
      prevQuestionRef.current = activeStepId
    }
  }, [activeStepId, isEditMode])

  // CRITICAL: Handle edit button clicks - navigate to edited card and prevent auto-center
  // When user clicks edit, mark as user-initiated navigation and move carousel to that card
  useEffect(() => {
    const handleCardEdit = (e: Event) => {
      const customEvent = e as CustomEvent<{ stepId: StepId; focusInput?: boolean; cardIndex?: number }>
      const stepId = customEvent.detail?.stepId
      if (!stepId) return

      if (!user && isBeyondFreeTaste(stepId)) return
      
      // CRITICAL: Enter edit mode - set activeStepId to the card being edited
      setActiveStepId(stepId)
      setIsEditMode(true)
      
      // Mark as user-initiated navigation to prevent auto-center
      isUserSwipeRef.current = true
      
      // Navigate carousel to the card being edited
      const cardIndex = customEvent.detail?.cardIndex !== undefined 
        ? customEvent.detail.cardIndex 
        : carouselItems.findIndex(item => item.stepId === stepId)
      
      if (cardIndex !== -1) {
        setCarouselIndex(cardIndex)
        carouselIndexRef.current = cardIndex
      }
      
      // Clear swipe flag after delay (but stay in edit mode until submit)
      setTimeout(() => {
        isUserSwipeRef.current = false
      }, 100)
    }
    
    window.addEventListener('cardEdit', handleCardEdit as EventListener)
    return () => {
      window.removeEventListener('cardEdit', handleCardEdit as EventListener)
    }
  }, [carouselItems])

  // CRITICAL: Handle card navigation (swiping) separately from editing
  // Navigation should update activeStepId WITHOUT entering edit mode
  useEffect(() => {
    const handleCardNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<{ stepId: StepId; cardIndex?: number }>
      const stepId = customEvent.detail?.stepId
      if (!stepId) return

      if (!user && isBeyondFreeTaste(stepId)) return
      
      // CRITICAL: Navigation is NOT editing - swiping away abandons any in-progress edit.
      // Without this, edit mode stuck ON after pencil+swipe and the carousel froze
      // (edit mode suppresses the current question card and blocks auto-center forever).
      setIsEditMode(false)
      setActiveStepId(stepId)
      
      // Mark as user-initiated to prevent auto-center during navigation
      isUserSwipeRef.current = true
      
      // Navigate carousel to the swiped card
      const cardIndex = customEvent.detail?.cardIndex !== undefined 
        ? customEvent.detail.cardIndex 
        : carouselItems.findIndex(item => item.stepId === stepId)
      
      if (cardIndex !== -1) {
        setCarouselIndex(cardIndex)
        carouselIndexRef.current = cardIndex
      }
      
      // Clear swipe flag after delay (allows auto-center for next step change)
      setTimeout(() => {
        isUserSwipeRef.current = false
      }, 100)
    }
    
    window.addEventListener('cardNavigate', handleCardNavigate as EventListener)
    return () => {
      window.removeEventListener('cardNavigate', handleCardNavigate as EventListener)
    }
  }, [carouselItems])

  const prevUserRef = useRef<any>(undefined)

  // Clear funnel state on logout only — not on initial anonymous load
  useEffect(() => {
    const hadUser = prevUserRef.current != null
    if (hadUser && !user) {
      setActiveStepId(null)
      setIsEditMode(false)
      prevQuestionRef.current = null
    }
    prevUserRef.current = user
  }, [user])

  // Restore anonymous draft step on load
  useEffect(() => {
    if (!user && hydrated) {
      const saved = loadDraft()
      if (saved?.currentStepId) {
        const draftKeys = getDraftAnsweredKeys()
        let stepId = saved.currentStepId
        if (isFreeTasteGateReached(draftKeys) || isBeyondFreeTaste(stepId)) {
          stepId = isFreeTasteGateReached(draftKeys)
            ? FREE_TASTE_LAST_STEP_ID
            : findFirstUnansweredInFreeTaste(draftKeys)
        }
        setActiveStepId(stepId)
      }
    }
  }, [user, hydrated])
  
  // Temporary preview state for live background updates (unified for logo + colors)
  const [previewOverrides, setPreviewOverrides] = useState<{
    primary_color?: string
    accent_color?: string
    brand_color?: string
    logo_url?: string
    logo_use_background?: boolean
  } | null>(null)
  
  // CRITICAL: Listen for profile preview changes from InlineColorPicker (matches Zeyoda's artistConfigPreview)
  // This ensures page.tsx knows about color changes and updates previewOverrides for halo
  useEffect(() => {
    const handleProfilePreview = (e: Event) => {
      const customEvent = e as CustomEvent<{ previewConfig?: { primary_color?: string; accent_color?: string; brand_color?: string; logo_url?: string | null; logo_use_background?: boolean } }>
      if (customEvent.detail?.previewConfig) {
        setPreviewOverrides(prev => ({
          ...prev,
          primary_color: customEvent.detail.previewConfig?.primary_color,
          accent_color: customEvent.detail.previewConfig?.accent_color,
          brand_color: customEvent.detail.previewConfig?.brand_color,
          // CRITICAL: Clear logo when primary color is set (user chose background color)
          logo_url: customEvent.detail.previewConfig?.logo_url !== undefined ? (customEvent.detail.previewConfig.logo_url ?? undefined) : prev?.logo_url,
          logo_use_background: customEvent.detail.previewConfig?.logo_use_background !== undefined ? customEvent.detail.previewConfig.logo_use_background : prev?.logo_use_background
        }))
      }
    }
    
    const handleLogoPreview = (e: Event) => {
      const customEvent = e as CustomEvent<{ logo_url?: string | null; logo_use_background?: boolean }>
      if (customEvent.detail) {
        setPreviewOverrides(prev => ({
          ...prev,
          logo_url: customEvent.detail.logo_url !== undefined ? (customEvent.detail.logo_url ?? undefined) : prev?.logo_url,
          logo_use_background: customEvent.detail.logo_use_background !== undefined ? customEvent.detail.logo_use_background : prev?.logo_use_background
        }))
      }
    }
    
    window.addEventListener('profilePreview', handleProfilePreview as EventListener)
    window.addEventListener('logoPreviewChange', handleLogoPreview as EventListener)
    return () => {
      window.removeEventListener('profilePreview', handleProfilePreview as EventListener)
      window.removeEventListener('logoPreviewChange', handleLogoPreview as EventListener)
    }
  }, [])
  
  // Legacy logo preview state (keep for backward compatibility with LogoPanel)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [logoPreviewUseBackground, setLogoPreviewUseBackground] = useState(false)
  
  // Refs for orbit positioning (like Zeyoda's videoContainerRef pattern)
  const featuredContentRef = useRef<HTMLDivElement>(null)
  const haloContainerRef = useRef<HTMLDivElement>(null) // Separate container for halo (below mission, above FeaturedContent)
  const chatRef = useRef<HTMLDivElement>(null)
  const isOrbitAnimationPaused = useRef(false)
  const establishInFlightRef = useRef(false)
  const migrationPromiseRef = useRef<Promise<void> | null>(null)

  const establishSession = async (nextUser: any) => {
    if (establishInFlightRef.current) return
    establishInFlightRef.current = true

    try {
      if (!nextUser) {
        setUser(null)
        setMigrating(false)
        setLoading(false)
        return
      }

      const draftToMigrate = loadDraft()
      const needsMigration =
        draftToMigrate &&
        (draftToMigrate.answers.length > 0 ||
          draftToMigrate.profilePreview.artist_name ||
          draftToMigrate.profilePreview.mission_statement)

      const draftKeysBeforeMigrate = getDraftAnsweredKeys()
      const continueAfterFreeTaste = isFreeTasteGateReached(draftKeysBeforeMigrate)
      const isReturningClaim = hasReturningClaimMarker()

      if (isReturningClaim) {
        // Returning claimed-name login — never migrate anonymous draft into this account
        clearDraft()
        clearReturningClaimMarker()
        refreshDraft()
        setSanctuarySaveError(null)
      } else if (needsMigration) {
        setMigrating(true)
        setSanctuarySaveError(null)
        try {
          if (!migrationPromiseRef.current) {
            migrationPromiseRef.current = migrateAnonymousDraft(nextUser.id)
              .then(() => {
                refreshDraft()
              })
              .finally(() => {
                migrationPromiseRef.current = null
              })
          }
          await migrationPromiseRef.current
          setSanctuarySaveError(null)
          if (continueAfterFreeTaste) {
            setActiveStepId('CURRENT_FOCUS_PILLAR')
          }
        } catch (err) {
          console.error('Draft migration failed:', err)
          // Keep local draft; account may be connected but sanctuary is not fully saved.
          setSanctuarySaveError(
            'Your account is connected, but your sanctuary has not finished saving yet. Your work is still safe in this browser. Try saving again.'
          )
        } finally {
          setMigrating(false)
        }
      }

      setUser(nextUser)
      setLoading(false)
    } finally {
      establishInFlightRef.current = false
    }
  }

  useEffect(() => {
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        void establishSession(session?.user ?? null)
      } else if (event === 'SIGNED_OUT') {
        void establishSession(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Compute merged profile from profile + preview overrides (Zeyoda pattern)
  const mergedProfile = useMemo(() => {
    if (!previewOverrides) return profile
    return { ...profile, ...previewOverrides } as Profile | null
  }, [profile, previewOverrides])

  const anonymousChatProfile = useMemo((): Profile | null => {
    if (user || !draft) return null
    const preview = draft.profilePreview
    return {
      id: 'anonymous',
      artist_name: preview.artist_name ?? null,
      mission_statement: preview.mission_statement ?? null,
      email: null,
      primary_color: preview.primary_color ?? null,
      accent_color: preview.accent_color ?? null,
      brand_color: preview.brand_color ?? null,
      font_family: preview.font_family ?? null,
      logo_url: preview.logo_url ?? null,
      logo_use_background: preview.logo_use_background ?? null,
    }
  }, [user, draft])

  const chatProfile = useMemo(() => {
    if (user) return mergedProfile
    if (!anonymousChatProfile) return null
    return { ...anonymousChatProfile, ...previewOverrides } as Profile
  }, [user, mergedProfile, anonymousChatProfile, previewOverrides])

  const handleAnonymousProfileUpdate = async (updates: Partial<Profile>) => {
    updateProfilePreview({
      artist_name: updates.artist_name,
      mission_statement: updates.mission_statement,
      primary_color: updates.primary_color,
      accent_color: updates.accent_color,
      brand_color: updates.brand_color,
      font_family: updates.font_family,
      logo_url: updates.logo_url,
      logo_use_background: updates.logo_use_background,
    })
    setPreviewOverrides((prev) => ({
      ...prev,
      primary_color: updates.primary_color ?? prev?.primary_color,
      accent_color: updates.accent_color ?? prev?.accent_color,
      brand_color: updates.brand_color ?? prev?.brand_color,
      logo_url: updates.logo_url ?? prev?.logo_url,
      logo_use_background: updates.logo_use_background ?? prev?.logo_use_background,
    }))
    handleDraftRefresh()
  }

  const anonymousLiveName =
    !user && hydrated
      ? activeStepId === 'INIT'
        ? currentTypingInput
        : draft?.profilePreview?.artist_name || getDraftAnswerText('artist_name') || ''
      : ''

  /** Anonymous gift subtitle — only when gift_to_world exists; no fallback copy. */
  const anonymousGiftSubtitle =
    !user && hydrated
      ? (
          draft?.profilePreview?.mission_statement?.trim() ||
          getDraftAnswerText('gift_to_world').trim() ||
          ''
        )
      : ''

  const showCarouselStage = (() => {
    if (activeStepId === 'INIT') {
      return currentTypingInput.length > 0 || (carouselItems && carouselItems.length >= 1)
    }
    return activeStepId || (carouselItems && carouselItems.length >= 1)
  })()

  const effectiveAnsweredKeys = useMemo(() => {
    if (user) {
      return withProfileSatisfiedArtistName(answeredKeys, mergedProfile?.artist_name)
    }
    return answeredKeys
  }, [user, answeredKeys, mergedProfile?.artist_name])

  const showPhaseCoins = effectiveAnsweredKeys.has('artist_name')
  const isEarlyOnboarding = !isFreeTasteGateReached(effectiveAnsweredKeys)

  /** First land only: centered welcome card. Exits as soon as name typing/stage begins (answer B). */
  const isAnonymousPoster =
    !user && hydrated && anonymousLiveName.length === 0 && !showCarouselStage

  const emeraldChatProps = {
    onProfileUpdate: user ? updateProfile : handleAnonymousProfileUpdate,
    onTriggerPanel: setActivePanel,
    onTypingUpdate: (input: string, stepId: StepId) => {
      setCurrentTypingInput(input)
      if (activeStepId !== stepId) {
        console.warn('Typing stepId mismatch:', { activeStepId, stepId })
      }
    },
    onCurrentStepChange: (stepId: StepId) => {
      if (isEditMode && stepId !== activeStepId) {
        setIsEditMode(false)
      }
      setActiveStepId(stepId)
    },
    onSubmitCard: () => {
      setCurrentTypingInput('')
      if (isEditMode) {
        setIsEditMode(false)
      }
    },
    profile: chatProfile,
    answeredKeys,
    setAnsweredKeys,
    answeredKeysReady,
    isAnonymous: !user,
    onDraftRefresh: handleDraftRefresh,
  }

  // Get current primary color for halo (Zeyoda pattern: livePrimaryColor || config || default)
  // In Zeyoda: currentPrimaryColor = livePrimaryColor || artistConfig?.theme?.primaryColor || '#0a1a3b'
  const currentPrimaryColor =
    chatProfile?.primary_color || chatProfile?.brand_color || '#0a0a0a'

  // Apply logo background when profile or preview changes (Zeyoda pattern)
  // Debounced to prevent glitching during typing
  // CRITICAL: Only apply for logo changes, not color changes (colors handled by InlineColorPicker)
  const logoBgTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastLogoBgRef = useRef<string>('')
  useEffect(() => {
    // Create a signature of the current background state to prevent unnecessary reapplications
    const bgSignature = JSON.stringify({
      logo_url: mergedProfile?.logo_url,
      logo_use_background: mergedProfile?.logo_use_background,
      preview_logo_url: previewOverrides?.logo_url,
      preview_logo_use_bg: previewOverrides?.logo_use_background,
      primary_color: mergedProfile?.primary_color, // Include primary color in signature
      user: !!user
    })
    
    // Only apply if signature changed (prevents reapplying same background)
    if (bgSignature === lastLogoBgRef.current) {
      return
    }
    
    // Debounce rapid changes (e.g., during typing)
    if (logoBgTimeoutRef.current) clearTimeout(logoBgTimeoutRef.current)
    logoBgTimeoutRef.current = setTimeout(() => {
      // Authenticated: never force marketing logo. Zeyoda rule — saved config only.
      // Anonymous landing preset is applied in the !user mount effect above.
      if (user) {
        if (previewOverrides?.primary_color && previewOverrides?.logo_url === null) {
          const colorProfile = {
            ...mergedProfile,
            primary_color: previewOverrides.primary_color,
            brand_color: previewOverrides.brand_color || previewOverrides.primary_color,
            logo_url: null,
            logo_use_background: false,
          } as Profile
          applyLogoBackground(colorProfile, null, false)
          lastLogoBgRef.current = bgSignature
          return
        }

        const previewUrl =
          previewOverrides?.logo_url !== undefined ? previewOverrides.logo_url : undefined
        const previewUseBg =
          previewOverrides?.logo_use_background !== undefined
            ? previewOverrides.logo_use_background
            : undefined
        applyLogoBackground(mergedProfile, previewUrl, previewUseBg)
        lastLogoBgRef.current = bgSignature
        return
      }

      // Anonymous portal (has progress): honor draft/preview via merged path
      if (previewOverrides?.primary_color && previewOverrides?.logo_url === null) {
        const colorProfile = {
          ...mergedProfile,
          primary_color: previewOverrides.primary_color,
          brand_color: previewOverrides.brand_color || previewOverrides.primary_color,
          logo_url: null,
          logo_use_background: false,
        } as Profile
        applyLogoBackground(colorProfile, null, false)
        lastLogoBgRef.current = bgSignature
        return
      }

      const previewUrl =
        previewOverrides?.logo_url !== undefined ? previewOverrides.logo_url : undefined
      const previewUseBg =
        previewOverrides?.logo_use_background !== undefined
          ? previewOverrides.logo_use_background
          : undefined
      applyLogoBackground(mergedProfile, previewUrl, previewUseBg)
      lastLogoBgRef.current = bgSignature
    }, 200) // Debounce background updates
    
    return () => {
      if (logoBgTimeoutRef.current) clearTimeout(logoBgTimeoutRef.current)
    }
  }, [mergedProfile, previewOverrides, user])

  if (loading || migrating || (user && profileLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-emerald-500">
        <div className="animate-pulse">
          {migrating ? 'Saving your progress...' : 'Loading Sanctuary...'}
        </div>
      </div>
    )
  }

  const loggedInReady = Boolean(user) && !migrating
  // Portal-only: reuse existing poster/portal gates (do not invent a new portal test)
  const showSanctuaryAccordion =
    loggedInReady || (!user && hydrated && !isAnonymousPoster)

  const handleRetrySanctuarySave = async () => {
    if (!user?.id || sanctuarySaveRetrying) return
    setSanctuarySaveRetrying(true)
    setSanctuarySaveError(null)
    try {
      const draftKeys = getDraftAnsweredKeys()
      const continueAfterFreeTaste = isFreeTasteGateReached(draftKeys)
      await migrateAnonymousDraft(user.id)
      refreshDraft()
      await reloadAnsweredKeys()
      await reloadProfile()
      setSanctuarySaveError(null)
      if (continueAfterFreeTaste) {
        setActiveStepId('CURRENT_FOCUS_PILLAR')
      }
    } catch (err) {
      console.error('Draft migration retry failed:', err)
      setSanctuarySaveError(
        'Your account is connected, but your sanctuary has not finished saving yet. Your work is still safe in this browser. Try saving again.'
      )
    } finally {
      setSanctuarySaveRetrying(false)
    }
  }

  return (
    <div 
      className="flex min-h-screen flex-col items-center pt-10 px-6 pb-6 relative text-zinc-50 font-sans selection:bg-emerald-500/30"
    >
      <DataReset isAnonymous={!user} />
      {user && sanctuarySaveError ? (
        <div
          role="alert"
          className="w-full max-w-lg mx-auto mb-4 px-4 py-3 rounded-lg text-sm text-center"
          style={{
            background: 'rgba(6, 78, 59, 0.92)',
            border: '1px solid rgba(16, 185, 129, 0.5)',
            color: '#ecfdf5',
            lineHeight: 1.5,
          }}
        >
          <p style={{ margin: '0 0 12px' }}>{sanctuarySaveError}</p>
          <button
            type="button"
            onClick={() => void handleRetrySanctuarySave()}
            disabled={sanctuarySaveRetrying}
            style={{
              padding: '8px 16px',
              backgroundColor: '#047857',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: sanctuarySaveRetrying ? 'wait' : 'pointer',
              boxShadow: '0 0 5px rgba(255, 215, 0, 0.8)',
            }}
          >
            {sanctuarySaveRetrying ? 'Saving...' : 'Try saving again'}
          </button>
        </div>
      ) : null}
      {/* Poster: login-view only on empty anonymous first land. Portal: flex-start, no login-view. */}
      <main className={isAnonymousPoster ? 'app-main login-view' : 'app-main'}>
        {/* Band A — visual/identity/orbit (z-0). Empty in poster mode; portal after identity begins. */}
        <div className="text-center relative z-0">
          {loggedInReady ? (
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
              {showCarouselStage ? (
                <div 
                  ref={haloContainerRef}
                  className="relative w-full max-w-5xl mx-auto"
                  style={{ marginTop: '24px', marginBottom: '16px', overflow: 'visible' }}
                >
                  <OvalGlowBackdrop
                    containerRef={featuredContentRef}
                    primaryColor={currentPrimaryColor}
                    intensity={0.95}
                    zIndex={1}
                  />
                  
                  <OrbitPeekCarousel
                    items={carouselItems}
                    index={carouselIndex}
                    onIndexChange={(idx) => {
                      isUserSwipeRef.current = true
                      setCarouselIndex(idx)
                      carouselIndexRef.current = idx
                      const swipedItem = carouselItems[idx]
                      if (swipedItem?.stepId) {
                        window.dispatchEvent(new CustomEvent('cardNavigate', {
                          detail: { stepId: swipedItem.stepId, cardIndex: idx }
                        }))
                      }
                    }}
                    containerRef={featuredContentRef}
                    theme={{
                      fontFamily: mergedProfile?.font_family || undefined,
                      primaryColor: mergedProfile?.primary_color || mergedProfile?.brand_color || undefined,
                      accentColor: mergedProfile?.accent_color || mergedProfile?.brand_color || undefined
                    }}
                  />
                  
                  {showPhaseCoins ? (
                    <ArtisTalksOrbitRenderer
                      featuredContentRef={featuredContentRef}
                      chatRef={chatRef}
                      isOrbitAnimationPaused={isOrbitAnimationPaused}
                      phaseTokens={phaseTokens}
                      profile={profile}
                      progress={progress}
                      answeredKeys={effectiveAnsweredKeys}
                      isAnonymous={false}
                      isEarlyOnboarding={isEarlyOnboarding}
                    />
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}

          {!user && hydrated && !isAnonymousPoster ? (
            <>
              {anonymousLiveName.length > 0 && (
                <h1
                  className="text-4xl md:text-5xl font-bold tracking-wider mt-0 mb-1 transition-opacity"
                  style={{
                    fontFamily: chatProfile?.font_family || 'Geist Sans, sans-serif',
                    color: chatProfile?.accent_color || chatProfile?.brand_color || '#10b981',
                    position: 'relative',
                    zIndex: 100,
                    pointerEvents: 'none',
                    maxWidth: '85%',
                    margin: '0 auto',
                    lineHeight: '1.1',
                  }}
                >
                  {anonymousLiveName}
                </h1>
              )}

              {anonymousGiftSubtitle.length > 0 && (
                <p
                  className="text-lg md:text-xl text-zinc-400 mt-1 mb-2 font-light transition-all duration-500"
                  style={{
                    fontFamily: chatProfile?.font_family || 'Geist Sans, sans-serif',
                    color: chatProfile?.accent_color || chatProfile?.brand_color || '#a1a1aa',
                    opacity: 1,
                    position: 'relative',
                    zIndex: 101,
                  }}
                >
                  {anonymousGiftSubtitle}
                </p>
              )}

              {showCarouselStage ? (
                <div
                  ref={haloContainerRef}
                  className="relative w-full max-w-5xl mx-auto"
                  style={{ marginTop: '24px', marginBottom: '16px', overflow: 'visible' }}
                >
                  <OvalGlowBackdrop
                    containerRef={featuredContentRef}
                    primaryColor={currentPrimaryColor}
                    intensity={0.95}
                    zIndex={1}
                  />
                  <OrbitPeekCarousel
                    items={carouselItems}
                    index={carouselIndex}
                    onIndexChange={(idx) => {
                      isUserSwipeRef.current = true
                      setCarouselIndex(idx)
                      carouselIndexRef.current = idx
                      const swipedItem = carouselItems[idx]
                      if (swipedItem?.stepId) {
                        window.dispatchEvent(
                          new CustomEvent('cardNavigate', {
                            detail: { stepId: swipedItem.stepId, cardIndex: idx },
                          })
                        )
                      }
                    }}
                    containerRef={featuredContentRef}
                    theme={{
                      fontFamily: chatProfile?.font_family || undefined,
                      primaryColor: chatProfile?.primary_color || chatProfile?.brand_color || undefined,
                      accentColor: chatProfile?.accent_color || chatProfile?.brand_color || undefined,
                    }}
                  />
                  {showPhaseCoins ? (
                    <ArtisTalksOrbitRenderer
                      featuredContentRef={featuredContentRef}
                      chatRef={chatRef}
                      isOrbitAnimationPaused={isOrbitAnimationPaused}
                      phaseTokens={phaseTokens}
                      profile={chatProfile}
                      progress={progress}
                      answeredKeys={effectiveAnsweredKeys}
                      isAnonymous
                      isEarlyOnboarding={isEarlyOnboarding}
                    />
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {showSanctuaryAccordion ? (
          <SanctuaryAccordion
            answers={sanctuaryAnswers}
            accentColor={
              chatProfile?.accent_color || chatProfile?.brand_color || null
            }
            fontFamily={chatProfile?.font_family || null}
          />
        ) : null}
        
        {/* Band C — chat only. Poster: 100vh centered. Portal: auto height under Band A. */}
        <div
          className="action-section text-center relative z-10"
          style={{
            width: '100%',
            maxWidth: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: isAnonymousPoster ? '100vh' : 'auto',
          }}
        >
          {!user && hydrated && (
            <div ref={chatRef} className="w-full flex justify-center">
              <EmeraldChat {...emeraldChatProps} />
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
          {loggedInReady && (
            <div ref={chatRef} className="w-full flex justify-center">
              <EmeraldChat {...emeraldChatProps} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

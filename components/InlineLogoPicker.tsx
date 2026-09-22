'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/hooks/useProfile'
import { applyLogoBackground } from '@/utils/themeBackground'
import {
  saveDraftLogoAsset,
  getDraftLogoGeneration,
  isManagedDraftLogoUrl,
  releaseSessionLogoUrl,
  retainSessionLogoFile,
} from '@/lib/draftLogoAsset'
import {
  extractLogoPalette,
  type LogoPaletteGuess,
} from '@/utils/extractLogoPalette'

interface InlineLogoPickerProps {
  profile: Profile | null
  onLogoChange: (updates: Partial<Profile>) => void | Promise<void>
  onPreviewChange?: (previewUrl: string | null, useBackground: boolean) => void
  onPaletteExtracted?: (
    guess: LogoPaletteGuess,
    source: { logo_url: string | null; logo_use_background: boolean }
  ) => void
  onUploadingChange?: (uploading: boolean) => void
  sessionPreviewUrl?: string | null
}

export default function InlineLogoPicker({
  profile,
  onLogoChange,
  onPreviewChange,
  onPaletteExtracted,
  onUploadingChange,
  sessionPreviewUrl,
}: InlineLogoPickerProps) {
  const initialPreview =
    sessionPreviewUrl !== undefined ? sessionPreviewUrl : profile?.logo_url || null
  const [logoPreview, setLogoPreview] = useState<string | null>(initialPreview)
  const logoPreviewRef = useRef<string | null>(initialPreview)
  const extractGenerationRef = useRef(0)
  const [logoUseBackground, setLogoUseBackground] = useState(profile?.logo_use_background || false)
  const [isUploading, setIsUploading] = useState(false)
  const [assetError, setAssetError] = useState<string | null>(null)
  const [durabilityNote, setDurabilityNote] = useState<string | null>(null)

  const canUploadLogo = Boolean(profile?.id && profile.id !== 'anonymous')

  useEffect(() => () => { extractGenerationRef.current += 1 }, [])

  function stillCurrentLogoSelection(selection: number, generation: number) {
    return selection === extractGenerationRef.current && generation === getDraftLogoGeneration()
  }

  function publishLogoPalette(file: File, selection: number, generation: number) {
    void extractLogoPalette(file).then(guess => {
      if (!guess || !stillCurrentLogoSelection(selection, generation)) return
      onPaletteExtracted?.(guess, {
        logo_url: logoPreviewRef.current,
        logo_use_background: logoUseBackground,
      })
    }).catch(() => {})
  }

  async function acceptLogoUrl(
    url: string,
    file: File,
    selection: number,
    generation: number,
    previousUrl: string | null
  ) {
    await onLogoChange({ logo_url: url })
    if (!stillCurrentLogoSelection(selection, generation)) return false
    if (previousUrl && previousUrl !== url) releaseSessionLogoUrl(previousUrl)
    setLogoPreview(url)
    logoPreviewRef.current = url
    applyLogoBackground(profile, url, logoUseBackground)
    onPreviewChange?.(url, logoUseBackground)
    publishLogoPalette(file, selection, generation)
    return true
  }

  async function selectLocalLogo(file: File) {
    const selection = ++extractGenerationRef.current
    const generation = getDraftLogoGeneration()
    const previousUrl = logoPreviewRef.current
    const pendingUrl = URL.createObjectURL(file)
    let keepPending = false
    setAssetError(null)
    setDurabilityNote(null)
    setIsUploading(true)
    onUploadingChange?.(true)
    setLogoPreview(pendingUrl)
    logoPreviewRef.current = pendingUrl
    applyLogoBackground(profile, pendingUrl, logoUseBackground)
    try {
      let stored: { url: string } | null = null
      try {
        stored = await saveDraftLogoAsset(file)
      } catch {
        stored = null
      }
      if (!stillCurrentLogoSelection(selection, generation)) return
      if (stored) {
        try {
          await acceptLogoUrl(stored.url, file, selection, generation, previousUrl)
        } catch {
          if (!stillCurrentLogoSelection(selection, generation)) return
          if (previousUrl && previousUrl !== stored.url) releaseSessionLogoUrl(previousUrl)
          setLogoPreview(stored.url)
          logoPreviewRef.current = stored.url
          applyLogoBackground(profile, stored.url, logoUseBackground)
          onPreviewChange?.(stored.url, logoUseBackground)
          publishLogoPalette(file, selection, generation)
        }
        return
      }
      try {
        retainSessionLogoFile(file, pendingUrl, generation)
      } catch {
        if (!stillCurrentLogoSelection(selection, generation)) return
        setLogoPreview(previousUrl)
        logoPreviewRef.current = previousUrl
        applyLogoBackground(profile, previousUrl, logoUseBackground)
        setAssetError('This image could not be saved in this browser. Your previous logo is unchanged. Try selecting the image again.')
        return
      }
      if (!stillCurrentLogoSelection(selection, generation)) {
        releaseSessionLogoUrl(pendingUrl)
        return
      }
      keepPending = true
      try {
        const accepted = await acceptLogoUrl(pendingUrl, file, selection, generation, previousUrl)
        if (!accepted) {
          releaseSessionLogoUrl(pendingUrl)
          keepPending = false
          return
        }
      } catch {
        if (!stillCurrentLogoSelection(selection, generation)) {
          releaseSessionLogoUrl(pendingUrl)
          keepPending = false
          return
        }
        setLogoPreview(pendingUrl)
        logoPreviewRef.current = pendingUrl
        applyLogoBackground(profile, pendingUrl, logoUseBackground)
        onPreviewChange?.(pendingUrl, logoUseBackground)
        publishLogoPalette(file, selection, generation)
      }
      setDurabilityNote('This browser may not keep your logo after refresh.')
    } finally {
      if (!keepPending) URL.revokeObjectURL(pendingUrl)
      if (selection === extractGenerationRef.current) {
        setIsUploading(false)
        onUploadingChange?.(false)
      }
    }
  }

  useEffect(() => {
    logoPreviewRef.current = logoPreview
  }, [logoPreview])

  useEffect(() => {
    if (sessionPreviewUrl === undefined) return
    setLogoPreview(sessionPreviewUrl)
    logoPreviewRef.current = sessionPreviewUrl
  }, [sessionPreviewUrl])

  useEffect(() => {
    setLogoUseBackground(profile?.logo_use_background || false)
  }, [profile?.logo_use_background])

  useEffect(() => {
    onUploadingChange?.(isUploading)
  }, [isUploading, onUploadingChange])

  const cleanupReplacedLogos = async (userId: string, keepPath: string) => {
    try {
      const formData = new FormData()
      formData.append('userId', userId)
      formData.append('cleanupKeepPath', keepPath)
      await fetch('/api/uploadLogo', { method: 'POST', body: formData })
    } catch {
      // Orphans are safe. Never delete-first.
    }
  }

  const uploadLogoFile = async (file: File, userId: string) => {
    setIsUploading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        alert('You must be logged in to upload a logo')
        return
      }

      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('userId', userId);

      const response = await fetch('/api/uploadLogo', {
        method: 'POST',
        body: uploadFormData
      });

      const result = await response.json();

      if (response.ok) {
        setLogoPreview(result.logoUrl);
        logoPreviewRef.current = result.logoUrl;

        applyLogoBackground(profile, result.logoUrl, logoUseBackground);

        if (onPreviewChange) {
          onPreviewChange(result.logoUrl, logoUseBackground);
        }

        await Promise.resolve(onLogoChange({ logo_url: result.logoUrl }));
        if (result.logoPath) {
          void cleanupReplacedLogos(userId, result.logoPath);
        }
      } else {
        alert(result.error || 'Failed to upload logo');
      }
    } catch (error) {
      console.error('Logo upload error:', error);
      alert('Failed to upload logo');
    } finally {
      setIsUploading(false)
    }
  };

  return (
    <div className="space-y-2">
      <div>
        {logoPreview && (
          <div className="mb-2 relative inline-block">
            <button
              type="button"
              disabled={isUploading}
              onClick={async () => {
                extractGenerationRef.current += 1
                setAssetError(null)
                setDurabilityNote(null)
                setIsUploading(false)
                onUploadingChange?.(false)
                const currentUrl = logoPreviewRef.current
                try {
                  await onLogoChange({ logo_url: null, logo_use_background: false });
                  setLogoPreview(null);
                  logoPreviewRef.current = null;
                  setLogoUseBackground(false)
                  onPreviewChange?.(null, false);
                  applyLogoBackground(profile, null, false);
                  releaseSessionLogoUrl(currentUrl)
                } catch {
                  setLogoPreview(logoPreviewRef.current)
                  applyLogoBackground(profile, logoPreviewRef.current, logoUseBackground)
                  setAssetError('The logo could not be removed. Try again.')
                }
              }}
              className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold transition-colors shadow-lg z-10"
              title="Remove logo"
            >
              ×
            </button>
            <img
              src={logoPreview}
              alt="Logo preview"
              className="h-12 w-12 object-contain rounded border border-gray-600 bg-gray-800"
            />
          </div>
        )}

        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
              alert('Please upload an image file (JPG, PNG, SVG, or WebP)');
              return;
            }

            if (file.size > 5 * 1024 * 1024) {
              alert('File size must be less than 5MB');
              return;
            }

            if (!canUploadLogo) {
              void selectLocalLogo(file)
              e.target.value = ''
              return
            }

            if (logoPreview && logoPreview.startsWith('blob:') && !isManagedDraftLogoUrl(logoPreview)) {
              URL.revokeObjectURL(logoPreview);
            }
            const preview = URL.createObjectURL(file);
            setLogoPreview(preview);
            logoPreviewRef.current = preview;

            const extractGeneration = extractGenerationRef.current + 1
            extractGenerationRef.current = extractGeneration
            void extractLogoPalette(file)
              .then((guess) => {
                if (extractGeneration !== extractGenerationRef.current) return
                if (!guess || !onPaletteExtracted) return
                onPaletteExtracted(guess, {
                  logo_url: logoPreviewRef.current,
                  logo_use_background: logoUseBackground,
                })
              })
              .catch(() => {})

            applyLogoBackground(profile, preview, logoUseBackground);

            if (onPreviewChange) {
              onPreviewChange(preview, logoUseBackground);
            }

            if (canUploadLogo && profile?.id) {
              uploadLogoFile(file, profile.id);
            } else {
              onLogoChange({ logo_url: preview });
            }

            e.target.value = ''
          }}
          className="w-full p-2 bg-gray-700 text-white rounded-lg border border-gray-600 mb-2 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-500 file:text-white hover:file:bg-yellow-600"
          disabled={isUploading}
        />
        {assetError && <p role="alert" className="text-red-300 text-sm mb-2">{assetError}</p>}
        {durabilityNote && <p className="text-sm mb-2 text-[#fffacd]/80">{durabilityNote}</p>}

        <label
          className={`flex items-center gap-2.5 py-1 ${logoPreview ? 'cursor-pointer' : 'cursor-not-allowed'}`}
        >
          <input
            type="checkbox"
            checked={logoUseBackground}
            onChange={async (e) => {
              const checked = e.target.checked;
              const currentLogoUrl = logoPreviewRef.current || logoPreview || profile?.logo_url || null;
              setAssetError(null);
              try {
                await onLogoChange({ logo_use_background: checked });
                setLogoUseBackground(checked);
                applyLogoBackground(profile, currentLogoUrl, checked);
                onPreviewChange?.(currentLogoUrl, checked);
              } catch {
                setLogoUseBackground(logoUseBackground);
                applyLogoBackground(profile, currentLogoUrl, logoUseBackground);
                setAssetError('The background choice could not be saved. Your previous choice is unchanged. Try again.');
              }
            }}
            className="h-4 w-4 shrink-0 accent-[#FFD700] disabled:opacity-60"
            disabled={!logoPreview || isUploading}
          />
          <span
            className={`[text-shadow:0_1px_2px_rgba(0,0,0,0.7)] ${
              logoPreview ? 'text-[#fffacd]' : 'text-[#fffacd]/65'
            }`}
          >
            Use logo as page background
          </span>
        </label>
      </div>
    </div>
  )
}

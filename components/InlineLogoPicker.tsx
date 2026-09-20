'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/hooks/useProfile'
import { applyLogoBackground } from '@/utils/themeBackground'
import {
  extractLogoPalette,
  type LogoPaletteGuess,
} from '@/utils/extractLogoPalette'

interface InlineLogoPickerProps {
  profile: Profile | null
  onLogoChange: (updates: Partial<Profile>) => void
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

  const canUploadLogo = Boolean(profile?.id && profile.id !== 'anonymous')

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
              onClick={() => {
                extractGenerationRef.current += 1
                setLogoPreview(null);
                logoPreviewRef.current = null;
                onLogoChange({ logo_url: null, logo_use_background: false });
                if (onPreviewChange) {
                  onPreviewChange(null, false);
                }
                applyLogoBackground(profile, null, false);
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

            if (logoPreview && logoPreview.startsWith('blob:')) {
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

        <label
          className={`flex items-center gap-2.5 py-1 ${logoPreview ? 'cursor-pointer' : 'cursor-not-allowed'}`}
        >
          <input
            type="checkbox"
            checked={logoUseBackground}
            onChange={(e) => {
              const checked = e.target.checked;
              setLogoUseBackground(checked);

              const currentLogoUrl = logoPreviewRef.current || logoPreview || profile?.logo_url || null;
              const logoUrlToUse = checked ? currentLogoUrl : null;

              const updatedProfile = {
                ...profile,
                logo_use_background: checked,
                primary_color: profile?.primary_color,
                brand_color: profile?.brand_color || profile?.primary_color
              } as Profile;

              applyLogoBackground(updatedProfile, logoUrlToUse, checked);

              if (onPreviewChange) {
                onPreviewChange(logoUrlToUse, checked);
              }

              onLogoChange({ logo_use_background: checked });
            }}
            className="h-4 w-4 shrink-0 accent-[#FFD700] disabled:opacity-60"
            disabled={!logoPreview}
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

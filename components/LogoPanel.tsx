'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/hooks/useProfile'
import { applyLogoBackground } from '@/utils/themeBackground'

interface LogoPanelProps {
  profile: Profile | null
  onSave: (updates: Partial<Profile>) => void
  onClose: () => void
  onPreviewChange?: (previewUrl: string | null, useBackground: boolean) => void
}

export default function LogoPanel({ profile, onSave, onClose, onPreviewChange }: LogoPanelProps) {
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(profile?.logo_url || null)
  const logoPreviewRef = useRef<string | null>(profile?.logo_url || null)
  const [logoUseBackground, setLogoUseBackground] = useState(profile?.logo_use_background || false)
  const [isUploading, setIsUploading] = useState(false)
  const [isUploaded, setIsUploaded] = useState(!!profile?.logo_url) // Set to true if logo already exists

  // Update ref when preview changes
  useCallback(() => {
    logoPreviewRef.current = logoPreview
  }, [logoPreview])

  // Upload logo file to server - COPIED FROM ZEYODA ProfileEditPanel.tsx lines 148-206
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
        setIsUploaded(true);
        
        // Zeyoda pattern: Apply background IMMEDIATELY if checkbox is checked
        // Pass actual profile object, then preview values override
        applyLogoBackground(profile, result.logoUrl, logoUseBackground);
        
        // Update preview for live background
        if (onPreviewChange) {
          onPreviewChange(result.logoUrl, logoUseBackground);
        }
        // Update profile but don't close panel yet - let user confirm background
        onSave({ logo_url: result.logoUrl });
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

  const handleSave = async () => {
    if (logoPreview && profile?.id) {
      // Final save with background preference
      // Allow saving if logo exists (either from profile or newly uploaded)
      onSave({ 
        logo_url: logoPreview,
        logo_use_background: logoUseBackground 
      })
      
      // Save completion to curriculum_answers
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('curriculum_answers').upsert({
          user_id: user.id,
          question_key: 'logo_uploaded',
          answer_data: { 
            text: 'Logo uploaded', 
            url: logoPreview,
            step_id: 'LOGO_PANEL' // CRITICAL: Store stepId to fix duplicate key bug
          },
          project_id: null
        })
      }
      
      // Small delay to show confirmation, then advance
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('panelComplete', { 
          detail: { stepId: 'LOGO_PANEL' } 
        }))
        onClose()
      }, 500)
    }
  }

  return (
    <div className="space-y-6">
      {/* Logo Upload Section - COPIED FROM ZEYODA ProfileEditPanel.tsx lines 525-726 */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Logo Upload</h3>
        
        {/* Current logo preview */}
        {logoPreview && (
          <div className="mb-3 relative">
            <button
              onClick={() => {
                if (confirm('Are you sure you want to remove the logo?')) {
                  if (logoPreview.startsWith('blob:')) {
                    URL.revokeObjectURL(logoPreview);
                  }
                  setLogoPreview(null);
                  logoPreviewRef.current = null;
                  setLogoFile(null);
                  onSave({ logo_url: null, logo_use_background: false });
                }
              }}
              className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold transition-colors shadow-lg z-10"
              title="Remove logo"
            >
              ×
            </button>
            <img 
              src={logoPreview} 
              alt="Logo preview" 
              className="w-full h-64 object-contain rounded border border-gray-600 bg-gray-800"
            />
          </div>
        )}
        
        {/* File input - only preview, don't auto-upload */}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            
            // Validate file type
            if (!file.type.startsWith('image/')) {
              alert('Please upload an image file (JPG, PNG, SVG, or WebP)');
              return;
            }
            
            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
              alert('File size must be less than 5MB');
              return;
            }
            
            setLogoFile(file);
            setIsUploaded(false); // Reset upload status when new file selected
            // Revoke old preview URL to prevent memory leaks
            if (logoPreview && logoPreview.startsWith('blob:')) {
              URL.revokeObjectURL(logoPreview);
            }
            const preview = URL.createObjectURL(file);
            setLogoPreview(preview);
            logoPreviewRef.current = preview;
            
            // Zeyoda pattern: Apply background IMMEDIATELY when file selected
            // Pass actual profile object, then preview values override
            applyLogoBackground(profile, preview, logoUseBackground);
            
            // Update parent state for consistency
            if (onPreviewChange) {
              onPreviewChange(preview, logoUseBackground);
            }
            // Don't auto-upload - user clicks "Upload Logo" button instead
          }}
          className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 mb-3 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-500 file:text-white hover:file:bg-yellow-600"
          disabled={isUploading}
        />
        
        {/* Upload button - manual upload */}
        {logoFile && !isUploaded && (
          <button
            onClick={async () => {
              if (logoFile && profile?.id) {
                await uploadLogoFile(logoFile, profile.id);
              }
            }}
            disabled={isUploading}
            className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold mb-3"
          >
            {isUploading ? 'Uploading Logo...' : 'Upload Logo'}
          </button>
        )}
        
        {/* Checkbox - Use logo as background */}
        <label className="flex items-center text-white cursor-pointer">
          <input
            type="checkbox"
            checked={logoUseBackground}
            onChange={(e) => {
              const checked = e.target.checked;
              setLogoUseBackground(checked);
              
              // Zeyoda pattern: Apply background IMMEDIATELY (bypass React state batching)
              // Use ref to get latest logo URL (avoids stale closure)
              const currentLogoUrl = logoPreviewRef.current || logoPreview || profile?.logo_url || null;
              
              // Apply immediately (Zeyoda pattern - direct call, no state batching delay)
              // Pass actual profile object, then preview values override
              applyLogoBackground(profile, currentLogoUrl, checked);
              
              // Update parent state for consistency (but background already applied above)
              if (onPreviewChange) {
                onPreviewChange(currentLogoUrl, checked);
              }
              // Also save to profile if logo is already uploaded
              if (isUploaded && profile?.id) {
                onSave({ logo_use_background: checked });
              }
            }}
            className="mr-2 w-4 h-4"
            disabled={!logoPreview}
          />
          <span className={logoPreview ? '' : 'text-gray-500'}>
            Use logo as page background
          </span>
        </label>
        
        {/* Upload confirmation message */}
        {isUploaded && (
          <div className="mt-4 p-3 bg-emerald-900/30 border border-emerald-600 rounded-lg text-emerald-400 text-sm">
            ✅ Logo uploaded successfully! Check the background preview above, then click "Save & Continue" when ready.
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-700">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isUploading || !logoPreview}
          className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {isUploading ? 'Uploading...' : 'Save & Continue'}
        </button>
      </div>
    </div>
  )
}


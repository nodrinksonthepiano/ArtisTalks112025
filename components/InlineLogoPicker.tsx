'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/hooks/useProfile'
import { applyLogoBackground } from '@/utils/themeBackground'

interface InlineLogoPickerProps {
  profile: Profile | null
  onLogoChange: (updates: Partial<Profile>) => void // Autosave callback
  onPreviewChange?: (previewUrl: string | null, useBackground: boolean) => void
}

export default function InlineLogoPicker({ profile, onLogoChange, onPreviewChange }: InlineLogoPickerProps) {
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(profile?.logo_url || null)
  const logoPreviewRef = useRef<string | null>(profile?.logo_url || null)
  const [logoUseBackground, setLogoUseBackground] = useState(profile?.logo_use_background || false)
  const [isUploading, setIsUploading] = useState(false)
  
  // Update ref when preview changes
  useEffect(() => {
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
        
        // Zeyoda pattern: Apply background IMMEDIATELY if checkbox is checked
        applyLogoBackground(profile, result.logoUrl, logoUseBackground);
        
        // Update preview for live background
        if (onPreviewChange) {
          onPreviewChange(result.logoUrl, logoUseBackground);
        }
        
        // CRITICAL: Autosave immediately
        onLogoChange({ logo_url: result.logoUrl });
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
    <div className="space-y-4">
      {/* Logo Upload Section - COPIED FROM ZEYODA ProfileEditPanel.tsx lines 525-726 */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-2">Logo Upload</h3>
        
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
                  onLogoChange({ logo_url: null, logo_use_background: false });
                  applyLogoBackground(profile, null, false);
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
        
        {/* File input */}
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
            // Revoke old preview URL to prevent memory leaks
            if (logoPreview && logoPreview.startsWith('blob:')) {
              URL.revokeObjectURL(logoPreview);
            }
            const preview = URL.createObjectURL(file);
            setLogoPreview(preview);
            logoPreviewRef.current = preview;
            
            // Zeyoda pattern: Apply background IMMEDIATELY when file selected
            applyLogoBackground(profile, preview, logoUseBackground);
            
            // Update parent state for consistency
            if (onPreviewChange) {
              onPreviewChange(preview, logoUseBackground);
            }
            
            // Auto-upload immediately
            if (profile?.id) {
              uploadLogoFile(file, profile.id);
            }
          }}
          className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 mb-3 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-500 file:text-white hover:file:bg-yellow-600"
          disabled={isUploading}
        />
        
        {/* Checkbox - Use logo as background */}
        <label className="flex items-center text-white cursor-pointer">
          <input
            type="checkbox"
            checked={logoUseBackground}
            onChange={(e) => {
              const checked = e.target.checked;
              setLogoUseBackground(checked);
              
              // Zeyoda pattern: Apply background IMMEDIATELY (bypass React state batching)
              const currentLogoUrl = logoPreviewRef.current || logoPreview || profile?.logo_url || null;
              
              // CRITICAL: When unchecked, pass null for logo URL to force primary color
              // This ensures background reverts to primary color, not logo
              const logoUrlToUse = checked ? currentLogoUrl : null;
              
              // Build profile with updated logo_use_background to ensure correct fallback
              const updatedProfile = {
                ...profile,
                logo_use_background: checked,
                primary_color: profile?.primary_color,
                brand_color: profile?.brand_color || profile?.primary_color
              } as Profile;
              
              // Apply immediately (Zeyoda pattern - direct call, no state batching delay)
              // Pass null for logo URL when unchecked to force primary color branch
              applyLogoBackground(updatedProfile, logoUrlToUse, checked);
              
              // Update parent state for consistency
              if (onPreviewChange) {
                onPreviewChange(logoUrlToUse, checked);
              }
              
              // CRITICAL: Autosave immediately
              onLogoChange({ logo_use_background: checked });
            }}
            className="mr-2 w-4 h-4"
            disabled={!logoPreview}
          />
          <span className={logoPreview ? '' : 'text-gray-500'}>
            Use logo as page background
          </span>
        </label>
      </div>
    </div>
  )
}


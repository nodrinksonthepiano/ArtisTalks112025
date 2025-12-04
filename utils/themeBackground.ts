import { Profile } from '@/hooks/useProfile'

/**
 * Applies background with strict precedence (Zeyoda pattern):
 * 1) logo_url (if logo_use_background is true)
 * 2) primary_color (fallback)
 * 
 * Adapted from: zeyoda-nextjs-52925/app/utils/themeBackground.ts
 * Adds a cache-buster to applied *style* only (not stored), to avoid stale mobile caching.
 * No timers, no refs, no appMode checks.
 */
export function applyLogoBackground(
  profile: Profile | null,
  previewUrl?: string | null,
  previewUseBackground?: boolean
) {
  // Zeyoda pattern: Early return if no config, don't reset background
  // Zeyoda's applyArtistBackground just returns silently if !config
  if (!profile && previewUrl === undefined) {
    return; // Silent return, no warning, no reset - matches Zeyoda exactly
  }

  // Use preview values if provided, otherwise use saved profile values
  // null = explicitly cleared, undefined = use profile
  const logoUrl = previewUrl !== undefined ? previewUrl : (profile?.logo_url || null);
  const useBackground = previewUseBackground !== undefined 
    ? previewUseBackground 
    : (profile?.logo_use_background || false);

  // Build theme object from profile (mirror Zeyoda's theme structure)
  // Zeyoda lines 18-28: Use fallback theme if missing
  const primary = profile?.brand_color || profile?.primary_color || 
    (typeof document !== 'undefined' 
      ? document.documentElement.style.getPropertyValue('--primary-color') || '#0a0a0a'
      : '#0a0a0a');
  
  const accent = profile?.accent_color || 
    (typeof document !== 'undefined'
      ? document.documentElement.style.getPropertyValue('--accent-color') || '#10b981'
      : '#10b981');
  
  const fontFamily = profile?.font_family || 'Geist Sans, sans-serif';

  // SSR guard
  if (typeof document === 'undefined') return;

  // Zeyoda lines 30-32: Always keep core theme variables current
  document.documentElement.style.setProperty("--primary-color", primary);

  // CRITICAL: Only set accent color CSS vars if accent color is provided AND different from current
  // This prevents accent color from being overwritten when only primary color changes
  // Accent color CSS vars should only be updated by updateAccentColor, not here
  if (accent) {
    const currentAccent = document.documentElement.style.getPropertyValue('--accent-color');
    // Only update if accent color actually changed (prevents overwriting when primary changes)
    if (currentAccent !== accent) {
      document.documentElement.style.setProperty("--accent-color", accent);
      document.documentElement.style.setProperty(
        "--accent-color-rgb",
        accent.match(/\d+/g)?.join(", ") ?? "0,0,0"
      );
    }
  }

  // Zeyoda lines 42-44: Set gradient variables (using primary as fallback)
  document.documentElement.style.setProperty("--gradient-start", primary);
  document.documentElement.style.setProperty("--gradient-middle", primary);
  document.documentElement.style.setProperty("--gradient-end", primary);

  // Zeyoda line 45: Set font family
  document.body.style.fontFamily = fontFamily;

  // Zeyoda line 47: Clear legacy background var
  document.documentElement.style.setProperty("--background", "transparent");

  // Zeyoda line 49: Cache-buster
  const ts = `?v=${Date.now()}`;

  // Zeyoda lines 89-120: CRITICAL - Logo branch with explicit boolean check
  if (logoUrl && useBackground === true) {
    // Skip cache-busting for blob URLs (they can't have query params)
    const isBlobUrl = logoUrl.startsWith('blob:');
    const cacheBustedLogoUrl = isBlobUrl ? logoUrl : `${logoUrl}${ts}`;
    
    console.log('[applyLogoBackground] ✅ BRANCH: logo', {
      url: logoUrl,
      cacheBuster: isBlobUrl ? 'skipped (blob URL)' : ts,
      logo_use_background: useBackground,
      logo_url_present: !!logoUrl,
      logo_use_background_type: typeof useBackground,
      logo_use_background_value: useBackground
    });
    
    // Zeyoda lines 95-96: CRITICAL - Set primary color as fallback FIRST
    document.body.style.setProperty("background-color", primary, "important");
    document.body.style.setProperty("background", primary, "important");
    
    // Zeyoda lines 98-115: Preload image and apply once loaded
    const img = new Image();
    img.onload = () => {
      // Zeyoda lines 100-106: Image loaded - apply it atomically
      const bgStyle = `${primary} url(${cacheBustedLogoUrl}) center/cover no-repeat`;
      document.body.style.setProperty("background-image", `url(${cacheBustedLogoUrl})`, "important");
      document.body.style.setProperty("background-size", "cover", "important"); /* EXACT from Zeyoda - fit to screen */
      document.body.style.setProperty("background-position", "center", "important");
      document.body.style.setProperty("background-repeat", "no-repeat", "important");
      document.body.style.setProperty("background-color", primary, "important");
      document.body.style.setProperty("background", bgStyle, "important");
      
      console.log('[applyLogoBackground] ✅ Logo image loaded and applied', { url: cacheBustedLogoUrl });
    };
    img.onerror = () => {
      // Zeyoda lines 107-110: Image failed to load - keep primary color
      console.warn('[applyLogoBackground] ⚠️ Logo image failed to load, keeping primary color');
      document.body.style.setProperty("background-color", primary, "important");
      document.body.style.setProperty("background", primary, "important");
    };
    
    // Zeyoda line 115: Start loading (if cached, onload fires immediately)
    img.src = cacheBustedLogoUrl;
    
    // Zeyoda line 117: Clear CSS variable
    document.documentElement.style.setProperty("--background", primary);
    return;
  }

  // Zeyoda lines 122-127: Fallback - primary color only
  console.log('[applyLogoBackground] ⚠️ BRANCH: primary_color (fallback)', {
    primaryColor: primary,
    reason: !logoUrl ? 'no logo_url' : useBackground !== true ? `logo_use_background=${useBackground} (not true)` : 'unknown',
    logo_url: logoUrl,
    logo_use_background: useBackground,
    logo_use_background_type: typeof useBackground
  });
  // Zeyoda lines 124-127: CRITICAL - Clear ALL background styles and set primary color
  document.body.style.setProperty("background-image", "none", "important");
  document.body.style.setProperty("background-color", primary, "important");
  document.body.style.setProperty("background", primary, "important");
  
  document.documentElement.style.setProperty("--background", primary);
}


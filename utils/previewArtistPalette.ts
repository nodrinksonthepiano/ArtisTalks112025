import { Profile } from '@/hooks/useProfile'
import { applyLogoBackground } from '@/utils/themeBackground'

/** Live Page preview only. Does not persist profile or draft. */
export function previewArtistPalette(args: {
  primary: string
  accent: string
  pop?: string | null
  logoUrl?: string | null
  logoUseBackground?: boolean
  fontFamily?: string | null
  bodyFontFamily?: string | null
}): void {
  if (typeof document === 'undefined') return

  document.documentElement.style.setProperty('--primary-color', args.primary)
  document.documentElement.style.setProperty('--accent-color', args.accent)
  document.documentElement.style.setProperty(
    '--accent-color-rgb',
    hexToRgbList(args.accent)
  )
  const pop = args.pop || '#ffffff'
  document.documentElement.style.setProperty('--pop-color', pop)
  document.documentElement.style.setProperty('--main-light', `color-mix(in srgb, ${args.primary} 70%, white)`)
  document.documentElement.style.setProperty('--main-shadow', `color-mix(in srgb, ${args.primary} 70%, black)`)
  document.documentElement.style.setProperty('--main-soft', `color-mix(in srgb, ${args.primary} 78%, white)`)
  document.documentElement.style.setProperty('--main-deep', `color-mix(in srgb, ${args.primary} 78%, black)`)
  document.documentElement.style.setProperty('--support-soft', `color-mix(in srgb, ${args.accent} 78%, white)`)
  document.documentElement.style.setProperty('--support-deep', `color-mix(in srgb, ${args.accent} 78%, black)`)
  document.documentElement.style.setProperty('--pop-light', `color-mix(in srgb, ${pop} 68%, white)`)
  document.documentElement.style.setProperty('--pop-glow', `color-mix(in srgb, ${pop} 82%, transparent)`)

  const headerElement = document.querySelector('h1')
  if (headerElement) {
    headerElement.style.color = args.accent
  }

  const logoUrl = args.logoUrl ?? null
  const logoUseBackground = args.logoUseBackground === true
  applyLogoBackground(
    {
      primary_color: args.primary,
      accent_color: args.accent,
      pop_color: args.pop ?? null,
      brand_color: args.primary,
      font_family: args.fontFamily ?? null,
      body_font_family: args.bodyFontFamily ?? null,
      logo_url: logoUrl,
      logo_use_background: logoUseBackground,
    } as Profile,
    logoUrl,
    logoUseBackground
  )

  window.dispatchEvent(
    new CustomEvent('primaryColorChange', { detail: { color: args.primary } })
  )
  window.dispatchEvent(
    new CustomEvent('profilePreview', {
      detail: {
        previewConfig: {
          primary_color: args.primary,
          accent_color: args.accent,
          pop_color: args.pop ?? null,
          brand_color: args.primary,
        },
      },
    })
  )
}

function hexToRgbList(hex: string): string {
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  if (full.length !== 6) return '0, 0, 0'
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if ([r, g, b].some((n) => Number.isNaN(n))) return '0, 0, 0'
  return `${r}, ${g}, ${b}`
}

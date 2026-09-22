export const VIBE_OPTIONS = [
  { value: 'glow', label: 'Glow' },
  { value: 'stained-glass', label: 'Stained Glass' },
  { value: 'kaleidoscope', label: 'Kaleidoscope' },
  { value: 'mandala', label: 'Mandala' },
] as const

export type PageVibe = (typeof VIBE_OPTIONS)[number]['value']

export function isPageVibe(value: unknown): value is PageVibe {
  return VIBE_OPTIONS.some(option => option.value === value)
}

export function normalizePageVibe(value: unknown): PageVibe {
  return isPageVibe(value) ? value : 'glow'
}

type RGB = readonly [number, number, number]

function rgb(value: string | null | undefined, fallback: RGB): RGB {
  const raw = value?.trim()
  const hex = raw?.replace(/^#/, '')
  if (hex && /^[\da-f]{3}$/i.test(hex)) {
    return [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16)]
  }
  if (hex && /^[\da-f]{6}$/i.test(hex)) {
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
  }
  const match = raw?.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i)
  const channel = (index: number) => Math.min(255, Math.max(0, Number(match?.[index])))
  return match ? [channel(1), channel(2), channel(3)] : fallback
}

function mix(first: RGB, second: RGB, amount: number): RGB {
  const channel = (index: number) => Math.round(first[index] * (1 - amount) + second[index] * amount)
  return [channel(0), channel(1), channel(2)]
}

function hex(color: RGB): string {
  return `#${color.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('')}`
}

function luminance(color: RGB): number {
  const linear = color.map(channel => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  })
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

function contrastRatio(surface: number, foreground: number): number {
  const lighter = Math.max(surface, foreground)
  const darker = Math.min(surface, foreground)
  return (lighter + 0.05) / (darker + 0.05)
}

function rgbToHsl(color: RGB): { h: number; s: number; l: number } {
  const r = color[0] / 255
  const g = color[1] / 255
  const b = color[2] / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const delta = max - min
  if (delta === 0) return { h: 0, s: 0, l }
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / delta + 2) / 6
  else h = ((r - g) / delta + 4) / 6
  return { h, s, l }
}

function hslToRgb(h: number, s: number, l: number): RGB {
  if (s === 0) {
    const gray = Math.round(l * 255)
    return [gray, gray, gray]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (amount: number) => {
    let t = amount
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [
    Math.round(channel(h + 1 / 3) * 255),
    Math.round(channel(h) * 255),
    Math.round(channel(h - 1 / 3) * 255),
  ]
}

/** Smallest lightness move that reaches the card-text contrast floor. Hue and saturation stay. */
function readableLightness(surface: number, h: number, s: number, start: number): number {
  const ratioAt = (lightness: number) => contrastRatio(surface, luminance(hslToRgb(h, s, lightness)))
  const solve = (end: number) => {
    let near = start
    let far = end
    for (let step = 0; step < 20; step++) {
      const mid = (near + far) / 2
      if (ratioAt(mid) >= 4.5) far = mid
      else near = mid
    }
    return far
  }
  const options = [0, 1].filter(end => ratioAt(end) >= 4.5).map(solve)
  if (options.length === 0) return ratioAt(0) >= ratioAt(1) ? 0 : 1
  return options.reduce((best, lightness) => (
    Math.abs(lightness - start) < Math.abs(best - start) ? lightness : best
  ))
}

/** Render-only colors. Artist palette values are never changed or persisted here. */
export function deriveVibeAppearance(primary?: string, accent?: string, pop?: string | null) {
  const main = rgb(primary, [10, 26, 59])
  const support = rgb(accent, [167, 226, 240])
  const light = mix(main, [255, 255, 255], 0.56)
  const shadow = mix(main, [5, 9, 18], 0.58)
  const hasPop = Boolean(pop?.trim())
  // None remains None: derived light provides depth without inventing a third color.
  const highlight = hasPop ? mix(rgb(pop, light), [255, 255, 255], 0.22) : mix(main, [255, 255, 255], 0.78)
  const seam = luminance(main) > 0.34 ? mix(main, [31, 24, 20], 0.72) : mix(main, [0, 0, 0], 0.55)
  // Light travels through each palette region independently; materials never blend
  // Main and Support into a single wash or change the saved artist colors.
  const material = (color: RGB) => ({
    base: hex(color),
    light: hex(mix([
      Math.min(255, color[0] * 1.45),
      Math.min(255, color[1] * 1.45),
      Math.min(255, color[2] * 1.45),
    ], [255, 255, 255], 0.08)),
    gleam: hex(mix(color, [255, 255, 255], 0.76)),
    shade: hex(mix(color, [0, 0, 0], 0.24)),
    deep: hex(mix(color, [0, 0, 0], 0.48)),
  })
  return {
    main: hex(main), support: hex(support), light: hex(light), shadow: hex(shadow),
    highlight: hex(highlight), pop: hasPop ? hex(rgb(pop, light)) : null, seam: hex(seam), hasPop,
    mainRGB: main.join(', '), supportRGB: support.join(', '), lightRGB: light.join(', '),
    shadowRGB: shadow.join(', '), highlightRGB: highlight.join(', '),
    materials: { main: material(main), support: material(support) },
    facets: [
      hex(mix(main, light, 0.2)), hex(mix(main, shadow, 0.25)),
      hex(mix(main, support, 0.34)), hex(mix(support, light, 0.22)),
      hex(mix(main, light, 0.46)), hex(mix(support, shadow, 0.22)),
    ],
  }
}

/** Render-only card text. Keeps the accent hue; lightness moves only when contrast is short. */
export function readableVibeForeground(background: string, preferred: string): string {
  const surface = luminance(rgb(background, [10, 26, 59]))
  const preferredRgb = rgb(preferred, [167, 226, 240])
  if (contrastRatio(surface, luminance(preferredRgb)) >= 4.5) return preferred
  const { h, s, l } = rgbToHsl(preferredRgb)
  return hex(hslToRgb(h, s, readableLightness(surface, h, s, l)))
}

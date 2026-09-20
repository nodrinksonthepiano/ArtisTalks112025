/**
 * Client-side logo palette guess (60 Main / 30 Support / 10 Pop).
 * Samples a local File / blob. Does not persist. Does not invent colors from prose.
 */

export type LogoPaletteGuess = {
  primary: string
  accent: string
  pop: string
}

export const FALLBACK_GOLD = '#FFD700'
export const FALLBACK_SILVER = '#C0C0C0'

const SAMPLE_SIZE = 64
const MIN_ALPHA = 96
const NEAR_WHITE = 248
const NEAR_BLACK = 12
const QUANT = 4
const MIN_HUE_SEP = 22
const MIN_RGB_SEP = 42

type Rgb = { r: number; g: number; b: number }
type Cluster = Rgb & { count: number; sat: number; light: number }

let stashedSuggestion: LogoPaletteGuess | null = null

export function stashLogoPaletteSuggestion(guess: LogoPaletteGuess): void {
  stashedSuggestion = guess
}

export function getLogoPaletteSuggestion(): LogoPaletteGuess | null {
  return stashedSuggestion
}

export function clearLogoPaletteSuggestion(): void {
  stashedSuggestion = null
}

export async function extractLogoPalette(
  file: File
): Promise<LogoPaletteGuess | null> {
  if (typeof document === 'undefined') return null
  if (!file || file.size === 0) return null
  if (file.type && !file.type.startsWith('image/')) return null

  const canvas = await rasterizeLogoFile(file)
  if (!canvas) return null

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  let imageData: ImageData
  try {
    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  } catch {
    return null
  }

  return guessPaletteFromRgba(imageData.data)
}

export function guessPaletteFromRgba(
  data: Uint8ClampedArray
): LogoPaletteGuess | null {
  const opaque = collectOpaquePixels(data)
  if (opaque.length === 0) return null

  const colorful = opaque.filter((p) => !isNearWhite(p) && !isNearBlack(p))
  const source = colorful.length > 0 ? colorful : opaque
  const clusters = clusterPixels(source)
  if (clusters.length === 0) return null

  const ranked = rankClusters(clusters)
  const primaryRgb = ranked[0]
  const accentRgb = pickSupport(ranked, primaryRgb)
  const popRgb = pickPop(ranked, primaryRgb, accentRgb)

  return {
    primary: rgbToHex(primaryRgb),
    accent: rgbToHex(accentRgb),
    pop: rgbToHex(popRgb),
  }
}

function collectOpaquePixels(data: Uint8ClampedArray): Rgb[] {
  const pixels: Rgb[] = []
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a < MIN_ALPHA) continue
    pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] })
  }
  return pixels
}

function clusterPixels(pixels: Rgb[]): Cluster[] {
  const buckets = new Map<number, Cluster>()
  for (const p of pixels) {
    const key =
      ((p.r >> QUANT) << 8) | ((p.g >> QUANT) << 4) | (p.b >> QUANT)
    const existing = buckets.get(key)
    if (existing) {
      existing.r += p.r
      existing.g += p.g
      existing.b += p.b
      existing.count += 1
    } else {
      buckets.set(key, { r: p.r, g: p.g, b: p.b, count: 1, sat: 0, light: 0 })
    }
  }

  const averaged: Cluster[] = []
  for (const bucket of buckets.values()) {
    const r = Math.round(bucket.r / bucket.count)
    const g = Math.round(bucket.g / bucket.count)
    const b = Math.round(bucket.b / bucket.count)
    const { s, l } = rgbToHsl(r, g, b)
    averaged.push({ r, g, b, count: bucket.count, sat: s, light: l })
  }

  return mergeNearDuplicates(averaged)
}

function mergeNearDuplicates(clusters: Cluster[]): Cluster[] {
  const sorted = [...clusters].sort((a, b) => b.count - a.count)
  const merged: Cluster[] = []
  for (const cluster of sorted) {
    const near = merged.find(
      (other) => rgbDistance(cluster, other) < MIN_RGB_SEP
    )
    if (!near) {
      merged.push({ ...cluster })
      continue
    }
    const total = near.count + cluster.count
    near.r = Math.round((near.r * near.count + cluster.r * cluster.count) / total)
    near.g = Math.round((near.g * near.count + cluster.g * cluster.count) / total)
    near.b = Math.round((near.b * near.count + cluster.b * cluster.count) / total)
    near.count = total
    const hsl = rgbToHsl(near.r, near.g, near.b)
    near.sat = hsl.s
    near.light = hsl.l
  }
  return merged
}

function rankClusters(clusters: Cluster[]): Cluster[] {
  return [...clusters].sort((a, b) => scoreCluster(b) - scoreCluster(a))
}

function scoreCluster(cluster: Cluster): number {
  const midLight = 1 - Math.abs(cluster.light - 0.5) * 1.4
  const satBoost = 0.4 + cluster.sat
  return cluster.count * Math.max(0.15, midLight) * satBoost
}

function pickSupport(ranked: Cluster[], primary: Cluster): Rgb {
  for (let i = 1; i < ranked.length; i += 1) {
    const candidate = ranked[i]
    if (!isDistinct(primary, candidate)) continue
    if (isMuddyGray(candidate) && candidate.sat < primary.sat * 0.5) continue
    return candidate
  }
  return fallbackSupport(primary)
}

function isDistinct(a: Rgb, b: Rgb): boolean {
  if (rgbDistance(a, b) >= MIN_RGB_SEP) return true
  const ha = rgbToHsl(a.r, a.g, a.b).h
  const hb = rgbToHsl(b.r, b.g, b.b).h
  return hueDistance(ha, hb) >= MIN_HUE_SEP
}

function fallbackSupport(primary: Cluster): Rgb {
  const hex = isGoldish(primary) ? FALLBACK_SILVER : FALLBACK_GOLD
  return hexToRgb(hex)
}

function pickPop(ranked: Cluster[], primary: Rgb, accent: Rgb): Rgb {
  for (const candidate of ranked) {
    if (!isDistinct(primary, candidate) || !isDistinct(accent, candidate)) continue
    if (isMuddyGray(candidate)) continue
    return candidate
  }

  const fallback =
    isGoldish(primary) || isGoldish(accent) ? FALLBACK_SILVER : FALLBACK_GOLD
  return hexToRgb(fallback)
}

function isGoldish(rgb: Rgb): boolean {
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b)
  return s > 0.32 && l > 0.28 && l < 0.88 && h >= 28 && h <= 62
}

function isMuddyGray(rgb: Rgb): boolean {
  const { s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b)
  return s < 0.12 && l > 0.18 && l < 0.82
}

function isNearWhite(p: Rgb): boolean {
  return p.r >= NEAR_WHITE && p.g >= NEAR_WHITE && p.b >= NEAR_WHITE
}

function isNearBlack(p: Rgb): boolean {
  return p.r <= NEAR_BLACK && p.g <= NEAR_BLACK && p.b <= NEAR_BLACK
}

function rgbDistance(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
  else if (max === gn) h = ((bn - rn) / d + 2) * 60
  else h = ((rn - gn) / d + 4) * 60
  return { h, s, l }
}

function rgbToHex(rgb: Rgb): string {
  const to = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

async function rasterizeLogoFile(file: File): Promise<HTMLCanvasElement | null> {
  try {
    if (
      typeof createImageBitmap === 'function' &&
      file.type !== 'image/svg+xml'
    ) {
      const bitmap = await createImageBitmap(file)
      const canvas = drawToSampleCanvas(bitmap)
      bitmap.close()
      if (canvas) return canvas
    }
  } catch {
    // SVG and some types need the <img> path.
  }

  try {
    const image = await loadImageFromFile(file)
    return drawToSampleCanvas(image)
  } catch {
    return null
  }
}

function drawToSampleCanvas(
  source: CanvasImageSource & { width: number; height: number }
): HTMLCanvasElement | null {
  const sourceWidth = source.width
  const sourceHeight = source.height
  if (!sourceWidth || !sourceHeight) return null

  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_SIZE
  canvas.height = SAMPLE_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  ctx.clearRect(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
  const scale = Math.min(SAMPLE_SIZE / sourceWidth, SAMPLE_SIZE / sourceHeight)
  const w = Math.max(1, sourceWidth * scale)
  const h = Math.max(1, sourceHeight * scale)
  ctx.drawImage(source, (SAMPLE_SIZE - w) / 2, (SAMPLE_SIZE - h) / 2, w, h)
  return canvas
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('logo rasterize failed'))
    }
    image.src = url
  })
}

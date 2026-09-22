import type { PageVibe } from '@/utils/vibeAppearance'

/** Card and vibe arrivals share this duration. The loop stops when it elapses. */
export const MORPH_MS = 1900

export const GLASS_MIRRORS = [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const
export const GLASS_PANE_ROLES = ['support', 'main', 'main', 'main', 'support', 'support', 'support', 'main', 'main'] as const

const GLASS_STEPS = 24
const BAND_GAP = 48

export type GlassParams = {
  centerRadius: number
  petalStart: number
  petalEnd: number
  petalReach: number
  petalExponent: number
  shoulderReach: number
  shoulderExponent: number
  shoulderBelly: number
  midBase: number
  midReach: number
  midExponent: number
  midBelly: number
  outerBase: number
  outerReach: number
  outerExponent: number
  outerBelly: number
  glintScale: number
}

export type KaleidoscopeParams = {
  radii: [number, number, number, number, number]
  bulge: [number, number, number, number, number]
  split: number
}

export type MandalaRingParams = {
  inner: number
  outer: number
  widthScale: number
  spread: number
  tip: number
}

export type MandalaParams = {
  rosetteInner: number
  rosetteOuter: number
  rings: MandalaRingParams[]
  beadOrbit: [number, number, number]
  beadSize: [number, number, number]
}

export type VibeGeometry =
  | { kind: 'stained-glass'; params: GlassParams }
  | { kind: 'kaleidoscope'; params: KaleidoscopeParams }
  | { kind: 'mandala'; params: MandalaParams }

export const MANDALA_RINGS = [
  { count: 8, kind: 'lotus', role: 'support', level: 'primary', turn: 0 },
  { count: 8, kind: 'lance', role: 'main', level: 'secondary', turn: 22.5 },
  { count: 12, kind: 'round', role: 'main', level: 'secondary', turn: 0 },
  { count: 16, kind: 'lotus', role: 'support', level: 'primary', turn: 0 },
  { count: 24, kind: 'arch', role: 'main', level: 'quiet', turn: 0 },
  { count: 12, kind: 'lance', role: 'support', level: 'primary', turn: 15 },
  { count: 24, kind: 'round', role: 'main', level: 'secondary', turn: 0 },
  { count: 32, kind: 'arch', role: 'support', level: 'quiet', turn: 0 },
  { count: 16, kind: 'lotus', role: 'main', level: 'secondary', turn: 0 },
] as const

export const MANDALA_BEADS = [
  { host: 1, count: 12, role: 'support', baseOrbit: 158, baseSize: 7 },
  { host: 3, count: 24, role: 'main', baseOrbit: 408, baseSize: 5.5 },
  { host: 4, count: 16, role: 'support', baseOrbit: 555, baseSize: 8 },
] as const

const MANDALA_BASE_RINGS: readonly MandalaRingParams[] = [
  { inner: 34, outer: 112, widthScale: 1, spread: 1, tip: 1 },
  { inner: 116, outer: 168, widthScale: 1, spread: 1, tip: 1 },
  { inner: 162, outer: 268, widthScale: 1, spread: 1, tip: 1 },
  { inner: 278, outer: 402, widthScale: 1, spread: 1, tip: 1 },
  { inner: 414, outer: 548, widthScale: 1, spread: 1, tip: 1 },
  { inner: 568, outer: 820, widthScale: 1, spread: 1, tip: 1 },
  { inner: 848, outer: 1140, widthScale: 1, spread: 1, tip: 1 },
  { inner: 1170, outer: 1560, widthScale: 1, spread: 1, tip: 1 },
  { inner: 1600, outer: 2140, widthScale: 1, spread: 1, tip: 1 },
]

const KALEIDO_RANGES: readonly (readonly [number, number])[] = [
  [110, 230],
  [250, 430],
  [520, 780],
  [1100, 1500],
  [2200, 2900],
]

type Pt = [number, number]
type Rng = () => number

export type GlassDraw = { panes: string[]; glints: string[]; seam: string; center: number }
export type KaleidoscopeDraw = { ring0: string; support: string[]; main: string[]; seam: string; metal: string }
export type MandalaDraw = {
  petals: string[]
  diamonds: (string | null)[]
  ringRadius: number[]
  rosetteOuter: number
  rosetteInner: number
  beadCy: number[]
  beadR: number[]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function fmt(value: number) {
  const rounded = Math.round(value * 10) / 10
  return Math.abs(rounded) < 0.05 ? '0' : String(rounded)
}

function polar(angle: number, radius: number): Pt {
  return [Math.cos(angle) * radius, -Math.sin(angle) * radius]
}

function outline(points: readonly Pt[]) {
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`).join('') + 'Z'
}

function openLine(points: readonly Pt[]) {
  if (points.length === 0) return ''
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`).join('')
}

function curvedSector(start: number, end: number, innerAt: (t: number) => number, outerAt: (t: number) => number) {
  const points: Pt[] = []
  for (let i = 0; i <= GLASS_STEPS; i++) points.push(polar(start + (end - start) * (i / GLASS_STEPS), outerAt(i / GLASS_STEPS)))
  for (let i = GLASS_STEPS; i >= 0; i--) points.push(polar(start + (end - start) * (i / GLASS_STEPS), innerAt(i / GLASS_STEPS)))
  return outline(points)
}

function arc(start: number, end: number, radiusAt: (t: number) => number) {
  const points: Pt[] = []
  for (let i = 0; i <= GLASS_STEPS; i++) {
    const t = i / GLASS_STEPS
    points.push(polar(start + (end - start) * t, radiusAt(t)))
  }
  return points
}

export function morphEase(t: number) {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

function lerpTree(a: unknown, b: unknown, t: number): unknown {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t
  if (Array.isArray(a) && Array.isArray(b)) return a.map((item, index) => lerpTree(item, b[index], t))
  if (a && b && typeof a === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(a as object)) {
      out[key] = lerpTree((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], t)
    }
    return out
  }
  return b
}

function addTree(base: unknown, delta: unknown): unknown {
  if (typeof base === 'number') return base + (typeof delta === 'number' && Number.isFinite(delta) ? delta : 0)
  if (Array.isArray(base)) return base.map((item, index) => addTree(item, Array.isArray(delta) ? delta[index] : undefined))
  if (base && typeof base === 'object') {
    const source = delta && typeof delta === 'object' ? delta as Record<string, unknown> : {}
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(base as object)) out[key] = addTree((base as Record<string, unknown>)[key], source[key])
    return out
  }
  return base
}

/** Endpoints only. Frames lerp the stored numbers so the ease is not reshaped. */
export function lerpGeometry(from: VibeGeometry, to: VibeGeometry, t: number): VibeGeometry {
  if (from.kind !== to.kind) return to
  const u = clamp(t, 0, 1)
  if (u <= 0) return from
  if (u >= 1) return to
  if (from.kind === 'stained-glass' && to.kind === 'stained-glass') {
    return { kind: 'stained-glass', params: lerpTree(from.params, to.params, u) as GlassParams }
  }
  if (from.kind === 'kaleidoscope' && to.kind === 'kaleidoscope') {
    return { kind: 'kaleidoscope', params: lerpTree(from.params, to.params, u) as KaleidoscopeParams }
  }
  if (from.kind === 'mandala' && to.kind === 'mandala') {
    return { kind: 'mandala', params: lerpTree(from.params, to.params, u) as MandalaParams }
  }
  return to
}

/** Future music offsets add onto the posed parameters. Null leaves the pose unchanged. */
export function addOffsets(geometry: VibeGeometry, offsets: VibeGeometry | null): VibeGeometry {
  if (!offsets || offsets.kind !== geometry.kind) return geometry
  if (geometry.kind === 'stained-glass' && offsets.kind === 'stained-glass') {
    return { kind: 'stained-glass', params: addTree(geometry.params, offsets.params) as GlassParams }
  }
  if (geometry.kind === 'kaleidoscope' && offsets.kind === 'kaleidoscope') {
    return { kind: 'kaleidoscope', params: addTree(geometry.params, offsets.params) as KaleidoscopeParams }
  }
  if (geometry.kind === 'mandala' && offsets.kind === 'mandala') {
    return { kind: 'mandala', params: addTree(geometry.params, offsets.params) as MandalaParams }
  }
  return geometry
}

export function isFiniteGeometry(geometry: VibeGeometry) {
  const stack: unknown[] = [geometry.params]
  while (stack.length > 0) {
    const value = stack.pop()
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return false
    } else if (Array.isArray(value)) stack.push(...value)
    else if (value && typeof value === 'object') stack.push(...Object.values(value))
  }
  return true
}

function glassBase(): GlassParams {
  return {
    centerRadius: 188,
    petalStart: 0.52,
    petalEnd: Math.PI / 2 - 0.52,
    petalReach: 268,
    petalExponent: 0.72,
    shoulderReach: 286,
    shoulderExponent: 0.82,
    shoulderBelly: 74,
    midBase: 690,
    midReach: 360,
    midExponent: 0.68,
    midBelly: 0.18,
    outerBase: 1280,
    outerReach: 980,
    outerExponent: 0.68,
    outerBelly: 0.18,
    glintScale: 1,
  }
}

function shoulderRadius(t: number, params: GlassParams) {
  const axis = Math.pow(Math.cos(t * Math.PI * 0.5), params.shoulderExponent)
  return params.centerRadius + params.shoulderReach * axis + params.shoulderBelly * Math.sin(t * Math.PI)
}

function petalRadius(t: number, params: GlassParams) {
  return params.centerRadius + params.petalReach * Math.pow(Math.sin(t * Math.PI), params.petalExponent)
}

function roseRadius(t: number, start: number, end: number, base: number, reach: number, exponent: number, belly: number) {
  const angle = start + (end - start) * t
  const rose = Math.pow(Math.max(0, Math.sin(angle * 2)), exponent)
  return base + reach * rose + reach * belly * Math.sin(t * Math.PI)
}

type GlassSector = { kind: 'left' | 'petal' | 'right'; start: number; end: number }

function glassSectors(params: GlassParams): GlassSector[] {
  return [
    { kind: 'left', start: 0, end: params.petalStart },
    { kind: 'petal', start: params.petalStart, end: params.petalEnd },
    { kind: 'right', start: params.petalEnd, end: Math.PI / 2 },
  ]
}

function band0At(sector: GlassSector, t: number, params: GlassParams) {
  if (sector.kind === 'petal') return petalRadius(t, params)
  if (sector.kind === 'left') return shoulderRadius(t, params)
  return shoulderRadius(1 - t, params)
}

function band1At(sector: GlassSector, t: number, params: GlassParams) {
  return roseRadius(t, sector.start, sector.end, params.midBase, params.midReach, params.midExponent, params.midBelly)
}

function band2At(sector: GlassSector, t: number, params: GlassParams) {
  return roseRadius(t, sector.start, sector.end, params.outerBase, params.outerReach, params.outerExponent, params.outerBelly)
}

function maxOver(params: GlassParams, radiusAt: (sector: GlassSector, t: number, params: GlassParams) => number) {
  let max = 0
  for (const sector of glassSectors(params)) {
    for (let i = 0; i <= GLASS_STEPS; i++) max = Math.max(max, radiusAt(sector, i / GLASS_STEPS, params))
  }
  return max
}

export function legalizeGlass(input: GlassParams): GlassParams {
  const params: GlassParams = {
    ...input,
    centerRadius: clamp(input.centerRadius, 150, 230),
    petalReach: clamp(input.petalReach, 180, 360),
    petalExponent: clamp(input.petalExponent, 0.5, 1.05),
    shoulderReach: clamp(input.shoulderReach, 200, 380),
    shoulderExponent: clamp(input.shoulderExponent, 0.55, 1.15),
    shoulderBelly: clamp(input.shoulderBelly, 20, 140),
    midReach: clamp(input.midReach, 240, 520),
    midExponent: clamp(input.midExponent, 0.5, 0.9),
    midBelly: clamp(input.midBelly, 0.08, 0.28),
    outerReach: clamp(input.outerReach, 700, 1200),
    outerExponent: clamp(input.outerExponent, 0.5, 0.9),
    outerBelly: clamp(input.outerBelly, 0.08, 0.28),
    glintScale: clamp(input.glintScale, 0.7, 1.45),
    petalStart: clamp(input.petalStart, 0.36, 0.7),
    petalEnd: clamp(input.petalEnd, 0.9, 1.22),
    midBase: input.midBase,
    outerBase: input.outerBase,
  }
  if (params.petalEnd - params.petalStart < 0.42) {
    const mid = (params.petalStart + params.petalEnd) / 2
    params.petalStart = clamp(mid - 0.21, 0.36, 0.7)
    params.petalEnd = clamp(mid + 0.21, 0.9, 1.22)
    if (params.petalEnd - params.petalStart < 0.42) {
      params.petalStart = 0.52
      params.petalEnd = Math.PI / 2 - 0.52
    }
  }
  params.midBase = Math.max(params.midBase, maxOver(params, band0At) + BAND_GAP)
  params.outerBase = Math.max(params.outerBase, maxOver(params, band1At) + BAND_GAP)
  return params
}

function sparkPath(angle: number, radius: number, reach: number) {
  const [x, y] = polar(angle, radius)
  const half = reach * 0.36
  return `M${fmt(x)} ${fmt(y - reach)}L${fmt(x + half)} ${fmt(y)}L${fmt(x)} ${fmt(y + reach)}L${fmt(x - half)} ${fmt(y)}Z`
}

export function drawGlass(params: GlassParams): GlassDraw {
  const sectors = glassSectors(params)
  const left = sectors[0]
  const petal = sectors[1]
  const right = sectors[2]
  const panes = [
    curvedSector(petal.start, petal.end, () => params.centerRadius, t => band0At(petal, t, params)),
    curvedSector(left.start, left.end, () => params.centerRadius, t => band0At(left, t, params)),
    curvedSector(right.start, right.end, () => params.centerRadius, t => band0At(right, t, params)),
    curvedSector(petal.start, petal.end, t => band0At(petal, t, params), t => band1At(petal, t, params)),
    curvedSector(left.start, left.end, t => band0At(left, t, params), t => band1At(left, t, params)),
    curvedSector(right.start, right.end, t => band0At(right, t, params), t => band1At(right, t, params)),
    curvedSector(petal.start, petal.end, t => band1At(petal, t, params), t => band2At(petal, t, params)),
    curvedSector(left.start, left.end, t => band1At(left, t, params), t => band2At(left, t, params)),
    curvedSector(right.start, right.end, t => band1At(right, t, params), t => band2At(right, t, params)),
  ]
  const glints = [
    sparkPath(Math.PI / 4, band0At(petal, 0.5, params), 16 * params.glintScale),
    sparkPath(0.18, shoulderRadius(0.18 / params.petalStart, params), 9 * params.glintScale),
    sparkPath(Math.PI / 4, band1At(petal, 0.5, params), 11 * params.glintScale),
  ]
  const mirrored: Pt[][] = []
  for (const sector of sectors) {
    mirrored.push(arc(sector.start, sector.end, t => band0At(sector, t, params)))
    mirrored.push(arc(sector.start, sector.end, t => band1At(sector, t, params)))
    mirrored.push(arc(sector.start, sector.end, t => band2At(sector, t, params)))
  }
  const ray = (angle: number, endRadius: number): Pt[] => [polar(angle, params.centerRadius), polar(angle, endRadius)]
  mirrored.push(ray(params.petalStart, band2At(petal, 0, params)))
  mirrored.push(ray(params.petalEnd, band2At(right, 0, params)))
  let seam = ''
  for (const [sx, sy] of GLASS_MIRRORS) {
    for (const sub of mirrored) seam += openLine(sub.map(([x, y]) => [x * sx, y * sy]))
  }
  const axisReach = params.outerBase
  seam += openLine([[params.centerRadius, 0], [axisReach, 0]])
  seam += openLine([[-params.centerRadius, 0], [-axisReach, 0]])
  seam += openLine([[0, -params.centerRadius], [0, -axisReach]])
  seam += openLine([[0, params.centerRadius], [0, axisReach]])
  return { panes, glints, seam, center: params.centerRadius }
}

const KALEIDO_HALF = Math.PI / 8
const CHORD_STEPS = 16

function kaleidoBase(): KaleidoscopeParams {
  return {
    radii: [160, 320, 640, 1280, 2560],
    bulge: [0, 0, 0, 0, 0],
    split: 0.5,
  }
}

function shoulderPoint(radius: number): Pt {
  return [radius * Math.tan(KALEIDO_HALF), -radius]
}

function sampleChord(radius: number, bulge: number): Pt[] {
  const start: Pt = [0, -radius]
  const end = shoulderPoint(radius)
  const mid: Pt = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]
  const len = Math.hypot(mid[0], mid[1]) || 1
  const control: Pt = [mid[0] + (mid[0] / len) * bulge, mid[1] + (mid[1] / len) * bulge]
  const points: Pt[] = []
  for (let i = 0; i <= CHORD_STEPS; i++) {
    const t = i / CHORD_STEPS
    const u = 1 - t
    points.push([
      u * u * start[0] + 2 * u * t * control[0] + t * t * end[0],
      u * u * start[1] + 2 * u * t * control[1] + t * t * end[1],
    ])
  }
  return points
}

function pointOn(samples: readonly Pt[], t: number): Pt {
  const scaled = clamp(t, 0, 1) * (samples.length - 1)
  const index = Math.min(samples.length - 2, Math.floor(scaled))
  const fraction = scaled - index
  const from = samples[index]
  const toward = samples[Math.min(samples.length - 1, index + 1)]
  return [from[0] + (toward[0] - from[0]) * fraction, from[1] + (toward[1] - from[1]) * fraction]
}

function sliceChord(samples: readonly Pt[], fromT: number, toT: number): Pt[] {
  const forward = toT >= fromT
  const startT = forward ? fromT : toT
  const endT = forward ? toT : fromT
  const start = pointOn(samples, startT)
  const end = pointOn(samples, endT)
  const n = samples.length - 1
  const first = Math.floor(startT * n) + 1
  const last = Math.floor(endT * n)
  const middle = samples.slice(first, last + 1).filter(point => Math.hypot(point[0] - start[0], point[1] - start[1]) > 0.05)
  const points = [start, ...middle]
  const tail = points[points.length - 1]
  if (Math.hypot(tail[0] - end[0], tail[1] - end[1]) > 0.05) points.push(end)
  return forward ? points : points.reverse()
}

function splitTs(split: number) {
  const slide = clamp((split - 0.5) / 0.12, -1, 1)
  return {
    innerT: slide > 0 ? slide * 0.55 : 0,
    outerT: slide < 0 ? 1 + slide * 0.55 : 1,
  }
}

export function legalizeKaleidoscope(input: KaleidoscopeParams): KaleidoscopeParams {
  const radii = input.radii.map((radius, index) => clamp(radius, KALEIDO_RANGES[index][0], KALEIDO_RANGES[index][1])) as KaleidoscopeParams['radii']
  for (let index = 1; index < radii.length; index++) {
    if (radii[index] < radii[index - 1] + 70) radii[index] = radii[index - 1] + 70
  }
  for (let index = radii.length - 1; index >= 1; index--) {
    if (radii[index] > KALEIDO_RANGES[index][1]) radii[index] = KALEIDO_RANGES[index][1]
    if (radii[index] < radii[index - 1] + 70) radii[index - 1] = Math.max(KALEIDO_RANGES[index - 1][0], radii[index] - 70)
  }
  const bulge = radii.map((radius, index) => {
    const previous = index === 0 ? 0 : radii[index - 1]
    const nextGap = index < radii.length - 1 ? radii[index + 1] - radius : radius - previous
    const limit = 0.22 * Math.min(radius - previous, nextGap)
    return clamp(input.bulge[index], -limit, limit)
  }) as KaleidoscopeParams['bulge']
  return { radii, bulge, split: clamp(input.split, 0.38, 0.62) }
}

function rotatePt(point: Pt, degrees: number): Pt {
  const angle = degrees * Math.PI / 180
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [point[0] * c - point[1] * s, point[0] * s + point[1] * c]
}

function bakeCopies(subpaths: readonly (readonly Pt[])[], mirrored: boolean) {
  let d = ''
  for (let step = 0; step < 8; step++) {
    const flips = mirrored ? [1, -1] : [1]
    for (const flip of flips) {
      for (const sub of subpaths) d += openLine(sub.map(point => rotatePt([point[0] * flip, point[1]], step * 45)))
    }
  }
  return d
}

export function drawKaleidoscope(params: KaleidoscopeParams): KaleidoscopeDraw {
  const { innerT, outerT } = splitTs(params.split)
  const chords = params.radii.map((radius, index) => sampleChord(radius, params.bulge[index]))
  const outer0 = chords[0]
  const ring0 = outline([[0, 0], ...[...outer0].reverse()])
  const support: string[] = []
  const main: string[] = []
  const splits: Pt[][] = []
  for (let ring = 1; ring < params.radii.length; ring++) {
    const inner = chords[ring - 1]
    const outer = chords[ring]
    const supportPts = [...sliceChord(inner, innerT, 1), ...sliceChord(outer, 1, outerT)]
    const mainPts = [...sliceChord(inner, 0, innerT), ...sliceChord(outer, outerT, 0)]
    support.push(outline(supportPts))
    main.push(outline(mainPts))
    splits.push([pointOn(inner, innerT), pointOn(outer, outerT)])
  }
  const outer = params.radii[4]
  const radials: Pt[][] = [
    [[0, 0], [0, -outer]],
    [[0, 0], shoulderPoint(outer)],
  ]
  return {
    ring0,
    support,
    main,
    seam: bakeCopies(chords, true) + bakeCopies(splits, true) + bakeCopies(radials, false),
    metal: bakeCopies(splits, true),
  }
}

/** Chord samples at bulge 0, for the straight-edge proof. */
export function kaleidoscopeChordSamples(radius: number, bulge: number) {
  return sampleChord(radius, bulge)
}

function mandalaBase(): MandalaParams {
  return {
    rosetteInner: 18,
    rosetteOuter: 48,
    rings: MANDALA_BASE_RINGS.map(ring => ({ ...ring })),
    beadOrbit: [158, 408, 555],
    beadSize: [7, 5.5, 8],
  }
}

function sideAt(inner: number, length: number, fraction: number, spread: number) {
  if (spread === 1) return inner + length * fraction
  const placed = fraction + (spread - 1) * (0.5 - fraction) * 0.25
  return inner + length * clamp(placed, 0.02, 0.98)
}

function tipAt(inner: number, length: number, fraction: number, tip: number) {
  if (tip === 1) return inner + length * fraction
  const placed = fraction + (tip - 1) * (1 - fraction) * 0.45
  return inner + length * clamp(placed, 0.02, 0.98)
}

export function mandalaPetalPath(inner: number, outer: number, count: number, kind: (typeof MANDALA_RINGS)[number]['kind'], widthScale: number, spread: number, tip: number) {
  const length = outer - inner
  const width = Math.sin((Math.PI / count) * 0.78) * ((inner + outer) / 2) * widthScale
  const y = (radius: number) => fmt(-radius)
  const side = (scale: number) => fmt(spread === 1 ? width * scale : width * scale * spread)
  const point = (scale: number) => fmt(tip === 1 ? width * scale : width * scale * (2 - tip))
  const atSide = (fraction: number) => fmt(-sideAt(inner, length, fraction, spread))
  const atTip = (fraction: number) => fmt(-tipAt(inner, length, fraction, tip))
  if (kind === 'round') {
    return `M0 ${y(inner)}C${side(-1.05)} ${atSide(0.42)} ${point(-0.7)} ${atTip(0.95)} 0 ${y(outer)}C${point(0.7)} ${atTip(0.95)} ${side(1.05)} ${atSide(0.42)} 0 ${y(inner)}Z`
  }
  if (kind === 'lotus') {
    return `M0 ${y(inner)}C${side(-0.22)} ${atSide(0.16)} ${side(-1)} ${atSide(0.58)} ${point(-0.16)} ${atTip(0.92)}C${point(-0.05)} ${y(outer)} 0 ${y(outer)} 0 ${y(outer)}C0 ${y(outer)} ${point(0.05)} ${y(outer)} ${point(0.16)} ${atTip(0.92)}C${side(1)} ${atSide(0.58)} ${side(0.22)} ${atSide(0.16)} 0 ${y(inner)}Z`
  }
  if (kind === 'arch') {
    return `M0 ${y(inner)}C${side(-0.18)} ${atSide(0.22)} ${side(-1)} ${atSide(0.62)} ${point(-1)} ${atTip(0.84)}C${point(-0.55)} ${y(outer)} 0 ${y(outer)} 0 ${y(outer)}C0 ${y(outer)} ${point(0.55)} ${y(outer)} ${point(1)} ${atTip(0.84)}C${side(1)} ${atSide(0.62)} ${side(0.18)} ${atSide(0.22)} 0 ${y(inner)}Z`
  }
  return `M0 ${y(inner)}C${side(-0.62)} ${atSide(0.34)} ${point(-0.28)} ${atTip(0.72)} 0 ${y(outer)}C${point(0.28)} ${atTip(0.72)} ${side(0.62)} ${atSide(0.34)} 0 ${y(inner)}Z`
}

export function legalizeMandala(input: MandalaParams): MandalaParams {
  const rings = input.rings.map((ring, index) => {
    const base = MANDALA_BASE_RINGS[index]
    const baseLength = base.outer - base.inner
    let inner = ring.inner
    let outer = ring.outer
    const minLength = baseLength * 0.62
    const maxLength = baseLength * 1.38
    if (outer < inner + minLength) outer = inner + minLength
    if (outer > inner + maxLength) outer = inner + maxLength
    if (inner < 16) {
      outer += 16 - inner
      inner = 16
    }
    return {
      inner,
      outer,
      widthScale: clamp(ring.widthScale, 0.72, 1.28),
      spread: clamp(ring.spread, 0.75, 1.3),
      tip: clamp(ring.tip, 0.75, 1.3),
    }
  })
  for (let index = 0; index < rings.length - 1; index++) {
    const baseGap = MANDALA_BASE_RINGS[index + 1].inner - MANDALA_BASE_RINGS[index].outer
    const gap = clamp(rings[index + 1].inner - rings[index].outer, baseGap - 12, baseGap + 12)
    const next = rings[index + 1]
    const baseLength = MANDALA_BASE_RINGS[index + 1].outer - MANDALA_BASE_RINGS[index + 1].inner
    next.inner = rings[index].outer + gap
    if (next.outer < next.inner + baseLength * 0.62) next.outer = next.inner + baseLength * 0.62
    if (next.outer > next.inner + baseLength * 1.38) next.outer = next.inner + baseLength * 1.38
  }
  const rosetteInner = clamp(input.rosetteInner, 12, 28)
  let rosetteOuter = clamp(input.rosetteOuter, 32, 70)
  if (rosetteOuter < rosetteInner + 8) rosetteOuter = rosetteInner + 8
  const rosetteCap = rings[0].inner + 20
  if (rosetteOuter > rosetteCap) rosetteOuter = Math.max(rosetteInner + 8, rosetteCap)
  const beadOrbit: MandalaParams['beadOrbit'] = [0, 0, 0]
  const beadSize: MandalaParams['beadSize'] = [0, 0, 0]
  MANDALA_BEADS.forEach((bead, index) => {
    const host = rings[bead.host]
    if (index === 0) {
      const low = host.inner + 8
      const high = Math.max(low, host.outer - 6)
      beadOrbit[index] = clamp(input.beadOrbit[index], low, high)
    } else {
      beadOrbit[index] = host.outer + clamp(input.beadOrbit[index] - host.outer, 2, 14)
    }
    beadSize[index] = clamp(input.beadSize[index], bead.baseSize * 0.7, bead.baseSize * 1.35)
  })
  return { rosetteInner, rosetteOuter, rings, beadOrbit, beadSize }
}

export function drawMandala(params: MandalaParams): MandalaDraw {
  const petals = params.rings.map((ring, index) => {
    const meta = MANDALA_RINGS[index]
    return mandalaPetalPath(ring.inner, ring.outer, meta.count, meta.kind, ring.widthScale, ring.spread, ring.tip)
  })
  const diamonds = params.rings.map((ring, index) => (
    MANDALA_RINGS[index].level === 'primary'
      ? `M0 ${fmt(-(ring.outer - 7))} l4.5 7.5 -4.5 7.5 -4.5 -7.5Z`
      : null
  ))
  return {
    petals,
    diamonds,
    ringRadius: params.rings.map(ring => ring.outer + 5),
    rosetteOuter: params.rosetteOuter,
    rosetteInner: params.rosetteInner,
    beadCy: params.beadOrbit.map(orbit => -orbit),
    beadR: [...params.beadSize],
  }
}

function randomGlass(rng: Rng): GlassParams {
  const pick = (min: number, max: number) => min + rng() * (max - min)
  return legalizeGlass({
    centerRadius: pick(150, 230),
    petalStart: pick(0.36, 0.7),
    petalEnd: pick(0.9, 1.22),
    petalReach: pick(180, 360),
    petalExponent: pick(0.5, 1.05),
    shoulderReach: pick(200, 380),
    shoulderExponent: pick(0.55, 1.15),
    shoulderBelly: pick(20, 140),
    midBase: pick(620, 860),
    midReach: pick(240, 520),
    midExponent: pick(0.5, 0.9),
    midBelly: pick(0.08, 0.28),
    outerBase: pick(1100, 1500),
    outerReach: pick(700, 1200),
    outerExponent: pick(0.5, 0.9),
    outerBelly: pick(0.08, 0.28),
    glintScale: pick(0.7, 1.45),
  })
}

function randomKaleidoscope(rng: Rng): KaleidoscopeParams {
  const pick = (min: number, max: number) => min + rng() * (max - min)
  return legalizeKaleidoscope({
    radii: KALEIDO_RANGES.map(([min, max]) => pick(min, max)) as KaleidoscopeParams['radii'],
    bulge: [0, 1, 2, 3, 4].map(() => pick(-500, 500)) as KaleidoscopeParams['bulge'],
    split: pick(0.38, 0.62),
  })
}

function randomMandala(rng: Rng): MandalaParams {
  const pick = (min: number, max: number) => min + rng() * (max - min)
  return legalizeMandala({
    rosetteInner: pick(12, 28),
    rosetteOuter: pick(32, 70),
    rings: MANDALA_BASE_RINGS.map(ring => ({
      inner: ring.inner + pick(-18, 18),
      outer: ring.outer + pick(-28, 28),
      widthScale: pick(0.72, 1.28),
      spread: pick(0.75, 1.3),
      tip: pick(0.75, 1.3),
    })),
    beadOrbit: [pick(130, 165), pick(390, 430), pick(540, 575)],
    beadSize: [pick(7 * 0.7, 7 * 1.35), pick(5.5 * 0.7, 5.5 * 1.35), pick(8 * 0.7, 8 * 1.35)],
  })
}

export function baseGeometry(vibe: PageVibe): VibeGeometry | null {
  if (vibe === 'stained-glass') return { kind: 'stained-glass', params: glassBase() }
  if (vibe === 'kaleidoscope') return { kind: 'kaleidoscope', params: kaleidoBase() }
  if (vibe === 'mandala') return { kind: 'mandala', params: mandalaBase() }
  return null
}

export function sampleGeometry(vibe: PageVibe, rng: Rng): VibeGeometry | null {
  if (vibe === 'stained-glass') return { kind: 'stained-glass', params: randomGlass(rng) }
  if (vibe === 'kaleidoscope') return { kind: 'kaleidoscope', params: randomKaleidoscope(rng) }
  if (vibe === 'mandala') return { kind: 'mandala', params: randomMandala(rng) }
  return null
}

export function drawGeometry(geometry: VibeGeometry): GlassDraw | KaleidoscopeDraw | MandalaDraw {
  if (geometry.kind === 'stained-glass') return drawGlass(geometry.params)
  if (geometry.kind === 'kaleidoscope') return drawKaleidoscope(geometry.params)
  return drawMandala(geometry.params)
}

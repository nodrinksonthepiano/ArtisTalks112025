/**
 * Focused checks for logo File/blob palette guessing (60/30/10).
 * Run: npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/verify-logo-palette.ts
 */
import { guessPaletteFromRgba } from '../utils/extractLogoPalette'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function fillRect(
  data: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  g: number,
  b: number,
  a = 255
) {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * width + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = a
    }
  }
}

{
  const data = new Uint8ClampedArray(64 * 64 * 4)
  assert(guessPaletteFromRgba(data) === null, 'fully transparent → no guess')
}

{
  const data = new Uint8ClampedArray(64 * 64 * 4)
  fillRect(data, 64, 0, 0, 32, 64, 200, 24, 24)
  fillRect(data, 64, 32, 0, 64, 64, 24, 48, 200)
  const guess = guessPaletteFromRgba(data)
  assert(!!guess, 'red/blue logo yields a guess')
  const hexes = [guess!.primary, guess!.accent]
  const rgbs = hexes.map((hex) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }))
  assert(
    rgbs.some((c) => c.r > c.b && c.r > c.g + 40),
    `expected a red-family color, got ${hexes.join(' ')}`
  )
  assert(
    rgbs.some((c) => c.b > c.r && c.b > c.g + 40),
    `expected a blue-family color, got ${hexes.join(' ')}`
  )
  assert(guess!.primary !== guess!.accent, '60 and 30 must differ')
  assert(guess!.pop === '#ffd700', `two-color logo should fall back to Gold Pop, got ${guess!.pop}`)
}

{
  const data = new Uint8ClampedArray(64 * 64 * 4)
  fillRect(data, 64, 0, 0, 32, 64, 200, 24, 24)
  fillRect(data, 64, 32, 0, 64, 32, 24, 48, 200)
  fillRect(data, 64, 32, 32, 64, 64, 24, 180, 72)
  const guess = guessPaletteFromRgba(data)
  assert(!!guess, 'red/blue/green logo yields a guess')
  const colors = [guess!.primary, guess!.accent, guess!.pop]
  assert(new Set(colors).size === 3, `three-color logo should yield three roles, got ${colors.join(' ')}`)
  assert(guess!.pop !== '#ffd700', 'useful third Logo color should win over Gold fallback')
}

{
  const data = new Uint8ClampedArray(64 * 64 * 4)
  fillRect(data, 64, 0, 0, 64, 64, 252, 252, 252)
  fillRect(data, 64, 20, 20, 44, 44, 16, 16, 16)
  const guess = guessPaletteFromRgba(data)
  assert(!!guess, 'near-white field with a dark mark still yields a guess')
  assert(guess!.primary !== guess!.accent, 'mono-ish logo still gets two crayons')
  assert(guess!.pop === '#c0c0c0', `Gold support should cause Silver Pop, got ${guess!.pop}`)
}

{
  const data = new Uint8ClampedArray(64 * 64 * 4)
  fillRect(data, 64, 0, 0, 48, 64, 214, 168, 32)
  fillRect(data, 64, 48, 0, 64, 64, 24, 24, 24)
  const guess = guessPaletteFromRgba(data)
  assert(!!guess, 'gold/dark logo yields a guess')
  assert(guess!.pop === '#c0c0c0', `gold-heavy palette should suggest Silver Pop, got ${guess!.pop}`)
}

console.log('verify-logo-palette: ok')

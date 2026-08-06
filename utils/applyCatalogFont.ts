import {
  FEATURED_FONTS,
  getFontEntryByValue,
  normalizeFontFamilyValue,
} from '@/lib/fontCatalog'
import { applyFontToDocument, ensureFontLoaded } from '@/utils/loadWebFont'

export type ApplyCatalogFontResult =
  | { ok: true; fontValue: string }
  | { ok: false; error: string }

/**
 * Load → wait → apply. On failure, document styles are unchanged.
 */
export async function preloadFeaturedFonts(): Promise<Set<string>> {
  const ready = new Set<string>()
  for (const font of FEATURED_FONTS) {
    try {
      await ensureFontLoaded(font)
      ready.add(font.value)
    } catch {
      // Preload failure is non-fatal; button falls back until user selects
    }
  }
  return ready
}

export async function applyCatalogFont(
  fontValue: string
): Promise<ApplyCatalogFontResult> {
  const normalized = normalizeFontFamilyValue(fontValue)
  const entry = getFontEntryByValue(normalized)
  if (!entry) {
    return { ok: false, error: 'That font is not available.' }
  }

  try {
    await ensureFontLoaded(entry)
    applyFontToDocument(entry.value)
    return { ok: true, fontValue: entry.value }
  } catch {
    return { ok: false, error: `Could not load ${entry.name}.` }
  }
}

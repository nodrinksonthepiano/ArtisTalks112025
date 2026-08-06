import { getFontEntryByValue } from '@/lib/fontCatalog'
import { applyFontToDocument, ensureFontLoaded } from '@/utils/loadWebFont'

export type ApplyCatalogFontResult =
  | { ok: true; fontValue: string }
  | { ok: false; error: string }

/**
 * Load → wait → apply. On failure, document styles are unchanged.
 */
export async function applyCatalogFont(
  fontValue: string
): Promise<ApplyCatalogFontResult> {
  const entry = getFontEntryByValue(fontValue)
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

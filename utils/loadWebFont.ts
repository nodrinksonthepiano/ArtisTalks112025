import {
  type FontCatalogEntry,
  getFontEntryByValue,
  primaryFamilyName,
} from '@/lib/fontCatalog'

const injectedStylesheets = new Set<string>()

function injectStylesheet(url: string): Promise<void> {
  if (injectedStylesheets.has(url)) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    link.onload = () => {
      injectedStylesheets.add(url)
      resolve()
    }
    link.onerror = () => reject(new Error('Failed to load font stylesheet'))
    document.head.appendChild(link)
  })
}

async function waitForFontFamily(fontValue: string): Promise<void> {
  const family = primaryFamilyName(fontValue)
  const spec = `16px ${fontValue}`

  try {
    await document.fonts.load(spec)
  } catch {
    // load() may reject; check() is the final gate
  }

  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (document.fonts.check(spec)) return
    await new Promise((r) => setTimeout(r, 50))
  }

  if (!document.fonts.check(spec)) {
    throw new Error(`Font failed to load: ${family}`)
  }
}

/**
 * Load a catalog font and confirm the browser can render it.
 * Geist and system fonts skip network fetch.
 */
export async function ensureFontLoaded(entry: FontCatalogEntry): Promise<void> {
  if (typeof document === 'undefined') return

  if (entry.source === 'google') {
    if (!entry.googleStylesheetUrl) {
      throw new Error(`Missing Google stylesheet URL for ${entry.name}`)
    }
    await injectStylesheet(entry.googleStylesheetUrl)
  }

  await waitForFontFamily(entry.value)
}

export async function ensureFontLoadedByValue(fontValue: string): Promise<void> {
  const entry = getFontEntryByValue(fontValue)
  if (!entry) {
    throw new Error('Font is not in the catalog')
  }
  await ensureFontLoaded(entry)
}

export function applyFontToDocument(fontValue: string): void {
  if (typeof document === 'undefined') return
  document.body.style.fontFamily = fontValue
  const headerElement = document.querySelector('h1')
  if (headerElement) {
    headerElement.style.fontFamily = fontValue
  }
}

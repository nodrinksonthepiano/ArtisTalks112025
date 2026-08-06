export type FontSource = 'geist' | 'system' | 'google'

export interface FontCatalogEntry {
  name: string
  value: string
  source: FontSource
  /** Exact tested Google Fonts CSS2 URL — required when source is google */
  googleStylesheetUrl?: string
}

export const GEIST_FONT_VALUE = 'var(--font-geist-sans), sans-serif'
export const DEFAULT_FONT_VALUE = GEIST_FONT_VALUE

/** Curated quick-pick fonts */
export const FEATURED_FONTS: FontCatalogEntry[] = [
  { name: 'Geist', value: GEIST_FONT_VALUE, source: 'geist' },
  {
    name: 'Bungee',
    value: 'Bungee, cursive',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Bungee&display=swap',
  },
  {
    name: 'Inter',
    value: 'Inter, sans-serif',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap',
  },
  {
    name: 'DM Sans',
    value: '"DM Sans", sans-serif',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap',
  },
  {
    name: 'Space Grotesk',
    value: '"Space Grotesk", sans-serif',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&display=swap',
  },
  {
    name: 'Instrument Sans',
    value: '"Instrument Sans", sans-serif',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;700&display=swap',
  },
]

/** System stacks — no download required */
const SYSTEM_FONTS: FontCatalogEntry[] = [
  { name: 'Arial', value: 'Arial, sans-serif', source: 'system' },
  { name: 'Helvetica', value: 'Helvetica, sans-serif', source: 'system' },
  {
    name: 'Times New Roman',
    value: '"Times New Roman", serif',
    source: 'system',
  },
  { name: 'Georgia', value: 'Georgia, serif', source: 'system' },
  { name: 'Verdana', value: 'Verdana, sans-serif', source: 'system' },
  {
    name: 'Trebuchet MS',
    value: '"Trebuchet MS", sans-serif',
    source: 'system',
  },
  { name: 'Palatino', value: 'Palatino, serif', source: 'system' },
  { name: 'Garamond', value: 'Garamond, serif', source: 'system' },
  { name: 'Bookman', value: 'Bookman, serif', source: 'system' },
  {
    name: 'Comic Sans MS',
    value: '"Comic Sans MS", cursive',
    source: 'system',
  },
  { name: 'Impact', value: 'Impact, sans-serif', source: 'system' },
  {
    name: 'Lucida Console',
    value: '"Lucida Console", monospace',
    source: 'system',
  },
  { name: 'Monaco', value: 'Monaco, monospace', source: 'system' },
  {
    name: 'Courier New',
    value: '"Courier New", monospace',
    source: 'system',
  },
]

/** Google fonts with exact tested stylesheet URLs */
const GOOGLE_FONTS: FontCatalogEntry[] = [
  {
    name: 'Roboto',
    value: 'Roboto, sans-serif',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap',
  },
  {
    name: 'Open Sans',
    value: '"Open Sans", sans-serif',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap',
  },
  {
    name: 'Lato',
    value: 'Lato, sans-serif',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap',
  },
  {
    name: 'Montserrat',
    value: 'Montserrat, sans-serif',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap',
  },
  {
    name: 'Poppins',
    value: 'Poppins, sans-serif',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap',
  },
  {
    name: 'Nunito',
    value: 'Nunito, sans-serif',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Nunito:wght@400;700&display=swap',
  },
  {
    name: 'Raleway',
    value: 'Raleway, sans-serif',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Raleway:wght@400;700&display=swap',
  },
  {
    name: 'Source Sans 3',
    value: '"Source Sans 3", sans-serif',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;700&display=swap',
  },
  {
    name: 'Ubuntu',
    value: 'Ubuntu, sans-serif',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;700&display=swap',
  },
  {
    name: 'Merriweather',
    value: 'Merriweather, serif',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap',
  },
  {
    name: 'Playfair Display',
    value: '"Playfair Display", serif',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap',
  },
  {
    name: 'Lora',
    value: 'Lora, serif',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Lora:wght@400;700&display=swap',
  },
  {
    name: 'Crimson Text',
    value: '"Crimson Text", serif',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Crimson+Text:wght@400;700&display=swap',
  },
  {
    name: 'Oswald',
    value: 'Oswald, sans-serif',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap',
  },
  {
    name: 'Bebas Neue',
    value: '"Bebas Neue", cursive',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap',
  },
  {
    name: 'Pacifico',
    value: 'Pacifico, cursive',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Pacifico&display=swap',
  },
  {
    name: 'Dancing Script',
    value: '"Dancing Script", cursive',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap',
  },
  {
    name: 'Lobster',
    value: 'Lobster, cursive',
    source: 'google',
    googleStylesheetUrl:
      'https://fonts.googleapis.com/css2?family=Lobster&display=swap',
  },
]

export const ALL_CATALOG_FONTS: FontCatalogEntry[] = [
  ...FEATURED_FONTS,
  ...SYSTEM_FONTS,
  ...GOOGLE_FONTS,
]

const byValue = new Map(ALL_CATALOG_FONTS.map((entry) => [entry.value, entry]))

export function getFontEntryByValue(value: string): FontCatalogEntry | undefined {
  return byValue.get(value)
}

export function searchCatalogFonts(query: string): FontCatalogEntry[] {
  const q = query.trim().toLowerCase()
  const pool = [...SYSTEM_FONTS, ...GOOGLE_FONTS]
  if (!q) return pool
  return pool.filter(
    (entry) =>
      entry.name.toLowerCase().includes(q) ||
      entry.value.toLowerCase().includes(q)
  )
}

/** Primary family name for document.fonts.load / check */
export function primaryFamilyName(value: string): string {
  const first = value.split(',')[0]?.trim() ?? value
  return first.replace(/^["']|["']$/g, '')
}

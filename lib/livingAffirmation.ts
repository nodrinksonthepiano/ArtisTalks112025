/**
 * Living Affirmation — gate-only render from exact free-taste draft answers.
 * Uses the approved [JAI] connective frame; slot values are never paraphrased.
 */

export const LIVING_AFFIRMATION_KEYS = [
  'artist_name',
  'genre_associations',
  'business_type_products_services',
  'known_for_expression',
  'known_for_legacy',
] as const

export type LivingAffirmationKey = (typeof LIVING_AFFIRMATION_KEYS)[number]

export interface LivingAffirmationSlots {
  artist_name: string
  genre_associations: string
  business_type_products_services: string
  known_for_expression: string
  known_for_legacy: string
}

/**
 * Assemble the Living Affirmation from exact artist answer strings.
 *
 * Approved [JAI] frame:
 * I am so happy and grateful now that [ARTIST] is stepping fully into [GENRE / WORLD],
 * creating [BUSINESS / OFFER], known for [EXPRESSION], and celebrated for [LEGACY].
 *
 * At the gate all five slots should exist. Empty slots are omitted without inventing
 * replacement words. Connective language outside the slots is not rewritten.
 */
export function assembleLivingAffirmation(slots: LivingAffirmationSlots): string {
  const artist = slots.artist_name.trim()
  const genre = slots.genre_associations.trim()
  const business = slots.business_type_products_services.trim()
  const expression = slots.known_for_expression.trim()
  const legacy = slots.known_for_legacy.trim()

  // Happy path — exact approved sentence with exact draft strings.
  if (artist && genre && business && expression && legacy) {
    return (
      `I am so happy and grateful now that ${artist} is stepping fully into ${genre}, ` +
      `creating ${business}, known for ${expression}, and celebrated for ${legacy}.`
    )
  }

  // Defensive partial path — omit empty slots; do not invent filler for missing ones.
  if (!artist) return ''

  const tail: string[] = []
  if (genre) tail.push(`stepping fully into ${genre}`)
  if (business) tail.push(`creating ${business}`)
  if (expression) tail.push(`known for ${expression}`)
  if (legacy) tail.push(`celebrated for ${legacy}`)
  if (tail.length === 0) return ''

  return `I am so happy and grateful now that ${artist} is ${joinAnd(tail)}.`
}

function joinAnd(parts: string[]): string {
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]}, and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

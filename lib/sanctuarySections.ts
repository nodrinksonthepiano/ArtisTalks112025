/**
 * Private Sanctuary Accordion — section definitions and read-only text mapping.
 * Curriculum answers only; no carousel derivation, no write path.
 */

export const SANCTUARY_ANSWER_KEYS = [
  'known_for_expression',
  'known_for_legacy',
  'signature_world_elements',
  'business_type_products_services',
  'collaborators_wishlist',
  'open_for_support_targets',
] as const

export type SanctuaryAnswerKey = (typeof SANCTUARY_ANSWER_KEYS)[number]

export type SanctuaryAnswers = Record<SanctuaryAnswerKey, string>

export type SanctuarySectionId = 'story' | 'offer' | 'on_tour'

export interface SanctuarySectionDef {
  id: SanctuarySectionId
  title: string
  keys: SanctuaryAnswerKey[]
}

export const SANCTUARY_SECTIONS: SanctuarySectionDef[] = [
  {
    id: 'story',
    title: 'Your Story',
    keys: [
      'known_for_expression',
      'known_for_legacy',
      'signature_world_elements',
    ],
  },
  {
    id: 'offer',
    title: 'What You Offer',
    keys: ['business_type_products_services'],
  },
  {
    id: 'on_tour',
    title: 'On Tour With',
    keys: ['collaborators_wishlist', 'open_for_support_targets'],
  },
]

export function emptySanctuaryAnswers(): SanctuaryAnswers {
  return {
    known_for_expression: '',
    known_for_legacy: '',
    signature_world_elements: '',
    business_type_products_services: '',
    collaborators_wishlist: '',
    open_for_support_targets: '',
  }
}

/** Pull plain text from curriculum answer_data (label preferred, then text). */
export function textFromAnswerData(answerData: unknown): string {
  if (!answerData || typeof answerData !== 'object') return ''
  const data = answerData as Record<string, unknown>
  const label = typeof data.label === 'string' ? data.label.trim() : ''
  const text = typeof data.text === 'string' ? data.text.trim() : ''
  return label || text
}

export function sectionBodyLines(
  section: SanctuarySectionDef,
  answers: SanctuaryAnswers
): string[] {
  return section.keys
    .map((key) => answers[key]?.trim() || '')
    .filter((line) => line.length > 0)
}

export function sectionHasContent(
  section: SanctuarySectionDef,
  answers: SanctuaryAnswers
): boolean {
  return sectionBodyLines(section, answers).length > 0
}

/** Sections that already have at least one real answer — progressive reveal filter. */
export function visibleSanctuarySections(
  answers: SanctuaryAnswers
): SanctuarySectionDef[] {
  return SANCTUARY_SECTIONS.filter((section) => sectionHasContent(section, answers))
}

/**
 * Which section changed between two answer snapshots.
 * Prefers the last section in spine order that gained or changed text
 * (so a new Offer answer wins over an older Story edit in the same tick).
 */
export function sectionChangedByAnswers(
  prev: SanctuaryAnswers,
  next: SanctuaryAnswers
): SanctuarySectionId | null {
  let changed: SanctuarySectionId | null = null

  for (const section of SANCTUARY_SECTIONS) {
    for (const key of section.keys) {
      const before = (prev[key] || '').trim()
      const after = (next[key] || '').trim()
      if (before !== after && after.length > 0) {
        changed = section.id
      }
    }
  }

  return changed
}

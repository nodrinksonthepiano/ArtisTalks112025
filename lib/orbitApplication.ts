export type OrbitApplicationStatus = 'draft' | 'submitted' | 'approved' | 'declined'
export type SixMonthReady = 'yes' | 'not_yet'

export type OrbitApplicationRow = {
  id: string
  user_id: string
  phone: string
  why_orbit: string
  six_month_ready: SixMonthReady | null
  status: OrbitApplicationStatus
  created_at: string
  updated_at: string
  submitted_at: string | null
}

/** Chat-only Orbit steps — not curriculum StepIds. */
export type OrbitChatStep = 'phone' | 'why' | 'ready' | 'submit'

export const ORBIT_CHAT_QUESTIONS: Record<OrbitChatStep, string> = {
  phone: "What's the best phone number to reach you?",
  why: 'Why Orbit now, and what would you like to accomplish over the next six months?',
  ready:
    'Are you ready to commit to six months of focused artist development?',
  submit: 'Submit your Orbit application when you are ready.',
}

export const ORBIT_READY_OPTIONS = [
  { label: 'Yes', value: 'yes' },
  { label: 'Not yet', value: 'not_yet' },
] as const

export const ORBIT_CONTINUATION_PROMPT =
  'What kind of support do you want?\n\nThese are two different paths — not step one and step two.\n\nArtisTalks is DIY guided artist development for $8/month.\nOrbit Launch is the done-with-you program. Applying is free; tuition comes only if Jai approves you.'

export const ORBIT_CONTINUE_CTA = 'Continue ArtisTalks — $8/month'
export const ORBIT_APPLY_CTA = 'Apply to Orbit Launch'

export function getFirstUnansweredOrbitStep(
  application: OrbitApplicationRow | null
): OrbitChatStep | null {
  if (!application || application.status !== 'draft') return null
  if (!application.phone.trim()) return 'phone'
  if (!application.why_orbit.trim()) return 'why'
  if (
    application.six_month_ready !== 'yes' &&
    application.six_month_ready !== 'not_yet'
  ) {
    return 'ready'
  }
  return 'submit'
}

export function orbitStatusMessage(
  status: OrbitApplicationStatus
): string | null {
  if (status === 'submitted') {
    return 'Application received. Your Orbit application is submitted and read-only while Jai reviews it.'
  }
  if (status === 'approved') {
    return 'Approved for ArtisTalks Orbit Launch. Jai will reach out about next steps.'
  }
  if (status === 'declined') {
    return 'This Orbit application was not approved for this cycle. Your ArtisTalks sanctuary remains yours.'
  }
  return null
}

export async function fetchOrbitApplication(): Promise<OrbitApplicationRow | null> {
  const res = await fetch('/api/orbit/application')
  const data = (await res.json().catch(() => ({}))) as {
    application?: OrbitApplicationRow | null
    error?: string
  }
  if (!res.ok) {
    throw new Error(data.error || 'Unable to load Orbit application.')
  }
  return data.application ?? null
}

export async function saveOrbitApplication(body: {
  phone?: string
  why_orbit?: string
  six_month_ready?: SixMonthReady | null
  submit?: boolean
}): Promise<OrbitApplicationRow> {
  const res = await fetch('/api/orbit/application', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as {
    application?: OrbitApplicationRow
    error?: string
  }
  if (!res.ok || !data.application) {
    throw new Error(data.error || 'Unable to save Orbit application.')
  }
  return data.application
}

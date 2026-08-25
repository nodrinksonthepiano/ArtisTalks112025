import type { SupabaseClient } from '@supabase/supabase-js'
import {
  resolveStripeProfileStatusUpdate,
  SAAS_PLAN_KEY_8_MONTHLY,
} from '@/lib/saasEntitlement'
import { getProfileSaasStatus } from '@/lib/saasStripeDb'

export type SaasPaypalSubscriptionRow = {
  id: string
  user_id: string
  provider: string
  provider_customer_id: string | null
  provider_subscription_id: string | null
  provider_status: string
  plan_key: string
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isOpaqueAttemptId(value: string): boolean {
  return UUID_RE.test(value.trim())
}

export async function findSaasPaypalSubscriptionById(
  admin: SupabaseClient,
  attemptId: string
): Promise<SaasPaypalSubscriptionRow | null> {
  const { data, error } = await admin
    .from('saas_payment_subscriptions')
    .select(
      'id, user_id, provider, provider_customer_id, provider_subscription_id, provider_status, plan_key'
    )
    .eq('id', attemptId)
    .eq('provider', 'paypal')
    .eq('plan_key', SAAS_PLAN_KEY_8_MONTHLY)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function findPendingSaasPaypalAttemptByUser(
  admin: SupabaseClient,
  userId: string
): Promise<SaasPaypalSubscriptionRow | null> {
  const { data, error } = await admin
    .from('saas_payment_subscriptions')
    .select(
      'id, user_id, provider, provider_customer_id, provider_subscription_id, provider_status, plan_key'
    )
    .eq('user_id', userId)
    .eq('provider', 'paypal')
    .eq('plan_key', SAAS_PLAN_KEY_8_MONTHLY)
    .is('provider_subscription_id', null)
    .eq('provider_status', 'pending')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function insertPendingSaasPaypalAttempt(
  admin: SupabaseClient,
  userId: string
): Promise<SaasPaypalSubscriptionRow> {
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('saas_payment_subscriptions')
    .insert({
      user_id: userId,
      provider: 'paypal',
      provider_customer_id: null,
      provider_subscription_id: null,
      provider_status: 'pending',
      plan_key: SAAS_PLAN_KEY_8_MONTHLY,
      created_at: now,
      updated_at: now,
    })
    .select(
      'id, user_id, provider, provider_customer_id, provider_subscription_id, provider_status, plan_key'
    )
    .single()

  if (error) throw error
  return data
}

/**
 * Reuse one pending PayPal attempt per artist+plan, or insert a new pending row.
 * Pending = provider_subscription_id is null (not yet bound to an I-… id).
 */
export async function getOrCreatePendingSaasPaypalAttempt(
  admin: SupabaseClient,
  userId: string
): Promise<SaasPaypalSubscriptionRow> {
  const existing = await findPendingSaasPaypalAttemptByUser(admin, userId)
  if (existing?.id) {
    const { error } = await admin
      .from('saas_payment_subscriptions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) throw error
    return existing
  }
  return insertPendingSaasPaypalAttempt(admin, userId)
}

/**
 * Bind PayPal I-… onto the attempt row. Entitlement is applied by the caller
 * using row.user_id — never a browser-supplied user id.
 */
export async function bindPaypalSubscriptionToAttempt(
  admin: SupabaseClient,
  args: {
    attemptId: string
    userId: string
    providerSubscriptionId: string
    providerStatus: string
  }
): Promise<void> {
  const now = new Date().toISOString()
  const providerSubscriptionId = args.providerSubscriptionId

  const { data: existingBySub, error: findBySubError } = await admin
    .from('saas_payment_subscriptions')
    .select('id')
    .eq('provider', 'paypal')
    .eq('provider_subscription_id', providerSubscriptionId)
    .maybeSingle()
  if (findBySubError) throw findBySubError

  if (existingBySub?.id) {
    const { error: updateBySubError } = await admin
      .from('saas_payment_subscriptions')
      .update({
        user_id: args.userId,
        provider_status: args.providerStatus,
        plan_key: SAAS_PLAN_KEY_8_MONTHLY,
        updated_at: now,
      })
      .eq('id', existingBySub.id)
    if (updateBySubError) throw updateBySubError
    return
  }

  const { data: updatedAttempt, error: updateAttemptError } = await admin
    .from('saas_payment_subscriptions')
    .update({
      user_id: args.userId,
      provider_subscription_id: providerSubscriptionId,
      provider_status: args.providerStatus,
      plan_key: SAAS_PLAN_KEY_8_MONTHLY,
      updated_at: now,
    })
    .eq('id', args.attemptId)
    .eq('provider', 'paypal')
    .select('id')
    .maybeSingle()
  if (!updateAttemptError) {
    if (updatedAttempt?.id) return
    throw new Error('paypal_attempt_bind_missing')
  }

  if ((updateAttemptError as { code?: string }).code !== '23505') {
    throw updateAttemptError
  }

  const { data: racedRow, error: refetchError } = await admin
    .from('saas_payment_subscriptions')
    .select('id')
    .eq('provider', 'paypal')
    .eq('provider_subscription_id', providerSubscriptionId)
    .maybeSingle()
  if (refetchError) throw refetchError
  if (!racedRow?.id) throw updateAttemptError

  const { error: recoverError } = await admin
    .from('saas_payment_subscriptions')
    .update({
      user_id: args.userId,
      provider_status: args.providerStatus,
      plan_key: SAAS_PLAN_KEY_8_MONTHLY,
      updated_at: now,
    })
    .eq('id', racedRow.id)
  if (recoverError) throw recoverError
}

/** Never overwrites comped. Never sets inactive from PayPal. */
export async function applyPaypalAccessStatus(
  admin: SupabaseClient,
  userId: string,
  next: 'active' | 'past_due'
): Promise<void> {
  const current = await getProfileSaasStatus(admin, userId)
  const resolved = resolveStripeProfileStatusUpdate(current, next)
  if (!resolved) return

  const { data: updated, error: updateError } = await admin
    .from('profiles')
    .update({ saas_subscription_status: resolved })
    .eq('id', userId)
    .select('id')
    .maybeSingle()
  if (updateError) throw updateError

  if (!updated) {
    const { error: insertError } = await admin.from('profiles').upsert({
      id: userId,
      email: null,
      artist_name: null,
      mission_statement: null,
      saas_subscription_status: resolved,
    })
    if (insertError) throw insertError
  }
}

export async function isPaypalEventProcessed(
  admin: SupabaseClient,
  eventId: string
): Promise<boolean> {
  const { data, error } = await admin
    .from('saas_paypal_webhook_events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle()
  if (error) throw error
  return !!data
}

/** Call ONLY after required subscription/profile writes succeed, or a clean ignore. */
export async function markPaypalEventProcessed(
  admin: SupabaseClient,
  eventId: string
): Promise<void> {
  const { error } = await admin.from('saas_paypal_webhook_events').insert({
    event_id: eventId,
    processed_at: new Date().toISOString(),
  })
  if (error) {
    if ((error as { code?: string }).code === '23505') return
    throw error
  }
}

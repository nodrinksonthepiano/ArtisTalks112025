import type { SupabaseClient } from '@supabase/supabase-js'
import {
  resolveStripeProfileStatusUpdate,
  SAAS_PLAN_KEY_8_MONTHLY,
} from '@/lib/saasEntitlement'

export async function findSaasStripeSubscriptionByUser(
  admin: SupabaseClient,
  userId: string
) {
  const { data, error } = await admin
    .from('saas_payment_subscriptions')
    .select(
      'id, user_id, provider, provider_customer_id, provider_subscription_id, provider_status, plan_key'
    )
    .eq('user_id', userId)
    .eq('provider', 'stripe')
    .eq('plan_key', SAAS_PLAN_KEY_8_MONTHLY)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export function isBlockingStripeProviderStatus(
  providerStatus: string | null | undefined
): boolean {
  const s = (providerStatus || '').toLowerCase()
  return (
    s === 'active' ||
    s === 'past_due' ||
    s === 'trialing' ||
    s === 'unpaid'
  )
}

export async function upsertSaasStripeSubscription(
  admin: SupabaseClient,
  args: {
    userId: string
    providerCustomerId?: string | null
    providerSubscriptionId?: string | null
    providerStatus: string
  }
) {
  const now = new Date().toISOString()
  const providerSubscriptionId = args.providerSubscriptionId || null

  if (providerSubscriptionId) {
    const { data: existingBySub, error: findError } = await admin
      .from('saas_payment_subscriptions')
      .select('id')
      .eq('provider', 'stripe')
      .eq('provider_subscription_id', providerSubscriptionId)
      .maybeSingle()
    if (findError) throw findError

    if (existingBySub?.id) {
      const { error: updateError } = await admin
        .from('saas_payment_subscriptions')
        .update({
          user_id: args.userId,
          provider_customer_id: args.providerCustomerId ?? null,
          provider_status: args.providerStatus,
          plan_key: SAAS_PLAN_KEY_8_MONTHLY,
          updated_at: now,
        })
        .eq('id', existingBySub.id)
      if (updateError) throw updateError
      return
    }
  }

  const existing = await findSaasStripeSubscriptionByUser(admin, args.userId)
  if (existing?.id) {
    const { error: updateError } = await admin
      .from('saas_payment_subscriptions')
      .update({
        provider_customer_id:
          args.providerCustomerId ?? existing.provider_customer_id,
        provider_subscription_id:
          providerSubscriptionId ?? existing.provider_subscription_id,
        provider_status: args.providerStatus,
        plan_key: SAAS_PLAN_KEY_8_MONTHLY,
        updated_at: now,
      })
      .eq('id', existing.id)
    if (updateError) throw updateError
    return
  }

  const { error: insertError } = await admin
    .from('saas_payment_subscriptions')
    .insert({
      user_id: args.userId,
      provider: 'stripe',
      provider_customer_id: args.providerCustomerId ?? null,
      provider_subscription_id: providerSubscriptionId,
      provider_status: args.providerStatus,
      plan_key: SAAS_PLAN_KEY_8_MONTHLY,
      created_at: now,
      updated_at: now,
    })
  if (!insertError) return

  // Concurrent webhook race: another event inserted the same
  // provider_subscription_id between our find and insert.
  if ((insertError as { code?: string }).code !== '23505' || !providerSubscriptionId) {
    throw insertError
  }

  const { data: racedRow, error: refetchError } = await admin
    .from('saas_payment_subscriptions')
    .select('id')
    .eq('provider', 'stripe')
    .eq('provider_subscription_id', providerSubscriptionId)
    .maybeSingle()
  if (refetchError) throw refetchError
  if (!racedRow?.id) throw insertError

  const { error: recoverError } = await admin
    .from('saas_payment_subscriptions')
    .update({
      user_id: args.userId,
      provider_customer_id: args.providerCustomerId ?? null,
      provider_status: args.providerStatus,
      plan_key: SAAS_PLAN_KEY_8_MONTHLY,
      updated_at: now,
    })
    .eq('id', racedRow.id)
  if (recoverError) throw recoverError
}

export async function getProfileSaasStatus(
  admin: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from('profiles')
    .select('saas_subscription_status')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.saas_subscription_status ?? null
}

/** Never overwrites comped. Never sets inactive from Stripe. */
export async function applyStripeAccessStatus(
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

export async function isStripeEventProcessed(
  admin: SupabaseClient,
  eventId: string
): Promise<boolean> {
  const { data, error } = await admin
    .from('saas_stripe_webhook_events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle()
  if (error) throw error
  return !!data
}

/** Call ONLY after required subscription/profile writes succeed. */
export async function markStripeEventProcessed(
  admin: SupabaseClient,
  eventId: string
): Promise<void> {
  const { error } = await admin.from('saas_stripe_webhook_events').insert({
    event_id: eventId,
    processed_at: new Date().toISOString(),
  })
  if (error) {
    // Concurrent retry already marked success — treat as ok.
    if ((error as { code?: string }).code === '23505') return
    throw error
  }
}

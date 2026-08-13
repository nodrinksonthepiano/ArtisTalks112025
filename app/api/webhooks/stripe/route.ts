import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import {
  applyStripeAccessStatus,
  isStripeEventProcessed,
  markStripeEventProcessed,
  upsertSaasStripeSubscription,
} from '@/lib/saasStripeDb'
import { getStripe, getStripeWebhookSecret } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'

export const runtime = 'nodejs'

function asSubscriptionId(
  value: string | Stripe.Subscription | null | undefined
): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  return value.id
}

function asCustomerId(
  value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if ('deleted' in value && value.deleted) return value.id
  return value.id
}

/** Stripe Invoice v1 uses parent.subscription_details; older payloads may still carry subscription. */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const fromParent = asSubscriptionId(
    invoice.parent?.subscription_details?.subscription
  )
  if (fromParent) return fromParent
  const legacy = (
    invoice as Stripe.Invoice & {
      subscription?: string | Stripe.Subscription | null
    }
  ).subscription
  return asSubscriptionId(legacy)
}

function userIdFromInvoiceSubscriptionMetadata(
  invoice: Stripe.Invoice
): string | null {
  const meta = invoice.parent?.subscription_details?.metadata
  const fromSnapshot = meta?.supabase_user_id?.trim()
  return fromSnapshot || null
}

async function resolveUserIdFromSubscription(
  stripe: Stripe,
  subscriptionId: string,
  fallbackUserId?: string | null
): Promise<{
  userId: string | null
  subscription: Stripe.Subscription | null
}> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const userId =
    subscription.metadata?.supabase_user_id?.trim() ||
    fallbackUserId?.trim() ||
    null
  return { userId, subscription }
}

async function handleCheckoutSessionCompleted(
  admin: ReturnType<typeof createAdminClient>,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  const userId =
    session.metadata?.supabase_user_id?.trim() ||
    session.client_reference_id?.trim() ||
    null
  const subscriptionId = asSubscriptionId(session.subscription)
  const customerId = asCustomerId(session.customer)

  let resolvedUserId = userId
  let providerStatus: string = session.status || 'complete'

  if (subscriptionId) {
    const { userId: fromSub, subscription } =
      await resolveUserIdFromSubscription(stripe, subscriptionId)
    if (!resolvedUserId) resolvedUserId = fromSub
    if (subscription?.status) providerStatus = String(subscription.status)
  }

  if (!resolvedUserId) {
    throw new Error('checkout.session.completed missing supabase_user_id')
  }

  await upsertSaasStripeSubscription(admin, {
    userId: resolvedUserId,
    providerCustomerId: customerId,
    providerSubscriptionId: subscriptionId,
    providerStatus,
  })
  // Enrichment only — never grant or downgrade access here.
}

async function handleInvoicePaid(
  admin: ReturnType<typeof createAdminClient>,
  stripe: Stripe,
  invoice: Stripe.Invoice
) {
  const subscriptionId = subscriptionIdFromInvoice(invoice)
  if (!subscriptionId) {
    // One-time invoices are out of scope for this SaaS slice.
    return
  }

  const { userId, subscription } = await resolveUserIdFromSubscription(
    stripe,
    subscriptionId,
    userIdFromInvoiceSubscriptionMetadata(invoice)
  )
  if (!userId) {
    throw new Error('invoice.paid missing supabase_user_id on subscription')
  }

  await upsertSaasStripeSubscription(admin, {
    userId,
    providerCustomerId:
      asCustomerId(invoice.customer) || asCustomerId(subscription?.customer),
    providerSubscriptionId: subscriptionId,
    providerStatus: subscription?.status || 'active',
  })
  await applyStripeAccessStatus(admin, userId, 'active')
}

async function handleInvoicePaymentFailed(
  admin: ReturnType<typeof createAdminClient>,
  stripe: Stripe,
  invoice: Stripe.Invoice
) {
  const subscriptionId = subscriptionIdFromInvoice(invoice)
  if (!subscriptionId) return

  const { userId, subscription } = await resolveUserIdFromSubscription(
    stripe,
    subscriptionId,
    userIdFromInvoiceSubscriptionMetadata(invoice)
  )
  if (!userId) {
    throw new Error(
      'invoice.payment_failed missing supabase_user_id on subscription'
    )
  }

  await upsertSaasStripeSubscription(admin, {
    userId,
    providerCustomerId:
      asCustomerId(invoice.customer) || asCustomerId(subscription?.customer),
    providerSubscriptionId: subscriptionId,
    providerStatus: subscription?.status || 'past_due',
  })
  await applyStripeAccessStatus(admin, userId, 'past_due')
}

async function handleSubscriptionUpdatedOrDeleted(
  admin: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription,
  deleted: boolean
) {
  const userId = subscription.metadata?.supabase_user_id?.trim() || null
  if (!userId) {
    throw new Error('subscription event missing supabase_user_id')
  }

  await upsertSaasStripeSubscription(admin, {
    userId,
    providerCustomerId: asCustomerId(subscription.customer),
    providerSubscriptionId: subscription.id,
    providerStatus: deleted ? 'canceled' : subscription.status,
  })
  // Cancellation records provider state only — never auto-revoke ArtisTalks.
}

export async function POST(request: Request) {
  let stripe
  let webhookSecret: string
  try {
    stripe = getStripe()
    webhookSecret = getStripeWebhookSecret()
  } catch {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 })
  }

  const rawBody = await request.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error(
      'stripe_webhook_signature_failed',
      err instanceof Error ? err.message : err
    )
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    if (await isStripeEventProcessed(admin, event.id)) {
      return NextResponse.json({ received: true, duplicate: true })
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutSessionCompleted(
          admin,
          stripe,
          event.data.object as Stripe.Checkout.Session
        )
        break
      }
      case 'invoice.paid': {
        await handleInvoicePaid(
          admin,
          stripe,
          event.data.object as Stripe.Invoice
        )
        break
      }
      case 'invoice.payment_failed': {
        await handleInvoicePaymentFailed(
          admin,
          stripe,
          event.data.object as Stripe.Invoice
        )
        break
      }
      case 'customer.subscription.updated': {
        await handleSubscriptionUpdatedOrDeleted(
          admin,
          event.data.object as Stripe.Subscription,
          false
        )
        break
      }
      case 'customer.subscription.deleted': {
        await handleSubscriptionUpdatedOrDeleted(
          admin,
          event.data.object as Stripe.Subscription,
          true
        )
        break
      }
      default:
        // Ignore unrelated events; still mark processed so Stripe stops retrying.
        break
    }

    // ONLY after required writes succeed (or ignored event handled cleanly).
    await markStripeEventProcessed(admin, event.id)
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error(
      'stripe_webhook_handler_failed',
      event.type,
      event.id,
      err instanceof Error ? err.message : err
    )
    // Do NOT mark processed — Stripe should retry.
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import {
  getPaypalClientId,
  getPaypalClientSecret,
  getPaypalPlanArtistalks8Monthly,
  getPaypalSubscription,
  getPaypalWebhookId,
  verifyPaypalWebhookSignature,
} from '@/lib/paypal'
import {
  applyPaypalAccessStatus,
  bindPaypalSubscriptionToAttempt,
  findSaasPaypalSubscriptionById,
  isOpaqueAttemptId,
  isPaypalEventProcessed,
  markPaypalEventProcessed,
} from '@/lib/saasPaypalDb'
import { createAdminClient } from '@/utils/supabase/admin'

export const runtime = 'nodejs'

type PaypalWebhookEvent = {
  id?: string
  event_type?: string
  resource?: {
    billing_agreement_id?: unknown
    id?: unknown
  }
}

function headerValue(request: Request, name: string): string | null {
  return request.headers.get(name) || request.headers.get(name.toLowerCase())
}

function asSubscriptionId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('I-')) return null
  return trimmed
}

async function handlePaymentSaleCompleted(
  admin: ReturnType<typeof createAdminClient>,
  event: PaypalWebhookEvent
): Promise<'granted' | 'ignored'> {
  const subscriptionId = asSubscriptionId(event.resource?.billing_agreement_id)
  if (!subscriptionId) return 'ignored'

  let subscription
  try {
    subscription = await getPaypalSubscription(subscriptionId)
  } catch {
    throw new Error('paypal_subscription_retrieve_failed')
  }
  if (!subscription?.id) return 'ignored'

  const expectedPlanId = getPaypalPlanArtistalks8Monthly()
  if (subscription.plan_id !== expectedPlanId) return 'ignored'

  const customId = (subscription.custom_id || '').trim()
  if (!customId || !isOpaqueAttemptId(customId)) return 'ignored'

  const attempt = await findSaasPaypalSubscriptionById(admin, customId)
  if (!attempt?.id || attempt.user_id == null) return 'ignored'

  await bindPaypalSubscriptionToAttempt(admin, {
    attemptId: attempt.id,
    userId: attempt.user_id,
    providerSubscriptionId: subscription.id,
    providerStatus: subscription.status || 'ACTIVE',
  })
  await applyPaypalAccessStatus(admin, attempt.user_id, 'active')
  return 'granted'
}

export async function POST(request: Request) {
  try {
    getPaypalClientId()
    getPaypalClientSecret()
    getPaypalWebhookId()
    getPaypalPlanArtistalks8Monthly()
  } catch {
    return NextResponse.json({ error: 'PayPal is not configured.' }, { status: 503 })
  }

  const authAlgo = headerValue(request, 'PAYPAL-AUTH-ALGO')
  const certUrl = headerValue(request, 'PAYPAL-CERT-URL')
  const transmissionId = headerValue(request, 'PAYPAL-TRANSMISSION-ID')
  const transmissionSig = headerValue(request, 'PAYPAL-TRANSMISSION-SIG')
  const transmissionTime = headerValue(request, 'PAYPAL-TRANSMISSION-TIME')
  if (
    !authAlgo ||
    !certUrl ||
    !transmissionId ||
    !transmissionSig ||
    !transmissionTime
  ) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 })
  }

  const rawBody = await request.text()
  let event: PaypalWebhookEvent
  try {
    event = JSON.parse(rawBody) as PaypalWebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const verified = await verifyPaypalWebhookSignature({
    authAlgo,
    certUrl,
    transmissionId,
    transmissionSig,
    transmissionTime,
    webhookEvent: event,
  })
  if (!verified) {
    console.error('paypal_webhook_signature_failed')
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  const eventId = typeof event.id === 'string' ? event.id.trim() : ''
  if (!eventId) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    if (await isPaypalEventProcessed(admin, eventId)) {
      return NextResponse.json({ received: true, duplicate: true })
    }

    const eventType = event.event_type || ''
    if (eventType === 'PAYMENT.SALE.COMPLETED') {
      await handlePaymentSaleCompleted(admin, event)
    }

    await markPaypalEventProcessed(admin, eventId)
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error(
      'paypal_webhook_handler_failed',
      event.event_type,
      eventId,
      err instanceof Error ? err.message : err
    )
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 })
  }
}

type PaypalTokenCache = {
  accessToken: string
  expiresAtMs: number
}

let paypalTokenCache: PaypalTokenCache | null = null

export function getPaypalApiBase(): string {
  const fromEnv = process.env.PAYPAL_API_BASE?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return 'https://api-m.sandbox.paypal.com'
}

export function getPaypalClientId(): string {
  const id = process.env.PAYPAL_CLIENT_ID?.trim()
  if (!id) {
    throw new Error('PayPal is not configured.')
  }
  return id
}

export function getPaypalClientSecret(): string {
  const secret = process.env.PAYPAL_CLIENT_SECRET
  if (!secret) {
    throw new Error('PayPal is not configured.')
  }
  return secret
}

export function getPaypalWebhookId(): string {
  const id = process.env.PAYPAL_WEBHOOK_ID?.trim()
  if (!id) {
    throw new Error('PayPal webhook is not configured.')
  }
  return id
}

export function getPaypalPlanArtistalks8Monthly(): string {
  const planId = process.env.PAYPAL_PLAN_ARTISTALKS_8_MONTHLY?.trim()
  if (!planId) {
    throw new Error('PayPal plan is not configured.')
  }
  return planId
}

export async function getPaypalAccessToken(): Promise<string> {
  const now = Date.now()
  if (paypalTokenCache && paypalTokenCache.expiresAtMs > now + 30_000) {
    return paypalTokenCache.accessToken
  }

  const clientId = getPaypalClientId()
  const clientSecret = getPaypalClientSecret()
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetch(`${getPaypalApiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    console.error('paypal_oauth_failed', response.status)
    throw new Error('PayPal is not configured.')
  }

  const data = (await response.json()) as {
    access_token?: string
    expires_in?: number
  }
  if (!data.access_token) {
    throw new Error('PayPal is not configured.')
  }

  const expiresInSec =
    typeof data.expires_in === 'number' && data.expires_in > 0
      ? data.expires_in
      : 300
  paypalTokenCache = {
    accessToken: data.access_token,
    expiresAtMs: now + expiresInSec * 1000,
  }
  return paypalTokenCache.accessToken
}

export type PaypalSubscription = {
  id: string
  plan_id?: string
  custom_id?: string
  status?: string
}

export async function getPaypalSubscription(
  subscriptionId: string
): Promise<PaypalSubscription | null> {
  const token = await getPaypalAccessToken()
  const response = await fetch(
    `${getPaypalApiBase()}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (response.status === 404) return null
  if (!response.ok) {
    console.error('paypal_subscription_get_failed', response.status)
    throw new Error('Unable to load PayPal subscription.')
  }

  const data = (await response.json()) as PaypalSubscription
  if (!data?.id) return null
  return data
}

export async function verifyPaypalWebhookSignature(args: {
  authAlgo: string
  certUrl: string
  transmissionId: string
  transmissionSig: string
  transmissionTime: string
  webhookEvent: unknown
}): Promise<boolean> {
  const token = await getPaypalAccessToken()
  const webhookId = getPaypalWebhookId()
  const response = await fetch(
    `${getPaypalApiBase()}/v1/notifications/verify-webhook-signature`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: args.authAlgo,
        cert_url: args.certUrl,
        transmission_id: args.transmissionId,
        transmission_sig: args.transmissionSig,
        transmission_time: args.transmissionTime,
        webhook_id: webhookId,
        webhook_event: args.webhookEvent,
      }),
    }
  )

  if (!response.ok) {
    console.error('paypal_webhook_verify_http_failed', response.status)
    throw new Error('Unable to verify PayPal webhook.')
  }

  const data = (await response.json()) as { verification_status?: string }
  return data.verification_status === 'SUCCESS'
}

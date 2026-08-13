import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('Stripe is not configured.')
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key)
  }
  return stripeClient
}

export function getStripePriceArtistalks8Monthly(): string {
  const priceId = process.env.STRIPE_PRICE_ARTISTALKS_8_MONTHLY
  if (!priceId) {
    throw new Error('Stripe price is not configured.')
  }
  return priceId
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('Stripe webhook secret is not configured.')
  }
  return secret
}

'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from '@stripe/react-stripe-js/checkout'

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
const stripePromise = publishableKey ? loadStripe(publishableKey) : null

const appearance = {
  theme: 'night' as const,
  variables: {
    colorPrimary: '#047857',
    colorBackground: '#18181b',
    colorText: '#f4f4f5',
    colorDanger: '#f87171',
    borderRadius: '5px',
    fontFamily: 'inherit',
  },
}

type SaasPaymentElementProps = {
  clientSecret: string
  onConfirmed: () => void
  onError: (message: string) => void
}

function SubscribeForm({
  onConfirmed,
  onError,
}: {
  onConfirmed: () => void
  onError: (message: string) => void
}) {
  const checkoutState = useCheckoutElements()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubscribe() {
    if (checkoutState.type !== 'success' || submitting) return
    setSubmitting(true)
    try {
      const result = await checkoutState.checkout.confirm({
        redirect: 'if_required',
      })
      if (result.type === 'error') {
        onError(result.error.message || 'Unable to continue.')
        return
      }
      // UX only — entitlement comes from webhook + /api/saas/status.
      onConfirmed()
    } catch {
      onError('Unable to continue.')
    } finally {
      setSubmitting(false)
    }
  }

  if (checkoutState.type === 'loading') {
    return (
      <p className="text-zinc-400 text-sm text-center" style={{ marginTop: '10px' }}>
        Preparing secure card fields…
      </p>
    )
  }

  if (checkoutState.type === 'error') {
    return (
      <p className="text-red-400 text-sm text-center" style={{ marginTop: '10px' }}>
        {checkoutState.error.message || 'Unable to load card fields.'}
      </p>
    )
  }

  return (
    <div style={{ marginTop: '10px', width: '100%' }}>
      <PaymentElement options={{ layout: 'tabs' }} />
      <button
        type="button"
        onClick={() => {
          void handleSubscribe()
        }}
        disabled={submitting}
        style={{
          marginTop: '12px',
          padding: '10px',
          backgroundColor: '#047857',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: submitting ? 'not-allowed' : 'pointer',
          boxShadow: '0 0 5px rgba(255, 215, 0, 0.8)',
          width: '100%',
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting ? 'Subscribing…' : 'Subscribe — $8/month'}
      </button>
    </div>
  )
}

/**
 * ArtisTalks-owned Subscribe beat: Stripe Payment Element only for card fields.
 * Confirm success is UX-only; SaaS access stays webhook-backed.
 */
export default function SaasPaymentElement({
  clientSecret,
  onConfirmed,
  onError,
}: SaasPaymentElementProps) {
  if (!stripePromise || !publishableKey) {
    return (
      <p className="text-red-400 text-sm text-center" style={{ marginTop: '10px' }}>
        Card checkout is not available yet.
      </p>
    )
  }

  return (
    <CheckoutElementsProvider
      stripe={stripePromise}
      options={{
        clientSecret,
        elementsOptions: { appearance },
      }}
    >
      <SubscribeForm onConfirmed={onConfirmed} onError={onError} />
    </CheckoutElementsProvider>
  )
}

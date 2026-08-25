'use client'

import { useRef, useState } from 'react'
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js'

const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ''

type SaasPaypalButtonsProps = {
  onConfirmed: () => void
  onAlreadyEntitled: (
    status: 'active' | 'past_due' | 'comped'
  ) => void | Promise<void>
  onError: (message: string) => void
  disabled?: boolean
}

function PaypalSubscribeButtons({
  onConfirmed,
  onAlreadyEntitled,
  onError,
  disabled,
}: SaasPaypalButtonsProps) {
  const [busy, setBusy] = useState(false)
  const alreadyEntitledRef = useRef(false)

  return (
    <div
      style={{ marginTop: '10px', width: '100%', opacity: disabled || busy ? 0.7 : 1 }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <PayPalButtons
        disabled={disabled || busy}
        style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' }}
        createSubscription={async (_data, actions) => {
          alreadyEntitledRef.current = false
          setBusy(true)
          try {
            const res = await fetch('/api/saas/paypal/prepare', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            })
            const data = (await res.json().catch(() => ({}))) as {
              attemptId?: string
              planId?: string
              already_entitled?: boolean
              saas_subscription_status?:
                | 'active'
                | 'past_due'
                | 'comped'
                | 'inactive'
              error?: string
            }

            if (res.status === 409 && data.already_entitled) {
              alreadyEntitledRef.current = true
              const status =
                data.saas_subscription_status === 'active' ||
                data.saas_subscription_status === 'past_due' ||
                data.saas_subscription_status === 'comped'
                  ? data.saas_subscription_status
                  : 'active'
              await onAlreadyEntitled(status)
              throw new Error('already_entitled')
            }

            if (!res.ok || !data.attemptId || !data.planId) {
              throw new Error(data.error || 'Unable to continue.')
            }

            return actions.subscription.create({
              plan_id: data.planId,
              custom_id: data.attemptId,
            })
          } finally {
            setBusy(false)
          }
        }}
        onApprove={async () => {
          // UX only — entitlement comes from webhook + /api/saas/status.
          onConfirmed()
        }}
        onCancel={() => {
          setBusy(false)
        }}
        onError={() => {
          setBusy(false)
          if (alreadyEntitledRef.current) {
            alreadyEntitledRef.current = false
            return
          }
          onError('Unable to continue.')
        }}
      />
    </div>
  )
}

/**
 * ArtisTalks $8 PayPal subscribe buttons under Card.
 * onApprove is UX-only; SaaS access stays webhook-backed.
 */
export default function SaasPaypalButtons(props: SaasPaypalButtonsProps) {
  if (!paypalClientId) {
    return null
  }

  return (
    <PayPalScriptProvider
      options={{
        clientId: paypalClientId,
        vault: true,
        intent: 'subscription',
        components: 'buttons',
        disableFunding: ['card', 'credit', 'paylater'],
        enableFunding: ['venmo'],
      }}
    >
      <PaypalSubscribeButtons {...props} />
    </PayPalScriptProvider>
  )
}

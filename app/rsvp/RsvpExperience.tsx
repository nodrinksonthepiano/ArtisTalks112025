'use client'

import { useEffect, useRef, useState, useTransition } from 'react'

export type RsvpChoice = 'accepted' | 'maybe' | 'declined'
export type DisplayRsvpStatus = 'Pending' | 'Accepted' | 'Maybe' | 'Declined'

type InvitationDetails = {
  eventTitle: string
  date: string
  time: string
  timezone: string
  rsvpStatus: DisplayRsvpStatus
}

export type RsvpLookupResult =
  | { status: 'unavailable' }
  | ({ status: 'ready' | 'canceled' } & InvitationDetails)

export type RsvpResponseResult =
  | { status: 'unavailable' }
  | { status: 'updated'; rsvpStatus: Exclude<DisplayRsvpStatus, 'Pending'> }

type RsvpExperienceProps = {
  lookupAction: (rawToken: string) => Promise<RsvpLookupResult>
  respondAction: (
    rawToken: string,
    choice: RsvpChoice
  ) => Promise<RsvpResponseResult>
}

const RSVP_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export default function RsvpExperience({
  lookupAction,
  respondAction,
}: RsvpExperienceProps) {
  const tokenRef = useRef<string | null>(null)
  const lookupStartedRef = useRef(false)
  const [lookupResult, setLookupResult] = useState<RsvpLookupResult | null>(null)
  const [responseStatus, setResponseStatus] =
    useState<DisplayRsvpStatus | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (lookupStartedRef.current) return
    lookupStartedRef.current = true

    const fragment = new URLSearchParams(window.location.hash.slice(1))
    const rawToken = fragment.get('token') ?? ''
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)

    if (RSVP_TOKEN_PATTERN.test(rawToken)) tokenRef.current = rawToken

    startTransition(async () => {
      const result = await lookupAction(rawToken)
      setLookupResult(result)
      if (result.status === 'ready' || result.status === 'canceled') {
        setResponseStatus(result.rsvpStatus)
      }
    })
  }, [lookupAction])

  function submitResponse(choice: RsvpChoice) {
    const rawToken = tokenRef.current
    if (!rawToken || isPending) return

    startTransition(async () => {
      const result = await respondAction(rawToken, choice)
      if (result.status === 'updated') {
        setResponseStatus(result.rsvpStatus)
      } else {
        tokenRef.current = null
        setLookupResult({ status: 'unavailable' })
      }
    })
  }

  return (
    <section className="mx-auto flex w-full max-w-md min-h-[calc(100vh-3rem)] items-center py-6 [min-height:calc(100dvh-3rem)]">
      <div className="w-full rounded-2xl border border-[#d8ad2a] bg-[#091b54] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.3)] sm:p-7">
        {!lookupResult ? (
          <p className="text-center text-base text-[#f5f1cf]" role="status">
            Checking invitation…
          </p>
        ) : null}

        {lookupResult?.status === 'unavailable' ? (
          <div className="text-center" role="status">
            <h1 className="text-2xl font-semibold text-[#f5f1cf]">
              Invitation unavailable
            </h1>
            <p className="mt-3 text-base leading-7 text-[#b9c9b8]">
              This invitation cannot be opened.
            </p>
          </div>
        ) : null}

        {lookupResult?.status === 'ready' ||
        lookupResult?.status === 'canceled' ? (
          <div>
            <p className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-[#d8ad2a]">
              ArtisTalks
            </p>
            <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight text-[#f5f1cf]">
              {lookupResult.eventTitle}
            </h1>
            <p className="mt-5 text-lg font-semibold text-[#f5f1cf]">
              {lookupResult.date}
            </p>
            <p className="mt-1 text-lg text-[#f5f1cf]">{lookupResult.time}</p>
            <p className="mt-1 break-words text-sm text-[#b9c9b8]">
              {lookupResult.timezone}
            </p>

            {lookupResult.status === 'canceled' ? (
              <p
                className="mt-6 rounded-xl border border-[#d8ad2a] bg-[#051340] px-4 py-3 text-base font-semibold text-[#f5f1cf]"
                role="status"
              >
                This event has been canceled.
              </p>
            ) : (
              <div className="mt-7">
                {responseStatus && responseStatus !== 'Pending' ? (
                  <p
                    aria-live="polite"
                    className="mb-5 text-center text-lg font-semibold text-[#7ee2a8]"
                  >
                    RSVP: {responseStatus}
                  </p>
                ) : null}

                <div className="space-y-3" aria-label="Choose your RSVP">
                  <button
                    className="min-h-12 w-full rounded-xl border border-[#7ee2a8] bg-[#1a9f62] px-5 py-3 text-base font-bold tracking-[0.06em] text-[#051340] transition hover:bg-[#25b873] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f5f1cf] disabled:cursor-wait disabled:opacity-70"
                    disabled={isPending}
                    onClick={() => submitResponse('accepted')}
                    type="button"
                  >
                    ACCEPT
                  </button>
                  <button
                    className="min-h-12 w-full rounded-xl border border-[#d8ad2a] bg-[#d8ad2a] px-5 py-3 text-base font-bold tracking-[0.06em] text-[#051340] transition hover:bg-[#efc748] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f5f1cf] disabled:cursor-wait disabled:opacity-70"
                    disabled={isPending}
                    onClick={() => submitResponse('maybe')}
                    type="button"
                  >
                    MAYBE
                  </button>
                  <button
                    className="min-h-12 w-full rounded-xl border border-[#8796aa] bg-[#051340] px-5 py-3 text-base font-bold tracking-[0.06em] text-[#f5f1cf] transition hover:border-[#f5f1cf] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#d8ad2a] disabled:cursor-wait disabled:opacity-70"
                    disabled={isPending}
                    onClick={() => submitResponse('declined')}
                    type="button"
                  >
                    DECLINE
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}

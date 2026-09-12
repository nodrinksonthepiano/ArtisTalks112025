'use client'

import { FormEvent, useActionState, useState } from 'react'

export type ArtistLookupState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'selected'; artistName: string; eligible: boolean }

export type InvitationPreparationState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | {
      status: 'prepared'
      artistName: string
      eventTitle: string
      rsvpStatus: 'Pending'
      deliveryStatus: 'Not sent' | 'Send failed' | 'Needs verification'
    }
  | {
      status: 'sent'
      artistName: string
      eventTitle: string
      deliveryStatus: 'Sent'
    }

export type InvitationSendState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'verification'; message: string }
  | {
      status: 'sent'
      artistName: string
      eventTitle: string
      recipientCount: 1
      deliveryStatus: 'Sent'
    }

type ServerFormAction<State> = (
  previousState: State,
  formData: FormData
) => Promise<State>

type PrepareInvitationProps = {
  checkAction: ServerFormAction<ArtistLookupState>
  createAction: ServerFormAction<InvitationPreparationState>
  sendAction: ServerFormAction<InvitationSendState>
  eventTitle: string
  eventDateTime: string
  eventMeetingUrl: string | null
}

const INITIAL_LOOKUP_STATE: ArtistLookupState = { status: 'idle' }
const INITIAL_PREPARATION_STATE: InvitationPreparationState = { status: 'idle' }
const INITIAL_SEND_STATE: InvitationSendState = { status: 'idle' }

export default function PrepareInvitation({
  checkAction,
  createAction,
  sendAction,
  eventTitle,
  eventDateTime,
  eventMeetingUrl,
}: PrepareInvitationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [artistName, setArtistName] = useState('')
  const [checkedArtistName, setCheckedArtistName] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [lookupState, lookupFormAction, isLookupPending] = useActionState(
    checkAction,
    INITIAL_LOOKUP_STATE
  )
  const [preparationState, preparationFormAction, isPreparationPending] =
    useActionState(createAction, INITIAL_PREPARATION_STATE)
  const [sendState, sendFormAction, isSendPending] = useActionState(
    sendAction,
    INITIAL_SEND_STATE
  )

  const resultIsCurrent =
    lookupState.status === 'selected' &&
    checkedArtistName.trim() === artistName.trim()
  const preparedResultIsCurrent =
    resultIsCurrent &&
    (preparationState.status === 'prepared' ||
      preparationState.status === 'sent') &&
    preparationState.artistName === lookupState.artistName
  const sentResultIsCurrent =
    preparedResultIsCurrent &&
    (preparationState.status === 'sent' ||
      (sendState.status === 'sent' &&
        sendState.artistName === lookupState.artistName))
  const needsDeliveryVerification =
    preparedResultIsCurrent &&
    ((preparationState.status === 'prepared' &&
      preparationState.deliveryStatus === 'Needs verification') ||
      sendState.status === 'verification')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget)
    const submittedArtistName = formData.get('artistName')

    setCheckedArtistName(
      typeof submittedArtistName === 'string' ? submittedArtistName : ''
    )
    setShowPreview(false)
  }

  if (!isOpen) {
    return (
      <button
        className="min-h-12 w-full rounded-xl border border-[#d8ad2a] bg-[#1a9f62] px-5 py-3 text-base font-bold tracking-[0.08em] text-[#051340] transition hover:bg-[#25b873] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f5f1cf]"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        PREPARE INVITATION
      </button>
    )
  }

  return (
    <section aria-labelledby="prepare-invitation-heading">
      <h2
        className="text-xl font-semibold text-[#f5f1cf]"
        id="prepare-invitation-heading"
      >
        Prepare invitation
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#b9c9b8]">
        Check one artist by their exact artist name.
      </p>

      <form action={lookupFormAction} className="mt-5" onSubmit={handleSubmit}>
        <label
          className="block text-sm font-semibold text-[#d8ad2a]"
          htmlFor="invitation-artist-name"
        >
          Artist name
        </label>
        <input
          autoComplete="off"
          className="mt-2 block min-h-12 w-full rounded-xl border border-[#8796aa] bg-white px-3 py-2 text-base text-[#111827] shadow-sm outline-none transition focus-visible:border-[#d8ad2a] focus-visible:ring-3 focus-visible:ring-[#d8ad2a]/35 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isLookupPending || isPreparationPending || isSendPending}
          id="invitation-artist-name"
          maxLength={200}
          name="artistName"
          onChange={(event) => {
            setArtistName(event.target.value)
            setShowPreview(false)
          }}
          required
          type="text"
          value={artistName}
        />
        <button
          className="mt-4 min-h-12 w-full rounded-xl border border-[#d8ad2a] bg-[#1a9f62] px-5 py-3 text-base font-bold tracking-[0.06em] text-[#051340] transition hover:bg-[#25b873] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f5f1cf] disabled:cursor-wait disabled:opacity-70"
          disabled={isLookupPending || isPreparationPending || isSendPending}
          type="submit"
        >
          {isLookupPending ? 'CHECKING…' : 'CHECK ELIGIBILITY'}
        </button>
      </form>

      <div aria-live="polite" className="mt-5">
        {lookupState.status === 'error' ? (
          <p
            className="rounded-xl border border-[#d8ad2a] bg-[#051340] px-4 py-3 text-sm leading-6 text-[#f5f1cf]"
            role="status"
          >
            {lookupState.message}
          </p>
        ) : null}

        {resultIsCurrent ? (
          <div className="rounded-xl border border-[#d8ad2a] bg-[#051340] p-4">
            <dl className="space-y-3 text-base leading-6">
              <div>
                <dt className="font-semibold text-[#d8ad2a]">Artist</dt>
                <dd className="mt-1 break-words text-[#f5f1cf]">
                  {lookupState.artistName}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[#d8ad2a]">Eligible</dt>
                <dd className="mt-1 text-[#f5f1cf]">
                  {lookupState.eligible ? 'Yes' : 'No'}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[#d8ad2a]">Event</dt>
                <dd className="mt-1 break-words text-[#f5f1cf]">
                  {eventTitle}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[#d8ad2a]">When</dt>
                <dd className="mt-1 text-[#f5f1cf]">{eventDateTime}</dd>
              </div>
            </dl>

            {lookupState.eligible ? (
              <button
                className="mt-5 min-h-12 w-full rounded-xl border border-[#d8ad2a] bg-[#d8ad2a] px-5 py-3 text-base font-bold tracking-[0.06em] text-[#051340] transition hover:bg-[#efc748] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f5f1cf]"
                onClick={() => setShowPreview((visible) => !visible)}
                type="button"
              >
                PREVIEW INVITATION
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {resultIsCurrent && lookupState.eligible && showPreview ? (
        <section
          aria-labelledby="invitation-preview-heading"
          className="mt-5 rounded-xl border border-[#7ee2a8] bg-[#0b2458] p-4"
        >
          <h3
            className="text-lg font-semibold text-[#f5f1cf]"
            id="invitation-preview-heading"
          >
            Invitation Preview
          </h3>
          <dl className="mt-4 space-y-3 text-base leading-6">
            <div>
              <dt className="font-semibold text-[#d8ad2a]">For</dt>
              <dd className="mt-1 break-words text-[#f5f1cf]">
                {lookupState.artistName}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-[#d8ad2a]">Event</dt>
              <dd className="mt-1 break-words text-[#f5f1cf]">{eventTitle}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[#d8ad2a]">When</dt>
              <dd className="mt-1 text-[#f5f1cf]">{eventDateTime}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[#d8ad2a]">Status</dt>
              <dd className="mt-1 font-semibold text-[#7ee2a8]">NOT SENT</dd>
            </div>
          </dl>

          {preparedResultIsCurrent ? (
            <div className="mt-5 rounded-xl border border-[#7ee2a8] bg-[#051340] p-4">
              <h4
                aria-live="polite"
                className="text-lg font-semibold text-[#7ee2a8]"
              >
                {sentResultIsCurrent
                  ? 'Invitation sent.'
                  : 'Invitation prepared'}
              </h4>
              <dl className="mt-4 space-y-3 text-base leading-6">
                <div>
                  <dt className="font-semibold text-[#d8ad2a]">Recipient</dt>
                  <dd className="mt-1 break-words text-[#f5f1cf]">
                    {preparationState.artistName}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#d8ad2a]">
                    Recipient count
                  </dt>
                  <dd className="mt-1 text-[#f5f1cf]">1</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#d8ad2a]">Event</dt>
                  <dd className="mt-1 break-words text-[#f5f1cf]">
                    {preparationState.eventTitle}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#d8ad2a]">When</dt>
                  <dd className="mt-1 text-[#f5f1cf]">{eventDateTime}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#d8ad2a]">Meeting</dt>
                  <dd className="mt-1 break-all text-[#f5f1cf]">
                    {eventMeetingUrl ? (
                      <a
                        className="text-[#7ee2a8] underline decoration-2 underline-offset-4 hover:text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#d8ad2a]"
                        href={eventMeetingUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {eventMeetingUrl}
                      </a>
                    ) : (
                      'Not added'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#d8ad2a]">Delivery</dt>
                  <dd className="mt-1 text-[#f5f1cf]">
                    {sentResultIsCurrent
                      ? 'Sent'
                      : preparationState.deliveryStatus}
                  </dd>
                </div>
              </dl>

              {!sentResultIsCurrent && !eventMeetingUrl ? (
                <p
                  className="mt-5 rounded-xl border border-[#d8ad2a] px-4 py-3 text-sm leading-6 text-[#f5f1cf]"
                  role="status"
                >
                  Add a meeting link before sending.
                </p>
              ) : null}

              {!sentResultIsCurrent && needsDeliveryVerification ? (
                <p
                  className="mt-5 rounded-xl border border-[#d8ad2a] px-4 py-3 text-sm leading-6 text-[#f5f1cf]"
                  role="status"
                >
                  Delivery status needs verification.
                </p>
              ) : null}

              {!sentResultIsCurrent &&
              eventMeetingUrl &&
              !needsDeliveryVerification ? (
                <form action={sendFormAction} className="mt-5">
                  <input
                    name="artistName"
                    type="hidden"
                    value={lookupState.artistName}
                  />
                  <button
                    className="min-h-12 w-full rounded-xl border border-[#7ee2a8] bg-[#1a9f62] px-5 py-3 text-base font-bold tracking-[0.06em] text-[#051340] transition hover:bg-[#25b873] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f5f1cf] disabled:cursor-wait disabled:opacity-70"
                    disabled={isSendPending}
                    type="submit"
                  >
                    {isSendPending ? 'SENDING…' : 'CONFIRM SEND'}
                  </button>
                  {sendState.status === 'error' ? (
                    <p
                      className="mt-3 rounded-xl border border-[#d8ad2a] px-4 py-3 text-sm leading-6 text-[#f5f1cf]"
                      role="status"
                    >
                      {sendState.message}
                    </p>
                  ) : null}
                </form>
              ) : null}
            </div>
          ) : (
            <form action={preparationFormAction} className="mt-5">
              <input
                name="artistName"
                type="hidden"
                value={lookupState.artistName}
              />
              <button
                className="min-h-12 w-full rounded-xl border border-[#7ee2a8] bg-[#1a9f62] px-5 py-3 text-base font-bold tracking-[0.06em] text-[#051340] transition hover:bg-[#25b873] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f5f1cf] disabled:cursor-wait disabled:opacity-70"
                disabled={isPreparationPending}
                type="submit"
              >
                {isPreparationPending
                  ? 'CREATING INVITATION…'
                  : 'CREATE INVITATION'}
              </button>
              {preparationState.status === 'error' ? (
                <p
                  className="mt-3 rounded-xl border border-[#d8ad2a] bg-[#051340] px-4 py-3 text-sm leading-6 text-[#f5f1cf]"
                  role="status"
                >
                  {preparationState.message}
                </p>
              ) : null}
            </form>
          )}
        </section>
      ) : null}
    </section>
  )
}

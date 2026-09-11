'use client'

import { FormEvent, useActionState, useState } from 'react'

export type ArtistLookupState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'selected'; artistName: string; eligible: boolean }

type ArtistLookupAction = (
  previousState: ArtistLookupState,
  formData: FormData
) => Promise<ArtistLookupState>

type PrepareInvitationProps = {
  action: ArtistLookupAction
  eventTitle: string
  eventDateTime: string
}

const INITIAL_STATE: ArtistLookupState = { status: 'idle' }

export default function PrepareInvitation({
  action,
  eventTitle,
  eventDateTime,
}: PrepareInvitationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [artistName, setArtistName] = useState('')
  const [checkedArtistName, setCheckedArtistName] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE)

  const resultIsCurrent =
    state.status === 'selected' &&
    checkedArtistName.trim() === artistName.trim()

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

      <form action={formAction} className="mt-5" onSubmit={handleSubmit}>
        <label
          className="block text-sm font-semibold text-[#d8ad2a]"
          htmlFor="invitation-artist-name"
        >
          Artist name
        </label>
        <input
          autoComplete="off"
          className="mt-2 block min-h-12 w-full rounded-xl border border-[#8796aa] bg-white px-3 py-2 text-base text-[#111827] shadow-sm outline-none transition focus-visible:border-[#d8ad2a] focus-visible:ring-3 focus-visible:ring-[#d8ad2a]/35 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isPending}
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
          disabled={isPending}
          type="submit"
        >
          {isPending ? 'CHECKING…' : 'CHECK ELIGIBILITY'}
        </button>
      </form>

      <div aria-live="polite" className="mt-5">
        {state.status === 'error' ? (
          <p
            className="rounded-xl border border-[#d8ad2a] bg-[#051340] px-4 py-3 text-sm leading-6 text-[#f5f1cf]"
            role="status"
          >
            {state.message}
          </p>
        ) : null}

        {resultIsCurrent ? (
          <div className="rounded-xl border border-[#d8ad2a] bg-[#051340] p-4">
            <dl className="space-y-3 text-base leading-6">
              <div>
                <dt className="font-semibold text-[#d8ad2a]">Artist</dt>
                <dd className="mt-1 break-words text-[#f5f1cf]">
                  {state.artistName}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[#d8ad2a]">Eligible</dt>
                <dd className="mt-1 text-[#f5f1cf]">
                  {state.eligible ? 'Yes' : 'No'}
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

            {state.eligible ? (
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

      {resultIsCurrent && state.eligible && showPreview ? (
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
                {state.artistName}
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
        </section>
      ) : null}
    </section>
  )
}

'use client'

import {
  type FormEvent,
  type KeyboardEvent,
  useId,
  useMemo,
  useState,
  useTransition,
} from 'react'

export type ArtistSelectionOption = { name: string; handle: string }
export type GroupSelectionOption = { name: string; handle: string }
export type CreateGroupState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'saved'; group: GroupSelectionOption; memberNames: string[] }
export type RecipientPreviewState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | {
      status: 'preview'
      recipientNames: string[]
      recipientCount: number
      eventTitle: string
      eventDateTime: string
      delivery: 'Not sent' | 'Sent' | 'Needs verification' | 'Mixed'
      recipientSetDigest: string
    }

type ServerFormAction<State> = (
  previousState: State,
  formData: FormData
) => Promise<State>
type PrepareInvitationProps = {
  artistOptions: ArtistSelectionOption[]
  groupOptions: GroupSelectionOption[]
  canPrepare: boolean
  createGroupAction: ServerFormAction<CreateGroupState>
  previewAction: ServerFormAction<RecipientPreviewState>
}
type ArtistComboboxProps = {
  label: string
  options: ArtistSelectionOption[]
  selectedHandles: string[]
  onChange: (handles: string[]) => void
  multiple?: boolean
  disabled?: boolean
}

const INITIAL_GROUP_STATE: CreateGroupState = { status: 'idle' }
const INITIAL_PREVIEW_STATE: RecipientPreviewState = { status: 'idle' }

function ArtistCombobox({
  label,
  options,
  selectedHandles,
  onChange,
  multiple = false,
  disabled = false,
}: ArtistComboboxProps) {
  const inputId = useId()
  const listboxId = useId()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const selected = useMemo(
    () => options.filter((option) => selectedHandles.includes(option.handle)),
    [options, selectedHandles]
  )
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('en-US')
    return normalized
      ? options.filter((option) =>
          option.name.toLocaleLowerCase('en-US').includes(normalized)
        )
      : options
  }, [options, query])

  function choose(option: ArtistSelectionOption) {
    if (multiple) {
      onChange(
        selectedHandles.includes(option.handle)
          ? selectedHandles.filter((handle) => handle !== option.handle)
          : [...selectedHandles, option.handle]
      )
      setQuery('')
      setActiveIndex(0)
    } else {
      onChange([option.handle])
      setQuery(option.name)
      setIsOpen(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setIsOpen(false)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((current) => {
        if (filtered.length === 0) return 0
        const change = event.key === 'ArrowDown' ? 1 : -1
        return (current + change + filtered.length) % filtered.length
      })
      return
    }
    if (event.key === 'Enter' && isOpen && filtered[activeIndex]) {
      event.preventDefault()
      choose(filtered[activeIndex])
    }
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-[#d8ad2a]" htmlFor={inputId}>
        {label}
      </label>
      <div
        className="relative mt-2"
        onBlur={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            setIsOpen(false)
          }
        }}
      >
        <input
          aria-activedescendant={
            isOpen && filtered[activeIndex]
              ? listboxId + '-option-' + activeIndex
              : undefined
          }
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          autoComplete="off"
          className="block min-h-12 w-full rounded-xl border border-[#8796aa] bg-white px-3 py-2 text-base text-[#111827] shadow-sm outline-none transition focus-visible:border-[#d8ad2a] focus-visible:ring-3 focus-visible:ring-[#d8ad2a]/35 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={disabled}
          id={inputId}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
            setIsOpen(true)
            if (!multiple && selectedHandles.length > 0) onChange([])
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search eligible artists"
          role="combobox"
          type="text"
          value={query}
        />

        {isOpen && !disabled ? (
          <div
            aria-multiselectable={multiple || undefined}
            className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[#d8ad2a] bg-[#051340] p-1 shadow-2xl"
            id={listboxId}
            onMouseDown={(event) => event.preventDefault()}
            role="listbox"
          >
            {filtered.length ? (
              filtered.map((option, index) => {
                const isSelected = selectedHandles.includes(option.handle)
                return (
                  <button
                    aria-selected={isSelected}
                    className={
                      'min-h-12 w-full rounded-lg px-3 py-2 text-left text-base text-[#f5f1cf] ' +
                      (index === activeIndex
                        ? 'bg-[#1a9f62] text-[#051340]'
                        : 'hover:bg-[#0b2458]')
                    }
                    id={listboxId + '-option-' + index}
                    key={option.handle}
                    onClick={() => choose(option)}
                    role="option"
                    tabIndex={-1}
                    type="button"
                  >
                    {isSelected ? '✓ ' : ''}
                    {option.name}
                  </button>
                )
              })
            ) : (
              <div aria-selected="false" className="px-3 py-4 text-sm text-[#b9c9b8]" role="option">
                No eligible artist matches that search.
              </div>
            )}
          </div>
        ) : null}
      </div>

      {selected.length ? (
        <ul aria-label="Selected artists" className="mt-3 flex flex-wrap gap-2">
          {selected.map((option) => (
            <li key={option.handle}>
              <button
                className="min-h-12 rounded-full border border-[#7ee2a8] bg-[#0b2458] px-4 py-2 text-sm text-[#f5f1cf] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#d8ad2a]"
                disabled={disabled}
                onClick={() => {
                  onChange(selectedHandles.filter((handle) => handle !== option.handle))
                  if (!multiple) setQuery('')
                }}
                type="button"
              >
                {option.name} <span aria-hidden="true">×</span>
                <span className="sr-only"> Remove</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default function PrepareInvitation({
  artistOptions,
  groupOptions,
  canPrepare,
  createGroupAction,
  previewAction,
}: PrepareInvitationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<'artist' | 'group'>('artist')
  const [selectedArtistHandles, setSelectedArtistHandles] = useState<string[]>([])
  const [groups, setGroups] = useState(groupOptions)
  const [groupChoice, setGroupChoice] = useState('all_eligible')
  const [groupName, setGroupName] = useState('')
  const [groupMemberHandles, setGroupMemberHandles] = useState<string[]>([])
  const [groupState, setGroupState] = useState<CreateGroupState>(INITIAL_GROUP_STATE)
  const [previewState, setPreviewState] =
    useState<RecipientPreviewState>(INITIAL_PREVIEW_STATE)
  const [isGroupPending, startGroupTransition] = useTransition()
  const [isPreviewPending, startPreviewTransition] = useTransition()

  function clearPreview() {
    setPreviewState(INITIAL_PREVIEW_STATE)
  }

  function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData()
    formData.set('groupName', groupName)
    for (const handle of groupMemberHandles) formData.append('artistHandle', handle)

    startGroupTransition(async () => {
      try {
        const next = await createGroupAction(groupState, formData)
        setGroupState(next)
        if (next.status === 'saved') {
          setGroups((current) => [
            ...current.filter((group) => group.handle !== next.group.handle),
            next.group,
          ])
          setGroupChoice(next.group.handle)
          setGroupName('')
          setGroupMemberHandles([])
          clearPreview()
        }
      } catch {
        setGroupState({ status: 'error', message: 'Unable to save group.' })
      }
    })
  }

  function submitPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData()
    if (mode === 'artist') {
      formData.set('selectionKind', 'artist')
      formData.set('selectionHandle', selectedArtistHandles[0] ?? '')
    } else if (groupChoice === 'all_eligible') {
      formData.set('selectionKind', 'all_eligible')
    } else {
      formData.set('selectionKind', 'group')
      formData.set('selectionHandle', groupChoice)
    }

    startPreviewTransition(async () => {
      try {
        setPreviewState(await previewAction(previewState, formData))
      } catch {
        setPreviewState({ status: 'error', message: 'Unable to preview invitations.' })
      }
    })
  }

  if (!canPrepare) {
    return (
      <p className="rounded-xl border border-[#d8ad2a] bg-[#051340] px-4 py-3 text-sm leading-6 text-[#f5f1cf]">
        Invitations cannot be prepared for a canceled event.
      </p>
    )
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

  const previewDisabled =
    isPreviewPending ||
    isGroupPending ||
    (mode === 'artist' && selectedArtistHandles.length !== 1) ||
    (mode === 'group' && groupChoice === 'create')

  return (
    <section aria-labelledby="prepare-invitation-heading">
      <h2 className="text-xl font-semibold text-[#f5f1cf]" id="prepare-invitation-heading">
        Prepare invitation
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#b9c9b8]">
        Choose one eligible artist or a group. This preview sends nothing.
      </p>

      <div aria-label="Invitation recipient type" className="mt-5 grid grid-cols-2 gap-2">
        {(['artist', 'group'] as const).map((choice) => (
          <button
            aria-pressed={mode === choice}
            className={
              'min-h-12 rounded-xl border px-3 py-2 text-sm font-bold tracking-[0.05em] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f5f1cf] ' +
              (mode === choice
                ? 'border-[#d8ad2a] bg-[#d8ad2a] text-[#051340]'
                : 'border-[#8796aa] bg-[#051340] text-[#f5f1cf]')
            }
            key={choice}
            onClick={() => {
              setMode(choice)
              clearPreview()
            }}
            type="button"
          >
            {choice === 'artist' ? 'ONE ARTIST' : 'GROUP'}
          </button>
        ))}
      </div>

      {mode === 'artist' ? (
        <div className="mt-5">
          <ArtistCombobox
            disabled={isGroupPending || isPreviewPending}
            label="Eligible artist"
            onChange={(handles) => {
              setSelectedArtistHandles(handles.slice(0, 1))
              clearPreview()
            }}
            options={artistOptions}
            selectedHandles={selectedArtistHandles}
          />
        </div>
      ) : (
        <div className="mt-5">
          <label className="block text-sm font-semibold text-[#d8ad2a]" htmlFor="invitation-group">
            Group
          </label>
          <select
            className="mt-2 block min-h-12 w-full rounded-xl border border-[#8796aa] bg-white px-3 py-2 text-base text-[#111827] shadow-sm outline-none focus-visible:border-[#d8ad2a] focus-visible:ring-3 focus-visible:ring-[#d8ad2a]/35"
            disabled={isGroupPending || isPreviewPending}
            id="invitation-group"
            onChange={(event) => {
              setGroupChoice(event.target.value)
              setGroupState(INITIAL_GROUP_STATE)
              clearPreview()
            }}
            value={groupChoice}
          >
            <option value="all_eligible">All eligible artists</option>
            {groups.map((group) => (
              <option key={group.handle} value={group.handle}>{group.name}</option>
            ))}
            <option value="create">Create a group…</option>
          </select>

          {groupChoice === 'create' ? (
            <form className="mt-5 rounded-xl border border-[#d8ad2a] bg-[#051340] p-4" onSubmit={submitGroup}>
              <h3 className="text-lg font-semibold text-[#f5f1cf]">Create a group</h3>
              <label className="mt-4 block text-sm font-semibold text-[#d8ad2a]" htmlFor="new-invitation-group-name">
                Group name
              </label>
              <input
                autoComplete="off"
                className="mt-2 block min-h-12 w-full rounded-xl border border-[#8796aa] bg-white px-3 py-2 text-base text-[#111827] shadow-sm outline-none focus-visible:border-[#d8ad2a] focus-visible:ring-3 focus-visible:ring-[#d8ad2a]/35"
                disabled={isGroupPending}
                id="new-invitation-group-name"
                maxLength={100}
                onChange={(event) => setGroupName(event.target.value)}
                required
                type="text"
                value={groupName}
              />
              <div className="mt-5">
                <ArtistCombobox
                  disabled={isGroupPending}
                  label="Eligible artists"
                  multiple
                  onChange={setGroupMemberHandles}
                  options={artistOptions}
                  selectedHandles={groupMemberHandles}
                />
              </div>
              <button
                className="mt-5 min-h-12 w-full rounded-xl border border-[#7ee2a8] bg-[#1a9f62] px-5 py-3 text-base font-bold tracking-[0.06em] text-[#051340] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f5f1cf] disabled:cursor-wait disabled:opacity-60"
                disabled={isGroupPending || !groupName.trim() || groupMemberHandles.length === 0}
                type="submit"
              >
                {isGroupPending ? 'SAVING…' : 'SAVE GROUP'}
              </button>
            </form>
          ) : null}
        </div>
      )}

      <div aria-live="polite" className="mt-4">
        {groupState.status === 'error' ? (
          <p className="rounded-xl border border-[#d8ad2a] bg-[#051340] px-4 py-3 text-sm leading-6 text-[#f5f1cf]" role="status">
            {groupState.message}
          </p>
        ) : null}
        {groupState.status === 'saved' ? (
          <p className="rounded-xl border border-[#7ee2a8] bg-[#051340] px-4 py-3 text-sm leading-6 text-[#f5f1cf]" role="status">
            Group saved: {groupState.group.name} ({groupState.memberNames.length}{' '}
            {groupState.memberNames.length === 1 ? 'artist' : 'artists'})
          </p>
        ) : null}
      </div>

      <form className="mt-5" onSubmit={submitPreview}>
        <button
          className="min-h-12 w-full rounded-xl border border-[#d8ad2a] bg-[#d8ad2a] px-5 py-3 text-base font-bold tracking-[0.06em] text-[#051340] transition hover:bg-[#efc748] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f5f1cf] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={previewDisabled}
          type="submit"
        >
          {isPreviewPending ? 'PREVIEWING…' : 'PREVIEW INVITATIONS'}
        </button>
      </form>

      <div aria-live="polite" className="mt-5">
        {previewState.status === 'error' ? (
          <p className="rounded-xl border border-[#d8ad2a] bg-[#051340] px-4 py-3 text-sm leading-6 text-[#f5f1cf]" role="status">
            {previewState.message}
          </p>
        ) : null}
        {previewState.status === 'preview' ? (
          <section aria-labelledby="invitation-preview-heading" className="rounded-xl border border-[#7ee2a8] bg-[#0b2458] p-4">
            <h3 className="text-lg font-semibold text-[#f5f1cf]" id="invitation-preview-heading">
              Invitation Preview
            </h3>
            <dl className="mt-4 space-y-3 text-base leading-6">
              <div>
                <dt className="font-semibold text-[#d8ad2a]">Selected</dt>
                <dd className="mt-1 text-[#f5f1cf]">
                  <ul className="list-disc space-y-1 pl-5">
                    {previewState.recipientNames.map((name, index) => (
                      <li className="break-words" key={name + '-' + index}>{name}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[#d8ad2a]">Recipient count</dt>
                <dd className="mt-1 text-[#f5f1cf]">{previewState.recipientCount}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[#d8ad2a]">Event</dt>
                <dd className="mt-1 break-words text-[#f5f1cf]">{previewState.eventTitle}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[#d8ad2a]">When</dt>
                <dd className="mt-1 text-[#f5f1cf]">{previewState.eventDateTime}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[#d8ad2a]">Delivery</dt>
                <dd className="mt-1 font-semibold text-[#7ee2a8]">{previewState.delivery}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm leading-6 text-[#b9c9b8]">
              Preview only. No invitations were created or sent.
            </p>
          </section>
        ) : null}
      </div>
    </section>
  )
}

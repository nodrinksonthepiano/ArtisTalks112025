import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CreateEventForm from './CreateEventForm'
import { requireJaiAdmin } from '@/utils/supabase/requireJaiAdmin'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Create Event | ArtisTalks',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function CreateEventPage() {
  const authorization = await requireJaiAdmin()

  if (!authorization.ok) {
    notFound()
  }

  return (
    <main
      className="min-h-screen bg-[#051340] px-4 text-[#f5f1cf] [min-height:100dvh] sm:px-6"
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <section className="mx-auto w-full max-w-xl">
        <header className="mb-6">
          <p className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-[#d8ad2a]">
            ArtisTalks
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#f5f1cf] sm:text-4xl">
            Create an event
          </h1>
          <p className="mt-3 max-w-prose text-base leading-7 text-[#dce7d0]">
            Save the event basics now. This creates a private draft and sends
            nothing.
          </p>
        </header>

        <CreateEventForm />
      </section>
    </main>
  )
}

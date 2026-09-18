import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import KeyboardFocusPrototype from './KeyboardFocusPrototype'

export const metadata: Metadata = {
  title: 'Keyboard Focus Prototype',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
}

export default function KeyboardFocusPrototypePage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }

  return <KeyboardFocusPrototype />
}

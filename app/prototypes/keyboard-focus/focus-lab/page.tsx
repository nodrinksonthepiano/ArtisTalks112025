import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import FocusLab from './FocusLab'

export const metadata: Metadata = {
  title: 'iPhone Focus Lab',
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

export default function FocusLabPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }

  return <FocusLab />
}

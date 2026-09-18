'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './focus-lab.module.css'

type CaseId = 'A' | 'B' | 'C'

type FocusSnapshot = {
  focusedCase: CaseId | null
  activeElement: string
  keyboardInferred: boolean
  visualViewportHeight: number
  visualViewportOffsetTop: number
  windowInnerHeight: number
}

const INITIAL_SNAPSHOT: FocusSnapshot = {
  focusedCase: null,
  activeElement: 'none',
  keyboardInferred: false,
  visualViewportHeight: 0,
  visualViewportOffsetTop: 0,
  windowInnerHeight: 0,
}

function roundMetric(value: number): number {
  return Math.round(value * 10) / 10
}

function activeElementLabel(element: Element | null): string {
  if (!(element instanceof HTMLElement)) return 'none'
  const tag = element.tagName.toLowerCase()
  return element.id ? `${tag}#${element.id}` : tag
}

function focusedCaseFromElement(element: Element | null): CaseId | null {
  if (!(element instanceof HTMLTextAreaElement)) return null
  const caseId = element.dataset.focusCase
  return caseId === 'A' || caseId === 'B' || caseId === 'C' ? caseId : null
}

function CaseTelemetry({
  caseId,
  snapshot,
}: {
  caseId: CaseId
  snapshot: FocusSnapshot
}) {
  const focused = snapshot.focusedCase === caseId

  return (
    <dl className={styles.telemetry}>
      <div>
        <dt>focused</dt>
        <dd data-positive={focused}>{focused ? 'yes' : 'no'}</dd>
      </div>
      <div>
        <dt>document.activeElement</dt>
        <dd>{snapshot.activeElement}</dd>
      </div>
      <div>
        <dt>keyboard inferred</dt>
        <dd>{snapshot.keyboardInferred ? 'open' : 'closed'}</dd>
      </div>
      <div>
        <dt>visualViewport.height</dt>
        <dd>{snapshot.visualViewportHeight}px</dd>
      </div>
      <div>
        <dt>visualViewport.offsetTop</dt>
        <dd>{snapshot.visualViewportOffsetTop}px</dd>
      </div>
      <div>
        <dt>window.innerHeight</dt>
        <dd>{snapshot.windowInnerHeight}px</dd>
      </div>
    </dl>
  )
}

export default function FocusLab() {
  const caseARef = useRef<HTMLTextAreaElement>(null)
  const caseBRef = useRef<HTMLTextAreaElement>(null)
  const caseCRef = useRef<HTMLTextAreaElement>(null)
  const closedViewportHeightRef = useRef(0)
  const [snapshot, setSnapshot] =
    useState<FocusSnapshot>(INITIAL_SNAPSHOT)

  const readFocusSnapshot = useCallback(() => {
    const visualViewport = window.visualViewport
    const visualViewportHeight =
      visualViewport?.height || window.innerHeight
    const focusedElement = document.activeElement
    const focusedCase = focusedCaseFromElement(focusedElement)

    if (closedViewportHeightRef.current === 0) {
      closedViewportHeightRef.current = visualViewportHeight
    }

    const keyboardThreshold = Math.max(
      100,
      closedViewportHeightRef.current * 0.18
    )
    const keyboardInferred =
      focusedCase !== null &&
      closedViewportHeightRef.current - visualViewportHeight >
        keyboardThreshold

    if (
      focusedCase === null &&
      !keyboardInferred &&
      visualViewportHeight > closedViewportHeightRef.current
    ) {
      closedViewportHeightRef.current = visualViewportHeight
    }

    setSnapshot({
      focusedCase,
      activeElement: activeElementLabel(focusedElement),
      keyboardInferred,
      visualViewportHeight: roundMetric(visualViewportHeight),
      visualViewportOffsetTop: roundMetric(
        visualViewport?.offsetTop || 0
      ),
      windowInnerHeight: roundMetric(window.innerHeight),
    })
  }, [])

  useEffect(() => {
    const visualViewport = window.visualViewport

    document.addEventListener('focusin', readFocusSnapshot)
    document.addEventListener('focusout', readFocusSnapshot)
    visualViewport?.addEventListener('resize', readFocusSnapshot)
    visualViewport?.addEventListener('scroll', readFocusSnapshot)
    window.addEventListener('resize', readFocusSnapshot)

    return () => {
      document.removeEventListener('focusin', readFocusSnapshot)
      document.removeEventListener('focusout', readFocusSnapshot)
      visualViewport?.removeEventListener('resize', readFocusSnapshot)
      visualViewport?.removeEventListener('scroll', readFocusSnapshot)
      window.removeEventListener('resize', readFocusSnapshot)
    }
  }, [readFocusSnapshot])

  const handleCaseC = () => {
    const textarea = caseCRef.current
    if (!textarea) return
    textarea.readOnly = false
    textarea.focus()
  }

  return (
    <main className={styles.root}>
      <header className={styles.header}>
        <p>TEST ONLY · IPHONE SAFARI</p>
        <h1>Trusted Gesture Focus Lab</h1>
        <span>
          Reload before each case. The visible native keyboard is the
          authority; inference is supporting telemetry only.
        </span>
      </header>

      <section className={styles.caseGrid} aria-label="Focus experiments">
        <article className={`${styles.caseCard} ${styles.caseA}`}>
          <div className={styles.caseHeading}>
            <span>A</span>
            <div>
              <h2>Direct tap</h2>
              <p>Editable from initial render. Tap the textarea once.</p>
            </div>
          </div>
          <textarea
            ref={caseARef}
            id="focus-lab-case-a"
            data-focus-case="A"
            defaultValue="Case A is already editable."
            aria-label="Case A editable textarea"
          />
          <CaseTelemetry
            caseId="A"
            snapshot={snapshot}
          />
        </article>

        <article className={`${styles.caseCard} ${styles.caseB}`}>
          <div className={styles.caseHeading}>
            <span>B</span>
            <div>
              <h2>Button → already-editable field</h2>
              <p>Tap only the Focus button once.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => caseBRef.current?.focus()}
          >
            Focus already-editable field
          </button>
          <textarea
            ref={caseBRef}
            id="focus-lab-case-b"
            data-focus-case="B"
            defaultValue="Case B was editable before the button gesture."
            aria-label="Case B editable textarea"
          />
          <CaseTelemetry
            caseId="B"
            snapshot={snapshot}
          />
        </article>

        <article className={`${styles.caseCard} ${styles.caseC}`}>
          <div className={styles.caseHeading}>
            <span>C</span>
            <div>
              <h2>Button → readOnly change → focus</h2>
              <p>Tap only the Make editable and focus button once.</p>
            </div>
          </div>
          <button type="button" onClick={handleCaseC}>
            Make editable and focus
          </button>
          <textarea
            ref={caseCRef}
            id="focus-lab-case-c"
            data-focus-case="C"
            defaultValue="Case C begins read-only."
            readOnly
            aria-label="Case C initially read-only textarea"
          />
          <CaseTelemetry
            caseId="C"
            snapshot={snapshot}
          />
        </article>
      </section>
    </main>
  )
}

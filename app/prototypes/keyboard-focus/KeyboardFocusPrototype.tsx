'use client'

import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import styles from './prototype.module.css'

type PrototypeMode =
  | 'viewing'
  | 'colorEditing'
  | 'answering'
  | 'affirmationEditing'

type ColorGroup = 'primary' | 'accent'

type ViewportChangeKind =
  | 'initial'
  | 'stable'
  | 'keyboard'
  | 'toolbar'
  | 'rotation'
  | 'zoom'

type Diagnostics = {
  visualViewportHeight: number
  visualViewportOffsetTop: number
  windowInnerHeight: number
  rootRectTop: number
  rawStageRectTop: number
  stageTopRelativeRoot: number
  layoutDrift: number
  layoutStabilityPass: boolean
  stageTopRelativeVisualViewport: number
  visibleViewportDrift: number
  visibleViewportStabilityPass: boolean
  stageHeight: number
  activeStageItemId: string
  focusedElement: string
  composerTop: number
  composerBottom: number
  keyboardOpen: boolean
  viewportChangeKind: ViewportChangeKind
  composerVisible: boolean
  activeTargetVisible: boolean
}

type StageItem = {
  id: string
  eyebrow: string
  title: string
  body: string
}

const STAGE_ITEMS: StageItem[] = [
  {
    id: 'artist-world',
    eyebrow: 'STAGE FIXTURE 01',
    title: 'The artist world',
    body: 'A stable featured surface while the Emerald changes state.',
  },
  {
    id: 'visual-language',
    eyebrow: 'STAGE FIXTURE 02',
    title: 'Visual language',
    body: 'Color changes may repaint this card without changing its identity.',
  },
  {
    id: 'release-proof',
    eyebrow: 'STAGE FIXTURE 03',
    title: 'Release proof',
    body: 'Explicit Stage selection is separate from focus and keyboard movement.',
  },
]

const PRIMARY_SWATCHES = ['#064e3b', '#0f766e', '#1d4ed8', '#7c3aed']
const ACCENT_SWATCHES = ['#fef3c7', '#fbbf24', '#f9a8d4', '#bfdbfe']

const INITIAL_DIAGNOSTICS: Diagnostics = {
  visualViewportHeight: 0,
  visualViewportOffsetTop: 0,
  windowInnerHeight: 0,
  rootRectTop: 0,
  rawStageRectTop: 0,
  stageTopRelativeRoot: 0,
  layoutDrift: 0,
  layoutStabilityPass: true,
  stageTopRelativeVisualViewport: 0,
  visibleViewportDrift: 0,
  visibleViewportStabilityPass: true,
  stageHeight: 0,
  activeStageItemId: STAGE_ITEMS[0].id,
  focusedElement: 'none',
  composerTop: 0,
  composerBottom: 0,
  keyboardOpen: false,
  viewportChangeKind: 'initial',
  composerVisible: true,
  activeTargetVisible: true,
}

function isEditableElement(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false
  return (
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.isContentEditable
  )
}

function focusedElementLabel(element: Element | null): string {
  if (!(element instanceof HTMLElement)) return 'none'
  const tag = element.tagName.toLowerCase()
  return element.id ? `${tag}#${element.id}` : tag
}

function roundMetric(value: number): number {
  return Math.round(value * 10) / 10
}

export default function KeyboardFocusPrototype() {
  const rootRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLElement>(null)
  const lowerWorldRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLElement>(null)
  const answerInputRef = useRef<HTMLInputElement>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)
  const affirmationInputRef = useRef<HTMLTextAreaElement>(null)
  const updateFrameRef = useRef<number | null>(null)
  const rotationTimerRef = useRef<number | null>(null)

  const [mode, setMode] = useState<PrototypeMode>('viewing')
  const modeRef = useRef<PrototypeMode>('viewing')
  const [activeStageItemId, setActiveStageItemId] = useState(STAGE_ITEMS[0].id)
  const activeStageItemIdRef = useRef(STAGE_ITEMS[0].id)
  const [colorGroup, setColorGroup] = useState<ColorGroup>('primary')
  const [colors, setColors] = useState({
    primary: '#064e3b',
    accent: '#fef3c7',
  })
  const [answer, setAnswer] = useState(
    'I am building a release experience that stays focused.'
  )
  const [submittedAnswer, setSubmittedAnswer] = useState('')
  const [affirmation, setAffirmation] = useState(
    'I am so happy and grateful now that my artist world is becoming clear, useful, and alive.'
  )
  const [diagnosticsExpanded, setDiagnosticsExpanded] = useState(false)
  const [diagnostics, setDiagnostics] =
    useState<Diagnostics>(INITIAL_DIAGNOSTICS)

  const viewportStateRef = useRef({
    closedHeight: 0,
    lastHeight: 0,
    lastOffsetTop: 0,
    lastWidth: 0,
    lastScale: 1,
    orientation: '',
    keyboardOpen: false,
  })

  const focusBaselineRef = useRef({
    stageTopRelativeRoot: 0,
    stageTopRelativeVisualViewport: 0,
    stageHeight: 0,
    stageItemId: STAGE_ITEMS[0].id,
    captured: false,
  })

  const activeStageItem = useMemo(
    () =>
      STAGE_ITEMS.find((item) => item.id === activeStageItemId) ||
      STAGE_ITEMS[0],
    [activeStageItemId]
  )

  const activeColor = colorGroup === 'primary' ? colors.primary : colors.accent
  const activeSwatches =
    colorGroup === 'primary' ? PRIMARY_SWATCHES : ACCENT_SWATCHES

  const getActiveEditingTarget = useCallback((): HTMLElement | null => {
    switch (modeRef.current) {
      case 'answering':
        return answerInputRef.current
      case 'colorEditing':
        return colorInputRef.current
      case 'affirmationEditing':
        return affirmationInputRef.current
      default:
        return null
    }
  }, [])

  const keepArtifactTargetVisible = useCallback(() => {
    if (modeRef.current !== 'affirmationEditing') return

    const scroller = lowerWorldRef.current
    const target = affirmationInputRef.current
    if (!scroller || !target) return

    const scrollerRect = scroller.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const inset = 8

    if (targetRect.bottom > scrollerRect.bottom - inset) {
      scroller.scrollTop += targetRect.bottom - scrollerRect.bottom + inset
    } else if (targetRect.top < scrollerRect.top + inset) {
      scroller.scrollTop -= scrollerRect.top - targetRect.top + inset
    }
  }, [])

  const captureFocusBaseline = useCallback(() => {
    const root = rootRef.current
    const stage = stageRef.current
    if (!root || !stage) return

    const visualViewport = window.visualViewport
    const viewportOffsetTop = visualViewport?.offsetTop || 0
    const rootRect = root.getBoundingClientRect()
    const stageRect = stage.getBoundingClientRect()

    focusBaselineRef.current = {
      stageTopRelativeRoot: stageRect.top - rootRect.top,
      stageTopRelativeVisualViewport: stageRect.top - viewportOffsetTop,
      stageHeight: stageRect.height,
      stageItemId: activeStageItemIdRef.current,
      captured: true,
    }
  }, [])

  const measureViewport = useCallback(
    (source: string) => {
      if (updateFrameRef.current !== null) {
        window.cancelAnimationFrame(updateFrameRef.current)
      }

      updateFrameRef.current = window.requestAnimationFrame(() => {
        updateFrameRef.current = null

        const root = rootRef.current
        const stage = stageRef.current
        const composer = composerRef.current
        if (!root || !stage || !composer) return

        const visualViewport = window.visualViewport
        const viewportHeight = visualViewport?.height || window.innerHeight
        const viewportWidth = visualViewport?.width || window.innerWidth
        const viewportOffsetTop = visualViewport?.offsetTop || 0
        const viewportScale = visualViewport?.scale || 1
        const orientation =
          window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait'
        const focusedElement = document.activeElement
        const editableFocused = isEditableElement(focusedElement)
        const previous = viewportStateRef.current

        const rotationDetected =
          source === 'orientationchange' ||
          (previous.orientation !== '' && previous.orientation !== orientation) ||
          (previous.lastWidth > 0 &&
            Math.abs(previous.lastWidth - viewportWidth) > 80)
        const zoomDetected = Math.abs(viewportScale - 1) > 0.02

        if (previous.closedHeight === 0 || rotationDetected) {
          previous.closedHeight = viewportHeight
        }

        const keyboardThreshold = Math.max(
          100,
          previous.closedHeight * 0.18
        )
        const heightLoss = previous.closedHeight - viewportHeight
        const heightSuggestsKeyboard = heightLoss > keyboardThreshold
        const keyboardOpen =
          editableFocused &&
          heightSuggestsKeyboard &&
          !rotationDetected &&
          !zoomDetected

        const viewportMoved =
          Math.abs(previous.lastHeight - viewportHeight) > 1 ||
          Math.abs(previous.lastOffsetTop - viewportOffsetTop) > 1

        let viewportChangeKind: ViewportChangeKind = 'stable'
        if (source === 'initial') {
          viewportChangeKind = 'initial'
        } else if (rotationDetected) {
          viewportChangeKind = 'rotation'
        } else if (zoomDetected) {
          viewportChangeKind = 'zoom'
        } else if (keyboardOpen) {
          viewportChangeKind = 'keyboard'
        } else if (viewportMoved) {
          viewportChangeKind = 'toolbar'
        }

        if (
          !keyboardOpen &&
          !heightSuggestsKeyboard &&
          !zoomDetected &&
          !rotationDetected
        ) {
          previous.closedHeight = Math.max(
            previous.closedHeight,
            viewportHeight
          )
        }

        root.style.setProperty(
          '--prototype-visual-height',
          `${viewportHeight}px`
        )
        root.style.setProperty(
          '--prototype-visual-top',
          `${viewportOffsetTop}px`
        )

        keepArtifactTargetVisible()

        const rootRect = root.getBoundingClientRect()
        const stageRect = stage.getBoundingClientRect()
        const composerRect = composer.getBoundingClientRect()
        const stageTopRelativeRoot = stageRect.top - rootRect.top
        const stageTopRelativeVisualViewport =
          stageRect.top - viewportOffsetTop
        const composerTop = composerRect.top - viewportOffsetTop
        const composerBottom = composerRect.bottom - viewportOffsetTop
        const activeTarget = getActiveEditingTarget()
        const activeTargetRect = activeTarget?.getBoundingClientRect()
        const visualBottom = viewportOffsetTop + viewportHeight
        const baseline = focusBaselineRef.current
        const layoutDrift =
          keyboardOpen && baseline.captured
            ? Math.abs(
                stageTopRelativeRoot - baseline.stageTopRelativeRoot
              )
            : 0
        const visibleViewportDrift =
          keyboardOpen && baseline.captured
            ? Math.abs(
                stageTopRelativeVisualViewport -
                  baseline.stageTopRelativeVisualViewport
              )
            : 0
        const stageHeightDrift =
          keyboardOpen && baseline.captured
            ? Math.abs(stageRect.height - baseline.stageHeight)
            : 0
        const stageSelectionStable =
          !keyboardOpen ||
          !baseline.captured ||
          baseline.stageItemId === activeStageItemIdRef.current

        setDiagnostics({
          visualViewportHeight: roundMetric(viewportHeight),
          visualViewportOffsetTop: roundMetric(viewportOffsetTop),
          windowInnerHeight: roundMetric(window.innerHeight),
          rootRectTop: roundMetric(rootRect.top),
          rawStageRectTop: roundMetric(stageRect.top),
          stageTopRelativeRoot: roundMetric(stageTopRelativeRoot),
          layoutDrift: roundMetric(layoutDrift),
          layoutStabilityPass:
            layoutDrift <= 4 &&
            stageHeightDrift <= 4 &&
            stageSelectionStable,
          stageTopRelativeVisualViewport: roundMetric(
            stageTopRelativeVisualViewport
          ),
          visibleViewportDrift: roundMetric(visibleViewportDrift),
          visibleViewportStabilityPass:
            visibleViewportDrift <= 4 &&
            stageHeightDrift <= 4 &&
            stageSelectionStable,
          stageHeight: roundMetric(stageRect.height),
          activeStageItemId: activeStageItemIdRef.current,
          focusedElement: focusedElementLabel(focusedElement),
          composerTop: roundMetric(composerTop),
          composerBottom: roundMetric(composerBottom),
          keyboardOpen,
          viewportChangeKind,
          composerVisible:
            composerRect.top >= viewportOffsetTop - 1 &&
            composerRect.bottom <= visualBottom + 1,
          activeTargetVisible:
            !activeTargetRect ||
            (activeTargetRect.top >= viewportOffsetTop - 1 &&
              activeTargetRect.bottom <= visualBottom + 1),
        })

        previous.lastHeight = viewportHeight
        previous.lastOffsetTop = viewportOffsetTop
        previous.lastWidth = viewportWidth
        previous.lastScale = viewportScale
        previous.orientation = orientation
        previous.keyboardOpen = keyboardOpen
      })
    },
    [getActiveEditingTarget, keepArtifactTargetVisible]
  )

  const lockStageHeight = useCallback(
    (source: 'initial' | 'orientationchange') => {
      const root = rootRef.current
      const stage = stageRef.current
      if (!root || !stage) return

      root.style.removeProperty('--prototype-stage-height')
      window.requestAnimationFrame(() => {
        const stageHeight = stage.getBoundingClientRect().height
        root.style.setProperty(
          '--prototype-stage-height',
          `${stageHeight}px`
        )
        captureFocusBaseline()
        measureViewport(source)
      })
    },
    [captureFocusBaseline, measureViewport]
  )

  useEffect(() => {
    const visualViewport = window.visualViewport

    const handleVisualResize = () => measureViewport('visualViewport.resize')
    const handleVisualScroll = () => measureViewport('visualViewport.scroll')
    const handleWindowResize = () => measureViewport('window.resize')
    const handleWindowScroll = () => measureViewport('window.scroll')
    const handleFocusIn = () => {
      captureFocusBaseline()
      measureViewport('focusin')
    }
    const handleFocusOut = () => {
      window.setTimeout(() => measureViewport('focusout'), 0)
    }
    const handleOrientationChange = () => {
      measureViewport('orientationchange')
      if (rotationTimerRef.current !== null) {
        window.clearTimeout(rotationTimerRef.current)
      }
      rotationTimerRef.current = window.setTimeout(() => {
        lockStageHeight('orientationchange')
      }, 220)
    }

    lockStageHeight('initial')
    visualViewport?.addEventListener('resize', handleVisualResize)
    visualViewport?.addEventListener('scroll', handleVisualScroll)
    window.addEventListener('resize', handleWindowResize)
    window.addEventListener('scroll', handleWindowScroll, { passive: true })
    window.addEventListener('orientationchange', handleOrientationChange)
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)

    const resizeObserver = new ResizeObserver(() =>
      measureViewport('element.resize')
    )
    if (composerRef.current) resizeObserver.observe(composerRef.current)

    return () => {
      if (updateFrameRef.current !== null) {
        window.cancelAnimationFrame(updateFrameRef.current)
      }
      if (rotationTimerRef.current !== null) {
        window.clearTimeout(rotationTimerRef.current)
      }
      resizeObserver.disconnect()
      visualViewport?.removeEventListener('resize', handleVisualResize)
      visualViewport?.removeEventListener('scroll', handleVisualScroll)
      window.removeEventListener('resize', handleWindowResize)
      window.removeEventListener('scroll', handleWindowScroll)
      window.removeEventListener('orientationchange', handleOrientationChange)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [
    captureFocusBaseline,
    lockStageHeight,
    measureViewport,
  ])

  const enterMode = useCallback(
    (nextMode: PrototypeMode) => {
      modeRef.current = nextMode
      setMode(nextMode)

      window.requestAnimationFrame(() => {
        if (nextMode === 'answering') {
          answerInputRef.current?.focus({ preventScroll: true })
        } else if (nextMode === 'affirmationEditing') {
          affirmationInputRef.current?.focus({ preventScroll: true })
          keepArtifactTargetVisible()
        }
        measureViewport('mode')
      })
    },
    [keepArtifactTargetVisible, measureViewport]
  )

  const selectStageItem = useCallback(
    (stageItemId: string) => {
      activeStageItemIdRef.current = stageItemId
      setActiveStageItemId(stageItemId)
      measureViewport('stage-selection')
    },
    [measureViewport]
  )

  const updateActiveColor = (value: string) => {
    setColors((current) =>
      colorGroup === 'primary'
        ? { ...current, primary: value }
        : { ...current, accent: value }
    )
  }

  const handleAnswerSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmittedAnswer(answer)
    measureViewport('answer-submit')
  }

  const rootStyle = {
    '--prototype-primary': colors.primary,
    '--prototype-accent': colors.accent,
  } as CSSProperties

  return (
    <main ref={rootRef} className={styles.root} style={rootStyle}>
      <section className={styles.productConcept} aria-label="Product concept">
        <header className={styles.conceptHeader}>
          <div>
            <p className={styles.kicker}>LOCAL FIXTURE · TICKET 0</p>
            <h1>Keyboard and focus prototype</h1>
          </div>
          <button
            type="button"
            className={styles.viewButton}
            onClick={() => enterMode('viewing')}
            aria-pressed={mode === 'viewing'}
          >
            Ordinary view
          </button>
        </header>

        <section ref={stageRef} className={styles.stage} aria-label="Stage">
          <article className={styles.stageCard}>
            <p>{activeStageItem.eyebrow}</p>
            <h2>{activeStageItem.title}</h2>
            <span>{activeStageItem.body}</span>
            {submittedAnswer ? (
              <small>Local answer: {submittedAnswer}</small>
            ) : null}
          </article>
          <nav className={styles.stageSelector} aria-label="Stage fixtures">
            {STAGE_ITEMS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectStageItem(item.id)}
                aria-pressed={item.id === activeStageItemId}
                aria-label={`Select Stage fixture ${index + 1}: ${item.title}`}
              >
                {index + 1}
              </button>
            ))}
          </nav>
        </section>

        <div ref={lowerWorldRef} className={styles.lowerWorld}>
          <article
            className={`${styles.affirmationCard} ${
              mode === 'affirmationEditing' ? styles.activeArtifact : ''
            }`}
          >
            <div className={styles.artifactHeading}>
              <div>
                <p>LOWER ARTIST WORLD</p>
                <h2>Living Affirmation</h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  enterMode(
                    mode === 'affirmationEditing'
                      ? 'viewing'
                      : 'affirmationEditing'
                  )
                }
                aria-pressed={mode === 'affirmationEditing'}
              >
                {mode === 'affirmationEditing' ? 'Done' : 'Edit affirmation'}
              </button>
            </div>
            <textarea
              ref={affirmationInputRef}
              id="prototype-affirmation"
              value={affirmation}
              onChange={(event) => setAffirmation(event.target.value)}
              onFocus={() => {
                modeRef.current = 'affirmationEditing'
                setMode('affirmationEditing')
                captureFocusBaseline()
              }}
              readOnly={mode !== 'affirmationEditing'}
              rows={3}
              aria-label="Fixture Living Affirmation"
            />
            <p className={styles.fixtureNotice}>
              Fixture state only · refresh clears every change
            </p>
          </article>
        </div>

        <section
          ref={composerRef}
          className={styles.composer}
          aria-label="Emerald composer concept"
        >
          <div
            className={styles.viewingComposer}
            hidden={mode !== 'viewing'}
          >
            <p>Emerald is ready.</p>
            <div>
              <button
                type="button"
                onClick={() => enterMode('colorEditing')}
              >
                Edit colors
              </button>
              <button
                type="button"
                onClick={() => enterMode('answering')}
              >
                Answer
              </button>
            </div>
          </div>

          <div
            className={styles.colorComposer}
            hidden={mode !== 'colorEditing'}
          >
            <div className={styles.composerTitle}>
              <strong>Compact color editing</strong>
              <button type="button" onClick={() => enterMode('viewing')}>
                Done
              </button>
            </div>
            <div className={styles.groupSelector}>
              <button
                type="button"
                onClick={() => setColorGroup('primary')}
                aria-pressed={colorGroup === 'primary'}
              >
                Primary
              </button>
              <button
                type="button"
                onClick={() => setColorGroup('accent')}
                aria-pressed={colorGroup === 'accent'}
              >
                Accent
              </button>
            </div>
            <div className={styles.singleColorGroup}>
              <div className={styles.swatches}>
                {activeSwatches.map((swatch) => (
                  <button
                    key={`${colorGroup}-${swatch}`}
                    type="button"
                    aria-label={`Set ${colorGroup} color to ${swatch}`}
                    aria-pressed={activeColor.toLowerCase() === swatch.toLowerCase()}
                    onClick={() => updateActiveColor(swatch)}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
              <input
                ref={colorInputRef}
                id="prototype-color-value"
                type="text"
                value={activeColor}
                onChange={(event) => updateActiveColor(event.target.value)}
                onFocus={captureFocusBaseline}
                aria-label={`${colorGroup} color value`}
                spellCheck={false}
              />
            </div>
          </div>

          <form
            className={styles.answerComposer}
            hidden={mode !== 'answering'}
            onSubmit={handleAnswerSubmit}
          >
            <div className={styles.composerTitle}>
              <label htmlFor="prototype-answer">Answering</label>
              <button type="button" onClick={() => enterMode('viewing')}>
                Done
              </button>
            </div>
            <div className={styles.answerRow}>
              <input
                ref={answerInputRef}
                id="prototype-answer"
                type="text"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                onFocus={captureFocusBaseline}
                autoComplete="off"
              />
              <button type="submit">Send</button>
            </div>
          </form>

          <div
            className={styles.artifactComposer}
            hidden={mode !== 'affirmationEditing'}
          >
            <span>Editing Living Affirmation</span>
            <button type="button" onClick={() => enterMode('viewing')}>
              Done
            </button>
          </div>
        </section>
      </section>

      <aside
        className={`${styles.diagnostics} ${
          diagnosticsExpanded ? '' : styles.diagnosticsCollapsed
        }`}
        aria-label="Test diagnostics"
      >
        <div className={styles.diagnosticsHeader}>
          <strong>TEST DIAGNOSTICS · NOT PRODUCT UI</strong>
          <button
            type="button"
            onClick={() => setDiagnosticsExpanded((expanded) => !expanded)}
            aria-expanded={diagnosticsExpanded}
          >
            {diagnosticsExpanded ? 'Hide' : 'Show'}
          </button>
        </div>
        {!diagnosticsExpanded ? (
          <p className={styles.diagnosticsSummary}>
            Layout{' '}
            <span data-pass={diagnostics.layoutStabilityPass}>
              {diagnostics.layoutStabilityPass ? 'PASS' : 'FAIL'}
            </span>
            {' · '}Visible{' '}
            <span data-pass={diagnostics.visibleViewportStabilityPass}>
              {diagnostics.visibleViewportStabilityPass ? 'PASS' : 'FAIL'}
            </span>
            {' · '}Keyboard {diagnostics.keyboardOpen ? 'OPEN' : 'closed'}
          </p>
        ) : (
        <dl>
          <div>
            <dt>visualViewport height</dt>
            <dd>{diagnostics.visualViewportHeight}px</dd>
          </div>
          <div>
            <dt>window innerHeight</dt>
            <dd>{diagnostics.windowInnerHeight}px</dd>
          </div>
          <div>
            <dt>— LAYOUT STABILITY —</dt>
            <dd />
          </div>
          <div>
            <dt>prototype/root rect top</dt>
            <dd>{diagnostics.rootRectTop}px</dd>
          </div>
          <div>
            <dt>raw Stage rect top</dt>
            <dd>{diagnostics.rawStageRectTop}px</dd>
          </div>
          <div>
            <dt>Stage top relative root</dt>
            <dd>{diagnostics.stageTopRelativeRoot}px</dd>
          </div>
          <div>
            <dt>layout drift from baseline</dt>
            <dd>{diagnostics.layoutDrift}px</dd>
          </div>
          <div>
            <dt>layout stability ≤ 4px</dt>
            <dd data-pass={diagnostics.layoutStabilityPass}>
              {diagnostics.layoutStabilityPass ? 'PASS' : 'FAIL'}
            </dd>
          </div>
          <div>
            <dt>— VISIBLE VIEWPORT —</dt>
            <dd />
          </div>
          <div>
            <dt>visualViewport offsetTop</dt>
            <dd>{diagnostics.visualViewportOffsetTop}px</dd>
          </div>
          <div>
            <dt>Stage top relative VV</dt>
            <dd>{diagnostics.stageTopRelativeVisualViewport}px</dd>
          </div>
          <div>
            <dt>visible drift from baseline</dt>
            <dd>{diagnostics.visibleViewportDrift}px</dd>
          </div>
          <div>
            <dt>visible stability ≤ 4px</dt>
            <dd data-pass={diagnostics.visibleViewportStabilityPass}>
              {diagnostics.visibleViewportStabilityPass ? 'PASS' : 'FAIL'}
            </dd>
          </div>
          <div>
            <dt>Stage height</dt>
            <dd>{diagnostics.stageHeight}px</dd>
          </div>
          <div>
            <dt>active Stage item ID</dt>
            <dd>{diagnostics.activeStageItemId}</dd>
          </div>
          <div>
            <dt>focused element</dt>
            <dd>{diagnostics.focusedElement}</dd>
          </div>
          <div>
            <dt>composer top / bottom</dt>
            <dd>
              {diagnostics.composerTop}px / {diagnostics.composerBottom}px
            </dd>
          </div>
          <div>
            <dt>keyboard inferred</dt>
            <dd>{diagnostics.keyboardOpen ? 'OPEN' : 'closed'}</dd>
          </div>
          <div>
            <dt>viewport change</dt>
            <dd>{diagnostics.viewportChangeKind}</dd>
          </div>
          <div>
            <dt>composer visible</dt>
            <dd data-pass={diagnostics.composerVisible}>
              {diagnostics.composerVisible ? 'PASS' : 'FAIL'}
            </dd>
          </div>
          <div>
            <dt>active target visible</dt>
            <dd data-pass={diagnostics.activeTargetVisible}>
              {diagnostics.activeTargetVisible ? 'PASS' : 'FAIL'}
            </dd>
          </div>
        </dl>
        )}
      </aside>
    </main>
  )
}

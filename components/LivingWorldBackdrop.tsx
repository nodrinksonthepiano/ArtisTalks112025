'use client'

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { deriveVibeAppearance, normalizePageVibe, type PageVibe } from '@/utils/vibeAppearance'
import {
  GLASS_MIRRORS,
  GLASS_PANE_ROLES,
  MANDALA_BEADS,
  MANDALA_RINGS,
  MORPH_MS,
  addOffsets,
  baseGeometry,
  drawGeometry,
  isFiniteGeometry,
  lerpGeometry,
  morphEase,
  sampleGeometry,
  type GlassDraw,
  type KaleidoscopeDraw,
  type MandalaDraw,
  type VibeGeometry,
} from '@/utils/vibeGeometry'

type Props = {
  vibe?: unknown
  primary?: string
  accent?: string
  pop?: string | null
  hasImage?: boolean
  awake?: boolean
  viewedStepId?: string | null
}

type MorphState = {
  vibe: PageVibe
  from: VibeGeometry
  to: VibeGeometry
  current: VibeGeometry
  startedAt: number
  settled: boolean
}

type PathMap = Map<string, (SVGPathElement | null)[]>
type CircleMap = Map<string, (SVGCircleElement | null)[]>

function posedGeometry(state: MorphState, now: number, offsets: VibeGeometry | null) {
  const elapsed = state.startedAt <= 0 ? 1 : Math.min(1, Math.max(0, (now - state.startedAt) / MORPH_MS))
  const posed = elapsed >= 1 ? state.to : lerpGeometry(state.from, state.to, morphEase(elapsed))
  const frame = addOffsets(posed, offsets)
  return isFiniteGeometry(frame) ? frame : null
}

function setAttr(elements: (SVGPathElement | SVGCircleElement | null)[] | undefined, name: string, value: string) {
  if (!elements) return
  for (const element of elements) {
    if (element?.isConnected) element.setAttribute(name, value)
  }
}

function paintGeometry(paths: PathMap, circles: CircleMap, geometry: VibeGeometry) {
  const drawing = drawGeometry(geometry)
  if (geometry.kind === 'stained-glass') {
    const glass = drawing as GlassDraw
    glass.panes.forEach((d, index) => {
      setAttr(paths.get(`pane-${index}`), 'd', d)
      setAttr(paths.get(`pane-reflect-${index}`), 'd', d)
    })
    glass.glints.forEach((d, index) => setAttr(paths.get(`glint-${index}`), 'd', d))
    setAttr(paths.get('glass-seam'), 'd', glass.seam)
    setAttr(paths.get('glass-seam-light'), 'd', glass.seam)
    setAttr(paths.get('glass-seam-metal'), 'd', glass.seam)
    const radius = String(glass.center)
    setAttr(circles.get('glass-center-fill'), 'r', radius)
    setAttr(circles.get('glass-center-reflect'), 'r', radius)
    setAttr(circles.get('glass-center-seam'), 'r', radius)
    setAttr(circles.get('glass-center-metal'), 'r', radius)
    return
  }
  if (geometry.kind === 'kaleidoscope') {
    const crystal = drawing as KaleidoscopeDraw
    setAttr(paths.get('k-ring0'), 'd', crystal.ring0)
    crystal.support.forEach((d, index) => setAttr(paths.get(`k-support-${index}`), 'd', d))
    crystal.main.forEach((d, index) => setAttr(paths.get(`k-main-${index}`), 'd', d))
    setAttr(paths.get('k-seam'), 'd', crystal.seam)
    setAttr(paths.get('k-gleam'), 'd', crystal.seam)
    setAttr(paths.get('k-metal'), 'd', crystal.metal)
    return
  }
  const mandala = drawing as MandalaDraw
  mandala.petals.forEach((d, index) => {
    setAttr(paths.get(`petal-${index}`), 'd', d)
    setAttr(paths.get(`petal-metal-${index}`), 'd', d)
    if (mandala.diamonds[index]) setAttr(paths.get(`diamond-${index}`), 'd', mandala.diamonds[index])
    const radius = String(Math.round(mandala.ringRadius[index] * 100) / 100)
    setAttr(circles.get(`ring-${index}`), 'r', radius)
    setAttr(circles.get(`ring-metal-${index}`), 'r', radius)
  })
  setAttr(circles.get('rosette-outer'), 'r', String(mandala.rosetteOuter))
  setAttr(circles.get('rosette-inner'), 'r', String(mandala.rosetteInner))
  setAttr(circles.get('rosette-metal'), 'r', String(mandala.rosetteInner))
  mandala.beadCy.forEach((cy, index) => {
    setAttr(circles.get(`bead-${index}`), 'cy', String(Math.round(cy * 100) / 100))
    setAttr(circles.get(`bead-${index}`), 'r', String(Math.round(mandala.beadR[index] * 100) / 100))
  })
}

function keepNode<T>(bucket: { current: Map<string, (T | null)[]> }, key: string, index: number) {
  return (node: T | null) => {
    const list = bucket.current.get(key) ?? []
    list[index] = node
    bucket.current.set(key, list)
  }
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])
  return reduced
}

export default function LivingWorldBackdrop({
  vibe,
  primary,
  accent,
  pop = null,
  hasImage = false,
  awake = true,
  viewedStepId = null,
}: Props) {
  const id = useId().replace(/:/g, '')
  const selected = normalizePageVibe(vibe)
  const appearance = useMemo(() => deriveVibeAppearance(primary, accent, pop), [primary, accent, pop])
  const reducedMotion = usePrefersReducedMotion()
  const settleRef = useRef<HTMLDivElement>(null)
  const pathsRef = useRef<PathMap>(new Map())
  const circlesRef = useRef<CircleMap>(new Map())
  const morphRef = useRef<MorphState | null>(null)
  const keyRef = useRef<string | null>(null)
  const rafRef = useRef(0)
  const reducedRef = useRef(false)
  const audioOffsetsRef = useRef<VibeGeometry | null>(null)

  useEffect(() => {
    const settleWhenHidden = () => { if (document.hidden && settleRef.current) settleRef.current.style.animation = 'none' }
    settleWhenHidden()
    document.addEventListener('visibilitychange', settleWhenHidden)
    return () => document.removeEventListener('visibilitychange', settleWhenHidden)
  }, [awake, selected, primary, accent, pop, hasImage])
  useEffect(() => {
    if (!awake) return
    document.documentElement.dataset.artisWorld = 'awake'
    // The fixed world now owns the image; body supplies the same base for overscroll.
    document.body.style.setProperty('background-image', 'none', 'important')
    return () => {
      delete document.documentElement.dataset.artisWorld
      document.body.style.setProperty('background-image', 'var(--artis-world-image, none)', 'important')
    }
  }, [awake])

  useLayoutEffect(() => {
    reducedRef.current = reducedMotion
    const paint = (geometry: VibeGeometry) => paintGeometry(pathsRef.current, circlesRef.current, geometry)
    const stop = () => cancelAnimationFrame(rafRef.current)
    if (!awake) {
      stop()
      return
    }
    if (selected === 'glow') {
      stop()
      keyRef.current = null
      morphRef.current = null
      return
    }
    if (!viewedStepId) {
      stop()
      keyRef.current = null
      const base = baseGeometry(selected)
      if (!base) return
      morphRef.current = { vibe: selected, from: base, to: base, current: base, startedAt: 0, settled: true }
      paint(base)
      return
    }

    const key = `${selected}:${viewedStepId}`
    if (keyRef.current !== key) {
      keyRef.current = key
      const base = baseGeometry(selected)
      if (!base) return
      const previous = morphRef.current
      const from = previous && previous.vibe === selected
        ? posedGeometry(previous, performance.now(), audioOffsetsRef.current) ?? previous.current
        : base
      const to = sampleGeometry(selected, Math.random) ?? base
      morphRef.current = { vibe: selected, from, to, current: from, startedAt: performance.now(), settled: false }
    }

    const state = morphRef.current
    if (!state) return
    if (reducedRef.current) {
      stop()
      state.current = state.to
      state.settled = true
      paint(state.to)
      return
    }
    if (state.settled) {
      paint(state.current)
      return
    }

    const tick = (now: number) => {
      const live = morphRef.current
      if (!live || live.settled) return
      if (reducedRef.current) {
        live.current = live.to
        live.settled = true
        paint(live.to)
        return
      }
      const frame = posedGeometry(live, now, audioOffsetsRef.current)
      if (!frame) {
        paint(live.current)
        live.settled = true
        return
      }
      live.current = frame
      paint(frame)
      if (now - live.startedAt >= MORPH_MS) {
        live.current = live.to
        live.settled = true
        paint(live.to)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return stop
  }, [awake, selected, viewedStepId, reducedMotion])

  if (!awake) return null

  const style = {
    '--vibe-main': appearance.main,
    '--vibe-support': appearance.support,
    '--vibe-light': appearance.light,
    '--vibe-shadow': appearance.shadow,
    '--vibe-pop-light': appearance.highlight,
    '--vibe-seam': appearance.seam,
    '--vibe-main-rgb': appearance.mainRGB,
    '--vibe-support-rgb': appearance.supportRGB,
    '--vibe-light-rgb': appearance.lightRGB,
    '--vibe-shadow-rgb': appearance.shadowRGB,
    '--vibe-highlight-rgb': appearance.highlightRGB,
  } as React.CSSProperties
  const materialFill = (kind: string, role: string) => `url(#${id}-${kind}-${role})`
  const popFill = appearance.hasPop ? appearance.pop! : appearance.highlight
  const pathSlot = (key: string, index: number) => keepNode<SVGPathElement>(pathsRef, key, index)
  const circleSlot = (key: string, index: number) => keepNode<SVGCircleElement>(circlesRef, key, index)

  return (
    <div className="artis-living-world" data-vibe={selected} data-has-image={hasImage} data-has-pop={appearance.hasPop} style={style} aria-hidden="true">
      <div className="artis-living-world-scene">
        {hasImage && <div className="artis-living-world-image" />}
        {selected !== 'glow' && (
          <svg key={selected} className="artis-living-world-pattern" viewBox="-500 -500 1000 1000" preserveAspectRatio="xMidYMid meet" focusable="false">
            <defs>
              {(['main', 'support'] as const).map(role => {
                const tone = appearance.materials[role]
                return (
                  <React.Fragment key={role}>
                    <linearGradient id={`${id}-glass-${role}`} x1="0.5" y1="0" x2="0.5" y2="1">
                      <stop stopColor={tone.shade} />
                      <stop offset="0.06" stopColor={tone.light} />
                      <stop offset="0.18" stopColor={tone.base} />
                      <stop offset="0.52" stopColor={tone.light} />
                      <stop offset="0.76" stopColor={tone.base} />
                      <stop offset="0.96" stopColor={tone.shade} />
                      <stop offset="1" stopColor={tone.deep} />
                    </linearGradient>
                    <linearGradient id={`${id}-crystal-${role}`} x1="0" y1="1" x2="1" y2="0">
                      <stop stopColor={tone.deep} />
                      <stop offset="0.18" stopColor={tone.shade} />
                      <stop offset="0.47" stopColor={tone.base} />
                      <stop offset="0.48" stopColor={tone.light} />
                      <stop offset="0.53" stopColor={tone.base} />
                      <stop offset="0.88" stopColor={tone.base} />
                      <stop offset="1" stopColor={tone.deep} />
                    </linearGradient>
                    <linearGradient id={`${id}-petal-${role}`} x1="0" y1="0.5" x2="1" y2="0.5">
                      <stop stopColor={tone.deep} />
                      <stop offset="0.12" stopColor={tone.shade} />
                      <stop offset="0.24" stopColor={tone.base} />
                      <stop offset="0.48" stopColor={tone.base} />
                      <stop offset="0.5" stopColor={tone.light} />
                      <stop offset="0.52" stopColor={tone.base} />
                      <stop offset="0.76" stopColor={tone.base} />
                      <stop offset="0.88" stopColor={tone.shade} />
                      <stop offset="1" stopColor={tone.deep} />
                    </linearGradient>
                  </React.Fragment>
                )
              })}
              <linearGradient id={`${id}-glass-reflection`} x1="0.5" y1="0" x2="0.5" y2="1">
                <stop stopColor="white" stopOpacity="0.24" />
                <stop offset="0.025" stopColor="white" stopOpacity="0.06" />
                <stop offset="0.2" stopColor="white" stopOpacity="0" />
                <stop offset="0.8" stopColor="black" stopOpacity="0" />
                <stop offset="0.97" stopColor="black" stopOpacity="0.06" />
                <stop offset="1" stopColor="black" stopOpacity="0.3" />
              </linearGradient>
              <linearGradient id={`${id}-metal`} x1="0.5" y1="0" x2="0.5" y2="1">
                <stop stopColor={appearance.highlight} />
                <stop offset="0.18" stopColor={appearance.hasPop ? appearance.pop! : appearance.light} />
                <stop offset="0.5" stopColor={appearance.seam} />
                <stop offset="0.82" stopColor={appearance.hasPop ? appearance.pop! : appearance.light} />
                <stop offset="1" stopColor={appearance.highlight} />
              </linearGradient>
              <radialGradient id={`${id}-window`}>
                <stop offset="0.46" stopColor="black" />
                <stop offset="0.72" stopColor="white" />
              </radialGradient>
              <mask id={`${id}-image-window`} maskUnits="userSpaceOnUse" x="-2200" y="-2400" width="4400" height="6000">
                <rect x="-2200" y="-2400" width="4400" height="6000" fill="white" />
                <ellipse rx="490" ry="670" fill={`url(#${id}-window)`} />
              </mask>
            </defs>
            <g mask={hasImage ? `url(#${id}-image-window)` : undefined}>
              <rect x="-2200" y="-2400" width="4400" height="6000" fill={appearance.main} />
              {selected === 'stained-glass' && (
                <g>
                  <circle ref={circleSlot('glass-center-fill', 0)} data-role="main" fill={materialFill('glass', 'main')} />
                  <circle ref={circleSlot('glass-center-reflect', 0)} fill={`url(#${id}-glass-reflection)`} />
                  <circle ref={circleSlot('glass-center-seam', 0)} fill="none" stroke={appearance.seam} strokeWidth="9" />
                  <circle ref={circleSlot('glass-center-metal', 0)} fill="none" stroke={`url(#${id}-metal)`} strokeWidth="2.2" />
                  {GLASS_MIRRORS.map(([sx, sy], mirror) => (
                    <g key={`${sx}${sy}`} transform={`scale(${sx} ${sy})`}>
                      {GLASS_PANE_ROLES.map((role, pane) => (
                        <g key={pane}>
                          <path ref={pathSlot(`pane-${pane}`, mirror)} data-role={role} fill={materialFill('glass', role)} />
                          <path ref={pathSlot(`pane-reflect-${pane}`, mirror)} fill={`url(#${id}-glass-reflection)`} />
                        </g>
                      ))}
                      {Array.from({ length: 3 }, (_, glint) => (
                        <path key={glint} ref={pathSlot(`glint-${glint}`, mirror)} fill={popFill} opacity="0.92" />
                      ))}
                    </g>
                  ))}
                  <path ref={pathSlot('glass-seam', 0)} fill="none" stroke={appearance.seam} strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
                  <path ref={pathSlot('glass-seam-light', 0)} fill="none" stroke={appearance.highlight} strokeOpacity="0.3" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
                  <path ref={pathSlot('glass-seam-metal', 0)} fill="none" stroke={`url(#${id}-metal)`} strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
                </g>
              )}
              {selected === 'kaleidoscope' && (
                <g>
                  {Array.from({ length: 8 }, (_, rotation) => (
                    <g key={rotation} transform={`rotate(${rotation * 45})`}>
                      {[1, -1].map((direction, flip) => (
                        <g key={direction} transform={`scale(${direction} 1)`}>
                          <path ref={pathSlot('k-ring0', rotation * 2 + flip)} data-role="main" fill={materialFill('crystal', 'main')} />
                          {Array.from({ length: 4 }, (_, ring) => (
                            <React.Fragment key={ring}>
                              <path ref={pathSlot(`k-support-${ring}`, rotation * 2 + flip)} data-role="support" fill={materialFill('crystal', 'support')} />
                              <path ref={pathSlot(`k-main-${ring}`, rotation * 2 + flip)} data-role="main" fill={materialFill('crystal', 'main')} />
                            </React.Fragment>
                          ))}
                        </g>
                      ))}
                    </g>
                  ))}
                  <path ref={pathSlot('k-seam', 0)} fill="none" stroke={appearance.seam} strokeWidth="4" strokeLinejoin="round" />
                  <path ref={pathSlot('k-gleam', 0)} fill="none" stroke={appearance.highlight} strokeOpacity="0.34" strokeWidth="0.9" />
                  <path ref={pathSlot('k-metal', 0)} fill="none" stroke={`url(#${id}-metal)`} strokeWidth="2.6" />
                </g>
              )}
              {selected === 'mandala' && (
                <g>
                  <circle ref={circleSlot('rosette-outer', 0)} data-role="main" fill={materialFill('petal', 'main')} />
                  <circle ref={circleSlot('rosette-inner', 0)} data-role="support" fill={materialFill('petal', 'support')} />
                  <circle ref={circleSlot('rosette-metal', 0)} fill="none" stroke={`url(#${id}-metal)`} strokeWidth="1.3" />
                  {MANDALA_RINGS.map((ring, ringIndex) => (
                    <g key={ringIndex}>
                      {Array.from({ length: ring.count }, (_, index) => (
                        <g key={index} transform={`rotate(${ring.turn + index * (360 / ring.count)})`}>
                          <path
                            ref={pathSlot(`petal-${ringIndex}`, index)}
                            data-role={ring.role}
                            fill={materialFill('petal', ring.role)}
                            stroke={appearance.seam}
                            strokeWidth={ring.level === 'primary' ? 4.5 : 1.5}
                            strokeLinejoin="round"
                          />
                          <path
                            ref={pathSlot(`petal-metal-${ringIndex}`, index)}
                            fill="none"
                            stroke={`url(#${id}-metal)`}
                            strokeWidth={ring.level === 'primary' ? 2.1 : ring.level === 'secondary' ? 1 : 0.55}
                            strokeOpacity={ring.level === 'quiet' ? 0.34 : 0.88}
                          />
                          {ring.level === 'primary' ? (
                            <path ref={pathSlot(`diamond-${ringIndex}`, index)} fill={popFill} stroke="none" />
                          ) : null}
                        </g>
                      ))}
                      <circle ref={circleSlot(`ring-${ringIndex}`, 0)} fill="none" stroke={appearance.seam} strokeWidth={ring.level === 'primary' ? 2.8 : 1.1} />
                      <circle
                        ref={circleSlot(`ring-metal-${ringIndex}`, 0)}
                        fill="none"
                        stroke={`url(#${id}-metal)`}
                        strokeWidth={ring.level === 'primary' ? 1 : 0.45}
                        opacity={ring.level === 'quiet' ? 0.22 : 0.66}
                      />
                    </g>
                  ))}
                  {MANDALA_BEADS.map((bead, group) => (
                    Array.from({ length: bead.count }, (_, index) => (
                      <g key={`${group}-${index}`} transform={`rotate(${index * (360 / bead.count)})`}>
                        <circle
                          ref={circleSlot(`bead-${group}`, index)}
                          cx={0}
                          data-role={bead.role}
                          fill={materialFill('petal', bead.role)}
                          stroke={`url(#${id}-metal)`}
                          strokeWidth="0.8"
                        />
                      </g>
                    ))
                  ))}
                </g>
              )}
            </g>
          </svg>
        )}
        <div key={`${selected}-air`} className="artis-living-world-atmosphere" />
        <div ref={settleRef} key={`${selected}-glint`} className="artis-living-world-settle" />
      </div>
      <div className="artis-living-world-emerald-light" />
    </div>
  )
}

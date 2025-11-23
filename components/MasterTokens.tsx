'use client'

import React, { useEffect, useRef } from 'react'

// Props contract (unchanged from original)
interface MasterTokensProps {
  preProgress: number    // 0-100
  proProgress: number   // 0-100
  postProgress: number   // 0-100
  loopProgress: number   // 0-100
  brandColor?: string
  carouselRef?: React.RefObject<HTMLDivElement>  // For orbit positioning
}

// Orbit animation constants (from Zeyoda)
const ORBIT_SPEED = 0.3; // natural radians/sec
const WHEEL_SENS = 0.0016;      // rad per wheel deltaY unit
const DRAG_SENS = 0.008;        // rad per px (approx)
const FRICTION = 1.8;           // 1/s velocity decay
const V_EPS = 0.003;            // rad/s threshold to stop inertia

export default function MasterTokens({
  preProgress,
  proProgress,
  postProgress,
  loopProgress,
  brandColor,
  carouselRef
}: MasterTokensProps) {
  // Default color palette: emerald, gold, silver, white
  const defaultColors = ['#10b981', '#fbbf24', '#cbd5e1', '#ffffff']
  
  // Helper to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  // Token configuration (PRE/PROD/POST/LEGACY)
  const phaseTokens = [
    { id: 'pre', label: 'PRE', progress: preProgress, defaultColor: defaultColors[0] },
    { id: 'prod', label: 'PROD', progress: proProgress, defaultColor: defaultColors[1] },
    { id: 'post', label: 'POST', progress: postProgress, defaultColor: defaultColors[2] },
    { id: 'legacy', label: 'LEGACY', progress: loopProgress, defaultColor: defaultColors[3] },
  ]

  // Orbit animation refs (from Zeyoda)
  const tokenElementRefs = useRef<(HTMLElement | null)[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);
  const naturalOffsetRef = useRef(0);      // natural orbit offset (radians)
  const userOffsetRef = useRef(0);         // user-imposed offset (radians)
  const userVelocityRef = useRef(0);       // user angular velocity (radians/sec)
  const lastTsRef = useRef(0);
  const isInteractingRef = useRef(false);
  const orbitContainerRef = useRef<HTMLDivElement | null>(null);
  const lastEventTsRef = useRef<number>(0);
  const centerRef = useRef<{cx:number; cy:number}>({ cx: 0, cy: 0 });
  const lastAngleRef = useRef<number | null>(null);
  const suppressClickRef = useRef<boolean>(false);
  const isHoveringRef = useRef<boolean>(false);
  const activePointerIdRef = useRef<number | null>(null);
  const downXYRef = useRef<{x:number;y:number}|null>(null);
  const draggingTokenRef = useRef<boolean>(false);
  const downTsRef = useRef<number>(0);
  const hoverPauseTimerRef = useRef<number | null>(null);
  const isOrbitAnimationPaused = useRef<boolean>(false);

  useEffect(() => {
    const carouselElement = carouselRef?.current;
    if (!carouselElement) {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      return;
    }

    // Distribute angles evenly across 4 tokens
    const allTokens = phaseTokens.map((token, index) => ({
      ...token,
      angle: ((index + 0.5) * 360) / 4 // Even distribution: 45°, 135°, 225°, 315°
    }));

    // Position calculation (from Zeyoda)
    const positionOnce = () => {
      let contentWidth, contentHeight, rect;
      
      // Measure the carousel element directly
      if (carouselElement) {
        contentWidth = carouselElement.offsetWidth;
        contentHeight = carouselElement.offsetHeight;
        rect = carouselElement.getBoundingClientRect();
        
        const isContentReady = contentWidth > 50 && contentHeight > 50 && rect && rect.width > 50;
        
        if (!isContentReady) {
          // Fallback to viewport-based dimensions
          contentWidth = Math.min(window.innerWidth * 0.7, 700);
          contentHeight = contentWidth * (9 / 16);
          centerRef.current = { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
        } else {
          centerRef.current = { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
        }
      } else {
        // Viewport fallback
        contentWidth = Math.min(window.innerWidth * 0.7, 700);
        contentHeight = contentWidth * (9 / 16);
        centerRef.current = { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
      }

      const radiusX = (contentWidth / 2) + 60;
      const radiusY = (contentHeight / 2) + 40;
      const currentGlobalAngleOffset = naturalOffsetRef.current + userOffsetRef.current;
      
      allTokens.forEach((tokenData, index) => {
        const tokenElement = tokenElementRefs.current[index];
        if (!tokenElement) return;
        const tokenSpecificInitialAngle = (typeof tokenData.angle === 'number' ? tokenData.angle : 0) * (Math.PI / 180);
        const angle = currentGlobalAngleOffset + tokenSpecificInitialAngle;
        const x = radiusX * Math.cos(angle);
        const y = radiusY * Math.sin(angle);
        const z = -20;
        const orbitPos = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px)`;
        tokenElement.style.setProperty('--orbit-pos', orbitPos);
        tokenElement.style.opacity = '1';
        tokenElement.style.filter = 'blur(0px)';
      });
    };

    // Animation loop (from Zeyoda)
    let lastTimestamp = 0;
    const animate = (timestamp: number) => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'hidden') {
        animationFrameIdRef.current = requestAnimationFrame(animate);
        return;
      }

      if (!lastTimestamp) {
        lastTimestamp = timestamp;
        animationFrameIdRef.current = requestAnimationFrame(animate);
        return;
      }
      const deltaTime = (timestamp - lastTimestamp) * 0.001; 
      lastTimestamp = timestamp;

      // natural orbit advances when not paused
      if (!isOrbitAnimationPaused.current && !isInteractingRef.current) {
        naturalOffsetRef.current += ORBIT_SPEED * deltaTime;
      }
      // inertia for user offset
      if (!isInteractingRef.current) {
        if (Math.abs(userVelocityRef.current) > V_EPS) {
          userOffsetRef.current += userVelocityRef.current * deltaTime;
          userVelocityRef.current *= Math.max(0, 1 - FRICTION * deltaTime);
        } else if (Math.abs(userOffsetRef.current) > 0.0005) {
          naturalOffsetRef.current += userOffsetRef.current;
          userOffsetRef.current = 0;
          userVelocityRef.current = 0;
        }
      }

      positionOnce();
      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    // Seed initial positions immediately, then start RAF
    positionOnce();
    animationFrameIdRef.current = requestAnimationFrame(animate);

    // Interaction handlers (from Zeyoda, simplified)
    const container = orbitContainerRef.current;
    if (container) {
      const timestampNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
      
      const onWheel = (e: WheelEvent) => {
        if (!isInteractingRef.current && !isHoveringRef.current) return;
        e.preventDefault(); e.stopPropagation();
        const now = timestampNow();
        const dt = Math.max(0.008, Math.min(0.08, (now - (lastEventTsRef.current || now)) * 0.001));
        let sideSign = 1;
        const targetEl = (e.target as Element)?.closest?.('.orbit-token') as HTMLElement | null;
        if (targetEl) {
          try {
            const tr = targetEl.getBoundingClientRect();
            const tcx = tr.left + tr.width / 2;
            sideSign = (tcx >= centerRef.current.cx) ? 1 : -1;
          } catch {}
        }
        const d = (-e.deltaY) * WHEEL_SENS * sideSign;
        userOffsetRef.current += d;
        const instV = d / dt;
        userVelocityRef.current = 0.6 * userVelocityRef.current + 0.4 * instV;
        lastEventTsRef.current = now;
      };

      const onPointerDown = (e: PointerEvent) => {
        const target = e.target as Element;
        if (!target.closest('.orbit-token')) return;
        try { orbitContainerRef.current?.setPointerCapture?.(e.pointerId); } catch {}
        isInteractingRef.current = true;
        activePointerIdRef.current = e.pointerId;
        draggingTokenRef.current = false;
        downXYRef.current = { x: e.clientX, y: e.clientY };
        downTsRef.current = timestampNow();
        const { cx, cy } = centerRef.current;
        lastAngleRef.current = Math.atan2(e.clientY - cy, e.clientX - cx);
        suppressClickRef.current = false;
      };

      const onPointerMove = (e: PointerEvent) => {
        if (activePointerIdRef.current !== e.pointerId || lastAngleRef.current === null) return;
        const dx = e.clientX - (downXYRef.current?.x || e.clientX);
        const dy = e.clientY - (downXYRef.current?.y || e.clientY);
        if (!draggingTokenRef.current && (dx*dx+dy*dy) > 36) {
          draggingTokenRef.current = true;
          suppressClickRef.current = true;
        }
        const now = timestampNow();
        const dt = Math.max(8, Math.min(80, now - (lastEventTsRef.current || now))) * 0.001;
        const { cx, cy } = centerRef.current;
        const ang = Math.atan2(e.clientY - cy, e.clientX - cx);
        let d = ang - (lastAngleRef.current || ang);
        if (d > Math.PI) d -= 2*Math.PI; else if (d < -Math.PI) d += 2*Math.PI;
        userOffsetRef.current += d;
        userVelocityRef.current = 0.6*userVelocityRef.current + 0.4 * (d/dt);
        lastAngleRef.current = ang;
        lastEventTsRef.current = now;
      };

      const onPointerUp = (e: PointerEvent) => {
        if (activePointerIdRef.current !== null) {
          try { orbitContainerRef.current?.releasePointerCapture?.(activePointerIdRef.current); } catch {}
        }
        activePointerIdRef.current = null;
        isInteractingRef.current = false;
        draggingTokenRef.current = false;
        lastAngleRef.current = null;
        if (hoverPauseTimerRef.current) window.clearTimeout(hoverPauseTimerRef.current);
        hoverPauseTimerRef.current = window.setTimeout(()=>{ isOrbitAnimationPaused.current = false; }, 120) as unknown as number;
        setTimeout(()=>{ suppressClickRef.current = false; }, 30);
      };

      const onClickCapture = (e: MouseEvent) => { 
        if (suppressClickRef.current) { 
          e.preventDefault(); 
          e.stopPropagation(); 
        } 
      };

      container.addEventListener('wheel', onWheel, { passive: false });
      container.addEventListener('pointerdown', onPointerDown as any, { passive: false } as any);
      container.addEventListener('pointermove', onPointerMove as any, { passive: false } as any);
      container.addEventListener('pointerup', onPointerUp as any);
      container.addEventListener('click', onClickCapture, true);

      return () => {
        container.removeEventListener('wheel', onWheel as any);
        container.removeEventListener('pointerdown', onPointerDown as any);
        container.removeEventListener('pointermove', onPointerMove as any);
        container.removeEventListener('pointerup', onPointerUp as any);
        container.removeEventListener('click', onClickCapture, true);
      };
    }

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [carouselRef, preProgress, proProgress, postProgress, loopProgress]);

  return (
    <div className="orbit-tokens-wrapper relative w-full">
      <div 
        className="orbital-tokens"
        ref={orbitContainerRef}
        style={{ touchAction: 'none', overscrollBehavior: 'contain' as any }}
      >
        {phaseTokens.map((token, index) => {
          const isFilled = token.progress >= 100
          const fillPercentage = Math.min(100, Math.max(0, token.progress))
          const tokenColor = brandColor || token.defaultColor
          
          return (
            <div
              key={token.id}
              className="orbit-token"
              ref={(el: HTMLElement | null) => {
                tokenElementRefs.current[index] = el;
              }}
              style={{
                willChange: 'transform, opacity',
                opacity: 1,
                transform: 'var(--orbit-pos, translate(-50%, -50%))',
                position: 'absolute',
                cursor: 'grab',
                pointerEvents: 'auto',
              }}
              onMouseEnter={(e) => { 
                isHoveringRef.current = true; 
                if (hoverPauseTimerRef.current) window.clearTimeout(hoverPauseTimerRef.current); 
                isOrbitAnimationPaused.current = true; 
              }}
              onMouseLeave={(e) => { 
                isHoveringRef.current = false; 
                if (hoverPauseTimerRef.current) window.clearTimeout(hoverPauseTimerRef.current); 
                hoverPauseTimerRef.current = window.setTimeout(()=>{ 
                  if (!isInteractingRef.current) isOrbitAnimationPaused.current = false; 
                }, 200) as unknown as number; 
              }}
              onPointerDown={(e)=>{ 
                try { (e.currentTarget as any).setPointerCapture?.(e.pointerId); } catch {}; 
                activePointerIdRef.current = e.pointerId; 
                isInteractingRef.current = true; 
                draggingTokenRef.current = false; 
                downXYRef.current = { x: e.clientX, y: e.clientY }; 
                downTsRef.current = (typeof performance!=='undefined'?performance.now():Date.now()); 
                const { cx, cy } = centerRef.current; 
                lastAngleRef.current = Math.atan2(e.clientY - cy, e.clientX - cx); 
                suppressClickRef.current = false; 
                (e.currentTarget.style as any).cursor = 'grabbing'; 
              }}
              onPointerMove={(e)=>{ 
                if (activePointerIdRef.current !== e.pointerId || lastAngleRef.current===null) return; 
                const dx = e.clientX - (downXYRef.current?.x||e.clientX); 
                const dy = e.clientY - (downXYRef.current?.y||e.clientY); 
                if (!draggingTokenRef.current && (dx*dx+dy*dy) > 36) { 
                  draggingTokenRef.current = true; 
                  suppressClickRef.current = true; 
                } 
                const now = (typeof performance!=='undefined'?performance.now():Date.now()); 
                const dt = Math.max(8, Math.min(80, now - (lastEventTsRef.current||now))) * 0.001; 
                const { cx, cy } = centerRef.current; 
                const ang = Math.atan2(e.clientY - cy, e.clientX - cx); 
                let d = ang - (lastAngleRef.current||ang); 
                if (d > Math.PI) d -= 2*Math.PI; else if (d < -Math.PI) d += 2*Math.PI; 
                userOffsetRef.current += d; 
                userVelocityRef.current = 0.6*userVelocityRef.current + 0.4 * (d/dt); 
                lastAngleRef.current = ang; 
                lastEventTsRef.current = now; 
              }}
              onPointerUp={(e)=>{ 
                if (activePointerIdRef.current !== null) { 
                  try { (e.currentTarget as any).releasePointerCapture?.(activePointerIdRef.current); } catch {} 
                } 
                activePointerIdRef.current = null; 
                isInteractingRef.current = false; 
                draggingTokenRef.current = false; 
                lastAngleRef.current = null; 
                (e.currentTarget.style as any).cursor = 'grab'; 
                if (hoverPauseTimerRef.current) window.clearTimeout(hoverPauseTimerRef.current); 
                hoverPauseTimerRef.current = window.setTimeout(()=>{ isOrbitAnimationPaused.current = false; }, 120) as unknown as number; 
                setTimeout(()=>{ suppressClickRef.current = false; }, 30); 
              }}
              onClickCapture={(e)=>{ if (suppressClickRef.current) { e.preventDefault(); e.stopPropagation(); } }}
            >
              {/* Token Circle */}
              <div
                className="relative w-16 h-16 md:w-20 md:h-20 rounded-full transition-all duration-500 ease-out"
                style={{
                  backgroundColor: isFilled 
                    ? tokenColor 
                    : 'transparent',
                  border: `2px solid ${isFilled ? tokenColor : hexToRgba(tokenColor, 0.3)}`,
                  opacity: isFilled ? 1 : 0.3,
                  boxShadow: isFilled 
                    ? `0 0 20px ${hexToRgba(tokenColor, 0.5)}` 
                    : 'none',
                }}
              >
                {/* Progress ring */}
                {fillPercentage > 0 && fillPercentage < 100 && (
                  <svg
                    className="absolute inset-0 w-full h-full transform -rotate-90"
                    viewBox="0 0 100 100"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke={hexToRgba(tokenColor, 0.3)}
                      strokeWidth="4"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke={tokenColor}
                      strokeWidth="4"
                      strokeDasharray={`${2 * Math.PI * 45}`}
                      strokeDashoffset={`${2 * Math.PI * 45 * (1 - fillPercentage / 100)}`}
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                  </svg>
                )}
              </div>

              {/* Token Label */}
              <span
                className="absolute bottom-[-24px] left-1/2 transform -translate-x-1/2 text-xs md:text-sm font-semibold tracking-wider transition-all duration-500 whitespace-nowrap"
                style={{
                  color: isFilled ? tokenColor : hexToRgba(tokenColor, 0.5),
                }}
              >
                {token.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  )
}

"use client";
import React, { useEffect, useRef } from 'react';

interface ArtisTalksOrbitRendererProps {
  featuredContentRef: React.RefObject<HTMLDivElement | null>;
  chatRef: React.RefObject<HTMLDivElement | null>;
  isOrbitAnimationPaused: React.MutableRefObject<boolean>;
  // Phase tokens data
  phaseTokens: Array<{
    id: 'pre' | 'prod' | 'post' | 'legacy';
    label: string;
    progress: number;
    color?: string;
  }>;
  brandColor?: string;
}

const ORBIT_SPEED = 0.3; // natural radians/sec
// Interaction tuning (radians and seconds)
const WHEEL_SENS = 0.0016;      // rad per wheel deltaY unit
const DRAG_SENS = 0.008;        // rad per px (approx)
const FRICTION = 1.8;           // 1/s velocity decay
const V_EPS = 0.003;            // rad/s threshold to stop inertia

const ArtisTalksOrbitRenderer: React.FC<ArtisTalksOrbitRendererProps> = ({
  featuredContentRef,
  chatRef,
  isOrbitAnimationPaused,
  phaseTokens,
  brandColor,
}) => {
  const tokenElementRefs = useRef<(HTMLElement | null)[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);
  const naturalOffsetRef = useRef(0);      // natural orbit offset (radians)
  const userOffsetRef = useRef(0);         // user-imposed offset (radians)
  const userVelocityRef = useRef(0);       // user angular velocity (radians/sec)
  const lastTsRef = useRef(0);
  const isInteractingRef = useRef(false);
  const dragStartXYRef = useRef<{x:number;y:number}|null>(null);
  const orbitContainerRef = useRef<HTMLDivElement | null>(null);
  const lastEventTsRef = useRef<number>(0);
  const centerRef = useRef<{cx:number; cy:number}>({ cx: 0, cy: 0 });
  const heroDimensionsRef = useRef<{w: number, h: number} | null>(null);
  const lastAngleRef = useRef<number | null>(null);
  const suppressClickRef = useRef<boolean>(false);
  const isHoveringRef = useRef<boolean>(false);
  const activePointerIdRef = useRef<number | null>(null);
  const downXYRef = useRef<{x:number;y:number}|null>(null);
  const draggingTokenRef = useRef<boolean>(false);
  const downTsRef = useRef<number>(0);
  const hoverPauseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const featuredElement = featuredContentRef.current;
    
    // If FeaturedContent not ready, don't animate (matches Zeyoda pattern)
    if (!featuredElement) {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      return;
    }

    // Distribute angles evenly across 4 tokens: 45°, 135°, 225°, 315°
    const allTokens = phaseTokens.map((token, index) => ({
      ...token,
      angle: ((index + 0.5) * 360) / 4 // Even distribution: 45°, 135°, 225°, 315°
    }));

    // one-off position write to avoid starting at center before RAF begins
    // Updated to match Zeyoda pattern: use stable hero:pinned dimensions first
    const positionOnce = () => {
      let contentWidth, contentHeight, rect;
      
      // Priority 1: Use stable hero dimensions from hero:pinned event (matches Zeyoda pattern)
      if (heroDimensionsRef.current && featuredElement) {
        contentWidth = heroDimensionsRef.current.w;
        contentHeight = heroDimensionsRef.current.h;
        rect = featuredElement.getBoundingClientRect();
        centerRef.current = { 
          cx: rect.left + rect.width / 2,   // VIEWPORT coordinates (Zeyoda)
          cy: rect.top + rect.height / 2    // VIEWPORT coordinates (Zeyoda)
        };
      } 
      // Priority 2: Measure FeaturedContent directly (fallback if hero:pinned not received yet)
      else if (featuredElement) {
        contentWidth = featuredElement.offsetWidth;
        contentHeight = featuredElement.offsetHeight;
        rect = featuredElement.getBoundingClientRect();
        
        const isContentReady = contentWidth > 50 && contentHeight > 50 && rect && rect.width > 50;
        
        if (!isContentReady) {
          // Fallback to viewport-based dimensions only if measurements invalid
          contentWidth = Math.min(window.innerWidth * 0.7, 700);
          contentHeight = contentWidth * (9 / 16);
          centerRef.current = { 
            cx: window.innerWidth / 2,   // VIEWPORT coordinates
            cy: window.innerHeight / 2   // VIEWPORT coordinates
          };
        } else {
          centerRef.current = { 
            cx: rect.left + rect.width / 2,   // VIEWPORT coordinates (Zeyoda)
            cy: rect.top + rect.height / 2    // VIEWPORT coordinates (Zeyoda)
          };
        }
      }
      // Priority 3: Viewport fallback when nothing else available
      else {
        contentWidth = Math.min(window.innerWidth * 0.7, 700);
        contentHeight = contentWidth * (9 / 16);
        centerRef.current = { 
          cx: window.innerWidth / 2,   // VIEWPORT coordinates
          cy: window.innerHeight / 2   // VIEWPORT coordinates
        };
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
        
        // Calculate viewport position: center (viewport) + offset (matches Zeyoda)
        const viewportX = centerRef.current.cx + x;
        const viewportY = centerRef.current.cy + y;
        
        // Set position directly using viewport coordinates
        tokenElement.style.position = 'fixed';
        tokenElement.style.left = `${viewportX}px`;
        tokenElement.style.top = `${viewportY}px`;
        tokenElement.style.transform = `translate(-50%, -50%) translateZ(${z}px)`;
        tokenElement.style.opacity = '1';
        tokenElement.style.filter = 'blur(0px)';
      });
    };

    // Animation loop - COPIED FROM ZEYODA ThemeOrbitRenderer.tsx lines 162-197
    let lastTimestamp = 0;
    const animate = (timestamp: number) => {
      // SSR guard and visibility throttling
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
      // inertia for user offset (no spring-to-zero; fold-in when stopped)
      if (!isInteractingRef.current) {
        if (Math.abs(userVelocityRef.current) > V_EPS) {
          userOffsetRef.current += userVelocityRef.current * deltaTime;
          userVelocityRef.current *= Math.max(0, 1 - FRICTION * deltaTime);
        } else if (Math.abs(userOffsetRef.current) > 0.0005) {
          naturalOffsetRef.current += userOffsetRef.current; // fold into natural
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

    // Listen to hero:pinned for stable carousel dimensions (Priority 1 - matches OvalGlowBackdrop pattern)
    const onHeroPinned = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { w, h } = customEvent.detail || {};
      if (w && h) {
        heroDimensionsRef.current = { w, h };
        // Update positions immediately with new stable dimensions
        positionOnce();
      }
    };
    window.addEventListener('hero:pinned', onHeroPinned);

    // Auto-resume when carousel reports stability (pin complete or snap complete)
    const onStable = () => {
      // Ensure not paused and positions valid
      isOrbitAnimationPaused.current = false;
      positionOnce();
      if (animationFrameIdRef.current === null) {
        animationFrameIdRef.current = requestAnimationFrame(animate);
      }
    };
    window.addEventListener('carousel:stable', onStable);

    // Interaction handlers - COPIED FROM ZEYODA ThemeOrbitRenderer.tsx lines 226-343
    const container = orbitContainerRef.current;
    if (container) {
      const timestampNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
      
      const onWheel = (e: WheelEvent) => {
        // Respond to wheel only while hovering a token or dragging
        if (!isInteractingRef.current && !isHoveringRef.current) return;
        e.preventDefault(); e.stopPropagation();
        const now = timestampNow();
        const dt = Math.max(0.008, Math.min(0.08, (now - (lastEventTsRef.current || now)) * 0.001));
        // Tangent-aware mapping: vertical wheel should rotate according to which side of the orbit you're on
        let sideSign = 1; // right side default
        const targetEl = (e.target as Element)?.closest?.('.orbit-token') as HTMLElement | null;
        if (targetEl) {
          try {
            const tr = targetEl.getBoundingClientRect();
            const tcx = tr.left + tr.width / 2; // VIEWPORT coordinates (Zeyoda)
            sideSign = (tcx >= centerRef.current.cx) ? 1 : -1;
          } catch {}
        }
        // User preference: make scroll up rotate in the same visual sense as drag on that side
        const d = (-e.deltaY) * WHEEL_SENS * sideSign;
        userOffsetRef.current += d;
        const instV = d / dt;
        userVelocityRef.current = 0.6 * userVelocityRef.current + 0.4 * instV;
        lastEventTsRef.current = now;
      };
      
      const onPointerDown = (e: PointerEvent) => {
        // Only start interaction if a token is grabbed
        const target = e.target as Element;
        if (!target.closest('.orbit-token')) return;
        try { orbitContainerRef.current?.setPointerCapture?.(e.pointerId); } catch {}
        isInteractingRef.current = true;
        activePointerIdRef.current = e.pointerId;
        draggingTokenRef.current = false;
        downXYRef.current = { x: e.clientX, y: e.clientY };
        downTsRef.current = timestampNow();
        // seed last angle for polar delta tracking - use viewport coordinates (Zeyoda)
        const { cx, cy } = centerRef.current;
        lastAngleRef.current = Math.atan2(e.clientY - cy, e.clientX - cx);
        suppressClickRef.current = true;
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
        // Use viewport coordinates directly (Zeyoda)
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

      container.addEventListener('wheel', onWheel, { passive: false });
      container.addEventListener('pointerdown', onPointerDown as any, { passive: false } as any);
      container.addEventListener('pointermove', onPointerMove as any, { passive: false } as any);
      container.addEventListener('pointerup', onPointerUp as any);
      const onPointerEnter = () => { isHoveringRef.current = true; };
      const onPointerLeave = () => { isHoveringRef.current = false; };
      container.addEventListener('pointerenter', onPointerEnter);
      container.addEventListener('pointerleave', onPointerLeave);
      // prevent accidental navigation clicks immediately after drag
      const onClickCapture = (e: MouseEvent) => { if (suppressClickRef.current) { e.preventDefault(); e.stopPropagation(); } };
      container.addEventListener('click', onClickCapture, true);

      // cleanup listeners
      const cleanup = () => {
        container.removeEventListener('wheel', onWheel as any);
        container.removeEventListener('pointerdown', onPointerDown as any);
        container.removeEventListener('pointermove', onPointerMove as any);
        container.removeEventListener('pointerup', onPointerUp as any);
        container.removeEventListener('pointerenter', onPointerEnter);
        container.removeEventListener('pointerleave', onPointerLeave);
        container.removeEventListener('click', onClickCapture, true);
      };

      return () => {
        cleanup();
      };
    }

    return () => {
      window.removeEventListener('hero:pinned', onHeroPinned);
      window.removeEventListener('carousel:stable', onStable);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [featuredContentRef, chatRef, isOrbitAnimationPaused, phaseTokens, brandColor]);

  // Early return if FeaturedContent not ready (matches Zeyoda line 379: if (!artistConfig) return null;)
  if (!featuredContentRef.current) return null;

  // Default colors for each phase
  const defaultColors: Record<string, string> = {
    pre: '#10b981',    // Emerald
    prod: '#fbbf24',   // Gold
    post: '#cbd5e1',   // Silver
    legacy: '#ffffff', // White
  };

  return (
    <div 
      className="orbit-tokens-wrapper"
      style={{
        position: 'absolute',
        inset: 0, // Cover carousel exactly
        pointerEvents: 'none', // Allow clicks through to carousel
        zIndex: 20 // Above carousel but below modals
      }}
    >
      <div 
        className="orbital-tokens"
        ref={orbitContainerRef}
        onMouseEnter={() => { /* pause handled on token hover */ }}
        onMouseLeave={() => { if (!isInteractingRef.current) isOrbitAnimationPaused.current = false; }}
        style={{ touchAction: 'none', overscrollBehavior: 'contain' as any, pointerEvents: 'auto' }}
      >
        {phaseTokens.map((token, index) => {
          const isFilled = token.progress >= 100;
          const tokenColor = brandColor || token.color || defaultColors[token.id] || defaultColors.pre;
          const fillPercentage = Math.min(100, Math.max(0, token.progress));
          
          // DEBUG: Log PRE token progress
          if (token.id === 'pre') {
            console.log('[PRE TOKEN FILL]', { 
              id: token.id,
              progress: token.progress, 
              fillPercentage, 
              tokenColor,
              willRender: fillPercentage > 0 
            });
          }
          
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
                position: 'fixed', // VIEWPORT-relative (matches center coordinates - Zeyoda)
                cursor: 'grab',
                pointerEvents: 'auto',
                // left/top set dynamically in positionOnce()
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
                className="relative w-16 h-16 md:w-20 md:h-20 rounded-full transition-all duration-500 ease-out overflow-hidden"
                style={{
                  backgroundColor: 'transparent',
                  border: `2px solid ${tokenColor}`,
                  opacity: 1,
                }}
              >
                {/* Bottom-up fill based on progress - let parent's overflow-hidden clip to circle */}
                {fillPercentage > 0 && (
                  <div
                    className="absolute transition-all duration-500 ease-out"
                    style={{
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: `${fillPercentage}%`,
                      backgroundColor: tokenColor,
                      // No border-radius - parent's overflow-hidden + rounded-full handles clipping
                      zIndex: 1, // Above border to ensure visibility
                      pointerEvents: 'none', // Don't block interactions
                    }}
                  />
                )}
                {/* Progress ring overlay for visual clarity */}
                {fillPercentage > 0 && fillPercentage < 100 && (
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 100 100"
                    style={{ pointerEvents: 'none' }}
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke={tokenColor}
                      strokeWidth="2"
                      opacity="0.5"
                    />
                  </svg>
                )}
                {/* Glow effect when filled */}
                {isFilled && (
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      boxShadow: `0 0 20px rgba(${parseInt(tokenColor.slice(1, 3), 16)}, ${parseInt(tokenColor.slice(3, 5), 16)}, ${parseInt(tokenColor.slice(5, 7), 16)}, 0.5)`,
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>

              {/* Token Label */}
              <span
                className="absolute bottom-[-24px] left-1/2 transform -translate-x-1/2 text-xs md:text-sm font-semibold tracking-wider transition-all duration-500 whitespace-nowrap"
                style={{
                  color: tokenColor,
                  opacity: 1,
                }}
              >
                {token.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ArtisTalksOrbitRenderer;


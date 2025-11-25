'use client'

import { forwardRef } from 'react'
import { Profile } from '@/hooks/useProfile'

// Future-proof props contract (designed for future carousel upgrade)
interface FeaturedContentProps {
  profile: Profile | null
  currentModule?: {
    id: string
    title: string
    content: string
    imageUrl?: string
    type?: 'pre' | 'pro' | 'post' | 'loop'
  }
  brandColor?: string
}

const FeaturedContent = forwardRef<HTMLDivElement, FeaturedContentProps>(({ 
  profile, 
  currentModule, 
  brandColor 
}, ref) => {
  // Default color palette: emerald, gold, silver, white, black
  const defaultColors = ['#10b981', '#fbbf24', '#cbd5e1', '#ffffff', '#000000']
  
  // Use brandColor if provided, otherwise rotate through default palette based on module type
  const getDefaultColor = (type?: 'pre' | 'pro' | 'post' | 'loop') => {
    if (brandColor) return brandColor
    const colorIndex = type === 'pre' ? 0 : type === 'pro' ? 1 : type === 'post' ? 2 : type === 'loop' ? 3 : 0
    return defaultColors[colorIndex] || defaultColors[0]
  }
  
  const accentColor = getDefaultColor(currentModule?.type)
  
  // Helper to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  return (
    <div 
      ref={ref}
      className="w-full max-w-4xl mx-auto bg-black/40 backdrop-blur-md border rounded-2xl p-8 shadow-2xl transition-all duration-500 relative"
      style={{
        borderColor: hexToRgba(accentColor, 0.3),
        boxShadow: `0 25px 50px -12px ${hexToRgba(accentColor, 0.2)}`,
        zIndex: 10,
        position: 'relative'
      }}
    >
      {/* Current Module Tile */}
      {currentModule ? (
        <div 
          className="mb-6 p-6 rounded-xl border-2 transition-all duration-500"
          style={{
            borderColor: hexToRgba(accentColor, 0.5),
            backgroundColor: hexToRgba(accentColor, 0.1),
          }}
        >
          <h3 
            className="text-2xl font-bold mb-3"
            style={{ color: accentColor }}
          >
            {currentModule.title}
          </h3>
          <p 
            className="text-lg leading-relaxed"
            style={{ color: hexToRgba(accentColor, 0.9) }}
          >
            {/* Use profile.mission_statement for gift-to-world module (current source of truth) */}
            {currentModule.id === 'gift-to-world' && profile?.mission_statement
              ? profile.mission_statement
              : currentModule.content}
          </p>
          {currentModule.imageUrl && (
            <div className="mt-4">
              <img 
                src={currentModule.imageUrl} 
                alt={currentModule.title || "Module content"}
                className="max-w-full max-h-64 object-contain rounded-lg"
              />
            </div>
          )}
        </div>
      ) : (
        /* Placeholder Area when no module yet */
        <div 
          className="w-full h-48 md:h-64 rounded-xl border-2 border-dashed bg-zinc-900/20 flex items-center justify-center transition-all duration-500"
          style={{
            borderColor: hexToRgba(accentColor, 0.2)
          }}
        >
          <div className="text-center text-zinc-500 text-sm">
            <div className="space-y-2">
              <div className="text-4xl opacity-50">🎨</div>
              <p className="text-xs">Share your gift to create your first tile</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

FeaturedContent.displayName = 'FeaturedContent'

export default FeaturedContent


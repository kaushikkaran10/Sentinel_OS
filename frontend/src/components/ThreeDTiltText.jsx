import React, { useState, useRef } from 'react'

/**
 * ThreeDTiltText — Retro Arcade 3D Pixel Pop & CRT Phosphor Sweep
 * Authentic retro arcade stepped extrusion and CRT scanline shimmer for DotGothic16.
 */
export default function ThreeDTiltText({
  children,
  className = '',
  as: Component = 'h2',
  ...props
}) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Component
      className={`retro-arcade-heading ${isHovered ? 'is-hovered' : ''} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        fontFamily: 'var(--font-display)',
        cursor: 'default',
        position: 'relative',
        display: 'block',
        width: 'fit-content',
        margin: '0',
        transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), text-shadow 0.18s ease, color 0.18s ease',
        transform: isHovered ? 'translate(-2px, -2px)' : 'translate(0, 0)',
        textShadow: isHovered
          ? '2px 2px 0px #181512, 4px 4px 0px var(--accent-coral), 6px 6px 0px rgba(223, 83, 63, 0.3), 0 8px 20px rgba(24, 21, 18, 0.12)'
          : '1px 1px 0px rgba(24, 21, 18, 0.4), 2px 2px 0px rgba(223, 83, 63, 0.15)',
      }}
      {...props}
    >
      {children}
    </Component>
  )
}

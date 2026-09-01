import React, { useState } from 'react'

/**
 * ScrambleText — Retro Terminal Phosphor Glow & Pixel Highlight
 * Provides a clean retro CRT phosphor bloom and 8-bit stepped highlight on hover.
 */
export default function ScrambleText({
  children,
  className = '',
  as: Component = 'span',
  ...props
}) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Component
      className={`retro-text-node ${isHovered ? 'is-retro-glow' : ''} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        cursor: 'default',
        transition: 'color 0.15s ease, text-shadow 0.15s ease, transform 0.15s ease',
        textShadow: isHovered
          ? '1px 1px 0px #ab3625, 0 0 8px rgba(223, 83, 63, 0.45)'
          : undefined,
        color: isHovered ? 'var(--accent-coral)' : undefined,
        display: 'inline-block',
      }}
      {...props}
    >
      {children}
    </Component>
  )
}


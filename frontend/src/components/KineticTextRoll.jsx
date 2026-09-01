import React, { useState } from 'react'

/**
 * KineticTextRoll — Retro Mechanical Split-Flap Odometer Roll
 * Clean, tactile character roll inspired by vintage Solari split-flap boards
 * and classic arcade displays.
 */
export default function KineticTextRoll({ text, isActive = false }) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <span
      className="retro-split-flap-root"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-flex',
        overflow: 'hidden',
        height: '18px',
        lineHeight: '18px',
        verticalAlign: 'middle',
      }}
    >
      {text.split('').map((char, i) => {
        const isSpace = char === ' '
        const delay = i * 18

        return (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              height: '36px',
              transform: isHovered ? 'translateY(-18px)' : 'translateY(0px)',
              transition: `transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.2) ${delay}ms`,
            }}
          >
            {/* Upper / Resting Character */}
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '18px',
                lineHeight: '18px',
                color: isActive ? 'var(--ink-primary)' : 'var(--ink-secondary)',
                fontWeight: isActive ? 700 : 400,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {isSpace ? '\u00A0' : char}
            </span>

            {/* Lower / Rolled Highlight Character */}
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '18px',
                lineHeight: '18px',
                color: 'var(--accent-coral)',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                textShadow: '1px 1px 0px rgba(223, 83, 63, 0.4)',
              }}
            >
              {isSpace ? '\u00A0' : char}
            </span>
          </span>
        )
      })}
    </span>
  )
}

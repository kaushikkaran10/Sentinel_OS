import React, { useState } from 'react'

export default function NeuralWaveform({ isLive = true, color = 'var(--accent-purple)' }) {
  const [hovered, setHovered] = useState(false)
  const barCount = 14

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'flex-end',
        gap: '2.5px',
        height: '16px',
        padding: '2px 4px',
        cursor: 'pointer',
      }}
      title="Local Neural Activity Stream"
    >
      {Array.from({ length: barCount }).map((_, i) => {
        // Staggered animated height
        const animDuration = 0.6 + (i % 5) * 0.15
        const delay = (i * 0.08)
        return (
          <span
            key={i}
            style={{
              width: '2px',
              height: hovered ? `${Math.min(16, 4 + (i * 1.2))}px` : '100%',
              background: color,
              borderRadius: '1px',
              opacity: 0.75,
              animation: isLive ? `waveform-bounce ${animDuration}s ease-in-out ${delay}s infinite alternate` : 'none',
              transition: 'height 0.2s ease',
            }}
          />
        )
      })}
    </div>
  )
}

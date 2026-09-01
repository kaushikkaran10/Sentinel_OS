import React, { useState, useCallback, useRef } from 'react'

/**
 * useScrambleText — Cybernetic Matrix / Decrypt Text Scramble Hook
 * On hover or trigger, scrambles characters with random glyphs before resolving.
 */
const GLYPHS = '0123456789ABCDEF$#%&*<>[]~_+'

export function useScrambleText(originalText, speed = 28) {
  const [displayText, setDisplayText] = useState(originalText)
  const [isScrambling, setIsScrambling] = useState(false)
  const isScramblingRef = useRef(false)
  const intervalRef = useRef(null)

  const scramble = useCallback(() => {
    if (isScramblingRef.current) return
    isScramblingRef.current = true
    setIsScrambling(true)

    let iteration = 0
    const maxIterations = originalText.length

    clearInterval(intervalRef.current)

    intervalRef.current = setInterval(() => {
      setDisplayText(
        originalText
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' '
            if (index < iteration) {
              return originalText[index]
            }
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
          })
          .join('')
      )

      if (iteration >= maxIterations) {
        clearInterval(intervalRef.current)
        setDisplayText(originalText)
        isScramblingRef.current = false
        setIsScrambling(false)
      }

      iteration += 1 / 2
    }, speed)
  }, [originalText, speed])

  return { displayText, scramble, isScrambling }
}

/**
 * ScrambleText Component Wrapper with glowing matrix decrypt feedback
 */
export function ScrambleText({ children, className = '', as = 'span', ...props }) {
  const text = typeof children === 'string' ? children : ''
  const { displayText, scramble, isScrambling } = useScrambleText(text)
  const Component = as

  return (
    <Component
      className={`scramble-text-node ${isScrambling ? 'is-decrypting' : ''} ${className}`}
      onMouseEnter={scramble}
      style={{
        cursor: 'default',
        transition: 'color 0.18s ease, text-shadow 0.18s ease',
        textShadow: isScrambling ? '0 0 8px rgba(223, 83, 63, 0.45)' : 'none',
        color: isScrambling ? 'var(--accent-coral)' : undefined,
      }}
      {...props}
    >
      {displayText || children}
    </Component>
  )
}

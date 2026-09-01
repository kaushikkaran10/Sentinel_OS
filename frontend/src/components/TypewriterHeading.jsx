import React, { useState, useEffect } from 'react'

const WORDS = [
  'AI Agents',
  'Confidential SOPs',
  'Autonomous Pipelines',
  'Engineering Workloads',
  'Air-Gapped Teams',
]

/**
 * TypewriterHeading — Authentic Retro CRT Terminal Typewriter
 * Character-by-character mechanical terminal typing in DotGothic16,
 * complete with retro solid block cursor and authentic deletion cadence.
 */
export default function TypewriterHeading() {
  const [wordIndex, setWordIndex] = useState(0)
  const [currentText, setCurrentText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const fullWord = WORDS[wordIndex]
    let timeout

    if (!isDeleting) {
      // Typing phase
      if (currentText.length < fullWord.length) {
        timeout = setTimeout(() => {
          setCurrentText(fullWord.slice(0, currentText.length + 1))
        }, 85)
      } else {
        // Pause at full word
        timeout = setTimeout(() => {
          setIsDeleting(true)
        }, 2600)
      }
    } else {
      // Deleting phase
      if (currentText.length > 0) {
        timeout = setTimeout(() => {
          setCurrentText(currentText.slice(0, -1))
        }, 40)
      } else {
        setIsDeleting(false)
        setWordIndex((prev) => (prev + 1) % WORDS.length)
      }
    }

    return () => clearTimeout(timeout)
  }, [currentText, isDeleting, wordIndex])

  const handleClick = () => {
    setIsDeleting(true)
  }

  return (
    <span
      className="retro-typewriter-container"
      onClick={handleClick}
      title="Click to fast-forward"
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        verticalAlign: 'bottom',
        cursor: 'pointer',
      }}
    >
      <span
        className="retro-typewriter-text"
        style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--accent-coral)',
          fontWeight: 400,
          letterSpacing: '0.02em',
          textShadow: '2px 2px 0px #ab3625, 3px 3px 0px #7d261a, 0 4px 12px rgba(223, 83, 63, 0.35)',
        }}
      >
        {currentText}
      </span>

      {/* Classic Retro Terminal Block Cursor */}
      <span
        className="retro-block-cursor"
        style={{
          display: 'inline-block',
          width: '9px',
          height: '1.05em',
          backgroundColor: 'var(--accent-coral)',
          marginLeft: '4px',
          verticalAlign: '-0.12em',
          animation: 'retro-cursor-blink 0.9s steps(2, start) infinite',
          boxShadow: '0 0 8px rgba(223, 83, 63, 0.6)',
        }}
      />
    </span>
  )
}

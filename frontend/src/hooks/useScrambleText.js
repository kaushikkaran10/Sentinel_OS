import { useState, useCallback, useRef, useEffect } from 'react'

const CRYPTO_GLYPHS = '0123456789ABCDEF!@#$%^&*<>[]{}~_+=/|:;ØΨΩ§λЖ∆∇∑√░▒▓█'

/**
 * useScrambleText — Cryptographic Cipher Scramble Hook
 * Supports on-demand hover scrambling, auto-scramble on mount,
 * and smooth cryptographic transitions between arbitrary phrases via scrambleTo().
 */
export function useScrambleText(initialText = '', speed = 25, autoScramble = false) {
  const [displayText, setDisplayText] = useState(initialText)
  const [isScrambling, setIsScrambling] = useState(false)
  const isScramblingRef = useRef(false)
  const intervalRef = useRef(null)
  const currentTextRef = useRef(initialText)

  useEffect(() => {
    currentTextRef.current = initialText
    setDisplayText(initialText)
  }, [initialText])

  const scrambleTo = useCallback((targetText, customSpeed = speed) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    isScramblingRef.current = true
    setIsScrambling(true)

    const fromText = currentTextRef.current || ''
    const maxLen = Math.max(fromText.length, targetText.length)
    let iteration = 0
    const totalSteps = maxLen * 2.5

    intervalRef.current = setInterval(() => {
      const lockIndex = Math.floor((iteration / totalSteps) * maxLen)

      let result = ''
      for (let i = 0; i < maxLen; i++) {
        if (i >= targetText.length) {
          // Shrinking phase if target is shorter
          if (i >= lockIndex) {
            result += CRYPTO_GLYPHS[Math.floor(Math.random() * CRYPTO_GLYPHS.length)]
          }
          continue
        }

        const targetChar = targetText[i]
        if (targetChar === ' ') {
          result += ' '
        } else if (i < lockIndex) {
          result += targetChar
        } else {
          result += CRYPTO_GLYPHS[Math.floor(Math.random() * CRYPTO_GLYPHS.length)]
        }
      }

      setDisplayText(result)
      iteration += 1

      if (iteration > totalSteps) {
        clearInterval(intervalRef.current)
        setDisplayText(targetText)
        currentTextRef.current = targetText
        isScramblingRef.current = false
        setIsScrambling(false)
      }
    }, customSpeed)
  }, [speed])

  const scramble = useCallback(() => {
    if (isScramblingRef.current) return
    scrambleTo(currentTextRef.current)
  }, [scrambleTo])

  useEffect(() => {
    if (autoScramble && initialText) {
      scrambleTo(initialText)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoScramble, initialText, scrambleTo])

  return { displayText, scramble, scrambleTo, isScrambling }
}

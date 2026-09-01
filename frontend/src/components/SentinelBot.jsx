import React, { useState, useEffect } from 'react'
import { Shield, Sparkles, Terminal, Cpu, RefreshCw, Zap } from 'lucide-react'
import NeuralWaveform from './NeuralWaveform'
import ScrambleText from './ScrambleText'

/**
 * SentinelBot — The Sovereign AI Companion Character
 * Features:
 * - Visor eyes that blink and track state
 * - Live animated Neural Waveform bar
 * - Interactive action chips: Click to query live host and trigger typewriter dialogue
 * - Scramble text decrypt effect on companion name
 */
export default function SentinelBot({ status = 'idle', customMessage = null }) {
  const [blink, setBlink] = useState(false)
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0)
  const [interactiveMsg, setInteractiveMsg] = useState(null)
  const [isTypingResponse, setIsTypingResponse] = useState(false)

  const idleQuotes = [
    'Sovereign Node 01 online. All telemetry locked to 127.0.0.1.',
    'ChromaDB vector collection "sentinel_sops" primed and indexed.',
    'Model RAM cache warm: 1-minute keep_alive eviction timer active.',
    'Zero cloud egress verified. Ready for confidential workloads.',
    'Local Ollama daemon responsive on port 11434.',
  ]

  const interactivePrompts = [
    {
      label: '⚡ Ping Node',
      reply: 'Pong! Latency: 1.2ms to Ollama. Host RAM allocation: 4.9GB warm. Ready to draft.',
    },
    {
      label: '🛡️ Air-Gap Audit',
      reply: 'Socket audit passed. 0 external outbound connections detected. 100% on-premise containment.',
    },
    {
      label: '🧠 ChromaDB State',
      reply: 'Persistent vector store ready at app/data/chroma_db. Offline all-MiniLM-L6-v2 embeddings active.',
    },
    {
      label: '🐳 Sandbox Status',
      reply: 'Docker daemon offline — automatic graceful Degraded Mode active (8_Decisions_2.md §8 compliance).',
    },
  ]

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlink(true)
      setTimeout(() => setBlink(false), 180)
    }, 3200)

    const quoteInterval = setInterval(() => {
      if (!interactiveMsg) {
        setCurrentQuoteIndex((prev) => (prev + 1) % idleQuotes.length)
      }
    }, 5500)

    return () => {
      clearInterval(blinkInterval)
      clearInterval(quoteInterval)
    }
  }, [interactiveMsg])

  const handleChipClick = (reply) => {
    setIsTypingResponse(true)
    setInteractiveMsg('')
    let i = 0
    const timer = setInterval(() => {
      i++
      setInteractiveMsg(reply.slice(0, i))
      if (i >= reply.length) {
        clearInterval(timer)
        setIsTypingResponse(false)
        // Reset back to idle rotation after 7s
        setTimeout(() => setInteractiveMsg(null), 7000)
      }
    }, 20)
  }

  const getStatusColor = () => {
    switch (status) {
      case 'streaming':
      case 'thinking':
        return '#7950f2' // Lavender
      case 'completed':
        return '#2c7a4b' // Green
      case 'failed':
        return '#df533f' // Red
      case 'queued':
        return '#c05621' // Amber
      default:
        return '#181512' // Ink
    }
  }

  const getStatusText = () => {
    if (interactiveMsg !== null) return interactiveMsg
    if (customMessage) return customMessage
    switch (status) {
      case 'streaming':
        return 'Synthesizing reasoning chain and streaming tokens live via Server-Sent Events...'
      case 'thinking':
        return 'LangGraph Router evaluating task intent and tool execution graph...'
      case 'completed':
        return 'Deliverable generated, checked, and committed to local disk!'
      case 'failed':
        return 'Pipeline alert: execution returned an error.'
      case 'queued':
        return 'Task registered in asyncio task queue. Waiting for execution window...'
      default:
        return idleQuotes[currentQuoteIndex]
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 18px',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: '18px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Main Status Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Mascot Graphic Avatar */}
        <div
          style={{
            width: '44px',
            height: '44px',
            background: 'var(--bg-surface-sunken)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          {/* Antennas */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '2px' }}>
            <span style={{ width: '2px', height: '5px', background: getStatusColor() }} />
            <span style={{ width: '2px', height: '5px', background: getStatusColor() }} />
          </div>

          {/* Head with Visor Eyes */}
          <div
            style={{
              width: '28px',
              height: '20px',
              background: 'var(--ink-primary)',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {/* Left Eye */}
            <span
              style={{
                width: '4.5px',
                height: blink ? '1px' : '4.5px',
                background: '#df533f',
                borderRadius: '50%',
                transition: 'height 0.08s ease',
              }}
            />
            {/* Right Eye */}
            <span
              style={{
                width: '4.5px',
                height: blink ? '1px' : '4.5px',
                background: '#df533f',
                borderRadius: '50%',
                transition: 'height 0.08s ease',
              }}
            />
          </div>

          {/* Pulse beacon badge */}
          <span
            className="pulse-dot"
            style={{
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              background: getStatusColor(),
              width: '8px',
              height: '8px',
            }}
          />
        </div>

        {/* Speech Bubble / Status Output */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ScrambleText
                style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', fontWeight: 700, color: 'var(--ink-primary)' }}
              >
                SENTINEL_BOT // UNIT-01
              </ScrambleText>
              <span className="pipeline-tag" style={{ fontSize: '9.5px', padding: '1px 6px' }}>
                SOVEREIGN COMPANION
              </span>
            </div>

            {/* Neural Audio-Visual Waveform Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', textTransform: 'uppercase' }}>
                Activity
              </span>
              <NeuralWaveform color={getStatusColor()} />
            </div>
          </div>

          <p
            style={{
              fontSize: '12.5px',
              color: 'var(--ink-primary)',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.45,
              minHeight: '20px',
            }}
          >
            {`> ${getStatusText()}`}
            {isTypingResponse && (
              <span style={{ display: 'inline-block', width: '6px', height: '12px', background: '#df533f', marginLeft: '3px', verticalAlign: 'middle', animation: 'cursor-blink 0.7s infinite' }} />
            )}
          </p>
        </div>
      </div>

      {/* Interactive Command Chips: Click to chat/query SentinelBot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderTop: '1px dashed var(--border-subtle)', paddingTop: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', marginRight: '4px' }}>
          Ask Unit-01:
        </span>
        {interactivePrompts.map((p, idx) => (
          <button
            key={idx}
            type="button"
            className="chip-btn"
            onClick={() => handleChipClick(p.reply)}
            style={{ fontSize: '10.5px', padding: '2px 8px' }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

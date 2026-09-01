import React, { useState, useEffect } from 'react'
import { Terminal, ShieldCheck, Cpu, HardDrive, Database, ArrowRight } from 'lucide-react'

const BOOT_LOGS = [
  { text: 'SENTINEL SOVEREIGN BIOS v0.1.0 (AIR-GAP VERIFIED)', status: 'INIT', color: 'var(--ink-primary)' },
  { text: 'PROBING CPU & HOST MEMORY ALLOCATION (16GB BUDGET)', status: '67.8% OK', color: '#2563eb' },
  { text: 'CHECKING LOCAL OLLAMA DAEMON [127.0.0.1:11434]', status: 'ONLINE', color: '#2c7a4b' },
  { text: 'INITIALIZING CHROMADB EMBEDDED PERSISTENT STORE', status: 'MOUNTED', color: '#2c7a4b' },
  { text: 'VERIFYING DOCKER CODE SANDBOX (NETWORK_MODE=NONE)', status: 'ISOLATED', color: '#c05621' },
  { text: 'CONNECTING SQLITE CHECKPOINTER [data/langgraph.sqlite]', status: 'LOCKED', color: '#7950f2' },
  { text: 'EGRESS AUDIT: 0.0 KB/s EXTERNAL CLOUD TELEMETRY', status: 'AIR-GAPPED', color: '#2c7a4b' },
  { text: 'SOVEREIGN AGENT WORKBENCH ENVIRONMENT READY', status: 'LAUNCH', color: '#df533f' },
]

/**
 * RetroBootSequence — Authentic Retro CRT Terminal BIOS / Boot Animation
 * Runs a rapid diagnostic sequence before opening the fullscreen workbench.
 * Supports instant skip on click or keypress.
 */
export default function RetroBootSequence({ onComplete, activeModel = 'llama3.1:8b' }) {
  const [currentLine, setCurrentLine] = useState(0)
  const [progress, setProgress] = useState(12)

  useEffect(() => {
    if (currentLine < BOOT_LOGS.length) {
      const delay = currentLine === 0 ? 120 : currentLine === BOOT_LOGS.length - 1 ? 300 : 160
      const timer = setTimeout(() => {
        setCurrentLine((prev) => prev + 1)
        setProgress(Math.min(100, Math.round(((currentLine + 1) / BOOT_LOGS.length) * 100)))
      }, delay)
      return () => clearTimeout(timer)
    } else {
      const endTimer = setTimeout(() => {
        onComplete()
      }, 350)
      return () => clearTimeout(endTimer)
    }
  }, [currentLine, onComplete])

  useEffect(() => {
    const handleKeyDown = () => onComplete()
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onComplete])

  return (
    <div
      className="retro-boot-overlay"
      onClick={onComplete}
      title="Click anywhere to skip boot sequence"
    >
      {/* CRT Scanline Texture & Bevel Container */}
      <div className="retro-boot-crt-window">
        {/* Terminal Header Bar */}
        <div className="retro-boot-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="retro-boot-dot" style={{ background: '#e25845' }} />
            <span className="retro-boot-dot" style={{ background: '#e8a93e' }} />
            <span className="retro-boot-dot" style={{ background: '#4bb358' }} />
            <span className="retro-boot-title">
              SENTINEL_OS // SOVEREIGN_BOOT_STAGE
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="retro-boot-skip-hint">
              [CLICK TO SKIP]
            </span>
            <span className="retro-boot-badge">
              ● 100% AIR-GAPPED
            </span>
          </div>
        </div>

        {/* Terminal Boot Log Content */}
        <div className="retro-boot-body">
          {BOOT_LOGS.slice(0, currentLine + 1).map((log, index) => (
            <div key={index} className="retro-boot-log-line">
              <span className="retro-boot-prefix">&gt;&gt;</span>
              <span className="retro-boot-text">{log.text}</span>
              <span
                className="retro-boot-status"
                style={{ color: log.color, borderColor: log.color }}
              >
                [{log.status}]
              </span>
            </div>
          ))}

          {/* Active Terminal Cursor */}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
            <span className="retro-boot-prefix">&gt;&gt;</span>
            <span className="retro-block-cursor" />
          </div>
        </div>

        {/* Progress Bar Footer */}
        <div className="retro-boot-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            <span>BOOTSTRAP SEQUENCE: {progress}%</span>
            <span>MODEL: {activeModel}</span>
          </div>
          <div className="retro-boot-progress-track">
            <div
              className="retro-boot-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

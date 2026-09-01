import React, { useState, useEffect } from 'react'
import { Shield, Terminal, Cpu, Database, Archive, Layers, Plus, Clock, Activity, Zap, ArrowLeft } from 'lucide-react'
import KineticTextRoll from './KineticTextRoll'

export default function NavigationRail({ activeTab, onTabChange, telemetry, onReturnToPortal, inStudioMode = false }) {
  const [timeStr, setTimeStr] = useState('')
  const [blink, setBlink] = useState(false)

  // Live ticking clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeStr(now.toTimeString().split(' ')[0])
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)

    // Blinking eye animation for mini avatar
    const blinkInterval = setInterval(() => {
      setBlink(true)
      setTimeout(() => setBlink(false), 150)
    }, 4000)

    return () => {
      clearInterval(timer)
      clearInterval(blinkInterval)
    }
  }, [])

  const items = [
    { id: 'workspace', label: 'Workspace', icon: Terminal, code: '01' },
    { id: 'pipeline', label: 'Agent Pipeline', icon: Layers, code: '02' },
    { id: 'vault', label: 'Document Vault', icon: Archive, code: '03' },
    { id: 'telemetry', label: 'Telemetry HUD', icon: Cpu, code: '04' },
  ]

  const ramPercent = telemetry?.ram_usage_percent || 67.8

  return (
    <aside className="left-rail">
      {/* Brand & Live Digital Clock */}
      <div>
        <div className="rail-brand" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="brand-icon">⌘</div>
            <div>
              <div className="brand-text" style={{ fontSize: '17px' }}>Sentinel OS</div>
              <div style={{ fontSize: '9px', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
                SOVEREIGN • v0.1.0
              </div>
            </div>
          </div>
        </div>

        {inStudioMode && onReturnToPortal && (
          <button
            onClick={onReturnToPortal}
            className="btn btn-outline"
            style={{
              width: '100%',
              marginTop: '10px',
              fontSize: '10.5px',
              padding: '5px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <ArrowLeft size={12} />
            <span>Showcase Portal</span>
          </button>
        )}

        {/* Live Monospace Clock Bar */}
        <div
          style={{
            margin: '14px 0 0',
            padding: '5px 8px',
            background: 'var(--bg-surface-sunken)',
            borderRadius: 'var(--radius-xs)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)',
            fontSize: '10.5px',
            color: 'var(--ink-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span className="pulse-dot" style={{ width: '6px', height: '6px' }} />
            <span>{timeStr || '12:00:00'}</span>
          </div>
          <span style={{ fontSize: '9px', color: 'var(--accent-green)', fontWeight: 600 }}>LOCAL</span>
        </div>
      </div>

      {/* Primary Navigation with Kinetic Text Roll Animations */}
      <nav className="rail-nav">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', marginBottom: '4px' }}>
          <span style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Systems Menu
          </span>
          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--ink-faint)' }}>
            [TAB]
          </span>
        </div>

        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id

          return (
            <div
              key={item.id}
              className={`rail-item ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(item.id)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 10px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'background 0.18s ease, transform 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                {/* Active Equalizer Soundwave vs resting dots */}
                {isActive ? (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '12px', width: '12px' }}>
                    <span style={{ width: '2px', height: '100%', background: 'var(--accent-coral)', animation: 'waveform-bounce 0.6s infinite alternate' }} />
                    <span style={{ width: '2px', height: '60%', background: 'var(--accent-coral)', animation: 'waveform-bounce 0.8s 0.2s infinite alternate' }} />
                    <span style={{ width: '2px', height: '80%', background: 'var(--accent-coral)', animation: 'waveform-bounce 0.5s 0.1s infinite alternate' }} />
                  </div>
                ) : (
                  <div className="dot-matrix">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </div>
                )}

                <Icon size={14} style={{ color: isActive ? 'var(--accent-coral)' : 'inherit', flexShrink: 0 }} />

                {/* Animated Mechanical Odometer Text Roll */}
                <KineticTextRoll text={item.label} isActive={isActive} />
              </div>

              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9.5px', opacity: 0.45 }}>
                {item.code}
              </span>
            </div>
          )
        })}
      </nav>

      {/* Quick Launch Action Button */}
      <button
        onClick={() => onTabChange('workspace')}
        className="btn btn-outline"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '7px',
          padding: '8px 10px',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          borderRadius: 'var(--radius-sm)',
          borderStyle: 'dashed',
        }}
      >
        <Plus size={13} />
        <span>New Agent Task</span>
      </button>

      {/* Live System Vitals HUD Widget (Fixes empty space!) */}
      <div
        style={{
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '9px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
          <span style={{ fontWeight: 600 }}>HOST VITALS</span>
          <span style={{ color: 'var(--accent-green)' }}>● 0.0 KB/s</span>
        </div>

        {/* RAM Usage Mini Meter */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', marginBottom: '3px' }}>
            <span>RAM</span>
            <span style={{ fontWeight: 600 }}>{ramPercent}%</span>
          </div>
          <div style={{ width: '100%', height: '4px', background: 'var(--bg-surface-sunken)', borderRadius: '2px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${ramPercent}%`,
                height: '100%',
                background: 'var(--ink-primary)',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
        </div>

        {/* Model Tag */}
        <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--ink-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Zap size={10} style={{ color: 'var(--accent-purple)' }} />
          <span style={{ truncate: true, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            llama3.1:8b (warm)
          </span>
        </div>
      </div>

      {/* Bottom Companion Tile & Air-Gap Verification */}
      <div className="rail-bottom" style={{ marginTop: 'auto' }}>
        {/* Mini SentinelBot Status Widget */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
          <div
            style={{
              width: '20px',
              height: '16px',
              background: 'var(--ink-primary)',
              borderRadius: '3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
            }}
          >
            <span style={{ width: '3px', height: blink ? '1px' : '3px', background: '#df533f', borderRadius: '50%' }} />
            <span style={{ width: '3px', height: blink ? '1px' : '3px', background: '#df533f', borderRadius: '50%' }} />
          </div>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--ink-primary)', fontWeight: 600 }}>
            UNIT-01: ONLINE
          </div>
        </div>

        <div className="airgap-badge" style={{ width: '100%', justifyContent: 'center' }}>
          <span className="pulse-dot" />
          <span>100% Air-Gapped</span>
        </div>
      </div>
    </aside>
  )
}

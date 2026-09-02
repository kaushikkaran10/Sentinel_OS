import React, { useState, useEffect } from 'react'
import { Lock, RefreshCw, Terminal, Layers, Cpu, Archive, Sun, Moon } from 'lucide-react'
import ScrambleText from './ScrambleText'

export default function OSWindowHeader({ activeTab, onTabChange, onRefresh, isRefreshing }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('sentinel-theme') || 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('sentinel-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const tabs = [
    { id: 'workspace', label: 'Task Workspace', code: '</>', icon: Terminal },
    { id: 'pipeline', label: 'Agent Pipeline', code: '⚡', icon: Layers },
    { id: 'telemetry', label: 'Analytics & Telemetry', code: '📊', icon: Cpu },
    { id: 'vault', label: 'Document Vault', code: '📁', icon: Archive },
  ]

  return (
    <>
      {/* Title Bar */}
      <div className="window-titlebar">
        <div className="traffic-lights">
          <span className="light red" />
          <span className="light yellow" />
          <span className="light green" />
        </div>

        <div className="location-capsule">
          <Lock size={12} style={{ color: 'var(--accent-green)' }} />
          <ScrambleText speed={18}>
            http://localhost:8000/api/v1 — air-gapped node
          </ScrambleText>
        </div>

        <div className="window-controls-end" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle-btn"
            title={`Switch to ${theme === 'dark' ? 'Light Bauhaus' : 'Tactical Dark'} Mode`}
            style={{ padding: '3px 8px', fontSize: '10.5px' }}
          >
            {theme === 'dark' ? (
              <>
                <Sun size={12} style={{ color: 'var(--accent-amber)' }} />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon size={12} style={{ color: 'var(--accent-purple)' }} />
                <span>Dark</span>
              </>
            )}
          </button>

          <button
            onClick={onRefresh}
            title="Refresh Status"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--ink-secondary)',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
            }}
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="window-tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              className={`window-tab ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <span style={{ fontSize: '11px', opacity: 0.8 }}>{tab.code}</span>
              <ScrambleText speed={20}>{tab.label}</ScrambleText>
            </button>
          )
        })}
      </div>
    </>
  )
}

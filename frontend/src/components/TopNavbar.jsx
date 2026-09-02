import React from 'react'
import {
  Shield,
  Terminal,
  Layers,
  Cpu,
  Archive,
  RefreshCw,
  Sun,
  Moon,
  ExternalLink,
  Lock,
  ArrowRight,
  Sparkles,
} from 'lucide-react'

export default function TopNavbar({
  viewMode = 'workbench', // 'workbench' | 'portal'
  onViewModeChange,
  activeTab = 'workspace',
  onTabChange,
  telemetry,
  models,
  onRefresh,
  isRefreshing,
  theme,
  onToggleTheme,
}) {
  const activeModelTag = models?.active_models?.[0] || 'llama3.1:8b'
  const isAirGapped = true

  const workbenchTabs = [
    { id: 'workspace', label: 'Workspace', icon: Terminal },
    { id: 'pipeline', label: 'Pipeline Graph', icon: Layers },
    { id: 'telemetry', label: 'Telemetry & HUD', icon: Cpu },
    { id: 'vault', label: 'Knowledge Vault', icon: Archive },
  ]

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: '60px',
        backgroundColor: 'var(--glass-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-medium)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* Brand & Mode Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div
          onClick={() => onViewModeChange('workbench')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, var(--accent-primary), #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 0 16px rgba(59, 130, 246, 0.3)',
            }}
          >
            <Shield size={17} />
          </div>
          <div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: 'var(--ink-primary)',
                lineHeight: 1.1,
              }}
            >
              SENTINEL<span style={{ color: 'var(--accent-primary)', marginLeft: '3px' }}>OS</span>
            </div>
            <div
              style={{
                fontSize: '9.5px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--ink-muted)',
                letterSpacing: '0.04em',
              }}
            >
              SOVEREIGN AIR-GAP
            </div>
          </div>
        </div>

        {/* View Mode Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-surface-sunken)',
            borderRadius: 'var(--radius-pill)',
            padding: '3px',
            border: '1px solid var(--border-medium)',
          }}
        >
          <button
            type="button"
            onClick={() => onViewModeChange('workbench')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              background: viewMode === 'workbench' ? 'var(--bg-surface-elevated)' : 'transparent',
              color: viewMode === 'workbench' ? 'var(--ink-primary)' : 'var(--ink-muted)',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: viewMode === 'workbench' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Terminal size={13} style={{ color: viewMode === 'workbench' ? 'var(--accent-primary)' : 'inherit' }} />
            <span>Workbench</span>
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange('portal')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              background: viewMode === 'portal' ? 'var(--bg-surface-elevated)' : 'transparent',
              color: viewMode === 'portal' ? 'var(--ink-primary)' : 'var(--ink-muted)',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: viewMode === 'portal' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Sparkles size={13} style={{ color: viewMode === 'portal' ? 'var(--accent-purple)' : 'inherit' }} />
            <span>Showcase</span>
          </button>
        </div>
      </div>

      {/* Center Tabs (When in Workbench Mode) */}
      {viewMode === 'workbench' && (
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {workbenchTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: isActive ? 'var(--ink-primary)' : 'var(--ink-secondary)',
                  fontSize: '12.5px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={14} style={{ color: isActive ? 'var(--accent-primary)' : 'var(--ink-muted)' }} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      )}

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Air Gap Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--accent-green-subtle)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            fontSize: '11px',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: 'var(--accent-green)',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-green)',
              boxShadow: '0 0 8px var(--accent-green)',
            }}
          />
          <span>AIR-GAP VERIFIED</span>
        </div>

        {/* Model Tag */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--bg-surface-sunken)',
            border: '1px solid var(--border-medium)',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--ink-secondary)',
          }}
        >
          <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>LLM</span>
          <span>{activeModelTag}</span>
        </div>

        {/* API Docs */}
        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline"
          style={{ padding: '5px 10px', fontSize: '11px', gap: '5px' }}
          title="FastAPI Swagger Documentation"
        >
          <span>API</span>
          <ExternalLink size={11} />
        </a>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="btn btn-outline"
          style={{ padding: '6px 9px', borderRadius: 'var(--radius-sm)' }}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <Sun size={14} style={{ color: 'var(--accent-amber)' }} />
          ) : (
            <Moon size={14} style={{ color: 'var(--accent-purple)' }} />
          )}
        </button>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={onRefresh}
          className="btn btn-outline"
          style={{ padding: '6px 9px', borderRadius: 'var(--radius-sm)' }}
          title="Refresh Node Telemetry"
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>
    </header>
  )
}

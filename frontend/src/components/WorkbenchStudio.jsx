import React from 'react'
import OSWindowHeader from './OSWindowHeader'
import WorkspaceTab from './WorkspaceTab'
import AgentPipelineTab from './AgentPipelineTab'
import TelemetryTab from './TelemetryTab'
import VaultTab from './VaultTab'
import { ArrowLeft, ExternalLink, Terminal, Shield, RefreshCw, Cpu, Lock } from 'lucide-react'

/**
 * WorkbenchStudio — Fullscreen Sovereign OS Workbench
 * Provides a distraction-free, professional, high-performance workspace.
 */
export default function WorkbenchStudio({
  activeTab = 'workspace',
  onTabChange,
  onReturnToPortal,
  telemetry,
  models,
  onRefresh,
  isRefreshing,
}) {
  const activeModelTag = models?.active_models?.[0] || 'llama3.1:8b'

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', padding: '24px 28px 48px', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* Studio Top Context Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          padding: '10px 16px',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={onReturnToPortal}
            className="btn btn-outline"
            style={{ fontSize: '11.5px', padding: '5px 12px', gap: '6px' }}
            title="Return to Sentinel OS Portal"
          >
            <ArrowLeft size={13} />
            <span>Showcase Portal</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 8px var(--accent-green)' }} />
            <span style={{ fontWeight: 600, color: 'var(--ink-primary)' }}>Sovereign Node 01: 127.0.0.1</span>
            <span style={{ color: 'var(--ink-muted)' }}>• Local Port 8000</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-green)',
              background: 'var(--accent-green-subtle)',
              padding: '3px 10px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
            }}
          >
            <Lock size={12} />
            <span>AIR-GAP LOCK: 0.0 KB/s EGRESS</span>
          </div>

          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline"
            style={{ fontSize: '11px', padding: '5px 12px', gap: '5px' }}
          >
            <span>OpenAPI Docs</span>
            <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* Primary OS Container Window */}
      <div
        className="os-window studio-os-window"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-window)',
        }}
      >
        <OSWindowHeader
          activeTab={activeTab}
          onTabChange={onTabChange}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />

        <div className="window-body" style={{ padding: '24px' }}>
          {activeTab === 'workspace' && (
            <WorkspaceTab onTaskFinished={onRefresh} />
          )}
          {activeTab === 'pipeline' && (
            <AgentPipelineTab activeModel={activeModelTag} />
          )}
          {activeTab === 'telemetry' && (
            <TelemetryTab telemetry={telemetry} models={models} onPurged={onRefresh} />
          )}
          {activeTab === 'vault' && (
            <VaultTab />
          )}
        </div>
      </div>
    </div>
  )
}

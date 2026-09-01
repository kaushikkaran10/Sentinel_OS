import React, { useState } from 'react'
import NavigationRail from './NavigationRail'
import OSWindowHeader from './OSWindowHeader'
import WorkspaceTab from './WorkspaceTab'
import AgentPipelineTab from './AgentPipelineTab'
import TelemetryTab from './TelemetryTab'
import VaultTab from './VaultTab'
import ThreeDTiltText from './ThreeDTiltText'
import { ArrowLeft, ExternalLink, Terminal, Shield, RefreshCw } from 'lucide-react'

/**
 * WorkbenchStudio — Fullscreen Dedicated Sovereign OS Workbench
 * Provides a distraction-free, professional operating workspace for AI agents.
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
    <div className="app-container workbench-fullscreen-container">
      {/* Left Technical Navigation Rail */}
      <NavigationRail
        activeTab={activeTab}
        onTabChange={onTabChange}
        telemetry={telemetry}
        onReturnToPortal={onReturnToPortal}
        inStudioMode={true}
      />

      {/* Main Studio Center Stage */}
      <main className="main-stage studio-stage">
        {/* Top Studio Meta Bar */}
        <div className="studio-top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onReturnToPortal}
              className="btn btn-outline"
              style={{ fontSize: '11px', padding: '5px 12px', gap: '6px' }}
              title="Return to Sentinel OS Showcase Portal"
            >
              <ArrowLeft size={13} />
              <span>Showcase Portal</span>
            </button>

            <div className="hero-meta" style={{ margin: 0 }}>
              <span className="dot" style={{ background: 'var(--accent-green)' }} />
              <span>Sovereign Local Node: 127.0.0.1</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="airgap-badge">
              <span className="pulse-dot" />
              <span>AIR-GAP VERIFIED</span>
            </span>

            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline"
              style={{ fontSize: '11px', padding: '5px 12px' }}
            >
              <span>API Specs</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Primary Sovereign OS Window */}
        <div className="os-window studio-os-window">
          <OSWindowHeader
            activeTab={activeTab}
            onTabChange={onTabChange}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
          />

          <div className="window-body">
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
      </main>
    </div>
  )
}

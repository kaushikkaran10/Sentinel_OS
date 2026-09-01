import React, { useState } from 'react'
import { Terminal, Layers, Activity, FileCheck, ArrowRight, CheckCircle2, Lock, Shield } from 'lucide-react'
import ThreeDTiltText from './ThreeDTiltText'

/**
 * ShowcaseSection — Interactive Product Preview Window
 * Faithfully recreating the AgentForge tabbed preview experience:
 * </ > Code Editor | ⚡ Agent Builder | 📊 Analytics | 📄 Content Audit
 */
export default function ShowcaseSection({ onJumpToConsole }) {
  const [activePreview, setActivePreview] = useState('editor')

  const tabs = [
    { id: 'editor', label: 'Code & Task Editor', icon: Terminal, code: '</>' },
    { id: 'builder', label: 'Agent Builder', icon: Layers, code: '⚡' },
    { id: 'analytics', label: 'Analytics & Telemetry', icon: Activity, code: '📊' },
    { id: 'audit', label: 'Content & Artifact Audit', icon: FileCheck, code: '📄' },
  ]

  return (
    <section id="showcase" className="showcase-section">
      <div className="section-header-wrap">
        <div className="hero-meta">
          <span className="dot" style={{ background: 'var(--accent-blue)' }} />
          <span>Interactive Product Showcase</span>
        </div>
        <ThreeDTiltText as="h2" className="section-title" maxTilt={7}>
          Built for Sovereign Agent Engineering
        </ThreeDTiltText>
        <p className="section-desc">
          Explore the unified developer environment for local inference, multi-agent LangGraph orchestration, and native artifact delivery.
        </p>
      </div>

      {/* Showcase OS Window Container matching AgentForge #work style */}
      <div className="os-window showcase-window">
        {/* Window Top Tabs */}
        <div className="window-titlebar">
          <div className="traffic-lights">
            <span className="light red" />
            <span className="light yellow" />
            <span className="light green" />
          </div>

          <div className="window-tabs" style={{ border: 'none', background: 'transparent', padding: 0 }}>
            {tabs.map((tab) => {
              const isSelected = activePreview === tab.id
              return (
                <button
                  key={tab.id}
                  className={`window-tab ${isSelected ? 'active' : ''}`}
                  onClick={() => setActivePreview(tab.id)}
                >
                  <span style={{ fontSize: '11px', opacity: 0.75 }}>{tab.code}</span>
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          <div className="window-controls-end">
            <span className="pipeline-tag" style={{ background: 'rgba(255,255,255,0.7)', fontSize: '10px' }}>
              INTERACTIVE PREVIEW
            </span>
          </div>
        </div>

        {/* Tab Content Panes */}
        <div className="window-body" style={{ minHeight: '440px', padding: '24px' }}>
          {activePreview === 'editor' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px', alignItems: 'center' }}>
              <div>
                <span className="pipeline-tag" style={{ background: 'var(--bg-surface-sunken)', marginBottom: '12px' }}>
                  :: CODE & WORKSPACE
                </span>
                <h3 style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0 12px' }}>
                  Agents meet you where you work
                </h3>
                <p style={{ fontSize: '13.5px', color: 'var(--ink-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
                  Delegate complex confidential engineering tasks. Input prompts, upload sensitive PDFs, and let the agent autonomously plan, invoke local python scripts, and create deliverables.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={onJumpToConsole} className="btn btn-primary">
                    <Terminal size={14} />
                    <span>Open Live Console</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* Terminal Code Mockup */}
              <div style={{ background: '#171513', borderRadius: 'var(--radius-md)', padding: '18px', border: '1px solid #2b2723', color: '#e5dfd5', fontFamily: 'var(--font-mono)', fontSize: '11.5px', lineHeight: 1.7 }}>
                <div style={{ color: '#8c8273', marginBottom: '10px' }}>// sentinel-pipeline.yaml</div>
                <div><span style={{ color: '#f87171' }}>const</span> agent = <span style={{ color: '#f87171' }}>new</span> SentinelAgent({'{'}</div>
                <div style={{ paddingLeft: '16px' }}><span style={{ color: '#60a5fa' }}>model</span>: <span style={{ color: '#34d399' }}>'llama3.1:8b'</span>,</div>
                <div style={{ paddingLeft: '16px' }}><span style={{ color: '#60a5fa' }}>coder</span>: <span style={{ color: '#34d399' }}>'qwen2.5-coder:7b'</span>,</div>
                <div style={{ paddingLeft: '16px' }}><span style={{ color: '#60a5fa' }}>memory</span>: <span style={{ color: '#34d399' }}>'chromadb:persistent'</span>,</div>
                <div style={{ paddingLeft: '16px' }}><span style={{ color: '#60a5fa' }}>sandbox</span>: <span style={{ color: '#34d399' }}>'docker:alpine'</span>,</div>
                <div style={{ paddingLeft: '16px' }}><span style={{ color: '#60a5fa' }}>airgapped</span>: <span style={{ color: '#f59e0b' }}>true</span>,</div>
                <div>{'}'})</div>
                <div style={{ marginTop: '10px', color: '#34d399' }}>
                  $ sentinel run --task "Audit sensor drift and generate .docx"
                </div>
                <div style={{ color: '#8c8273' }}>
                  → Routing to local Qwen coder...<br />
                  → Generated deliverable: approval_note_2734.docx (36.9 KB)
                </div>
              </div>
            </div>
          )}

          {activePreview === 'builder' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px', alignItems: 'center' }}>
              <div>
                <span className="pipeline-tag" style={{ background: 'var(--accent-purple-subtle)', color: 'var(--accent-purple)', marginBottom: '12px' }}>
                  :: MULTI-AGENT ORCHESTRATION
                </span>
                <h3 style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0 12px' }}>
                  Visual Pipeline Orchestration
                </h3>
                <p style={{ fontSize: '13.5px', color: 'var(--ink-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
                  Coordinate multiple specialized agents working together. LangGraph branches tasks between Vision OCR, Coder mathematics, and drafting without writing glue code.
                </p>
                <button onClick={onJumpToConsole} className="btn btn-outline">
                  <span>Inspect Pipeline Graph</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* Pipeline Nodes List Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="pipeline-card" style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="dot" style={{ background: '#e25845' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>01 / Ingestion Node (PDF / DOCX)</span>
                  </div>
                  <span className="pipeline-tag">SOURCE</span>
                </div>
                <div className="pipeline-card is-running" style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="dot" style={{ background: '#7950f2' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>02 / LangGraph Router Agent</span>
                  </div>
                  <span className="pipeline-tag" style={{ background: '#f3effe', color: '#7950f2' }}>ROUTER</span>
                </div>
                <div className="pipeline-card" style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="dot" style={{ background: '#2563eb' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>03 / ChromaDB Local RAG</span>
                  </div>
                  <span className="pipeline-tag">MEMORY</span>
                </div>
                <div className="pipeline-card" style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="dot" style={{ background: '#2c7a4b' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>04 / Deliverable Output Generator</span>
                  </div>
                  <span className="pipeline-tag" style={{ background: '#eaf5ee', color: '#2c7a4b' }}>OUTPUT</span>
                </div>
              </div>
            </div>
          )}

          {activePreview === 'analytics' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px', alignItems: 'center' }}>
              <div>
                <span className="pipeline-tag" style={{ background: 'var(--accent-green-subtle)', color: 'var(--accent-green)', marginBottom: '12px' }}>
                  :: SYSTEM METRICS
                </span>
                <h3 style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0 12px' }}>
                  Real-time Sovereign Monitoring
                </h3>
                <p style={{ fontSize: '13.5px', color: 'var(--ink-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
                  Observe host compute vitals live. Track RAM consumption, GPU allocation, Docker sandbox health, and zero-egress network lockdown in real time.
                </p>
                <button onClick={onJumpToConsole} className="btn btn-outline">
                  <span>View Live Telemetry HUD</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="halftone-card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>AIR-GAP INTEGRITY</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-green)', margin: '4px 0' }}>100%</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>0.0 KB/s External</div>
                </div>
                <div className="halftone-card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>MODEL RAM ALLOCATION</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink-primary)', margin: '4px 0' }}>4.9 GB</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>Auto 1m Eviction</div>
                </div>
                <div className="halftone-card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>PERSISTENT CHECKPOINTS</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink-primary)', margin: '4px 0' }}>SQLite</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>survives restarts</div>
                </div>
                <div className="halftone-card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>LOCAL EMBEDDINGS</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-blue)', margin: '4px 0' }}>MiniLM</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>offline vector db</div>
                </div>
              </div>
            </div>
          )}

          {activePreview === 'audit' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px', alignItems: 'center' }}>
              <div>
                <span className="pipeline-tag" style={{ background: 'var(--accent-amber-subtle)', color: 'var(--accent-amber)', marginBottom: '12px' }}>
                  :: ARTIFACT VAULT
                </span>
                <h3 style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0 12px' }}>
                  Audit Deliverables at Scale
                </h3>
                <p style={{ fontSize: '13.5px', color: 'var(--ink-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
                  Every execution generates a verifiable artifact trail. Review historical prompts, download previous Word and Excel deliverables, and index new company SOPs.
                </p>
                <button onClick={onJumpToConsole} className="btn btn-outline">
                  <span>Explore Vault & SOPs</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="halftone-card" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
                    <span>TASK-45D3</span>
                    <span>Recent Run</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>
                    Approval note for replacing factory sensors (defects=2, pass=99%)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                    <CheckCircle2 size={13} style={{ color: 'var(--accent-green)' }} />
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>
                      approval_note_afb84e1d.docx generated
                    </span>
                  </div>
                </div>

                <div className="halftone-card" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
                    <span>TASK-EFD4</span>
                    <span>1 hour ago</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>
                    Plant reliability defect metrics spreadsheet calculation
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                    <CheckCircle2 size={13} style={{ color: 'var(--accent-green)' }} />
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>
                      metrics_sheet_912da0a8.xlsx generated
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

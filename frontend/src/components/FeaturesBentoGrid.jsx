import React from 'react'
import { Shield, Database, Cpu, HardDrive, FileCheck, Layers } from 'lucide-react'
import ThreeDTiltText from './ThreeDTiltText'

/**
 * FeaturesBentoGrid — Bento Grid feature showcase matching AgentForge
 */
export default function FeaturesBentoGrid() {
  const features = [
    {
      title: 'Zero Cloud Egress (Air-Gap Lockdown)',
      tag: 'SECURITY',
      desc: 'Guaranteed 0.0 KB/s external network traffic during inference. Zero imports of cloud LLM SDKs (OpenAI, Anthropic, Gemini).',
      icon: Shield,
      accent: '#2c7a4b',
      bg: '#eaf5ee',
      colSpan: 'col-span-2',
    },
    {
      title: 'LangGraph Cyclic State Machine',
      tag: 'ORCHESTRATION',
      desc: 'Stateful workflow engine routing dynamically between drafting, vision OCR, and coding with SQLite checkpoint persistence.',
      icon: Layers,
      accent: '#7950f2',
      bg: '#f3effe',
      colSpan: 'col-span-1',
    },
    {
      title: '16GB RAM Model Swapping',
      tag: 'COMPUTE',
      desc: 'Automated 1-minute keep_alive eviction in Ollama prevents Out-of-Memory crashes while running 7B/8B quantized models.',
      icon: HardDrive,
      accent: '#df533f',
      bg: '#faebe9',
      colSpan: 'col-span-1',
    },
    {
      title: 'Docker Code Sandbox + Degraded Fallback',
      tag: 'SANDBOX',
      desc: 'Runs Python calculations in an isolated Alpine container without network. If Docker is offline, agent explains the issue politely.',
      icon: Cpu,
      accent: '#c05621',
      bg: '#fef5ee',
      colSpan: 'col-span-2',
    },
    {
      title: 'Offline ChromaDB Vector Store',
      tag: 'RAG MEMORY',
      desc: 'Embedded ChromaDB vector database with all-MiniLM-L6-v2 embeddings pre-downloaded to disk for internal SOP lookups.',
      icon: Database,
      accent: '#2563eb',
      bg: '#eff6ff',
      colSpan: 'col-span-2',
    },
    {
      title: 'Native Document Synthesis',
      tag: 'DELIVERABLES',
      desc: 'Autonomous agent synthesizes formatted Word (.docx) approval notes and Excel (.xlsx) metrics sheets directly on disk.',
      icon: FileCheck,
      accent: '#2c7a4b',
      bg: '#eaf5ee',
      colSpan: 'col-span-1',
    },
  ]

  return (
    <section id="features" style={{ margin: '56px 0', width: '100%' }}>
      <div className="section-header-wrap">
        <div className="hero-meta">
          <span className="dot" style={{ background: 'var(--accent-purple)' }} />
          <span>Core Capabilities</span>
        </div>
        <ThreeDTiltText as="h2" className="section-title" maxTilt={7}>
          Built for Confidential Workloads
        </ThreeDTiltText>
        <p className="section-desc">
          Engineered from the ground up for strict air-gapped compliance, local workstation constraints, and high-assurance delivery.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px', marginTop: '24px' }}>
        {features.map((feat, idx) => {
          const Icon = feat.icon
          const isWide = feat.colSpan === 'col-span-2'
          return (
            <div
              key={idx}
              className="halftone-card"
              style={{
                gridColumn: isWide ? 'span 2' : 'span 1',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div className="pipeline-icon-box" style={{ background: feat.bg, color: feat.accent }}>
                    <Icon size={20} />
                  </div>
                  <span className="pipeline-tag" style={{ background: feat.bg, color: feat.accent, borderColor: feat.accent }}>
                    {feat.tag}
                  </span>
                </div>

                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
                  {feat.title}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', lineHeight: 1.55 }}>
                  {feat.desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

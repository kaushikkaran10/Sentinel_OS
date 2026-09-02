import React from 'react'
import { Terminal, Shield, ArrowRight, Code2, Sparkles, Cpu, ExternalLink, Lock, CheckCircle2 } from 'lucide-react'
import SystemArchitectureVisual from './SystemArchitectureVisual'

export default function HeroSection({ onLaunchWorkbench, onScrollToSection, telemetry, activeModel }) {
  return (
    <section className="hero-landing-section" style={{ padding: '40px 24px 60px', maxWidth: '1360px', margin: '0 auto' }}>
      {/* Main Hero Split View */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '40px', alignItems: 'center' }}>
        {/* Left Column: Typography & CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Version Capsule */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--accent-primary-subtle)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              width: 'fit-content',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '11.5px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
              v0.1.0 • MULTI-AGENT SOVEREIGN PIPELINES
            </span>
          </div>

          {/* Heading */}
          <h1
            style={{
              fontSize: '44px',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              color: 'var(--ink-primary)',
            }}
          >
            The Sovereign Workbench for{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, var(--accent-primary), #60a5fa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Autonomous AI Agents
            </span>
          </h1>

          {/* Description */}
          <p
            style={{
              fontSize: '15px',
              color: 'var(--ink-secondary)',
              lineHeight: 1.65,
              maxWidth: '560px',
            }}
          >
            Build, orchestrate, and audit mission-critical AI agents from an air-gapped operating system.
            Zero cloud telemetry, native industrial deliverables (.docx / .xlsx), persistent SQLite state machines, and local ChromaDB RAG.
          </p>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px' }}>
            <button
              onClick={onLaunchWorkbench}
              className="btn btn-primary"
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 700,
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 0 24px rgba(59, 130, 246, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
              }}
            >
              <Terminal size={17} />
              <span>Launch Workbench</span>
              <ArrowRight size={16} />
            </button>

            <a
              href="https://github.com/kaushikkaran10/Sentinel_OS"
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline"
              style={{
                padding: '12px 20px',
                fontSize: '13.5px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Code2 size={16} />
              <span>GitHub</span>
            </a>
          </div>

          {/* Verification Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>
              <CheckCircle2 size={14} />
              <span>100% On-Premise Air-Gap</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
              <span>•</span>
              <Cpu size={14} style={{ color: 'var(--accent-purple)' }} />
              <span>Model: {activeModel || 'llama3.1:8b'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
              <span>•</span>
              <Lock size={14} style={{ color: 'var(--accent-amber)' }} />
              <span>Zero Cloud Egress</span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Sovereign Topology Visual */}
        <div>
          <SystemArchitectureVisual />
        </div>
      </div>

      {/* Live Sovereign Telemetry Marquee Ticker */}
      <div
        style={{
          marginTop: '50px',
          background: 'var(--bg-surface-sunken)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-pill)',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          overflow: 'hidden',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--ink-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-green)' }} />
          <span>LOCAL NODE: 127.0.0.1</span>
        </div>
        <div>STATE CHECKPOINTER: SQLITE (WAL MODE)</div>
        <div>VECTOR STORE: CHROMADB EMBEDDED</div>
        <div>EGRESS PACKETS: 0 BYTES</div>
      </div>
    </section>
  )
}

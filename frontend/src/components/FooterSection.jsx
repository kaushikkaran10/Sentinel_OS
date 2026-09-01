import React from 'react'
import { Code2, ExternalLink, ShieldCheck, Terminal } from 'lucide-react'

export default function FooterSection({ onJumpToTop, onJumpToConsole }) {
  return (
    <footer style={{ marginTop: '72px', paddingTop: '40px', borderTop: '1px dashed var(--border-medium)', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '32px', marginBottom: '36px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div className="brand-icon">⌘</div>
            <div className="brand-text" style={{ fontSize: '19px' }}>
              Sentinel OS
            </div>
          </div>
          <p style={{ fontSize: '12.5px', color: 'var(--ink-secondary)', maxWidth: '360px', lineHeight: 1.6 }}>
            The sovereign on-premise agentic AI workbench. Built with FastAPI, LangGraph, ChromaDB, and local Ollama inference.
          </p>
          <div style={{ marginTop: '14px' }}>
            <span className="airgap-badge">
              <span className="pulse-dot" />
              <span>100% Air-Gapped Verified</span>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '48px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink-primary)', textTransform: 'uppercase', marginBottom: '12px' }}>
              Architecture
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              <a href="#showcase" style={{ color: 'var(--ink-secondary)', textDecoration: 'none' }}>Product Showcase</a>
              <a href="#how-it-works" style={{ color: 'var(--ink-secondary)', textDecoration: 'none' }}>How It Works</a>
              <a href="#features" style={{ color: 'var(--ink-secondary)', textDecoration: 'none' }}>Core Capabilities</a>
              <a href="#workbench" onClick={onJumpToConsole} style={{ color: 'var(--ink-secondary)', textDecoration: 'none' }}>Live Console</a>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink-primary)', textTransform: 'uppercase', marginBottom: '12px' }}>
              Resources
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" style={{ color: 'var(--ink-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>Swagger API</span>
                <ExternalLink size={10} />
              </a>
              <a href="http://localhost:8000/health" target="_blank" rel="noreferrer" style={{ color: 'var(--ink-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>Health Telemetry</span>
                <ExternalLink size={10} />
              </a>
              <a href="https://github.com/R4J-RYN/Sentinel_OS" target="_blank" rel="noreferrer" style={{ color: 'var(--ink-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>GitHub Repository</span>
                <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '20px', paddingBottom: '32px', fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
        <div>
          © 2026 Sentinel OS. Sovereign air-gapped system.
        </div>
        <button
          onClick={onJumpToTop}
          style={{ background: 'none', border: 'none', color: 'var(--ink-secondary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
        >
          ↑ Back to Top
        </button>
      </div>
    </footer>
  )
}

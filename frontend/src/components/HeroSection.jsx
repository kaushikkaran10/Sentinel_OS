import React from 'react'
import { Terminal, Shield, ArrowRight, Code2, Download, Sparkles, Cpu, ExternalLink } from 'lucide-react'
import InteractiveCanvas from './InteractiveCanvas'
import TypewriterHeading from './TypewriterHeading'
import ScrambleText from './ScrambleText'
import NeuralWaveform from './NeuralWaveform'
import ThreeDTiltText from './ThreeDTiltText'

export default function HeroSection({ onLaunchWorkbench, onScrollToSection, telemetry, activeModel }) {
  return (
    <section className="hero-landing-section">
      {/* Top Global Navigation Bar matching AgentForge Header */}
      <header className="hero-navbar">
        <div className="nav-brand">
          <div className="brand-logo-icon">⌘</div>
          <ScrambleText className="brand-title" as="span">
            Sentinel OS
          </ScrambleText>
        </div>

        <nav className="nav-links">
          <a href="#workbench" onClick={(e) => { e.preventDefault(); onScrollToSection('workspace') }} className="nav-link">
            <ScrambleText>Workbench</ScrambleText>
          </a>
          <a href="#showcase" onClick={(e) => { e.preventDefault(); document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' }) }} className="nav-link">
            <ScrambleText>Showcase</ScrambleText>
          </a>
          <a href="#how-it-works" onClick={(e) => { e.preventDefault(); document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }) }} className="nav-link">
            <ScrambleText>How It Works</ScrambleText>
          </a>
          <a href="#features" onClick={(e) => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }) }} className="nav-link">
            <ScrambleText>Capabilities</ScrambleText>
          </a>
          <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" className="nav-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <ScrambleText>API Specs</ScrambleText>
            <ExternalLink size={11} />
          </a>
        </nav>

        <div className="nav-actions">
          <a
            href="https://github.com/R4J-RYN/Sentinel_OS"
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline"
            style={{ fontSize: '11px', padding: '6px 14px' }}
          >
            <Code2 size={14} />
            <span>GitHub</span>
          </a>
          <button
            onClick={onLaunchWorkbench}
            className="btn btn-primary"
            style={{ fontSize: '11px', padding: '6px 16px' }}
          >
            <Terminal size={14} />
            <span>Launch OS</span>
          </button>
        </div>
      </header>

      {/* Main Hero Split View */}
      <div className="hero-grid-content">
        {/* Left Column: Typography & CTAs */}
        <div className="hero-copy-col">
          <div className="hero-badge-capsule">
            <span className="dot" style={{ background: 'var(--accent-coral)' }} />
            <ScrambleText className="badge-text" as="span">
              v0.1.0 — Multi-Agent Sovereign Pipelines
            </ScrambleText>
            <span className="badge-grid-accent">::::::</span>
          </div>

          <ThreeDTiltText as="h1" className="hero-main-title" maxTilt={8}>
            The Sovereign Workbench<br />
            <span className="hero-title-accent">for </span>
            <TypewriterHeading />
          </ThreeDTiltText>

          <p className="hero-description">
            Build, orchestrate, and deploy air-gapped AI agents from a unified local workspace.
            Zero cloud telemetry, native document deliverables (.docx / .xlsx), and persistent SQLite state machines.
          </p>

          <div className="hero-cta-group">
            <button
              onClick={onLaunchWorkbench}
              className="btn btn-primary hero-btn-main"
            >
              <Terminal size={16} />
              <span>Launch Workbench</span>
              <ArrowRight size={15} />
            </button>

            <a
              href="https://github.com/R4J-RYN/Sentinel_OS"
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline hero-btn-sec"
            >
              <Code2 size={16} />
              <span>GitHub</span>
            </a>
          </div>

          {/* Micro Telemetry Pills under CTA */}
          <div className="hero-meta-strip">
            <div className="meta-pill">
              <span className="pulse-dot" />
              <span>Air-Gapped: <strong>100% Offline</strong></span>
            </div>
            <div className="meta-pill" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={12} style={{ color: 'var(--accent-purple)' }} />
              <span>Model Warm: <strong>{activeModel}</strong></span>
              <NeuralWaveform color="var(--accent-purple)" />
            </div>
          </div>
        </div>

        {/* Right Column: WebGL / Canvas Cybernetic Hologram Mascot */}
        <div className="hero-visual-col">
          <InteractiveCanvas />
        </div>
      </div>

      {/* Retro-Futuristic Dither Ribbon Pattern matching AgentForge screenshot */}
      <div className="dither-ribbon-divider">
        <div className="dither-pattern-strip" />
      </div>

      {/* Live Sovereign Telemetry Marquee Ticker */}
      <div className="marquee-ticker">
        <div className="ticker-track">
          <span className="ticker-item">● LOCAL INFERENCE: OLLAMA [127.0.0.1:11434]</span>
          <span className="ticker-item">● AIR-GAPPED: 0.0 KB/s CLOUD EGRESS</span>
          <span className="ticker-item">● CHECKPOINTER: SQLITE [data/langgraph.sqlite]</span>
          <span className="ticker-item">● VECTOR STORE: CHROMADB EMBEDDED</span>
          <span className="ticker-item">● DELIVERABLE SYNTHESIS: .DOCX & .XLSX</span>
          <span className="ticker-item">● MEMORY BUDGET: 1-MIN MODEL EVICTION</span>
          {/* Duplicate for infinite loop */}
          <span className="ticker-item">● LOCAL INFERENCE: OLLAMA [127.0.0.1:11434]</span>
          <span className="ticker-item">● AIR-GAPPED: 0.0 KB/s CLOUD EGRESS</span>
          <span className="ticker-item">● CHECKPOINTER: SQLITE [data/langgraph.sqlite]</span>
          <span className="ticker-item">● VECTOR STORE: CHROMADB EMBEDDED</span>
          <span className="ticker-item">● DELIVERABLE SYNTHESIS: .DOCX & .XLSX</span>
          <span className="ticker-item">● MEMORY BUDGET: 1-MIN MODEL EVICTION</span>
        </div>
      </div>
    </section>
  )
}

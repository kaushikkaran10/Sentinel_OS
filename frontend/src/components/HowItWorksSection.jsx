import React, { useState } from 'react'
import { Upload, GitBranch, Cpu, FileText, CheckCircle2, ArrowRight } from 'lucide-react'
import ThreeDTiltText from './ThreeDTiltText'

/**
 * HowItWorksSection — Interactive Step Timeline matching AgentForge
 */
export default function HowItWorksSection({ onJumpToConsole }) {
  const [activeStep, setActiveStep] = useState(0)

  const steps = [
    {
      number: '01',
      title: 'Upload & Ingest Confidential Documents',
      short: 'Ingest',
      desc: 'Drag and drop proprietary engineering reports, scanned PDFs, or internal SOPs up to 10 MB. Local validation enforces strict MIME allowlists without cloud uploads.',
      icon: Upload,
      previewTitle: 'Ingestion & OCR Extraction Node',
      previewDetails: [
        'MIME validation: .pdf, .docx, .txt, .png, .jpg',
        'Local pdfplumber extraction & Pillow OCR',
        'Direct stream to ChromaDB vector store',
      ],
      previewCode: `POST /api/v1/workspace/task\nContent-Type: multipart/form-data\n\nfile: confidential_sensor_specs.pdf\nprompt: "Audit defect tolerances"`,
    },
    {
      number: '02',
      title: 'Autonomous Local Classification & Routing',
      short: 'Reason',
      desc: 'The LangGraph Router inspects task intent and file types. It selects between Qwen3, Qwen-Coder, and Gemma-Vision with 1-minute RAM eviction.',
      icon: GitBranch,
      previewTitle: 'LangGraph Router Classification',
      previewDetails: [
        'Classifies: Draft | Coder | Vision | Math',
        'Local Ollama daemon on http://localhost:11434',
        'Prompted JSON output with Pydantic schemas',
      ],
      previewCode: `{\n  "task_type": "draft",\n  "model": "llama3.1:8b",\n  "keep_alive": "1m",\n  "routed_node": "drafter"\n}`,
    },
    {
      number: '03',
      title: 'Isolated Execution & Vector Retrieval',
      short: 'Orchestrate',
      desc: 'When code execution or SOP lookups are needed, Sentinel OS invokes local tools: ChromaDB vector search or an isolated Alpine Docker sandbox.',
      icon: Cpu,
      previewTitle: 'Secure Tool Execution Node',
      previewDetails: [
        'ChromaDB offline all-MiniLM-L6-v2 embeddings',
        'Docker sandbox with network_mode="none"',
        'Graceful Degraded Mode fallback if Docker is offline',
      ],
      previewCode: `execute_sandbox_code(\n  code="defects = 2; total = 200; rate = (1 - defects/total)*100"\n)\n→ Output: 99.0% pass rate`,
    },
    {
      number: '04',
      title: 'Deliverable Synthesis & Stream',
      short: 'Deliver',
      desc: 'The agent synthesizes a native downloadable Word (.docx) approval note or Excel (.xlsx) sheet, streaming live reasoning tokens via Server-Sent Events.',
      icon: FileText,
      previewTitle: 'Final Deliverable Generation',
      previewDetails: [
        'Native python-docx and openpyxl synthesis',
        'Real-time Server-Sent Events (SSE) stream',
        'Persistent checkpoint saved in data/langgraph.sqlite',
      ],
      previewCode: `event: deliverable\ndata: {"file_id": "approval_note_27343e4f.docx"}\n\nevent: complete\ndata: {"status": "success"}`,
    },
  ]

  const current = steps[activeStep]

  return (
    <section id="how-it-works" style={{ margin: '48px 0', width: '100%' }}>
      <div className="section-header-wrap">
        <div className="hero-meta">
          <span className="dot" style={{ background: 'var(--accent-coral)' }} />
          <span>Timeline Architecture</span>
        </div>
        <ThreeDTiltText as="h2" className="section-title" maxTilt={7}>
          How It Works: End-to-End Flow
        </ThreeDTiltText>
        <p className="section-desc">
          Four interconnected stages transform raw prompts into structured, verifiable deliverables without ever connecting to the internet.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '32px', marginTop: '24px' }}>
        {/* Left: Step Selection Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {steps.map((step, idx) => {
            const isSelected = activeStep === idx
            return (
              <div
                key={step.number}
                className={`pipeline-card ${isSelected ? 'is-running' : ''}`}
                onClick={() => setActiveStep(idx)}
                style={{
                  cursor: 'pointer',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: isSelected ? 'var(--accent-purple)' : 'var(--ink-muted)',
                  }}
                >
                  {step.number}
                </span>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink-primary)', marginBottom: '4px' }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
                    {step.desc}
                  </div>
                </div>

                <span className="pipeline-tag" style={{ background: isSelected ? 'var(--accent-purple-subtle)' : 'var(--bg-surface-sunken)', color: isSelected ? 'var(--accent-purple)' : 'var(--ink-muted)' }}>
                  {step.short}
                </span>
              </div>
            )
          })}
        </div>

        {/* Right: Dynamic Interactive Preview Pane */}
        <div className="halftone-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="dot" style={{ background: 'var(--accent-green)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600 }}>
                  STAGE {current.number} // {current.short.toUpperCase()}
                </span>
              </div>
              <span className="pipeline-tag" style={{ background: 'var(--accent-green-subtle)', color: 'var(--accent-green)' }}>
                VERIFIED LOCAL
              </span>
            </div>

            <h4 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
              {current.previewTitle}
            </h4>

            {/* Checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
              {current.previewDetails.map((detail, dIdx) => (
                <div key={dIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--ink-secondary)' }}>
                  <CheckCircle2 size={13} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                  <span>{detail}</span>
                </div>
              ))}
            </div>

            {/* Code Box */}
            <div style={{ background: '#1c1917', color: '#e5dfd5', padding: '14px', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {current.previewCode}
            </div>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px dashed var(--border-subtle)' }}>
            <button onClick={onJumpToConsole} className="btn btn-primary" style={{ width: '100%' }}>
              <span>Try This In Live Workspace</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

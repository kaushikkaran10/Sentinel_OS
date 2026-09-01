import React, { useState } from 'react'
import { Globe, Bot, Database, FileCode, CheckCircle2, ChevronRight, Terminal, Sliders } from 'lucide-react'

export default function AgentPipelineTab({ activeModel = 'llama3.1:8b' }) {
  const [selectedNode, setSelectedNode] = useState('router')

  const nodes = [
    {
      id: 'ingestion',
      name: 'Document & OCR Ingestion',
      subtitle: 'Parsing PDFs, DOCX, and scanned image inputs',
      tag: 'SOURCE',
      color: '#e25845',
      bgColor: '#faebe9',
      icon: Globe,
      details: {
        engine: 'pdfplumber + Pillow OCR',
        airgapped: '100% Local',
        timeout: '30s per document',
        status: 'Active / Listening',
      },
    },
    {
      id: 'router',
      name: 'LangGraph Orchestration & Router',
      subtitle: 'Classifying task intent and branching execution',
      tag: 'AGENT',
      color: '#d6459b',
      bgColor: '#fdf0f7',
      icon: Bot,
      details: {
        model: activeModel,
        checkpointer: 'SQLite (data/langgraph.sqlite)',
        roles: ['Vision', 'Coder', 'Drafter'],
        stateMachine: 'LangGraph StateGraph TypedDict',
      },
    },
    {
      id: 'vector_db',
      name: 'Persistent Vector Store (ChromaDB)',
      subtitle: 'all-MiniLM-L6-v2 local offline embeddings',
      tag: 'MEMORY',
      color: '#2563eb',
      bgColor: '#eff6ff',
      icon: Database,
      details: {
        collection: 'sentinel_sops',
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2 (offline)',
        chunkSize: '500 tokens (50 overlap)',
        topK: '4 results',
      },
    },
    {
      id: 'coder',
      name: 'Code Sandbox & Reasoning Agent',
      subtitle: 'Mathematical verification & isolated code execution',
      tag: 'TOOL',
      color: '#7950f2',
      bgColor: '#f5f3ff',
      icon: FileCode,
      details: {
        coderModel: 'qwen2.5-coder:7b',
        sandbox: 'Docker python:3.12-alpine (network_mode=none)',
        degradedFallback: 'Polite agent explanation if Docker is offline',
        timeout: '30s max execution',
      },
    },
    {
      id: 'deliverable',
      name: 'Output Router & File Maker',
      subtitle: 'Synthesizing native .docx approval notes and .xlsx metrics',
      tag: 'OUTPUT',
      color: '#2c7a4b',
      bgColor: '#eaf5ee',
      icon: CheckCircle2,
      details: {
        libraries: 'python-docx, openpyxl',
        outputDir: 'app/data/generated/',
        sseSentinels: 'thought, tool_call, token, deliverable, complete',
        streamFormat: 'Server-Sent Events (SSE)',
      },
    },
  ]

  const activeNodeData = nodes.find((n) => n.id === selectedNode) || nodes[0]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
      {/* LEFT: Interactive Pipeline Diagram matching AgentForge inspiration */}
      <div>
        <div style={{ marginBottom: '18px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink-primary)' }}>
            Visual Pipeline Orchestration
          </h3>
          <p style={{ fontSize: '12.5px', color: 'var(--ink-secondary)', marginTop: '4px' }}>
            Coordinate sovereign multi-agent execution. Router branches between Drafting, Coding, and Vision without data leakage.
          </p>
        </div>

        <div className="pipeline-list">
          {nodes.map((node, idx) => {
            const Icon = node.icon
            const isSelected = selectedNode === node.id

            return (
              <div
                key={node.id}
                className={`pipeline-card ${isSelected ? 'is-running' : ''}`}
                onClick={() => setSelectedNode(node.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="pipeline-card-left">
                  <div
                    className="pipeline-icon-box"
                    style={{ background: node.bgColor, color: node.color }}
                  >
                    <Icon size={20} />
                  </div>
                  <div>
                    <div className="pipeline-info-title">{node.name}</div>
                    <div className="pipeline-info-desc">{node.subtitle}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="pipeline-tag" style={{ color: node.color, background: node.bgColor, borderColor: node.color }}>
                    ● {node.tag}
                  </span>
                  <ChevronRight size={16} style={{ color: 'var(--ink-muted)' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* RIGHT: Node Inspector & Parameters */}
      <div>
        <div className="halftone-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={16} style={{ color: 'var(--ink-primary)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                Node Inspector
              </span>
            </div>
            <span className="pipeline-tag" style={{ background: activeNodeData.bgColor, color: activeNodeData.color }}>
              {activeNodeData.tag}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <div className="pipeline-icon-box" style={{ background: activeNodeData.bgColor, color: activeNodeData.color }}>
              <activeNodeData.icon size={22} />
            </div>
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 700 }}>{activeNodeData.name}</h4>
              <p style={{ fontSize: '11.5px', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                {activeNodeData.subtitle}
              </p>
            </div>
          </div>

          {/* Properties Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-surface-sunken)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
            {Object.entries(activeNodeData.details).map(([key, val]) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  borderBottom: '1px dashed var(--border-subtle)',
                  paddingBottom: '6px',
                }}
              >
                <span style={{ color: 'var(--ink-muted)', textTransform: 'capitalize' }}>
                  {key.replace(/([A-Z])/g, ' $1')}:
                </span>
                <span style={{ color: 'var(--ink-primary)', fontWeight: 600 }}>
                  {Array.isArray(val) ? val.join(', ') : val}
                </span>
              </div>
            ))}
          </div>

          {/* Terminal Spec Snippet */}
          <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', marginBottom: '6px' }}>
              Execution Specification:
            </div>
            <div style={{ background: '#1c1917', color: '#e7dfd0', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              <code>
                {`> node: ${activeNodeData.id}\n`}
                {`> airgap_compliance: verified\n`}
                {`> telemetry_logging: active\n`}
                {`✓ ready for orchestrator invocation`}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

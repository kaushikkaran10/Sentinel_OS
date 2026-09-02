import React, { useState } from 'react'
import { Shield, Cpu, Database, FileCode2, Terminal, HardDrive, CheckCircle2, Lock, ArrowRight } from 'lucide-react'

export default function SystemArchitectureVisual() {
  const [selectedNode, setSelectedNode] = useState('agent')

  const nodes = [
    {
      id: 'client',
      title: 'Local Client',
      sub: '127.0.0.1:3000',
      icon: Terminal,
      color: 'var(--accent-blue)',
      details: 'React 18 frontend with real-time Server-Sent Events (SSE) streaming and offline document previewers.',
      status: 'AIR-GAPPED',
    },
    {
      id: 'gateway',
      title: 'FastAPI Gateway',
      sub: 'Uvicorn Port 8000',
      icon: Cpu,
      color: 'var(--accent-primary)',
      details: 'High-throughput async ASGI backend driving task orchestration, streaming pipelines, and secure downloads.',
      status: 'ONLINE',
    },
    {
      id: 'agent',
      title: 'LangGraph Engine',
      sub: 'State Graph v0.1.0',
      icon: Shield,
      color: 'var(--accent-purple)',
      details: 'Cyclic state machine with persistent SQLite checkpointer driving multi-agent planning, tool calling, and synthesis.',
      status: 'ACTIVE',
    },
    {
      id: 'ollama',
      title: 'Ollama Engine',
      sub: 'Llama 3.1:8b',
      icon: HardDrive,
      color: 'var(--accent-amber)',
      details: '100% on-device quantized model execution with 1-minute warm RAM retention and zero cloud telemetry.',
      status: 'LOCAL',
    },
    {
      id: 'chroma',
      title: 'ChromaDB RAG',
      sub: 'all-MiniLM-L6-v2',
      icon: Database,
      color: 'var(--accent-green)',
      details: 'Embedded persistent vector database with cosine semantic search for engineering SOPs and OSHA codes.',
      status: 'INDEXED',
    },
    {
      id: 'deliverables',
      title: 'Artifact Engine',
      sub: '.docx & .xlsx',
      icon: FileCode2,
      color: 'var(--accent-coral)',
      details: 'Direct disk generation of executive memos (.docx) and multi-tab reconciliation workbooks (.xlsx).',
      status: 'NATIVE',
    },
  ]

  const activeNodeData = nodes.find((n) => n.id === selectedNode) || nodes[2]

  return (
    <div
      style={{
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-lg)',
        padding: '22px',
        boxShadow: 'var(--shadow-window)',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}
    >
      {/* Visual Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 8px var(--accent-green)' }} />
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-secondary)' }}>
            Sovereign Pipeline Topology
          </span>
        </div>
        <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', background: 'var(--accent-green-subtle)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
          ZERO-EGRESS AIR-GAP
        </span>
      </div>

      {/* Grid of Interactive Topology Nodes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        {nodes.map((node) => {
          const Icon = node.icon
          const isSelected = selectedNode === node.id

          return (
            <div
              key={node.id}
              onClick={() => setSelectedNode(node.id)}
              style={{
                background: isSelected ? 'var(--bg-surface-muted)' : 'var(--bg-surface)',
                border: `1.5px solid ${isSelected ? node.color : 'var(--border-medium)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '12px 10px',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                boxShadow: isSelected ? `0 0 16px ${node.color}25` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Icon size={16} style={{ color: node.color }} />
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
                  {node.status}
                </span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-primary)', marginTop: '4px' }}>
                {node.title}
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
                {node.sub}
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected Node Deep-Dive Card */}
      <div
        style={{
          background: 'var(--bg-surface-sunken)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: activeNodeData.color }}>
              {activeNodeData.title}
            </span>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
              ({activeNodeData.sub})
            </span>
          </div>
          <span className="status-pill success" style={{ fontSize: '9.5px' }}>
            LOCAL AIR-GAP VERIFIED
          </span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
          {activeNodeData.details}
        </p>
      </div>
    </div>
  )
}

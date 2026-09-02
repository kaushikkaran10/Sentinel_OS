import React, { useState, useRef, useEffect } from 'react'
import {
  Upload,
  FileText,
  FileSpreadsheet,
  X,
  Play,
  Download,
  Terminal,
  Clock,
  Wrench,
  Brain,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Zap,
  Cpu,
  Layers,
  Activity,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { submitTask, streamTaskEvents, getDownloadUrl } from '../services/api'
import MarkdownRenderer from './MarkdownRenderer'
import DeliverablePreviewer from './DeliverablePreviewer'

export default function WorkspaceTab({ onTaskFinished }) {
  const [prompt, setPrompt] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [taskId, setTaskId] = useState(null)
  const [streamEvents, setStreamEvents] = useState([])
  const [streamedText, setStreamedText] = useState('')
  const [deliverable, setDeliverable] = useState(null)
  const [taskStatus, setTaskStatus] = useState('idle') // idle | queued | streaming | completed | failed
  const [errorMessage, setErrorMessage] = useState('')
  const [activeScenarioId, setActiveScenarioId] = useState(null)
  const [isExpanded, setIsExpanded] = useState(false)

  const fileInputRef = useRef(null)
  const streamEndRef = useRef(null)

  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/png',
    'image/jpeg',
  ]

  // Four authoritative industrial benchmark scenarios
  const scenarios = [
    {
      id: 'p1042-audit',
      badge: 'CBM SENSOR AUDIT',
      badgeColor: 'var(--accent-coral)',
      title: '⚙️ Pump P-1042 Anomaly Audit',
      desc: 'Condition-Based Monitoring telemetry audit: 3 High-Severity events, vibration excursion, root causes & corrective actions.',
      text: 'Analyze the Pump Condition Monitoring Report for Centrifugal Pump P-1042. Summarize all High-Severity abnormality events, root causes, and corrective actions taken.',
      fileHint: 'pump_condition_monitoring_report.txt',
    },
    {
      id: 'p1042-memo',
      badge: 'OFFICIAL MEMO (.DOCX)',
      badgeColor: 'var(--accent-blue)',
      title: '📄 Executive Approval Note',
      desc: 'Generate official AEN-2026-0091 anomaly approval note with baseline excursion analysis, Structured Metrics table & sign-off station.',
      text: 'Draft an executive engineering Approval Note (.docx) for Centrifugal Pump P-1042 following the standard anomaly template. Include a detailed technical summary of the excursion against baseline, root causes, and formal recommendation (hold for human sign-off), along with a structured Metrics table (asset_id, location, baseline_vibration, observed_peak, high_severity_count, root_cause, severity, status=pending_human_review).',
      fileHint: 'pump_condition_monitoring_report.txt',
    },
    {
      id: 'cdu3-yields',
      badge: 'MASS BALANCE (.XLSX)',
      badgeColor: 'var(--accent-green)',
      title: '📊 Crude Distillation Yields',
      desc: 'Process CDU-3 18-batch distillation data: cut yields, baseline tolerance, volume calculations & generate 2-tab reconciliation spreadsheet.',
      text: 'Analyze crude distillation cut yields from oil.csv. Calculate average yield across distillation cuts and generate an executive yield reconciliation spreadsheet (.xlsx).',
      fileHint: 'oil.csv (CDU-3 18 Batches)',
    },
    {
      id: 'osha-psm',
      badge: 'RAG COMPLIANCE',
      badgeColor: 'var(--accent-purple)',
      title: '📋 OSHA PSM 5 Key Areas',
      desc: '29 CFR 1910.119 National Emphasis Program reference brief: top 5 cited deficiencies & key RAGAGEP consensus codes (API 510/570/653).',
      text: 'What are the five key areas OSHA cited most often during the Petroleum Refinery PSM National Emphasis Program? Summarize key RAGAGEP codes and requirements.',
      fileHint: 'osha_petroleum_refinery_psm.txt',
    },
  ]

  const [copied, setCopied] = useState(false)
  const handleCopyAnswer = () => {
    if (!streamedText) return
    navigator.clipboard.writeText(streamedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSelectScenario = (sc) => {
    setActiveScenarioId(sc.id)
    setPrompt(sc.text)
  }

  const handleFileChange = (file) => {
    setFileError('')
    if (!file) return

    // 10 MB limit check
    if (file.size > 10 * 1024 * 1024) {
      setFileError('File exceeds 10 MB limit')
      return
    }

    const name = file.name.toLowerCase()
    const validExt =
      name.endsWith('.pdf') ||
      name.endsWith('.docx') ||
      name.endsWith('.txt') ||
      name.endsWith('.png') ||
      name.endsWith('.jpg') ||
      name.endsWith('.csv')
    if (!validExt && !allowedTypes.includes(file.type)) {
      setFileError('Unsupported file type. Use PDF, DOCX, TXT, CSV, PNG, or JPG.')
      return
    }

    setSelectedFile(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0])
    }
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!prompt.trim()) return

    setIsSubmitting(true)
    setTaskStatus('queued')
    setStreamEvents([])
    setStreamedText('')
    setDeliverable(null)
    setErrorMessage('')

    try {
      // 1. Submit task to FastAPI backend
      const res = await submitTask(prompt, selectedFile)
      const currentTaskId = res.task_id
      setTaskId(currentTaskId)
      setTaskStatus('streaming')

      // 2. Open Server-Sent Events stream
      await streamTaskEvents(currentTaskId, {
        onEvent: (frame) => {
          setStreamEvents((prev) => [...prev, frame])

          if (frame.event === 'token' && frame.data?.text) {
            setStreamedText((prev) => prev + frame.data.text)
          }

          if (frame.event === 'deliverable' && frame.data?.file_id) {
            setDeliverable(frame.data)
            try {
              confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } })
            } catch {}
          }
        },
        onError: (err) => {
          console.error('SSE Stream error:', err)
          setTaskStatus('failed')
          setErrorMessage(err.message || 'Stream disconnected')
        },
        onComplete: (data) => {
          setTaskStatus('completed')
          setIsSubmitting(false)
          if (onTaskFinished) onTaskFinished()
        },
      })
    } catch (err) {
      console.error('Submission error:', err)
      setTaskStatus('failed')
      setErrorMessage(err.message || 'Task submission failed')
      setIsSubmitting(false)
    }
  }

  // Filter out raw JSON tool-call fragments
  const cleanAnswer = streamedText
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('{"action"')) return false
      if (trimmed.startsWith('[tool call]')) return false
      if (trimmed.startsWith('{"tool"')) return false
      return true
    })
    .join('\n')
    .trim()

  // Compute active pipeline stage for visual tracker
  const hasRouter = streamEvents.some((e) => e.data?.node === 'router')
  const hasTool = streamEvents.some((e) => e.event === 'tool_call')
  const hasDrafter = streamEvents.some((e) => e.event === 'token')
  const hasDeliverable = Boolean(deliverable)

  return (
    <div>
      {/* Modern Operational Status Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface-sunken)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 16px',
          marginBottom: '20px',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background:
                taskStatus === 'streaming'
                  ? 'var(--accent-primary)'
                  : taskStatus === 'completed'
                  ? 'var(--accent-green)'
                  : taskStatus === 'failed'
                  ? 'var(--accent-coral)'
                  : 'var(--accent-green)',
              boxShadow: '0 0 8px currentColor',
            }}
          />
          <span style={{ fontWeight: 700, color: 'var(--ink-primary)' }}>
            {taskStatus === 'streaming'
              ? 'PIPELINE EXECUTING (MULTI-AGENT GRAPH)'
              : taskStatus === 'completed'
              ? 'WORKFLOW COMPLETED (ALL GATES PASSED)'
              : taskStatus === 'failed'
              ? 'TASK INTERRUPTED'
              : 'AGENT PIPELINE STANDBY'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--ink-muted)' }}>
          <span>CHECKPOINTER: SQLITE (WAL)</span>
          <span>•</span>
          <span>VECTOR DB: CHROMADB (MiniLM)</span>
          <span>•</span>
          <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>EGRESS: 0 BYTES</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '28px' }}>
        {/* LEFT COLUMN: Input & Evaluation Scenarios */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Prompt Section */}
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  <span style={{ fontWeight: 700 }}>Task Prompt</span>
                </label>
                <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>
                  🔒 SOVEREIGN OFFLINE INFERENCE
                </span>
              </div>

              <textarea
                className="textarea-field"
                placeholder="Select a scenario below or enter an engineering prompt..."
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value)
                  setActiveScenarioId(null)
                }}
                disabled={isSubmitting}
                style={{ height: '95px', resize: 'vertical' }}
              />

              {/* Four Authoritative Scenario Cards */}
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={13} style={{ color: 'var(--accent-amber)' }} />
                  <span>Industrial Evaluation Scenarios</span>
                </div>

                <div className="scenario-grid">
                  {scenarios.map((sc) => {
                    const isSel = activeScenarioId === sc.id
                    return (
                      <div
                        key={sc.id}
                        className={`scenario-card ${isSel ? 'active' : ''}`}
                        onClick={() => handleSelectScenario(sc)}
                      >
                        <div className="scenario-card-header">
                          <span className="scenario-badge" style={{ color: sc.badgeColor }}>
                            {sc.badge}
                          </span>
                          {isSel && <Check size={13} style={{ color: 'var(--accent-coral)' }} />}
                        </div>
                        <div className="scenario-title">{sc.title}</div>
                        <div className="scenario-desc">{sc.desc}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* File Upload Dropzone */}
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  <span>Source Document / Dataset</span>
                </label>
                <span style={{ fontSize: '10px', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                  Auto-linked for presets • Max 10 MB
                </span>
              </div>

              {!selectedFile ? (
                <div
                  className="dropzone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ padding: '16px 14px' }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileChange(e.target.files[0])}
                    accept=".pdf,.docx,.txt,.csv,.png,.jpg"
                    disabled={isSubmitting}
                  />
                  <Upload size={20} style={{ color: 'var(--ink-muted)', margin: '0 auto 6px' }} />
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink-primary)' }}>
                    Drag & Drop file or Click to Upload
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--ink-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                    PDF, DOCX, TXT, CSV, PNG, JPG (Air-Gapped Local Storage)
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-surface-sunken)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileText size={20} style={{ color: 'var(--accent-blue)' }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-primary)' }}>
                        {selectedFile.name}
                      </div>
                      <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
                        {(selectedFile.size / 1024).toFixed(1)} KB • Attached
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    disabled={isSubmitting}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {fileError && (
                <div style={{ fontSize: '11.5px', color: 'var(--accent-coral)', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px' }}>
                  <AlertCircle size={13} />
                  <span>{fileError}</span>
                </div>
              )}
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !prompt.trim()}
              style={{ padding: '12px 20px', fontSize: '13px', gap: '8px' }}
            >
              {isSubmitting ? (
                <>
                  <Clock size={16} className="animate-spin" />
                  <span>Running Agent Graph Workflow...</span>
                </>
              ) : (
                <>
                  <Play size={16} fill="currentColor" />
                  <span>Execute Agent Pipeline</span>
                </>
              )}
            </button>
          </form>

          {/* Air-gap Verification Status Box */}
          <div className="halftone-card" style={{ padding: '12px 16px', background: 'var(--bg-surface-sunken)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Sparkles size={14} style={{ color: 'var(--accent-green)' }} />
              <span style={{ fontSize: '11.5px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>
                AIR-GAP PROTOCOL ACTIVE
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
              Zero cloud telemetry egress. Workflows execute locally via LangGraph SQLite checkpointer with persistent ChromaDB RAG.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Execution Stream & Intelligence Brief */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Dynamic Workflow Stage Tracker */}
          <div className="pipeline-stage-tracker">
            <div className={`pipeline-stage-step ${hasRouter ? (hasTool || hasDrafter ? 'completed' : 'active') : ''}`}>
              <div className="pipeline-stage-dot" />
              <span>1. ROUTER</span>
            </div>
            <span style={{ opacity: 0.3 }}>→</span>

            <div className={`pipeline-stage-step ${hasTool ? 'completed' : hasRouter ? 'active' : ''}`}>
              <div className="pipeline-stage-dot" />
              <span>2. ANALYSIS</span>
            </div>
            <span style={{ opacity: 0.3 }}>→</span>

            <div className={`pipeline-stage-step ${hasTool ? (hasDrafter ? 'completed' : 'active') : ''}`}>
              <div className="pipeline-stage-dot" />
              <span>3. TOOL EXEC</span>
            </div>
            <span style={{ opacity: 0.3 }}>→</span>

            <div className={`pipeline-stage-step ${hasDrafter ? (hasDeliverable ? 'completed' : 'active') : ''}`}>
              <div className="pipeline-stage-dot" />
              <span>4. SYNTHESIS</span>
            </div>
            <span style={{ opacity: 0.3 }}>→</span>

            <div className={`pipeline-stage-step ${hasDeliverable ? 'completed' : ''}`}>
              <div className="pipeline-stage-dot" />
              <span>5. DELIVERABLE</span>
            </div>
          </div>

          {/* Live Execution Console */}
          <div className="stream-box" style={{ minHeight: '140px', maxHeight: '180px' }}>
            {streamEvents.length === 0 && !streamedText && (
              <div style={{ color: 'var(--ink-muted)', fontSize: '12px', textAlign: 'center', padding: '30px 10px' }}>
                <Terminal size={24} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <div>SSE pipeline events stream here live.</div>
                <div style={{ fontSize: '10.5px', marginTop: '2px', opacity: 0.7 }}>
                  Select an evaluation scenario to view thoughts and tool execution.
                </div>
              </div>
            )}

            {streamEvents.map((ev, i) => {
              if (ev.event === 'thought') {
                return (
                  <div key={i} className="stream-event-item stream-event-thought">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600 }}>
                      <Brain size={12} />
                      <span>[AGENT THOUGHT] {ev.data?.node ? `(${ev.data.node})` : ''}</span>
                    </div>
                    <div style={{ marginTop: '2px', whiteSpace: 'pre-wrap' }}>
                      {ev.data?.message || JSON.stringify(ev.data)}
                    </div>
                  </div>
                )
              }

              if (ev.event === 'tool_call') {
                return (
                  <div key={i} className="stream-event-item stream-event-tool">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600 }}>
                      <Wrench size={12} />
                      <span>TOOL INVOCATION: {ev.data?.tool}</span>
                      <span style={{ color: '#4ade80', marginLeft: 'auto' }}>DONE</span>
                    </div>
                    {ev.data?.preview && (
                      <div style={{ fontSize: '10.5px', opacity: 0.85, marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                        {ev.data.preview}
                      </div>
                    )}
                  </div>
                )
              }

              return null
            })}

            {errorMessage && (
              <div style={{ color: '#f87171', fontSize: '12px', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}>
                Error: {errorMessage}
              </div>
            )}

            <div ref={streamEndRef} />
          </div>

          {/* DEDICATED ON-SCREEN INTELLIGENCE BRIEF (RICH MARKDOWN RENDERER) */}
          {(cleanAnswer || taskStatus === 'streaming') && (
            <div
              className="halftone-card"
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1.5px solid var(--border-strong)',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                animation: 'fadeIn 0.25s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-medium)', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-coral)' }}>
                  <Brain size={15} />
                  <span>INTELLIGENCE BRIEF // SOVEREIGN SYNTHESIS</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={handleCopyAnswer}
                    className="btn btn-outline"
                    style={{ fontSize: '11px', padding: '4px 10px', gap: '5px' }}
                  >
                    {copied ? (
                      <>
                        <Check size={12} style={{ color: 'var(--accent-green)' }} />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy Brief</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="btn btn-outline"
                    title={isExpanded ? 'Collapse' : 'Expand View'}
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                  >
                    {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  </button>
                </div>
              </div>

              <div
                style={{
                  maxHeight: isExpanded ? '600px' : '300px',
                  overflowY: 'auto',
                  paddingRight: '6px',
                  transition: 'max-height 0.25s ease',
                }}
              >
                {cleanAnswer ? (
                  <MarkdownRenderer content={cleanAnswer} />
                ) : (
                  <div style={{ fontSize: '12.5px', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                    Agent synthesizing findings from local knowledge base...
                  </div>
                )}

                {taskStatus === 'streaming' && (
                  <span
                    className="retro-block-cursor"
                    style={{ width: '7px', height: '1em', verticalAlign: '-0.1em', marginLeft: '4px' }}
                  />
                )}
              </div>
            </div>
          )}

          {/* DELIVERABLE WORKBENCH PREVIEWER (SPREADSHEET & MEMO) */}
          {deliverable && (
            <DeliverablePreviewer deliverable={deliverable} />
          )}
        </div>
      </div>
    </div>
  )
}

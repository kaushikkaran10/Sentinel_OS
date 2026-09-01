import React, { useState, useRef } from 'react'
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
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { submitTask, streamTaskEvents, getDownloadUrl } from '../services/api'
import SentinelBot from './SentinelBot'

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

  const fileInputRef = useRef(null)
  const streamEndRef = useRef(null)

  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/png',
    'image/jpeg',
  ]

  const presets = [
    {
      label: '⚙️ Pump P-1042 Audit',
      text: 'Analyze the Pump Condition Monitoring Report for Centrifugal Pump P-1042. Summarize all High-Severity abnormality events, root causes, and corrective actions taken.',
    },
    {
      label: '📄 Pump Maintenance Memo (.docx)',
      text: 'Draft an executive engineering Approval Note (.docx) for Centrifugal Pump P-1042 following the standard anomaly template. Include a detailed technical summary of the excursion against baseline, root causes, and formal recommendation (hold for human sign-off), along with a structured Metrics table (asset_id, location, baseline_vibration, observed_peak, high_severity_count, root_cause, severity, status=pending_human_review).',
    },
    {
      label: '📊 Crude Distillation Yields (.xlsx)',
      text: 'Analyze crude distillation cut yields from oil.csv. Calculate average yield across distillation cuts and generate an executive yield reconciliation spreadsheet (.xlsx).',
    },
    {
      label: '📋 OSHA PSM 5 Key Areas',
      text: 'What are the five key areas OSHA cited most often during the Petroleum Refinery PSM National Emphasis Program? Summarize key RAGAGEP codes and requirements.',
    },
  ]

  const [copied, setCopied] = useState(false)
  const handleCopyAnswer = () => {
    if (!streamedText) return
    navigator.clipboard.writeText(streamedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleFileChange = (file) => {
    setFileError('')
    if (!file) return

    // 10 MB limit check
    if (file.size > 10 * 1024 * 1024) {
      setFileError('File exceeds 10 MB limit')
      return
    }

    // Check extension / MIME
    const name = file.name.toLowerCase()
    const validExt = name.endsWith('.pdf') || name.endsWith('.docx') || name.endsWith('.txt') || name.endsWith('.png') || name.endsWith('.jpg')
    if (!validExt && !allowedTypes.includes(file.type)) {
      setFileError('Unsupported file type. Use PDF, DOCX, TXT, PNG, or JPG.')
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
    e.preventDefault()
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
              confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } })
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

  return (
    <div>
      {/* Sovereign Companion Mascot */}
      <SentinelBot status={taskStatus} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '28px' }}>
      {/* LEFT COLUMN: Input & Configuration */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Prompt Section */}
          <div className="form-group">
            <label className="form-label">
              <span>Task Prompt</span>
              <span style={{ fontSize: '10px', color: 'var(--ink-muted)' }}>Ollama Qwen / Llama 3.1</span>
            </label>
            <textarea
              className="textarea-field"
              placeholder="Describe the confidential task, engineering analysis, or SOP approval needed..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isSubmitting}
            />
            {/* Quick Prompt Presets */}
            <div className="preset-chips">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="chip-btn"
                  onClick={() => setPrompt(p.text)}
                  disabled={isSubmitting}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* File Upload Dropzone */}
          <div className="form-group">
            <label className="form-label">
              <span>Upload Document (Optional)</span>
              <span style={{ fontSize: '10px', color: 'var(--ink-muted)' }}>Max 10 MB • Air-Gapped</span>
            </label>

            {!selectedFile ? (
              <div
                className="dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileChange(e.target.files[0])}
                  accept=".pdf,.docx,.txt,.png,.jpg"
                  disabled={isSubmitting}
                />
                <Upload size={22} style={{ color: 'var(--ink-muted)', margin: '0 auto 8px' }} />
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-primary)' }}>
                  Drag & Drop file or Click to Browse
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ink-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                  Supports PDF, DOCX, TXT, PNG, JPG
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
                  <FileText size={20} style={{ color: 'var(--ink-primary)' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-primary)' }}>
                      {selectedFile.name}
                    </div>
                    <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
                      {(selectedFile.size / 1024).toFixed(1)} KB
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
              <div style={{ fontSize: '11.5px', color: 'var(--accent-coral)', display: 'flex', alignItems: 'center', gap: '5px' }}>
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
            style={{ padding: '12px 20px', fontSize: '13px' }}
          >
            {isSubmitting ? (
              <>
                <Clock size={16} className="animate-spin" />
                <span>Agent Pipeline Running...</span>
              </>
            ) : (
              <>
                <Play size={16} fill="currentColor" />
                <span>Execute Agent Pipeline</span>
              </>
            )}
          </button>
        </form>

        {/* Security / Air-gap Notice Box */}
        <div className="halftone-card" style={{ padding: '14px', background: 'rgba(238, 232, 221, 0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Sparkles size={14} style={{ color: 'var(--accent-purple)' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
              Air-Gapped Sovereign Execution
            </span>
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--ink-secondary)', lineHeight: 1.45 }}>
            Zero data egress. Models run locally through Ollama, documents are indexed in persistent ChromaDB, and deliverables are generated directly on disk.
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN: Live Execution Stream & Deliverable */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={16} style={{ color: 'var(--ink-primary)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
              Live Execution Feed
            </span>
          </div>

          {/* Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {taskStatus === 'idle' && (
              <span className="pipeline-tag" style={{ background: 'var(--bg-surface-sunken)' }}>
                ● Standby
              </span>
            )}
            {taskStatus === 'queued' && (
              <span className="pipeline-tag" style={{ background: 'var(--accent-amber-subtle)', color: 'var(--accent-amber)' }}>
                ● Queued
              </span>
            )}
            {taskStatus === 'streaming' && (
              <span className="pipeline-tag" style={{ background: 'var(--accent-purple-subtle)', color: 'var(--accent-purple)' }}>
                <span className="pulse-dot" style={{ background: 'var(--accent-purple)', marginRight: '4px' }} />
                Streaming Live
              </span>
            )}
            {taskStatus === 'completed' && (
              <span className="pipeline-tag" style={{ background: 'var(--accent-green-subtle)', color: 'var(--accent-green)' }}>
                ✓ Completed
              </span>
            )}
            {taskStatus === 'failed' && (
              <span className="pipeline-tag" style={{ background: 'var(--accent-coral-subtle)', color: 'var(--accent-coral)' }}>
                ✕ Error
              </span>
            )}
          </div>
        </div>

        {/* Streaming Console Terminal */}
        <div className="stream-box">
          {streamEvents.length === 0 && !streamedText && (
            <div style={{ color: '#7a7266', fontSize: '12px', textAlign: 'center', padding: '40px 10px' }}>
              <Terminal size={28} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <div>Pipeline output will stream here via Server-Sent Events.</div>
              <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>
                Submit a prompt to watch thoughts, tool invocations, and tokens live.
              </div>
            </div>
          )}

          {/* Event Items */}
          {streamEvents.map((ev, i) => {
            if (ev.event === 'thought') {
              return (
                <div key={i} className="stream-event-item stream-event-thought">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600 }}>
                    <Brain size={12} />
                    <span>[AGENT THOUGHT] {ev.data?.task_type ? `→ ${ev.data.task_type}` : ''}</span>
                  </div>
                  <div style={{ marginTop: '3px', whiteSpace: 'pre-wrap' }}>
                    {ev.data?.msg || JSON.stringify(ev.data)}
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
                    {ev.data?.ok ? (
                      <span style={{ color: '#4ade80', marginLeft: 'auto' }}>PASS</span>
                    ) : (
                      <span style={{ color: '#f87171', marginLeft: 'auto' }}>FAIL</span>
                    )}
                  </div>
                  {ev.data?.preview && (
                    <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '4px' }}>
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

        {/* DEDICATED ON-SCREEN INTELLIGENCE ANSWER BOX */}
        {streamedText && (() => {
          // Filter out raw JSON tool-call fragments — only show the final prose answer
          const cleanAnswer = streamedText
            .split('\n')
            .filter(line => {
              const trimmed = line.trim()
              // Skip lines that are raw JSON tool calls or action objects
              if (trimmed.startsWith('{"action"')) return false
              if (trimmed.startsWith('[tool call]')) return false
              if (trimmed.startsWith('{"tool"')) return false
              return true
            })
            .join('\n')
            .trim()

          if (!cleanAnswer && taskStatus !== 'streaming') return null

          return (
          <div
            className="halftone-card"
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1.5px solid var(--border-strong)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              animation: 'fadeIn 0.25s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-medium)', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-coral)' }}>
                <Brain size={14} />
                <span>AGENT INTELLIGENCE BRIEF // RESPONSE</span>
              </div>

              <button
                type="button"
                onClick={handleCopyAnswer}
                className="btn btn-outline"
                style={{ fontSize: '10.5px', padding: '3px 8px', gap: '4px' }}
              >
                <CheckCircle2 size={12} />
                <span>{copied ? 'Copied!' : 'Copy Answer'}</span>
              </button>
            </div>

            <div
              style={{
                fontSize: '13px',
                lineHeight: '1.65',
                color: 'var(--ink-primary)',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'pre-wrap',
                maxHeight: '260px',
                overflowY: 'auto',
              }}
            >
              {cleanAnswer || 'Processing...'}
              {taskStatus === 'streaming' && (
                <span
                  className="retro-block-cursor"
                  style={{ width: '7px', height: '1em', verticalAlign: '-0.1em', marginLeft: '3px' }}
                />
              )}
            </div>
          </div>
          )
        })()}

        {/* DELIVERABLE SHOWCASE CARD */}
        {deliverable && (
          <div
            className="halftone-card"
            style={{
              background: 'var(--accent-green-subtle)',
              borderColor: 'var(--accent-green)',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              animation: 'fadeIn 0.25s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {deliverable.file_id?.endsWith('.xlsx') ? (
                <FileSpreadsheet size={28} style={{ color: 'var(--accent-green)' }} />
              ) : (
                <FileText size={28} style={{ color: 'var(--accent-green)' }} />
              )}
              <div>
                <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', fontWeight: 600 }}>
                  EXPORTED DELIVERABLE DOCUMENT
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink-primary)' }}>
                  {deliverable.file_id}
                </div>
              </div>
            </div>

            <a
              href={getDownloadUrl(deliverable.file_id)}
              download
              className="btn btn-primary"
              style={{ background: 'var(--accent-green)', borderColor: 'var(--accent-green)', padding: '7px 14px', fontSize: '12px' }}
            >
              <Download size={14} />
              <span>Download {deliverable.file_id?.endsWith('.xlsx') ? '.xlsx' : '.docx'}</span>
            </a>
          </div>
        )}
      </div>
    </div>
  </div>
  )
}

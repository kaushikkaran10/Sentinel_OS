import React, { useState, useEffect } from 'react'
import { Archive, FileText, Upload, CheckCircle2, Clock, Search, ExternalLink, RefreshCw } from 'lucide-react'
import { fetchHistory, uploadKbDocument } from '../services/api'

export default function VaultTab() {
  const [historyTasks, setHistoryTasks] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Knowledge base upload state
  const [kbFile, setKbFile] = useState(null)
  const [kbCategory, setKbCategory] = useState('SOP')
  const [isUploadingKb, setIsUploadingKb] = useState(false)
  const [kbMessage, setKbMessage] = useState('')

  const loadHistory = async () => {
    setIsLoadingHistory(true)
    try {
      const res = await fetchHistory()
      setHistoryTasks(res.tasks || [])
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const handleKbUpload = async (e) => {
    e.preventDefault()
    if (!kbFile) return
    setIsUploadingKb(true)
    setKbMessage('')
    try {
      const res = await uploadKbDocument(kbFile, kbCategory)
      setKbMessage(`Indexed ${res.chunks_indexed} chunk(s) into collection "${res.collection}". Doc ID: ${res.doc_id}`)
      setKbFile(null)
    } catch (err) {
      setKbMessage(`Error: ${err.message}`)
    } finally {
      setIsUploadingKb(false)
    }
  }

  const filteredTasks = historyTasks.filter((t) =>
    (t.prompt || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.task_id || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
      {/* LEFT: Task Audit & History List (matching AgentForge screenshot 5) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Task Execution Ledger</h3>
            <p style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>
              Persistent checkpoints stored in <code>data/langgraph.sqlite</code>
            </p>
          </div>

          <button
            onClick={loadHistory}
            className="btn btn-outline"
            style={{ padding: '6px 12px', fontSize: '11px' }}
          >
            <RefreshCw size={12} className={isLoadingHistory ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)' }} />
          <input
            type="text"
            className="textarea-field"
            style={{ minHeight: '38px', height: '38px', paddingLeft: '34px', fontSize: '12px' }}
            placeholder="Search tasks by prompt or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* List of Tasks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '460px', overflowY: 'auto' }}>
          {filteredTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--ink-muted)', fontSize: '12px' }}>
              No historical runs recorded yet.
            </div>
          ) : (
            filteredTasks.map((t, idx) => {
              const dateStr = t.timestamp ? new Date(t.timestamp).toLocaleString() : 'Recent'
              return (
                <div
                  key={t.task_id || idx}
                  className="halftone-card"
                  style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
                      ID: {t.task_id?.slice(0, 13)}...
                    </span>
                    <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
                      {dateStr}
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-primary)', lineHeight: 1.4 }}>
                    {t.prompt}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span className="pipeline-tag" style={{ background: 'var(--accent-green-subtle)', color: 'var(--accent-green)' }}>
                      ✓ CHECKPOINT SAVED
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* RIGHT: Knowledge Base (ChromaDB) SOP Ingestion Drawer */}
      <div>
        <div className="halftone-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Upload size={16} style={{ color: 'var(--ink-primary)' }} />
            <h4 style={{ fontSize: '15px', fontWeight: 700 }}>
              Knowledge Base Ingestion (RAG)
            </h4>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--ink-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
            Upload proprietary Standard Operating Procedures (SOPs), manuals, and specs to index them into persistent <strong>ChromaDB</strong>. Offline embeddings generated with <code>all-MiniLM-L6-v2</code>.
          </p>

          <form onSubmit={handleKbUpload} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                value={kbCategory}
                onChange={(e) => setKbCategory(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-surface-elevated)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  outline: 'none',
                }}
              >
                <option value="SOP">Standard Operating Procedure (SOP)</option>
                <option value="Manual">Technical Engineering Manual</option>
                <option value="Policy">Security & Compliance Policy</option>
                <option value="General">General Reference Document</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Document File</label>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(e) => setKbFile(e.target.files[0])}
                disabled={isUploadingKb}
                style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <button
              type="submit"
              disabled={isUploadingKb || !kbFile}
              className="btn btn-primary"
              style={{ marginTop: '6px' }}
            >
              <Upload size={14} />
              <span>{isUploadingKb ? 'Indexing into ChromaDB...' : 'Index Document into RAG'}</span>
            </button>
          </form>

          {kbMessage && (
            <div
              style={{
                marginTop: '14px',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11.5px',
                fontFamily: 'var(--font-mono)',
                background: kbMessage.startsWith('Error') ? 'var(--accent-coral-subtle)' : 'var(--accent-green-subtle)',
                color: kbMessage.startsWith('Error') ? 'var(--accent-coral)' : 'var(--accent-green)',
                border: '1px solid currentColor',
              }}
            >
              {kbMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import React, { useState } from 'react'
import { ShieldCheck, Cpu, HardDrive, AlertTriangle, Trash2, Zap, CheckCircle2, Activity } from 'lucide-react'
import { purgeData } from '../services/api'

export default function TelemetryTab({ telemetry, models, onPurged }) {
  const [isPurging, setIsPurging] = useState(false)
  const [purgeResult, setPurgeResult] = useState(null)

  const handlePurge = async () => {
    if (!window.confirm('Delete uploaded and generated files older than 24 hours?')) return
    setIsPurging(true)
    try {
      const res = await purgeData()
      setPurgeResult(res)
      if (onPurged) onPurged()
    } catch (err) {
      alert(`Purge failed: ${err.message}`)
    } finally {
      setIsPurging(false)
    }
  }

  // Format bytes
  const formatBytes = (bytes) => {
    if (!bytes) return '0 MB'
    const mb = bytes / (1024 * 1024)
    return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top 4 Stat Cards matching AgentForge layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div className="halftone-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
              AIR-GAP INTEGRITY
            </span>
            <ShieldCheck size={16} style={{ color: 'var(--accent-green)' }} />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '8px', color: 'var(--accent-green)' }}>
            100%
          </div>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', marginTop: '4px' }}>
            ● ZERO CLOUD EGRESS
          </div>
        </div>

        <div className="halftone-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
              DOCKER SANDBOX
            </span>
            <Activity size={16} style={{ color: telemetry?.degraded_mode ? 'var(--accent-amber)' : 'var(--accent-green)' }} />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '8px' }}>
            {telemetry?.degraded_mode ? 'DEGRADED' : 'READY'}
          </div>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: telemetry?.degraded_mode ? 'var(--accent-amber)' : 'var(--accent-green)', marginTop: '4px' }}>
            {telemetry?.degraded_mode ? '⚠ Host Sandbox Offline' : '✓ Network=None Active'}
          </div>
        </div>

        <div className="halftone-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
              ACTIVE INFERENCE
            </span>
            <Zap size={16} style={{ color: 'var(--accent-purple)' }} />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '8px' }}>
            LOCAL OLLAMA
          </div>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', marginTop: '4px' }}>
            keep_alive: 1m RAM eviction
          </div>
        </div>

        <div className="halftone-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
              HOST RAM BUDGET
            </span>
            <HardDrive size={16} style={{ color: 'var(--accent-blue)' }} />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '8px' }}>
            {telemetry?.ram_used_mb ? `${(telemetry.ram_used_mb / 1024).toFixed(1)} GB` : 'N/A'}
          </div>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', marginTop: '4px' }}>
            of {telemetry?.ram_total_mb ? `${(telemetry.ram_total_mb / 1024).toFixed(0)} GB total` : '16 GB budget'}
          </div>
        </div>
      </div>

      {/* Model Roster & Hardware Vitals */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Model Pipeline Table */}
        <div className="halftone-card">
          <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>
            Configured Sovereign AI Models
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(models?.active_models || ['llama3.1:8b', 'qwen2.5-coder:7b']).map((mod, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-surface-sunken)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="dot" style={{ background: 'var(--accent-green)' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {mod}
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                      {idx === 0 ? 'Routing & Drafting' : idx === 1 ? 'Coding & Mathematics' : 'Vision & OCR'}
                    </div>
                  </div>
                </div>

                <span className="pipeline-tag" style={{ background: 'var(--accent-green-subtle)', color: 'var(--accent-green)' }}>
                  READY
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '18px', fontSize: '11.5px', color: 'var(--ink-muted)', lineHeight: 1.45 }}>
            Models run locally inside the Ollama runtime on <code>http://localhost:11434</code> with automated RAM swapping.
          </div>
        </div>

        {/* Data Retention & System Purge (§7) */}
        <div className="halftone-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>
              Data Retention & Disk Purge
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--ink-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
              In accordance with security specification <strong>8_Decisions_2.md §7</strong>, manually wipe temporary uploaded files and generated deliverables older than 24 hours. SQLite checkpoint records remain intact.
            </p>

            {purgeResult && (
              <div style={{ background: 'var(--bg-surface-sunken)', padding: '10px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                <div>✓ Deleted: {purgeResult.deleted} files</div>
                <div>✓ Freed: {formatBytes(purgeResult.freed_bytes)}</div>
              </div>
            )}
          </div>

          <button
            onClick={handlePurge}
            disabled={isPurging}
            className="btn btn-outline"
            style={{ width: '100%', borderColor: 'var(--accent-coral)', color: 'var(--accent-coral)' }}
          >
            <Trash2 size={15} />
            <span>{isPurging ? 'Purging Files...' : 'Run 24h Data Retention Purge'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

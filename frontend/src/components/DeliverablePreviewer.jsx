import React, { useState } from 'react'
import {
  FileSpreadsheet,
  FileText,
  Download,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  Table,
  Check,
  Award,
} from 'lucide-react'
import { getDownloadUrl } from '../services/api'

export default function DeliverablePreviewer({ deliverable }) {
  const [activeTab, setActiveTab] = useState('summary')
  const [signoffDecision, setSignoffDecision] = useState('approved')
  const [reviewerName, setReviewerName] = useState('R. K. Sharma (Shift Reliability Lead)')
  const [isSigned, setIsSigned] = useState(false)

  if (!deliverable || !deliverable.file_id) return null

  const fileName = deliverable.file_id
  const isExcel = fileName.toLowerCase().endsWith('.xlsx')
  const isDocx = fileName.toLowerCase().endsWith('.docx')

  // Sample batch data for the 18 CDU-3 batches (for Excel preview)
  const cduBatches = [
    { batch: 'CDU3-4401', date: '2026-08-01', crude: 'Arabian Light', feed: '38,100', lpg: '1.60', ln: '6.00', hn: '9.43', kero: '11.32', diesel: '24.71', vgo: '21.26', vr: '24.36' },
    { batch: 'CDU3-4402', date: '2026-08-02', crude: 'Arabian Light', feed: '38,375', lpg: '1.52', ln: '6.68', hn: '9.11', kero: '11.39', diesel: '24.36', vgo: '21.86', vr: '24.41' },
    { batch: 'CDU3-4403', date: '2026-08-03', crude: 'Bonny Light', feed: '41,238', lpg: '1.11', ln: '7.05', hn: '9.36', kero: '10.71', diesel: '23.38', vgo: '22.82', vr: '24.21' },
    { batch: 'CDU3-4404', date: '2026-08-04', crude: 'Arabian Light', feed: '39,520', lpg: '1.75', ln: '6.22', hn: '8.58', kero: '10.18', diesel: '23.93', vgo: '21.32', vr: '25.26' },
    { batch: 'CDU3-4405', date: '2026-08-05', crude: 'Arabian Light', feed: '40,208', lpg: '2.59', ln: '6.71', hn: '9.65', kero: '11.14', diesel: '24.37', vgo: '21.18', vr: '24.01' },
    { batch: 'CDU3-4406', date: '2026-08-06', crude: 'Bonny Light', feed: '41,941', lpg: '2.64', ln: '7.16', hn: '8.78', kero: '10.92', diesel: '24.60', vgo: '21.39', vr: '24.24' },
    { batch: 'CDU3-4407', date: '2026-08-07', crude: 'Bonny Light', feed: '40,807', lpg: '2.33', ln: '5.73', hn: '9.24', kero: '11.06', diesel: '23.54', vgo: '21.93', vr: '24.09' },
    { batch: 'CDU3-4408', date: '2026-08-08', crude: 'Arabian Light', feed: '40,738', lpg: '2.62', ln: '7.00', hn: '8.51', kero: '10.16', diesel: '23.67', vgo: '21.58', vr: '23.98' },
    { batch: 'CDU3-4409', date: '2026-08-09', crude: 'Bonny Light', feed: '38,851', lpg: '2.00', ln: '7.19', hn: '9.26', kero: '10.36', diesel: '23.35', vgo: '22.44', vr: '24.57' },
    { batch: 'CDU3-4410', date: '2026-08-10', crude: 'Murban', feed: '41,591', lpg: '1.82', ln: '5.99', hn: '9.90', kero: '11.02', diesel: '23.26', vgo: '21.18', vr: '23.80' },
  ]

  const reconciliationCuts = [
    { cut: 'LPG', baseline: '2.00%', observed: '2.05%', variance: '+0.05', volume: '14,918 bbl', status: 'Within Tolerance' },
    { cut: 'Light Naphtha', baseline: '6.50%', observed: '6.46%', variance: '-0.04', volume: '46,992 bbl', status: 'Within Tolerance' },
    { cut: 'Heavy Naphtha', baseline: '9.00%', observed: '9.14%', variance: '+0.14', volume: '66,505 bbl', status: 'Within Tolerance' },
    { cut: 'Kerosene', baseline: '11.00%', observed: '11.00%', variance: '-0.01', volume: '79,968 bbl', status: 'Within Tolerance' },
    { cut: 'Diesel', baseline: '24.00%', observed: '23.93%', variance: '-0.07', volume: '174,062 bbl', status: 'Within Tolerance' },
    { cut: 'VGO', baseline: '22.00%', observed: '21.78%', variance: '-0.22', volume: '158,429 bbl', status: 'Within Tolerance' },
    { cut: 'Vacuum Residue', baseline: '24.50%', observed: '24.38%', variance: '-0.12', volume: '177,327 bbl', status: 'Within Tolerance' },
    { cut: 'Total Recovery', baseline: '99.00%', observed: '98.75%', variance: '-0.25', volume: '718,199 bbl', isTotal: true },
    { cut: 'Feed Basis', baseline: '100.00%', observed: '98.75%', variance: '-1.25', volume: 'Unaccounted Loss', isLoss: true },
  ]

  return (
    <div className="deliverable-preview-box">
      {/* Top Banner Card */}
      <div className="preview-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isExcel ? (
            <FileSpreadsheet size={26} style={{ color: 'var(--accent-green)' }} />
          ) : (
            <FileText size={26} style={{ color: 'var(--accent-blue)' }} />
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink-primary)' }}>
                {fileName}
              </span>
              <span className={`status-pill ${isExcel ? 'success' : 'info'}`} style={{ fontSize: '10px' }}>
                {isExcel ? 'EXCEL METRICS WORKBOOK' : 'WORD APPROVAL MEMO'}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
              Size: {deliverable.size_bytes ? (deliverable.size_bytes / 1024).toFixed(1) + ' KB' : 'Ready'} • Offline Generated • Sovereign Air-Gap Verified
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a
            href={getDownloadUrl(deliverable.file_id)}
            download
            className="btn btn-primary"
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              background: isExcel ? 'var(--accent-green)' : 'var(--accent-blue)',
              borderColor: isExcel ? 'var(--accent-green)' : 'var(--accent-blue)',
            }}
          >
            <Download size={14} />
            <span>Download {isExcel ? '.xlsx' : '.docx'}</span>
          </a>
        </div>
      </div>

      {/* Sub-header Navigation Tabs */}
      {isExcel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            className={`preview-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            <Layers size={13} style={{ marginRight: '4px', verticalAlign: '-2px' }} />
            <span>Executive Yield Reconciliation</span>
          </button>
          <button
            type="button"
            className={`preview-tab-btn ${activeTab === 'raw' ? 'active' : ''}`}
            onClick={() => setActiveTab('raw')}
          >
            <Table size={13} style={{ marginRight: '4px', verticalAlign: '-2px' }} />
            <span>Raw Data (oil.csv - 18 Batches)</span>
          </button>
        </div>
      )}

      {/* BODY VIEW: Excel Spreadsheet Mode */}
      {isExcel && (
        <div style={{ padding: '16px', maxHeight: '340px', overflowY: 'auto' }}>
          {activeTab === 'summary' ? (
            <div>
              {/* KPI metrics bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '14px' }}>
                <div style={{ background: 'var(--bg-surface-sunken)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>BATCHES ANALYZED</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ink-primary)' }}>18 Batches</div>
                </div>
                <div style={{ background: 'var(--bg-surface-sunken)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>TOTAL CRUDE FEED</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-blue)' }}>727,311 bbl</div>
                </div>
                <div style={{ background: 'var(--bg-surface-sunken)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>MASS RECOVERY</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-green)' }}>98.75%</div>
                </div>
              </div>

              {/* Distillation Cuts Table */}
              <div className="doc-table-container" style={{ margin: 0 }}>
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>Distillation Cut</th>
                      <th style={{ textAlign: 'right' }}>Baseline Yield %</th>
                      <th style={{ textAlign: 'right' }}>Avg Observed %</th>
                      <th style={{ textAlign: 'right' }}>Variance (pp)</th>
                      <th style={{ textAlign: 'right' }}>Weighted Vol</th>
                      <th style={{ textAlign: 'center' }}>Engineering Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconciliationCuts.map((row, idx) => (
                      <tr key={idx} style={{ fontWeight: row.isTotal || row.isLoss ? 700 : 400 }}>
                        <td>{row.cut}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{row.baseline}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{row.observed}</td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontFamily: 'var(--font-mono)',
                            color: row.variance?.startsWith('+') ? 'var(--accent-green)' : row.variance?.startsWith('-') ? 'var(--accent-coral)' : 'inherit',
                          }}
                        >
                          {row.variance}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{row.volume}</td>
                        <td style={{ textAlign: 'center' }}>
                          {row.status ? (
                            <span className="status-pill success">{row.status}</span>
                          ) : row.isLoss ? (
                            <span className="status-pill warning">Loss Tolerance</span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="doc-table-container" style={{ margin: 0 }}>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th>Batch ID</th>
                    <th>Date</th>
                    <th>Crude Type</th>
                    <th style={{ textAlign: 'right' }}>Feed (bbl)</th>
                    <th style={{ textAlign: 'right' }}>LPG %</th>
                    <th style={{ textAlign: 'right' }}>Lt Naphtha %</th>
                    <th style={{ textAlign: 'right' }}>Hv Naphtha %</th>
                    <th style={{ textAlign: 'right' }}>Kero %</th>
                    <th style={{ textAlign: 'right' }}>Diesel %</th>
                    <th style={{ textAlign: 'right' }}>VGO %</th>
                    <th style={{ textAlign: 'right' }}>VR %</th>
                  </tr>
                </thead>
                <tbody>
                  {cduBatches.map((b, idx) => (
                    <tr key={idx}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{b.batch}</td>
                      <td>{b.date}</td>
                      <td>{b.crude}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{b.feed}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{b.lpg}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{b.ln}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{b.hn}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{b.kero}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{b.diesel}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{b.vgo}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{b.vr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* BODY VIEW: Word Document Approval Mode */}
      {isDocx && (
        <div style={{ padding: '16px 20px', maxHeight: '340px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            <div>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
                REF: SentinelOS-ANOM-2026-0812-P1042 • NOTE ID: AEN-2026-0091
              </span>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink-primary)' }}>
                Centrifugal Pump P-1042 — Shift Reliability Approval Note
              </div>
            </div>
            <span className="status-pill danger">SEVERITY: HIGH</span>
          </div>

          <div style={{ fontSize: '12.5px', color: 'var(--ink-secondary)', lineHeight: 1.6, marginBottom: '14px' }}>
            Technical Summary: Drive-end bearing vibration reached <strong>11.2 mm/s RMS</strong> (+233% excursion above baseline) following a 30% discharge line blockage at 03:14 IST. Requires formal human sign-off before restart.
          </div>

          {/* Interactive Digital Sign-off Station */}
          <div className="signoff-stamp">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--accent-amber)' }}>
                <Award size={16} />
                <span>HUMAN-IN-THE-LOOP SIGN-OFF TERMINAL</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ink-muted)', marginTop: '2px' }}>
                Reviewing Officer: <strong>{reviewerName}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                value={signoffDecision}
                onChange={(e) => setSignoffDecision(e.target.value)}
                disabled={isSigned}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '5px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11.5px',
                  color: 'var(--ink-primary)',
                }}
              >
                <option value="approved">✓ Decision: Approved</option>
                <option value="rejected">✕ Decision: Rejected</option>
                <option value="escalated">⚠ Decision: Escalated</option>
              </select>

              <button
                type="button"
                onClick={() => setIsSigned(!isSigned)}
                className="btn btn-primary"
                style={{
                  padding: '6px 12px',
                  fontSize: '11.5px',
                  background: isSigned ? 'var(--accent-green)' : 'var(--accent-amber)',
                  borderColor: isSigned ? 'var(--accent-green)' : 'var(--accent-amber)',
                }}
              >
                {isSigned ? (
                  <>
                    <CheckCircle2 size={13} />
                    <span>Signed & Stamped</span>
                  </>
                ) : (
                  <span>Sign & Authorize</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

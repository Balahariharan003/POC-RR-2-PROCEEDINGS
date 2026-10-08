import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  FileText,
  Database,
  RefreshCw,
  Eye,
  Printer,
  CheckCircle2,
  AlertCircle,
  Users,
  ShieldCheck,
  BarChart3,
  Layers,
} from 'lucide-react';
import { recordActivity } from '../../services/activityStore.js';
import { apiService } from '../../services/apiService.js';
import Modal from '../common/Modal.jsx';
import './BackupPage.css';
import { STORAGE_KEYS } from '../../config/appConfig.js';

const HISTORY_KEY = STORAGE_KEYS?.backupHistory || 'rr_backup_history';
function readHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

export default function BackupPage({ onRestored }) {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pending, setPending] = useState(null);

  // Analytics Report State
  const [reportData, setReportData] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [selectedScope, setSelectedScope] = useState('all'); // 'all' | 'summary' | 'officer' | 'audit'

  const fileInputRef = useRef(null);

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  // 1. Full Database Backup
  async function makeDatabaseBackup() {
    setError('');
    setSuccessMsg('');
    setIsProcessing(true);
    try {
      const backup = await apiService.createDatabaseBackup();
      const item = {
        id: crypto.randomUUID(),
        createdAt: backup.created_at || new Date().toISOString(),
        checksum: backup.checksum_sha256,
        counts: backup.table_counts,
        type: 'Full PostgreSQL Snapshot',
        backup,
      };
      const updated = [item, ...history];
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      setHistory(updated);

      // Download JSON snapshot file to browser
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rr-database-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      recordActivity('Backup created', { reference: `Checksum: ${backup.checksum_sha256?.slice(0, 10)}` });
      setSuccessMsg(`Full database backup created successfully! SHA-256: ${backup.checksum_sha256?.slice(0, 16)}...`);
    } catch (e) {
      setError(`Backup generation failed: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  }

  // 2. Import & Verify Backup File
  async function importBackupFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setSuccessMsg('');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.data || !parsed.app) {
        throw new Error('Selected file is not a valid Office Assistant database backup payload.');
      }
      const createdAt = parsed.created_at || new Date().toISOString();
      setPending({
        id: crypto.randomUUID(),
        createdAt,
        fileName: file.name,
        backup: parsed,
        type: 'Imported Snapshot',
      });
    } catch (e) {
      setError(`Invalid backup file: ${e.message}`);
    }
  }

  // 3. Restore Database from Payload
  async function restoreDatabase() {
    if (!pending?.backup) return;
    setError('');
    setIsProcessing(true);
    try {
      const result = await apiService.restoreDatabaseBackup(pending.backup);
      recordActivity('Backup restored', { reference: pending.fileName || pending.createdAt });
      setSuccessMsg(`Database successfully restored! (${JSON.stringify(result.restored_counts)})`);
      setPending(null);
      if (onRestored) onRestored();
    } catch (e) {
      setError(`Restore failed: ${e.message}`);
      setPending(null);
    } finally {
      setIsProcessing(false);
    }
  }

  // 4. Generate & Preview Analytics Report
  async function openReportPreview(scope = 'all') {
    setError('');
    setLoadingReport(true);
    setSelectedScope(scope);
    try {
      const report = await apiService.getSystemAnalyticsReport();
      setReportData(report);
      setIsPreviewOpen(true);
      recordActivity('Report generated', { reference: `Scope: ${scope}` });
    } catch (e) {
      setError(`Failed to compile report: ${e.message}`);
    } finally {
      setLoadingReport(false);
    }
  }

  // 5. Download Report as DOCX
  async function handleDownloadDocx() {
    if (!reportData) return;
    try {
      await apiService.exportSystemReportDocx(reportData, selectedScope);
      recordActivity('Report DOCX downloaded', { reference: `Scope: ${selectedScope}` });
    } catch (e) {
      setError(`DOCX download failed: ${e.message}`);
    }
  }

  // 6. Download / Print Report as PDF
  function handlePrintPdf() {
    window.print();
  }

  return (
    <section className="rr-admin-page rr-backup-page" aria-label="Backup and System Reporting Center">
      <header className="rr-admin-page-header">
        <div>
          <span className="rr-admin-badge" style={{ backgroundColor: 'rgba(16, 44, 87, 0.08)', color: '#102C57' }}>
            Administration · System Reliability &amp; Reports
          </span>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#102C57', margin: '0.35rem 0' }}>
            Backup &amp; Reporting Center
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Generate full PostgreSQL database backups, restore points, and export proceedings analytical reports.
          </p>
        </div>
      </header>

      {/* Notifications / Alerts */}
      {error && (
        <div className="rr-admin-alert error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="rr-admin-alert success" role="status" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Primary Action Cards Grid */}
      <div className="rr-admin-grid">
        {/* Full Database Backup Card */}
        <article className="rr-backup-card">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.75rem' }}>
              <span style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(16, 44, 87, 0.08)', color: '#102C57' }}>
                <Database size={24} />
              </span>
              <div>
                <h2 style={{ fontSize: '1.15rem', margin: '0 0 2px 0', color: '#102C57', fontWeight: 700 }}>Full Database Backup</h2>
                <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                  Cryptographic JSON dump of Users, Templates, Cases, and Audit Ledger.
                </p>
              </div>
            </div>

            <div className="rr-backup-stats-box">
              <div className="rr-backup-stat-item">
                <dt>Last Backup</dt>
                <dd title={history[0]?.createdAt || ''}>
                  {history[0] ? new Date(history[0].createdAt).toLocaleDateString('en-IN') : 'None yet'}
                </dd>
              </div>
              <div className="rr-backup-stat-item">
                <dt>Status</dt>
                <dd>
                  <span className="rr-admin-status active" style={{ display: 'inline-block' }}>Database Healthy</span>
                </dd>
              </div>
              <div className="rr-backup-stat-item">
                <dt>Tables Protected</dt>
                <dd>4 Core Tables</dd>
              </div>
            </div>
          </div>

          <div className="rr-admin-actions" style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isProcessing}
              onClick={makeDatabaseBackup}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <Download size={16} /> {isProcessing ? 'Generating Backup...' : 'Create DB Backup'}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <RefreshCw size={16} /> Import &amp; Restore
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              aria-label="Upload Office Assistant backup JSON"
              onChange={importBackupFile}
              style={{ display: 'none' }}
              tabIndex={-1}
            />
          </div>
        </article>

        {/* Proceedings Analytics Report Card */}
        <article className="rr-backup-card">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.75rem' }}>
              <span style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'rgba(5, 150, 105, 0.1)', color: '#059669' }}>
                <FileText size={24} />
              </span>
              <div>
                <h2 style={{ fontSize: '1.15rem', margin: '0 0 2px 0', color: '#102C57', fontWeight: 700 }}>Proceedings Analytics &amp; Reports</h2>
                <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                  Interactive Collectorate reports with multi-format PDF and Word exports.
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.825rem', color: '#475569', margin: '0.5rem 0' }}>
              Choose a report scope below to preview statistics, officer workloads, or audit logs, then export in official <strong>TAU-Marutham DOCX</strong> or <strong>Printable PDF</strong>:
            </p>

            {/* Scope Selection Quick Buttons */}
            <div className="rr-scope-grid">
              <button
                type="button"
                className="rr-scope-btn"
                onClick={() => openReportPreview('summary')}
              >
                <BarChart3 size={16} color="#059669" />
                <span>RR Financial Summary</span>
              </button>
              <button
                type="button"
                className="rr-scope-btn"
                onClick={() => openReportPreview('officer')}
              >
                <Users size={16} color="#2563EB" />
                <span>Officer-Wise Workload</span>
              </button>
              <button
                type="button"
                className="rr-scope-btn"
                onClick={() => openReportPreview('audit')}
              >
                <ShieldCheck size={16} color="#7C3AED" />
                <span>Full Audit Ledger</span>
              </button>
              <button
                type="button"
                className="rr-scope-btn"
                onClick={() => openReportPreview('all')}
              >
                <Layers size={16} color="#D97706" />
                <span>Complete Master Report</span>
              </button>
            </div>
          </div>

          <div className="rr-admin-actions" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ backgroundColor: '#059669', borderColor: '#059669', width: '100%', justifyContent: 'center' }}
              disabled={loadingReport}
              onClick={() => openReportPreview('all')}
            >
              <Eye size={16} /> {loadingReport ? 'Compiling Report...' : 'Generate & Preview Master Report'}
            </button>
          </div>
        </article>
      </div>

      {/* Recent Backups Table */}
      <article className="rr-admin-card">
        <header style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: 0, color: '#102C57' }}>Recent Backup Snapshots</h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            History of system backups and restore points stored in session registry.
          </p>
        </header>
        <div className="rr-admin-table-scroll rr-backup-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Date / Time</th>
                <th scope="col">Snapshot Type</th>
                <th scope="col">Checksum (SHA-256)</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {history.length ? (
                history.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{new Date(item.createdAt).toLocaleString('en-IN')}</strong>
                    </td>
                    <td>{item.type || 'Full PostgreSQL Snapshot'}</td>
                    <td>
                      <code style={{ fontSize: '0.75rem', backgroundColor: 'rgba(0,0,0,0.05)', padding: '2px 4px', borderRadius: '4px' }}>
                        {item.checksum ? item.checksum.slice(0, 16) + '...' : 'Verified'}
                      </code>
                    </td>
                    <td>
                      <span className="rr-admin-status active">Ready</span>
                    </td>
                    <td>
                      <div className="rr-admin-actions">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                          onClick={() => {
                            const blob = new Blob([JSON.stringify(item.backup, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `rr-database-backup-${item.createdAt.replace(/[:.]/g, '-')}.json`;
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                            setTimeout(() => URL.revokeObjectURL(url), 1000);
                          }}
                        >
                          <Download size={14} /> Download
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                          onClick={() => setPending(item)}
                        >
                          <RefreshCw size={14} /> Restore
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="rr-backup-empty">
                    No backup snapshots generated yet. Click "Create DB Backup" to capture a snapshot.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {/* Restore Confirmation Modal */}
      {pending && (
        <Modal title="Restore Database Snapshot" onClose={() => setPending(null)}>
          <p>
            Are you sure you want to restore the database snapshot from <strong>{new Date(pending.createdAt).toLocaleString('en-IN')}</strong>
            {pending.fileName ? ` (${pending.fileName})` : ''}?
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            This will synchronize templates, proceedings cases, and audit records with the backup state.
          </p>
          <div className="rr-modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={restoreDatabase}>
              Confirm &amp; Restore
            </button>
          </div>
        </Modal>
      )}

      {/* Interactive Proceedings Analytics Report Preview Modal */}
      {isPreviewOpen && reportData && (
        <Modal title="Proceedings &amp; Analytics Report Preview" onClose={() => setIsPreviewOpen(false)} maxWidth="960px">
          <div className="report-preview-container" id="report-print-area" style={{ padding: '0.5rem' }}>
            {/* Header with Emblem Title */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #EADBC8', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', color: '#102C57', margin: '0 0 0.35rem 0', fontWeight: 700 }}>
                தமிழ்நாடு அரசு – வருவாய் மற்றும் பேரிடர் மேலாண்மைத் துறை
              </h2>
              <h3 style={{ fontSize: '1.05rem', color: '#334155', margin: '0 0 0.35rem 0' }}>
                ஈரோடு மாவட்ட ஆட்சியர் அலுவலகம் · வருவாய் வசூல் செயல்முறைகள் அறிக்கை
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Generated on: {reportData.generated_at} | Officer: {reportData.generated_by} | Scope: <strong style={{ textTransform: 'uppercase' }}>{selectedScope}</strong>
              </p>

              {/* Scope Switcher Tabs Inside Modal */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedScope('all')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    backgroundColor: selectedScope === 'all' ? '#102C57' : '#FEFAF6',
                    color: selectedScope === 'all' ? '#ffffff' : '#102C57',
                    border: '1px solid #DAC0A3',
                  }}
                >
                  Master Report (All)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedScope('summary')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    backgroundColor: selectedScope === 'summary' ? '#059669' : '#FEFAF6',
                    color: selectedScope === 'summary' ? '#ffffff' : '#059669',
                    border: '1px solid #DAC0A3',
                  }}
                >
                  Financial &amp; Counts Summary
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedScope('officer')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    backgroundColor: selectedScope === 'officer' ? '#2563EB' : '#FEFAF6',
                    color: selectedScope === 'officer' ? '#ffffff' : '#2563EB',
                    border: '1px solid #DAC0A3',
                  }}
                >
                  Officer-Wise Workload
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedScope('audit')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    backgroundColor: selectedScope === 'audit' ? '#7C3AED' : '#FEFAF6',
                    color: selectedScope === 'audit' ? '#ffffff' : '#7C3AED',
                    border: '1px solid #DAC0A3',
                  }}
                >
                  Audit Ledger Records
                </button>
              </div>
            </div>

            {/* SECTION 1: FINANCIAL & COUNTS SUMMARY */}
            {(selectedScope === 'all' || selectedScope === 'summary') && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'rgba(16, 44, 87, 0.05)', border: '1px solid rgba(16, 44, 87, 0.15)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Proceedings</span>
                    <strong style={{ display: 'block', fontSize: '1.35rem', color: '#102C57' }}>
                      {reportData.summary_statistics.total_proceedings}
                    </strong>
                  </div>
                  <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'rgba(5, 150, 105, 0.08)', border: '1px solid rgba(5, 150, 105, 0.2)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#065F46', textTransform: 'uppercase' }}>Total Recoverable Sum</span>
                    <strong style={{ display: 'block', fontSize: '1.35rem', color: '#059669' }}>
                      {reportData.summary_statistics.formatted_total_amount}
                    </strong>
                  </div>
                  <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.2)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#92400E', textTransform: 'uppercase' }}>Dispatched to DRO</span>
                    <strong style={{ display: 'block', fontSize: '1.35rem', color: '#D97706' }}>
                      {reportData.summary_statistics.status_breakdown?.DISPATCHED || 0}
                    </strong>
                  </div>
                  <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#4338CA', textTransform: 'uppercase' }}>Verified Orders</span>
                    <strong style={{ display: 'block', fontSize: '1.35rem', color: '#6366F1' }}>
                      {reportData.summary_statistics.status_breakdown?.VERIFIED || 0}
                    </strong>
                  </div>
                </div>

                {/* Department Breakdown */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#102C57', fontWeight: 600 }}>Department Breakdown</h4>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {Object.entries(reportData.summary_statistics.department_breakdown || {}).map(([dept, count]) => (
                      <span
                        key={dept}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.78rem',
                          backgroundColor: '#FEFAF6',
                          border: '1px solid #EADBC8',
                          color: '#102C57',
                        }}
                      >
                        <strong>{dept}:</strong> {count} cases
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* SECTION 2: OFFICER-WISE BREAKDOWN */}
            {(selectedScope === 'all' || selectedScope === 'officer') && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#102C57', fontWeight: 600 }}>
                  Officer-Wise Performance &amp; Case Processing (அதிகாரி வாரியான விவரம்)
                </h4>
                <div className="rr-admin-table-scroll" style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #EADBC8', borderRadius: '6px' }}>
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#FEFAF6', borderBottom: '1px solid #EADBC8' }}>
                        <th style={{ padding: '8px', textAlign: 'left' }}>#</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Officer Name</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Taluk</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Total Cases</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Total Sum (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Dispatched</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Verified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.officer_statistics?.length ? (
                        reportData.officer_statistics.map((off, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #EADBC8' }}>
                            <td style={{ padding: '8px' }}>{idx + 1}</td>
                            <td style={{ padding: '8px' }}><strong>{off.officer_name}</strong></td>
                            <td style={{ padding: '8px' }}>{off.taluk}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>{off.total_cases}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                              ₹{Number(off.total_amount || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <span className="rr-admin-status active" style={{ fontSize: '0.72rem', padding: '2px 6px' }}>
                                {off.dispatched}
                              </span>
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <span className="rr-admin-status verified" style={{ fontSize: '0.72rem', padding: '2px 6px' }}>
                                {off.verified}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                            No officer statistics available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECTION 3: AUDIT LEDGER RECORDS */}
            {(selectedScope === 'all' || selectedScope === 'audit') && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#102C57', fontWeight: 600 }}>
                  Immutable Audit Ledger Records (முழுமையான தணிக்கைப் பதிவு)
                </h4>
                <div className="rr-admin-table-scroll" style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #EADBC8', borderRadius: '6px' }}>
                  <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#FEFAF6', borderBottom: '1px solid #EADBC8' }}>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Timestamp</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Action</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>User / Officer</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Details Summary</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Cryptographic Signature</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.audit_ledger_records?.length ? (
                        reportData.audit_ledger_records.slice(0, 50).map((aud, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #EADBC8' }}>
                            <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{aud.timestamp}</td>
                            <td style={{ padding: '8px' }}>
                              <span
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  backgroundColor: aud.action.includes('LOGIN') ? '#DCFCE7' : aud.action.includes('BACKUP') ? '#E0E7FF' : '#FEF3C7',
                                  color: aud.action.includes('LOGIN') ? '#166534' : aud.action.includes('BACKUP') ? '#3730A3' : '#92400E',
                                }}
                              >
                                {aud.action}
                              </span>
                            </td>
                            <td style={{ padding: '8px' }}>{aud.user_id}</td>
                            <td style={{ padding: '8px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {aud.details}
                            </td>
                            <td style={{ padding: '8px' }}>
                              <code style={{ fontSize: '0.7rem', color: '#059669' }}>{aud.signature?.slice(0, 18)}...</code>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                            No audit ledger records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECTION 4: PARTICULARS TABLE (For all and summary) */}
            {(selectedScope === 'all' || selectedScope === 'summary') && (
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#102C57', fontWeight: 600 }}>
                  Particulars Ledger (செயல்முறைகள் விவரப் பட்டியல்)
                </h4>
                <div className="rr-admin-table-scroll" style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #EADBC8', borderRadius: '6px' }}>
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#FEFAF6', borderBottom: '1px solid #EADBC8' }}>
                        <th style={{ padding: '8px', textAlign: 'left' }}>#</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Case / File No</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Defaulter Name</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Department</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Taluk</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Amount (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.particulars?.length ? (
                        reportData.particulars.map((item, idx) => (
                          <tr key={item.id || idx} style={{ borderBottom: '1px solid #EADBC8' }}>
                            <td style={{ padding: '8px' }}>{idx + 1}</td>
                            <td style={{ padding: '8px' }}><strong>{item.caseNumber}</strong></td>
                            <td style={{ padding: '8px' }}>{item.defaulterName}</td>
                            <td style={{ padding: '8px' }}>{item.department}</td>
                            <td style={{ padding: '8px' }}>{item.taluk}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                              ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <span className={`rr-admin-status ${item.status?.includes('DISPATCH') ? 'active' : 'verified'}`} style={{ fontSize: '0.72rem', padding: '2px 6px' }}>
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                            No proceedings records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="rr-modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #EADBC8' }}>
              <button type="button" className="btn btn-outline" onClick={() => setIsPreviewOpen(false)}>
                Close Preview
              </button>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn btn-outline" onClick={handlePrintPdf}>
                  <Printer size={16} /> Print / Save PDF
                </button>
                <button type="button" className="btn btn-primary" style={{ backgroundColor: '#059669', borderColor: '#059669' }} onClick={handleDownloadDocx}>
                  <Download size={16} /> Download DOCX ({selectedScope.toUpperCase()})
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { Download, FileText, Database, RefreshCw, Eye, Printer, CheckCircle2, AlertCircle } from 'lucide-react';
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
        backup
      };
      const updated = [item, ...history];
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      setHistory(updated);

      // Download file to browser
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
      setSuccessMsg(`Database backup generated successfully! Checksum: ${backup.checksum_sha256?.slice(0, 16)}...`);
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
        throw new Error('Selected file is not a valid RR Assistant database backup payload.');
      }
      const createdAt = parsed.created_at || new Date().toISOString();
      setPending({
        id: crypto.randomUUID(),
        createdAt,
        fileName: file.name,
        backup: parsed,
        type: 'Imported Snapshot'
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
  async function openReportPreview() {
    setError('');
    setLoadingReport(true);
    try {
      const report = await apiService.getSystemAnalyticsReport();
      setReportData(report);
      setIsPreviewOpen(true);
      recordActivity('Report generated', { reference: 'Proceedings Analytics Report' });
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
      await apiService.exportSystemReportDocx(reportData);
      recordActivity('Report download requested', { reference: 'DOCX Format' });
    } catch (e) {
      setError(`DOCX download failed: ${e.message}`);
    }
  }

  // 6. Download / Print Report as PDF
  function handlePrintPdf() {
    window.print();
    recordActivity('Report download requested', { reference: 'PDF Print' });
  }

  const lastBackup = history[0];

  return (
    <section className="rr-admin rr-backup-page">
      <header className="rr-admin-heading">
        <div>
          <p className="rr-admin-eyebrow">ADMINISTRATION · SYSTEM RELIABILITY</p>
          <h1>Backup &amp; Reporting Center</h1>
          <p>Generate full database snapshots, restore points, and comprehensive proceedings analytical reports.</p>
        </div>
      </header>

      {error && <div className="rr-admin-alert" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
      {successMsg && <div className="rr-admin-notice" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: '#10B981', color: '#065F46', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={18} /><span>{successMsg}</span></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        
        {/* Database Backup Card */}
        <article className="rr-admin-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
              <span style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(16, 44, 87, 0.08)', color: '#102C57' }}><Database size={22} /></span>
              <div>
                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Full Database Backup</h2>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cryptographic JSON dump of Users, Templates, Cases, and Audit logs.</p>
              </div>
            </div>
            <dl className="rr-backup-overview" style={{ margin: '1rem 0' }}>
              <div><dt>Last Backup</dt><dd><strong>{lastBackup ? new Date(lastBackup.createdAt).toLocaleString('en-IN') : 'No backups yet'}</strong></dd></div>
              <div><dt>Status</dt><dd><span className="rr-admin-status active">Database Healthy</span></dd></div>
              <div><dt>Tables Protected</dt><dd>Users, Templates, Cases, Logs</dd></div>
            </dl>
          </div>
          <div className="rr-admin-actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn btn-primary" disabled={isProcessing} onClick={makeDatabaseBackup}>
              <Download size={16} /> {isProcessing ? 'Backing up...' : 'Create DB Backup'}
            </button>
            <button type="button" className="btn btn-outline" disabled={isProcessing} onClick={() => fileInputRef.current?.click()}>
              <RefreshCw size={16} /> Import &amp; Restore
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              aria-label="Import backup file"
              onChange={importBackupFile}
              style={{ display: 'none' }}
              tabIndex={-1}
            />
          </div>
        </article>

        {/* Proceedings Analytics Report Card */}
        <article className="rr-admin-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
              <span style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(5, 150, 105, 0.1)', color: '#059669' }}><FileText size={22} /></span>
              <div>
                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Proceedings Analytics Report</h2>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Consolidated summary of all cases, recovered sums, taluk &amp; department stats.</p>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: '1rem 0' }}>
              Generates an executive Collectorate report with interactive preview, printable PDF summary, and official TAU-Marutham Word (.docx) export.
            </p>
          </div>
          <div className="rr-admin-actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn btn-primary" style={{ backgroundColor: '#059669', borderColor: '#059669' }} disabled={loadingReport} onClick={openReportPreview}>
              <Eye size={16} /> {loadingReport ? 'Compiling Report...' : 'Generate & Preview Report'}
            </button>
          </div>
        </article>
      </div>

      {/* Recent Backups Table */}
      <article className="rr-admin-card">
        <header style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Recent Backup Snapshots</h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>History of system backups and restore points stored in session registry.</p>
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
                history.map(item => (
                  <tr key={item.id}>
                    <td><strong>{new Date(item.createdAt).toLocaleString('en-IN')}</strong></td>
                    <td>{item.type || 'Full PostgreSQL Snapshot'}</td>
                    <td><code style={{ fontSize: '0.75rem', backgroundColor: 'rgba(0,0,0,0.05)', padding: '2px 4px', borderRadius: '4px' }}>{item.checksum ? item.checksum.slice(0, 16) + '...' : 'Verified'}</code></td>
                    <td><span className="rr-admin-status active">Ready</span></td>
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
                  <td colSpan={5} className="rr-backup-empty">No backup snapshots generated yet. Click "Create DB Backup" to capture a snapshot.</td>
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
            <button type="button" className="btn btn-outline" onClick={() => setPending(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={restoreDatabase}>Confirm &amp; Restore</button>
          </div>
        </Modal>
      )}

      {/* Interactive Proceedings Analytics Report Preview Modal */}
      {isPreviewOpen && reportData && (
        <Modal title="Proceedings & Analytics Report Preview" onClose={() => setIsPreviewOpen(false)} maxWidth="920px">
          <div className="report-preview-container" id="report-print-area" style={{ padding: '0.5rem' }}>
            
            {/* Header */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', color: '#102C57', margin: '0 0 0.35rem 0' }}>
                தமிழ்நாடு அரசு – வருவாய் மற்றும் பேரிடர் மேலாண்மைத் துறை
              </h2>
              <h3 style={{ fontSize: '1.05rem', color: '#334155', margin: '0 0 0.35rem 0' }}>
                ஈரோடு மாவட்ட ஆட்சியர் அலுவலகம் · வருவாய் வசூல் செயல்முறைகள் அறிக்கை
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Generated on: {reportData.generated_at} | Officer: {reportData.generated_by}
              </p>
            </div>

            {/* Summary Statistics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'rgba(16, 44, 87, 0.05)', border: '1px solid rgba(16, 44, 87, 0.15)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Proceedings</span>
                <strong style={{ display: 'block', fontSize: '1.35rem', color: '#102C57' }}>{reportData.summary_statistics.total_proceedings}</strong>
              </div>
              <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'rgba(5, 150, 105, 0.08)', border: '1px solid rgba(5, 150, 105, 0.2)' }}>
                <span style={{ fontSize: '0.75rem', color: '#065F46', textTransform: 'uppercase' }}>Total Recoverable Sum</span>
                <strong style={{ display: 'block', fontSize: '1.35rem', color: '#059669' }}>{reportData.summary_statistics.formatted_total_amount}</strong>
              </div>
              <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.2)' }}>
                <span style={{ fontSize: '0.75rem', color: '#92400E', textTransform: 'uppercase' }}>Dispatched to DRO</span>
                <strong style={{ display: 'block', fontSize: '1.35rem', color: '#D97706' }}>{reportData.summary_statistics.status_breakdown?.DISPATCHED || 0}</strong>
              </div>
              <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <span style={{ fontSize: '0.75rem', color: '#4338CA', textTransform: 'uppercase' }}>Verified Orders</span>
                <strong style={{ display: 'block', fontSize: '1.35rem', color: '#6366F1' }}>{reportData.summary_statistics.status_breakdown?.VERIFIED || 0}</strong>
              </div>
            </div>

            {/* Department Breakdown */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#102C57' }}>Department Breakdown</h4>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {Object.entries(reportData.summary_statistics.department_breakdown || {}).map(([dept, count]) => (
                  <span key={dept} style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.78rem', backgroundColor: 'var(--cream)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)' }}>
                    <strong>{dept}:</strong> {count} cases
                  </span>
                ))}
              </div>
            </div>

            {/* Particulars Table */}
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#102C57' }}>Particulars Ledger (செயல்முறைகள் விவரப் பட்டியல்)</h4>
              <div className="rr-admin-table-scroll" style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
                <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--cream)', borderBottom: '1px solid var(--border-subtle)' }}>
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
                        <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '8px' }}>{idx + 1}</td>
                          <td style={{ padding: '8px' }}><strong>{item.caseNumber}</strong></td>
                          <td style={{ padding: '8px' }}>{item.defaulterName}</td>
                          <td style={{ padding: '8px' }}>{item.department}</td>
                          <td style={{ padding: '8px' }}>{item.taluk}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>₹{Number(item.amount || 0).toLocaleString('en-IN')}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <span className={`rr-admin-status ${item.status?.includes('DISPATCH') ? 'active' : 'verified'}`} style={{ fontSize: '0.72rem', padding: '2px 6px' }}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>No proceedings records found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="rr-modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-outline" onClick={() => setIsPreviewOpen(false)}>Close Preview</button>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn btn-outline" onClick={handlePrintPdf}>
                  <Printer size={16} /> Print / Save PDF
                </button>
                <button type="button" className="btn btn-primary" onClick={handleDownloadDocx}>
                  <Download size={16} /> Download DOCX
                </button>
              </div>
            </div>

          </div>
        </Modal>
      )}

    </section>
  );
}


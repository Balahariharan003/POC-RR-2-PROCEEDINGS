import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  AlertTriangle,
  Inbox,
  FileText,
  LogIn,
  LogOut,
  Database,
  LayoutTemplate,
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  Eye,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';
import AuditFilters from './AuditFilters.jsx';
import { emptyAuditFilters, availableOfficerIds, matchesAuditFilters, officerId } from './auditFilters.js';
import { apiService } from '../../services/apiService.js';
import { isRRProceeding } from '../../services/auditStore.js';
import Modal from '../common/Modal.jsx';
import './AuditLogView.css';

function formatDisplayDate(dateStr) {
  if (!dateStr) return 'Not recorded';
  const date = new Date(dateStr);
  if (!Number.isFinite(date.getTime())) return dateStr;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (!Number.isFinite(date.getTime())) return '';
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getEventMeta(entry) {
  const action = String(entry.action || '').toUpperCase();
  const fileId = String(entry.rawFileId || entry.orderId || entry.caseNumber || '').toUpperCase();
  const details = entry.details && typeof entry.details === 'object' ? entry.details : {};

  if (action.includes('LOGOUT') || fileId === 'LOGOUT') {
    return {
      type: 'LOGOUT',
      badgeClass: 'logout',
      badgeText: 'Session Closed',
      icon: LogOut,
      title: 'User Logout'
    };
  }

  if (action.includes('LOGIN') || fileId === 'LOGIN') {
    return {
      type: 'LOGIN',
      badgeClass: 'login',
      badgeText: 'Active Login',
      icon: LogIn,
      title: 'User Login'
    };
  }

  if (action.includes('RESTORE') || fileId.startsWith('RESTORE-')) {
    return {
      type: 'RESTORE',
      badgeClass: 'restore',
      badgeText: 'Database Restore',
      icon: Database,
      title: 'System Restore'
    };
  }

  if (action.includes('BACKUP') || fileId.startsWith('BACKUP-')) {
    return {
      type: 'BACKUP',
      badgeClass: 'backup',
      badgeText: 'Database Backup',
      icon: Database,
      title: 'System Backup'
    };
  }

  if (action.includes('TEMPLATE') || details.template_code) {
    return {
      type: 'TEMPLATE',
      badgeClass: 'template',
      badgeText: 'Template Config',
      icon: LayoutTemplate,
      title: details.name || `Template: ${details.template_code || 'Config'}`
    };
  }

  if (action.includes('REPORT') || fileId.startsWith('REPORT-') || details.total_proceedings !== undefined) {
    return {
      type: 'REPORT',
      badgeClass: 'report',
      badgeText: 'Analytics Report',
      icon: BarChart3,
      title: 'System Analytics Report'
    };
  }

  // Default: RR Proceedings
  const status = String(entry.status || '').toUpperCase();
  let statusText = 'Draft Generated';
  let statusTagClass = 'draft';
  if (status === 'VERIFIED') {
    statusText = 'Verified by Officer';
    statusTagClass = 'verified';
  } else if (status === 'DISPATCHED' || status === 'DISPATCHED_TO_DRO') {
    statusText = 'Dispatched to DRO';
    statusTagClass = 'dispatched';
  } else if (status === 'FLAGGED' || status === 'FLAGGED_FOR_REVIEW') {
    statusText = 'Flagged for Review';
    statusTagClass = 'flagged';
  }

  return {
    type: 'PROCEEDINGS',
    badgeClass: 'proceedings',
    badgeText: 'RR Proceedings',
    icon: FileText,
    title: entry.caseNumber || entry.fileName || 'Revenue Recovery Order',
    statusText,
    statusTagClass
  };
}

export default function AuditLogView({
  currentUser,
  isAdmin: isAdminProp = false,
  onRestoreSession,
  onNavigateToAssistant
}) {
  const isUserAdmin = Boolean(isAdminProp || currentUser?.role === 'admin' || currentUser?.role === 'SUPER_ADMIN');
  const [auditLogs, setAuditLogs] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedInspectEntry, setSelectedInspectEntry] = useState(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOfficer, setSelectedOfficer] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedDay, setSelectedDay] = useState('ALL');
  const [filters, setFilters] = useState(emptyAuditFilters);

  // Load audit logs on mount
  const loadLogs = async () => {
    setIsLoading(true);
    setError('');
    try {
      const logs = await apiService.getAuditLogs();
      setAuditLogs(logs && typeof logs === 'object' && !Array.isArray(logs) ? logs : {});
    } catch (err) {
      console.error('Error loading audit logs:', err);
      setAuditLogs({});
      setError(err?.message || 'Unable to load saved audit records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    window.addEventListener('storage', loadLogs);
    window.addEventListener('rr-audit-logs-updated', loadLogs);
    return () => {
      window.removeEventListener('storage', loadLogs);
      window.removeEventListener('rr-audit-logs-updated', loadLogs);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadLogs();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const filterEntries = (entries) => {
    if (!Array.isArray(entries)) return [];
    return entries.filter((e) => {
      if (!e || typeof e !== 'object') return false;

      const queryLower = (searchQuery || '').toLowerCase();
      const matchesSearch =
        !queryLower ||
        (e.caseNumber && typeof e.caseNumber === 'string' && e.caseNumber.toLowerCase().includes(queryLower)) ||
        (e.id && typeof e.id === 'string' && e.id.toLowerCase().includes(queryLower)) ||
        (e.orderId && typeof e.orderId === 'string' && e.orderId.toLowerCase().includes(queryLower)) ||
        (e.defaulter && typeof e.defaulter === 'string' && e.defaulter.toLowerCase().includes(queryLower)) ||
        (e.officerName && typeof e.officerName === 'string' && e.officerName.toLowerCase().includes(queryLower)) ||
        (e.taluk && typeof e.taluk === 'string' && e.taluk.toLowerCase().includes(queryLower)) ||
        (e.notes && typeof e.notes === 'string' && e.notes.toLowerCase().includes(queryLower));

      const matchesStatus =
        selectedStatus === 'ALL' ||
        (selectedStatus === 'DISPATCHED' && (e.status === 'DISPATCHED' || e.status === 'DISPATCHED_TO_DRO')) ||
        (selectedStatus === 'FLAGGED' && (e.status === 'FLAGGED' || e.status === 'FLAGGED_FOR_REVIEW')) ||
        (selectedStatus === 'VERIFIED' && e.status === 'VERIFIED') ||
        (selectedStatus === 'DRAFT' && e.status === 'DRAFT');

      const matchesOfficer = selectedOfficer === 'ALL' || e.officerName === selectedOfficer || e.officerId === selectedOfficer;
      const matchesDate = !selectedDate || (e.timestamp && typeof e.timestamp === 'string' && e.timestamp.startsWith(selectedDate));

      let matchesYear = true;
      let matchesMonth = true;
      let matchesDay = true;

      if (e.timestamp && typeof e.timestamp === 'string') {
        const [datePart] = e.timestamp.split(' ');
        if (datePart) {
          const [yr, mo, dy] = datePart.split('-');
          if (selectedYear !== 'ALL' && yr !== selectedYear) matchesYear = false;
          if (selectedMonth !== 'ALL' && parseInt(mo, 10) !== parseInt(selectedMonth, 10)) matchesMonth = false;
          if (selectedDay !== 'ALL' && parseInt(dy, 10) !== parseInt(selectedDay, 10)) matchesDay = false;
        }
      }

      return matchesSearch && matchesStatus && matchesOfficer && matchesDate && matchesYear && matchesMonth && matchesDay;
    });
  };

  const officers = useMemo(() => {
    const logIds = availableOfficerIds(Object.values(auditLogs).flat());
    return [...new Set(logIds.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [auditLogs]);

  const filterByAuditFilters = (entries) => entries.filter((entry) => matchesAuditFilters(entry, filters));

  const entries = filterEntries(filterByAuditFilters(Object.values(auditLogs).flat())).sort(
    (a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0)
  );
  const totalFilteredCount = entries.length;

  const handleRowClick = (entry) => {
    const meta = getEventMeta(entry);
    const isRealProceeding = meta.type === 'PROCEEDINGS' && isRRProceeding(entry);

    if (isRealProceeding) {
      const orderLabel = entry.caseNumber || entry.fileName || entry.orderId || entry.id;
      const initialPrompt = {
        id: 1,
        prompt: entry.notes || `Ingested source order "${entry.fileName || orderLabel}" and synthesized draft proceedings.`,
        timestamp: entry.timestamp
          ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const docContent = entry.documentContent || entry.details?.documentContent || '';
      const docLayout = entry.documentLayout || entry.details?.documentLayout || null;
      const docEdits = entry.documentEdits || entry.details?.documentEdits || {};
      const docxFilename = entry.generated_docx_filename || entry.details?.generated_docx_filename || entry.details?.output_docx || '';
      const sourceUrl = entry.sourceFileUrl || entry.details?.original_file_url || (entry.rawFileId && !entry.rawFileId.startsWith('backup') ? `/api/v1/documents/original/${encodeURIComponent(entry.rawFileId)}` : '');

      const payload = {
        ...entry,
        documentContent: docContent || (docLayout ? '' : `Draft proceedings recorded for ${orderLabel}.`),
        documentLayout: docLayout,
        documentEdits: docEdits,
        generated_docx_filename: docxFilename,
        sourceFileUrl: sourceUrl,
        fileName: entry.fileName || entry.details?.fileName || entry.rawFileId || orderLabel,
        promptHistory: Array.isArray(entry.promptHistory) && entry.promptHistory.length > 0
          ? entry.promptHistory
          : Array.isArray(entry.details?.promptHistory) && entry.details.promptHistory.length > 0
            ? entry.details.promptHistory
            : [initialPrompt]
      };
      if (onRestoreSession) {
        onRestoreSession(payload);
      } else if (onNavigateToAssistant) {
        onNavigateToAssistant();
      }
    } else {
      // For all other entries (Analytics Reports, Backups, Restores, Logins, Logouts, Templates),
      // remain strictly on the current tab and open the detail inspection modal.
      setSelectedInspectEntry(entry);
    }
  };

  return (
    <div className="rr-audit-view">
      {/* Header */}
      <div className="rr-audit-header-row">
        <div>
          <h1 className="rr-audit-title">Audit Logs</h1>
          <p className="rr-audit-subtitle">
            Cryptographic ledger and activity trail for Revenue Recovery proceedings and security events.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleRefresh}
            className="btn btn-outline"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              fontSize: '0.825rem',
              fontWeight: 600,
              color: '#102C57',
              background: '#ffffff',
              border: '1px solid #DAC0A3',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spinner' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rr-admin-alert" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Component */}
      <AuditFilters
        filters={filters}
        onChange={setFilters}
        officers={officers}
        showOfficer={isUserAdmin}
        records={Object.values(auditLogs).flat()}
      />

      {/* Count Banner */}
      <div className="rr-audit-count-banner">
        <span>
          Showing <strong style={{ color: '#102C57' }}>{totalFilteredCount}</strong> audit entries
        </span>
      </div>

      {/* Empty State */}
      {!error && totalFilteredCount === 0 && (
        <div
          style={{
            width: '100%',
            background: '#ffffff',
            border: '1.5px dashed #DAC0A3',
            borderRadius: '16px',
            padding: '64px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
          }}
        >
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: '#FEFAF6',
              border: '1px solid #EADBC8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#102C57',
              marginBottom: '16px'
            }}
          >
            <Inbox size={28} color="#102C57" />
          </div>

          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#102C57', margin: '0 0 6px 0' }}>
            No Audit Log entries found
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#102C57', margin: '0 0 22px 0', maxWidth: '480px' }}>
            Actions submitted in office Assistant and administrative events will automatically appear here.
          </p>

          <button
            type="button"
            onClick={onNavigateToAssistant}
            style={{
              backgroundColor: '#102C57',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 24px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 44, 87, 0.2)'
            }}
          >
            Go to Office Assistant
          </button>
        </div>
      )}

      {/* Ledger Table */}
      {totalFilteredCount > 0 && (
        <div className="rr-audit-table-card">
          <div className="rr-audit-table-wrapper">
            <table className="rr-audit-table" aria-label="Audit logs">
              <thead>
                <tr>
                  <th>Event / Reference</th>
                  <th>Officer</th>
                  <th>Activity Details</th>
                  <th style={{ textAlign: 'right' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const meta = getEventMeta(entry);
                  const Icon = meta.icon;
                  const details = entry.details && typeof entry.details === 'object' ? entry.details : {};
                  const isRealProceeding = meta.type === 'PROCEEDINGS' && isRRProceeding(entry);
                  const officerName = entry.officerName || details.full_name || entry.officerId || 'System';
                  const initials = (officerName || 'O')
                    .split(' ')
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  // Amount formatting
                  const rawAmt = entry.amount || details.total_amount || details.amount;
                  const formattedAmt =
                    typeof rawAmt === 'number'
                      ? `₹ ${rawAmt.toLocaleString('en-IN')}/-`
                      : typeof rawAmt === 'string' && rawAmt.length > 0
                      ? rawAmt.startsWith('₹')
                        ? rawAmt
                        : `₹ ${rawAmt}/-`
                      : null;

                  return (
                    <tr
                      key={entry.id}
                      tabIndex={0}
                      className="rr-audit-row"
                      onClick={() => handleRowClick(entry)}
                      title={isRealProceeding ? 'Click to open in Office Assistant' : 'Click to inspect details'}
                    >
                      {/* Event / Reference Column */}
                      <td className="rr-audit-cell-identifier">
                        <div className={`rr-audit-event-badge ${meta.badgeClass}`}>
                          <Icon size={12} />
                          <span>{meta.badgeText}</span>
                        </div>
                        <div className="rr-audit-order-title">
                          {entry.caseNumber || entry.orderId || entry.rawFileId || entry.id}
                        </div>
                      </td>

                      {/* Officer Column */}
                      <td className="rr-audit-cell-officer">
                        <div className="rr-audit-officer-box">
                          <div className="rr-audit-officer-avatar">{initials}</div>
                          <div className="rr-audit-officer-info">
                            <span className="rr-audit-officer-name">{officerName}</span>
                            <span className="rr-audit-officer-id">{officerId(entry) || entry.user_id || 'admin'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Details Column */}
                      <td className="rr-audit-cell-details">
                        {isRealProceeding ? (
                          <>
                            <div className="rr-audit-details-header">
                              <span className={`rr-audit-status-tag ${meta.statusTagClass}`}>
                                <CheckCircle2 size={12} />
                                {meta.statusText}
                              </span>
                              {formattedAmt && <span className="rr-audit-chip amount">{formattedAmt}</span>}
                            </div>

                            <div className="rr-audit-details-text">
                              {entry.notes && !entry.notes.startsWith('{')
                                ? entry.notes
                                : details.notes || 'Automated OCR extraction and draft generation completed in Office Assistant.'}
                            </div>

                            <div className="rr-audit-chips-row">
                              {entry.defaulter && entry.defaulter !== entry.action && (
                                <span className="rr-audit-chip" title="Defaulter Name">
                                  <User size={11} />
                                  {entry.defaulter}
                                </span>
                              )}
                              {(entry.taluk || details.taluk) && (
                                <span className="rr-audit-chip" title="Jurisdiction">
                                  <MapPin size={11} />
                                  {entry.taluk || details.taluk}
                                </span>
                              )}
                              {details.ocr_mode && (
                                <span className="rr-audit-chip" title="OCR Mode">
                                  <Layers size={11} />
                                  {details.ocr_mode === 'native_digital_high_fidelity' ? 'Native Digital OCR' : details.ocr_mode}
                                </span>
                              )}
                            </div>
                          </>
                        ) : meta.type === 'LOGIN' ? (
                          <>
                            <div className="rr-audit-details-header">
                              <span className="rr-audit-status-tag verified">
                                <LogIn size={12} />
                                Active Session
                              </span>
                            </div>
                            <div className="rr-audit-details-text">
                              Officer logged in securely with {details.role === 'admin' ? 'Administrator' : 'Revenue Officer'} privileges.
                            </div>
                          </>
                        ) : meta.type === 'LOGOUT' ? (
                          <>
                            <div className="rr-audit-details-header">
                              <span className="rr-audit-status-tag info">
                                <LogOut size={12} />
                                Session Closed
                              </span>
                            </div>
                            <div className="rr-audit-details-text">User session terminated safely.</div>
                          </>
                        ) : meta.type === 'BACKUP' ? (
                          <>
                            <div className="rr-audit-details-header">
                              <span className="rr-audit-status-tag info">
                                <Database size={12} />
                                Snapshot Created
                              </span>
                            </div>
                            <div className="rr-audit-details-text">
                              {details.table_counts ? (
                                <span>
                                  Tables: Users ({details.table_counts.users || 0}) • Audit Logs ({details.table_counts.audit_ledger || 0}) •
                                  Templates ({details.table_counts.document_templates || 0})
                                </span>
                              ) : (
                                'Database backup JSON archive generated.'
                              )}
                            </div>
                            {details.backup_checksum && (
                              <div className="rr-audit-chips-row">
                                <span className="rr-audit-chip" title="SHA-256 Checksum">
                                  <ShieldCheck size={11} />
                                  SHA-256: {details.backup_checksum.slice(0, 16)}...
                                </span>
                              </div>
                            )}
                          </>
                        ) : meta.type === 'RESTORE' ? (
                          <>
                            <div className="rr-audit-details-header">
                              <span className="rr-audit-status-tag verified">
                                <Database size={12} />
                                Snapshot Restored
                              </span>
                            </div>
                            <div className="rr-audit-details-text">
                              {details.restored_counts ? (
                                <span>
                                  Restored: {details.restored_counts.templates || 0} Templates, {details.restored_counts.cases || 0} Cases,{' '}
                                  {details.restored_counts.audit || 0} Logs
                                </span>
                              ) : (
                                'Database configuration restored.'
                              )}
                            </div>
                          </>
                        ) : meta.type === 'TEMPLATE' ? (
                          <>
                            <div className="rr-audit-details-header">
                              <span className="rr-audit-status-tag info">
                                <LayoutTemplate size={12} />
                                Template Modified
                              </span>
                            </div>
                            <div className="rr-audit-details-text">
                              {details.updated_fields ? `Updated fields: ${details.updated_fields.join(', ')}` : details.name || 'Template configuration updated.'}
                            </div>
                          </>
                        ) : meta.type === 'REPORT' ? (
                          <>
                            <div className="rr-audit-details-header">
                              <span className="rr-audit-status-tag info">
                                <BarChart3 size={12} />
                                Report Generated
                              </span>
                              {details.total_amount && (
                                <span className="rr-audit-chip amount">
                                  ₹ {Number(details.total_amount).toLocaleString('en-IN')}/-
                                </span>
                              )}
                            </div>
                            <div className="rr-audit-details-text">
                              Analytics report covering {details.total_proceedings || 0} proceedings.
                            </div>
                          </>
                        ) : (
                          <div className="rr-audit-details-text">
                            {entry.notes || entry.action || 'System action recorded.'}
                          </div>
                        )}
                      </td>

                      {/* Timestamp Column */}
                      <td className="rr-audit-cell-timestamp">
                        <div className="rr-audit-time-main">{formatDisplayDate(entry.timestamp)}</div>
                        <div className="rr-audit-time-ago">{timeAgo(entry.timestamp)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspect Technical Details Modal */}
      {selectedInspectEntry && (
        <Modal
          title="Audit Ledger Entry Inspection"
          isOpen={Boolean(selectedInspectEntry)}
          onClose={() => setSelectedInspectEntry(null)}
          size="large"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="rr-audit-modal-grid">
              <div className="rr-audit-modal-field">
                <label>Entry ID</label>
                <span>{selectedInspectEntry.id}</span>
              </div>
              <div className="rr-audit-modal-field">
                <label>Action / Event</label>
                <span>{selectedInspectEntry.action}</span>
              </div>
              <div className="rr-audit-modal-field">
                <label>Officer / Actor</label>
                <span>{selectedInspectEntry.officerName || selectedInspectEntry.user_id}</span>
              </div>
              <div className="rr-audit-modal-field">
                <label>Recorded Timestamp</label>
                <span>{formatDisplayDate(selectedInspectEntry.timestamp)}</span>
              </div>
            </div>

            {selectedInspectEntry.signature && (
              <div className="rr-audit-modal-field">
                <label>Cryptographic HMAC-SHA256 Signature</label>
                <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                  {selectedInspectEntry.signature}
                </span>
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#102C57', marginBottom: '6px', display: 'block' }}>
                Complete Raw Payload (JSON)
              </label>
              <pre className="rr-audit-json-box">
                {JSON.stringify(selectedInspectEntry.details || selectedInspectEntry, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


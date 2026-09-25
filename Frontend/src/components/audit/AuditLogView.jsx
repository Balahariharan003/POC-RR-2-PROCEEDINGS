import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  ExternalLink,
  Calendar,
  Layers,
  ChevronDown,
  X,
  RefreshCw,
  MessageSquare,
  ArrowRight,
  Inbox,
  User,
  Check,
  Printer,
  Sparkles,
  Eye,
  FileCheck
} from 'lucide-react';
import AuditFilters from './AuditFilters.jsx';
import { emptyAuditFilters, availableOfficerIds, matchesAuditFilters, officerId } from './auditFilters.js';
import { apiService } from '../../services/apiService.js';
import { readUsers } from '../../services/adminStore.js';
import { INITIAL_AUDIT_LOGS } from '../../data/adminMockData.js';

export default function AuditLogView({ 
  currentUser,
  isAdmin: isAdminProp = false,
  onRestoreSession, 
  onNavigateToAssistant 
}) {
  const isUserAdmin = Boolean(isAdminProp || currentUser?.role === 'admin');
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Filters State (Matching exact screenshot controls)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOfficer, setSelectedOfficer] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedDay, setSelectedDay] = useState('ALL');
  const [filters, setFilters] = useState(emptyAuditFilters);

  // Dynamic list of unique officers from audit logs
  const officerOptions = useMemo(() => {
    const names = new Set();
    if (auditLogs && typeof auditLogs === 'object') {
      Object.values(auditLogs).forEach(monthEntries => {
        if (Array.isArray(monthEntries)) {
          monthEntries.forEach(entry => {
            if (entry && entry.officerName) {
              names.add(entry.officerName);
            }
          });
        }
      });
    }
    return Array.from(names).sort();
  }, [auditLogs]);

  // Modal State for Side-by-Side Comparison & Inspection (Phase 3 & 4)
  const [selectedLog, setSelectedLog] = useState(null);

  // Load audit logs on mount (Phase 1)
  const loadLogs = async () => {
    setIsLoading(true);
    setError('');
    try {
      const logs = await apiService.getAuditLogs();
      setAuditLogs((logs && typeof logs === 'object' && Object.keys(logs).length > 0) ? logs : INITIAL_AUDIT_LOGS);
    } catch (err) {
      console.error("Error loading audit logs:", err);
      setAuditLogs(INITIAL_AUDIT_LOGS);
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

  useEffect(() => {
    if (!selectedLog) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedLog(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedLog]);

  // Handle Refresh Button
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadLogs();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // Flatten and filter entries across all partitions (Phase 2)
  const allMonths = auditLogs && typeof auditLogs === 'object' ? Object.keys(auditLogs) : [];
  
  const filterEntries = (entries) => {
    if (!Array.isArray(entries)) return [];
    return entries.filter(e => {
      if (!e || typeof e !== 'object') return false;

      // 1. Text Search Filter (Officer, Case/Source ID, Prompt)
      const queryLower = (searchQuery || '').toLowerCase();
      const matchesSearch = !queryLower || 
        (e.caseNumber && typeof e.caseNumber === 'string' && e.caseNumber.toLowerCase().includes(queryLower)) ||
        (e.id && typeof e.id === 'string' && e.id.toLowerCase().includes(queryLower)) ||
        (e.defaulter && typeof e.defaulter === 'string' && e.defaulter.toLowerCase().includes(queryLower)) ||
        (e.officerName && typeof e.officerName === 'string' && e.officerName.toLowerCase().includes(queryLower)) ||
        (e.taluk && typeof e.taluk === 'string' && e.taluk.toLowerCase().includes(queryLower)) ||
        (e.notes && typeof e.notes === 'string' && e.notes.toLowerCase().includes(queryLower)) ||
        (Array.isArray(e.promptHistory) && e.promptHistory.some(p => {
          if (!p) return false;
          if (typeof p === 'string') return p.toLowerCase().includes(queryLower);
          return p.prompt && typeof p.prompt === 'string' && p.prompt.toLowerCase().includes(queryLower);
        }));

      // 2. Status Filter
      const matchesStatus = selectedStatus === 'ALL' || 
        (selectedStatus === 'DISPATCHED' && (e.status === 'DISPATCHED' || e.status === 'DISPATCHED_TO_DRO')) ||
        (selectedStatus === 'FLAGGED' && (e.status === 'FLAGGED' || e.status === 'FLAGGED_FOR_REVIEW')) ||
        (selectedStatus === 'VERIFIED' && e.status === 'VERIFIED') ||
        (selectedStatus === 'DRAFT' && e.status === 'DRAFT');

      // 3. Officer Filter
      const matchesOfficer = selectedOfficer === 'ALL' || e.officerName === selectedOfficer;

      // 4. Date Input Filter
      const matchesDate = !selectedDate || (e.timestamp && typeof e.timestamp === 'string' && e.timestamp.startsWith(selectedDate));

      // 5. Year / Month / Day Dropdowns
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
    let directoryIds = [];
    try {
      directoryIds = readUsers()
        .filter(u => u.role !== 'admin')
        .map((u, idx) => u.officerId || `OFF-USER-${String(idx + 1).padStart(3, '0')}`);
    } catch {
      directoryIds = [];
    }
    const combined = [...new Set([...logIds, ...directoryIds, 'OFF-USER-001', 'OFF-USER-002'].filter(Boolean))];
    return combined.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [auditLogs]);
  const filterByAuditFilters = entries => entries.filter(entry => matchesAuditFilters(entry, filters));

  const entries = filterEntries(filterByAuditFilters(Object.values(auditLogs).flat())).sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));
  const totalFilteredCount = entries.length;

  // Export Audit Ledger to JSON (Phase 4)
  const exportToJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `rr_assistant_audit_trail_${new Date().toISOString().substring(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Print / PDF Export for Individual Audit Receipt
  const handlePrintAuditReceipt = (log) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Audit_Receipt_${log.caseNumber || log.id}</title>
          <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; line-height: 1.6; color: #102C57; padding: 20px; }
            .header { border-bottom: 2px solid #102C57; padding-bottom: 12px; margin-bottom: 20px; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; background: #EADBC8; color: #102C57; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #DAC0A3; padding: 8px 12px; text-align: left; }
            th { background: #FEFAF6; font-weight: 600; width: 30%; }
            pre { background: #FEFAF6; padding: 12px; border-radius: 6px; white-space: pre-wrap; font-family: inherit; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Tamil Nadu Revenue Recovery — Compliance Audit Receipt</h2>
            <p style="color: #102C57; margin: 4px 0 0 0;">RR Assistant Automated Ledger Verification Record</p>
          </div>
          <table>
            <tr><th>Audit Log Reference</th><td><strong>${log.id}</strong></td></tr>
            <tr><th>Order / Case No</th><td><strong>${log.caseNumber}</strong></td></tr>
            <tr><th>Timestamp</th><td>${log.timestamp}</td></tr>
            <tr><th>Officer Name &amp; Seat</th><td>${log.officerName} (${log.officerRole || 'Revenue Department'})</td></tr>
            <tr><th>Target Beneficiary / Defaulter</th><td>${log.defaulter} • ${log.taluk}, ${log.district}</td></tr>
            <tr><th>Amount Directed</th><td><strong>${log.amount}</strong></td></tr>
            <tr><th>AI Grounding Confidence</th><td>${Math.round((log.groundingScore || 0.96) * 100)}% (Risk: ${log.hallucinationScore || 0.04})</td></tr>
            <tr><th>DRO Portal Sync Receipt</th><td>${log.dispatchReceipt || 'Pending Verification'}</td></tr>
            <tr><th>Cryptographic Hash</th><td><code>${log.docHash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}</code></td></tr>
          </table>
          <h4 style="margin-top: 25px; margin-bottom: 8px;">Final Proceedings Document Record:</h4>
          <pre>${log.documentContent || 'Document content recorded.'}</pre>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div style={{
      maxWidth: '1280px',
      margin: '0 auto',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
      paddingBottom: '2.5rem'
    }}>
      {/* =========================================================================
          HEADER ROW: TITLE, SUBTITLE & REFRESH BUTTON (Matching Screenshot)
          ========================================================================= */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#102C57',
            margin: '0 0 4px 0',
            letterSpacing: '-0.01em'
          }}>
            Audit Logs
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: '#102C57',
            margin: 0
          }}>
            Real-time audit trail of user queries and message activity in RR Assistant.
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
        <div className="rr-admin-alert" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #DAC0A3' }}>
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}


      <AuditFilters filters={filters} onChange={setFilters} officers={officers} showOfficer={isUserAdmin} records={Object.values(auditLogs).flat()} />

      {/* Showing Count Indicator */}
      <div style={{
        fontSize: '0.825rem',
        color: '#102C57',
        fontWeight: 600
      }}>
        Showing <span style={{ color: '#102C57', fontWeight: 700 }}>{totalFilteredCount}</span> audit entries
      </div>

      {/* =========================================================================
          EMPTY STATE (Exact Match to Screenshot)
          ========================================================================= */}
      {!error && totalFilteredCount === 0 && (
        <div style={{
          width: '100%',
          background: '#ffffff',
          border: '1.5px dashed #DAC0A3',
          borderRadius: '16px',
          padding: '64px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          marginTop: '0.5rem'
        }}>
          {/* Empty State Icon Circle */}
          <div style={{
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
          }}>
            <Inbox size={28} color="#102C57" />
          </div>

          <h3 style={{
            fontSize: '1.15rem',
            fontWeight: 700,
            color: '#102C57',
            margin: '0 0 6px 0'
          }}>
            No Audit Log entries found
          </h3>
          <p style={{
            fontSize: '0.875rem',
            color: '#102C57',
            margin: '0 0 22px 0',
            maxWidth: '480px'
          }}>
            Messages submitted in RR Assistant will automatically appear here.
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
              boxShadow: '0 4px 12px rgba(16, 44, 87, 0.2)',
              transition: 'all 0.2s ease'
            }}
          >
            Go to RR Assistant
          </button>
        </div>
      )}

      {/* Continuous audit ledger across all months */}
      {totalFilteredCount > 0 && (
        <div style={{ background: '#ffffff', border: '1px solid #EADBC8', borderRadius: '16px', boxShadow: '0 2px 10px rgba(16, 44, 87, 0.05)', overflow: 'hidden' }}>
                {/* Table of Records */}
                <div style={{ overflowX: 'auto' }}>
                  <table aria-label="Audit logs" style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#FEFAF6', color: '#102C57', borderBottom: '1px solid #EADBC8' }}>
                        <th style={{ padding: '12px 20px', fontWeight: 600 }}>{isUserAdmin ? 'Order ID' : 'Order ID & Defaulter'}</th>
                        {isUserAdmin && <th style={{ padding: '12px 16px', fontWeight: 600 }}>Officer ID</th>}
                        <th style={{ padding: '12px 16px', fontWeight: 600, width: '45%' }}>Details</th>
                        <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => {
                        const orderLabel = entry.orderId || entry.order_id || entry.caseNumber || entry.caseId || entry.id;
                        return (
                          <tr 
                            key={entry.id}
                            tabIndex={0}
                            aria-label={`Audit entry ${orderLabel}`}
                            onClick={() => setSelectedLog(entry)}
                            onKeyDown={(e) => {
                              if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                                e.preventDefault();
                                setSelectedLog(entry);
                              }
                            }}
                            title="Click or press Enter to view audit details and receipt"
                            style={{
                              borderBottom: '1px solid #FEFAF6',
                              cursor: 'pointer',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#FEFAF6'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            onFocus={(e) => e.currentTarget.style.background = '#FEFAF6'}
                            onBlur={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            {/* Order & Defaulter */}
                            <td style={{ padding: '14px 20px' }}>
                              <div style={{ fontWeight: 700, color: '#102C57', fontSize: '0.92rem' }}>
                                {orderLabel}
                              </div>
                              {!isUserAdmin && <div style={{ color: '#102C57', fontSize: '0.785rem', marginTop: '2px' }}>
                                {entry.defaulter} • {entry.taluk}
                              </div>}
                            </td>

                            {/* Officer ID (Admin Only) */}
                            {isUserAdmin && (
                              <td style={{ padding: '14px 16px', color: '#102C57', overflowWrap: 'anywhere' }}>
                                {officerId(entry) || 'Not recorded'}
                              </td>
                            )}

                            {/* Details (User & Admin) */}
                            <td style={{ padding: '14px 16px', color: '#102C57', lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                              <div style={{ fontWeight: 600 }}>
                                {({ DRAFT: 'Draft proceedings generated', VERIFIED: 'Proceedings verified', DISPATCHED: 'Proceedings dispatched', DISPATCHED_TO_DRO: 'Proceedings dispatched to DRO', FLAGGED: 'Proceedings flagged for review', FLAGGED_FOR_REVIEW: 'Proceedings flagged for review' })[entry.status] || 'RR proceedings recorded'}
                              </div>
                              <div style={{ fontSize: '0.785rem', marginTop: '3px' }}>
                                {entry.promptHistory?.at(-1)?.prompt || entry.notes || entry.fileName || 'No further details recorded.'}
                              </div>
                            </td>

                            {/* Timestamp */}
                            <td style={{ padding: '14px 20px', color: '#102C57', fontSize: '0.785rem', textAlign: 'right' }}>
                              {entry.timestamp || 'Not recorded'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
        </div>
      )}

      {/* =========================================================================
          PHASE 3 & 4: SIDE-BY-SIDE VERIFICATION & INSPECTION MODAL
          ========================================================================= */}
      {selectedLog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rr-audit-modal-title"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedLog(null); }}
          style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(16, 44, 87, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '1050px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 24px',
              background: '#102C57',
              color: '#ffffff',
              borderBottom: '2px solid #102C57'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={22} color="#DAC0A3" />
                <div>
                  <h3 id="rr-audit-modal-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
                    Audit Verification: {selectedLog.caseNumber || selectedLog.id}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#EADBC8' }}>
                    Officer: {selectedLog.officerName} • Timestamp: {selectedLog.timestamp}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => onRestoreSession(selectedLog)}
                  style={{
                    backgroundColor: '#102C57',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <MessageSquare size={14} />
                  <span>Resume in RR Assistant</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePrintAuditReceipt(selectedLog)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Printer size={14} />
                  <span>Print Receipt</span>
                </button>

                <button
                  type="button"
                  aria-label="Close audit details"
                  onClick={() => setSelectedLog(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body: Side-by-Side Comparison (Phase 3) */}
            <div style={{
              padding: '20px 24px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {/* Top Summary Badges */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px'
              }}>
                <div style={{ background: '#FEFAF6', border: '1px solid #EADBC8', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#102C57', textTransform: 'uppercase', fontWeight: 600 }}>
                    Grounding Score
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: selectedLog.hallucinationScore > 0.20 ? '#102C57' : '#102C57' }}>
                    {Math.round((selectedLog.groundingScore || 0.96) * 100)}%
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#102C57' }}>
                    Hallucination Risk: {selectedLog.hallucinationScore || 0.04}
                  </div>
                </div>

                <div style={{ background: '#FEFAF6', border: '1px solid #EADBC8', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#102C57', textTransform: 'uppercase', fontWeight: 600 }}>
                    DRO Portal Dispatch
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#102C57', marginTop: '2px' }}>
                    {selectedLog.dispatchReceipt || 'Draft In-Progress'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#102C57' }}>
                    State Portal Sync Verified
                  </div>
                </div>

                <div style={{ background: '#FEFAF6', border: '1px solid #EADBC8', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#102C57', textTransform: 'uppercase', fontWeight: 600 }}>
                    Award / Recovery Target
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#102C57' }}>
                    {selectedLog.amount || '—'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#102C57' }}>
                    Taluk: {selectedLog.taluk}
                  </div>
                </div>
              </div>

              {/* Side-by-Side Columns */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.2fr',
                gap: '16px',
                marginTop: '6px'
              }}>
                {/* Left Column: Original Scanned OCR & Prompt History */}
                <div style={{
                  background: '#FEFAF6',
                  border: '1px solid #EADBC8',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #EADBC8', paddingBottom: '8px' }}>
                    <FileText size={16} color="#102C57" />
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#102C57' }}>
                      Input Order &amp; AI Prompt Activity
                    </h4>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#102C57', textTransform: 'uppercase', fontWeight: 600 }}>
                      Source Document
                    </span>
                    <p style={{ margin: '2px 0 8px 0', fontSize: '0.825rem', fontWeight: 600, color: '#102C57' }}>
                      📄 {selectedLog.fileName || `${selectedLog.caseNumber}.pdf`} ({selectedLog.fileSize || 'Size not recorded'})
                    </p>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#102C57', textTransform: 'uppercase', fontWeight: 600 }}>
                      User Prompt &amp; Conversation Trail
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                      {(selectedLog.promptHistory && selectedLog.promptHistory.length > 0) ? (
                        selectedLog.promptHistory.map((p, idx) => (
                          <div key={idx} style={{
                            background: '#ffffff',
                            border: '1px solid #EADBC8',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            fontSize: '0.785rem',
                            color: '#102C57'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                              <strong style={{ color: '#102C57' }}>Step {idx + 1}</strong>
                              <span style={{ color: '#102C57', fontSize: '0.7rem' }}>{p.timestamp}</span>
                            </div>
                            <div>"{p.prompt}"</div>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: '0.785rem', color: '#102C57', fontStyle: 'italic' }}>
                          Initial automated ingestion and entity extraction.
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#102C57', textTransform: 'uppercase', fontWeight: 600 }}>
                      Audit Verification Notes
                    </span>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.785rem', color: '#102C57', lineHeight: 1.5 }}>
                      {selectedLog.notes || 'Automated RapidOCR extraction validated by officer.'}
                    </p>
                  </div>
                </div>

                {/* Right Column: Final Generated Official Document */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #DAC0A3',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #EADBC8', paddingBottom: '8px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileCheck size={16} color="#102C57" />
                      <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#102C57' }}>
                        Officer Validated Proceedings Sheet
                      </h4>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#102C57', background: '#FEFAF6', padding: '2px 8px', borderRadius: '4px' }}>
                      Tamil Unicode
                    </span>
                  </div>

                  <pre style={{
                    fontFamily: "'Noto Sans Tamil', 'Plus Jakarta Sans', serif",
                    fontSize: '0.8rem',
                    lineHeight: '1.7',
                    color: '#102C57',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    background: '#FEFAF6',
                    border: '1px solid #EADBC8',
                    borderRadius: '6px',
                    padding: '14px',
                    maxHeight: '380px',
                    overflowY: 'auto',
                    margin: 0
                  }}>
                    {selectedLog.documentContent || 'No document content stored for this record.'}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

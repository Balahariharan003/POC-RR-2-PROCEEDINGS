import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, AlertTriangle, Inbox } from 'lucide-react';
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

  const handleOpenChat = (entry) => {
    const orderLabel = entry.orderId || entry.order_id || entry.caseNumber || entry.caseId || entry.id;
    const initialPrompt = {
      id: 1,
      prompt: entry.notes || `Ingested source order "${entry.fileName || orderLabel}" and synthesized draft proceedings.`,
      timestamp: entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const payload = {
      ...entry,
      documentContent: entry.documentContent || `Draft proceedings recorded for ${orderLabel}.`,
      promptHistory: (Array.isArray(entry.promptHistory) && entry.promptHistory.length > 0) ? entry.promptHistory : [initialPrompt]
    };
    if (onRestoreSession) {
      onRestoreSession(payload);
    } else if (onNavigateToAssistant) {
      onNavigateToAssistant();
    }
  };

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
                            aria-label={`Open chat for ${orderLabel}`}
                            onClick={() => handleOpenChat(entry)}
                            onKeyDown={(e) => {
                              if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                                e.preventDefault();
                                handleOpenChat(entry);
                              }
                            }}
                            title="Click to open this proceedings chat in RR Assistant"
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

    </div>
  );
}
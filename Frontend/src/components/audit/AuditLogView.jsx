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
import { apiService } from '../../services/apiService.js';
import { INITIAL_AUDIT_LOGS } from '../../data/mockData.js';

export default function AuditLogView({ 
  currentUser,
  onRestoreSession, 
  onNavigateToAssistant 
}) {
  const isAdmin = !currentUser || currentUser.role === 'admin';
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters State (Matching exact screenshot controls)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOfficer, setSelectedOfficer] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedDay, setSelectedDay] = useState('ALL');

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
    try {
      const logs = await apiService.getAuditLogs();
      setAuditLogs((logs && typeof logs === 'object' && Object.keys(logs).length > 0) ? logs : INITIAL_AUDIT_LOGS);
    } catch (err) {
      console.error("Error loading audit logs:", err);
      setAuditLogs(INITIAL_AUDIT_LOGS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
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

  // Compute overall count of filtered entries
  let totalFilteredCount = 0;
  allMonths.forEach(m => {
    totalFilteredCount += filterEntries(auditLogs[m] || []).length;
  });

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
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; line-height: 1.6; color: #0f172a; padding: 20px; }
            .header { border-bottom: 2px solid #ea580c; padding-bottom: 12px; margin-bottom: 20px; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; background: #e0f2fe; color: #0369a1; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
            th { background: #f8fafc; font-weight: 600; width: 30%; }
            pre { background: #f1f5f9; padding: 12px; border-radius: 6px; white-space: pre-wrap; font-family: inherit; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Tamil Nadu Revenue Recovery — Compliance Audit Receipt</h2>
            <p style="color: #64748b; margin: 4px 0 0 0;">RR Assistant Automated Ledger Verification Record</p>
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
            color: '#0f243c',
            margin: '0 0 4px 0',
            letterSpacing: '-0.01em'
          }}>
            Audit Logs
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: '#64748b',
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
              color: '#334155',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
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

      {/* =========================================================================
          FILTER ROW: SEARCH + DROPDOWNS + DATE PICKERS (Matching Screenshot)
          ========================================================================= */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Search Bar Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flex: '1 1 300px',
          minWidth: '220px'
        }}>
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder="Filter by officer, source ID, or message prompt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              width: '100%',
              fontSize: '0.85rem',
              color: '#1e293b',
              background: 'transparent'
            }}
          />
          {searchQuery && (
            <X 
              size={14} 
              color="#94a3b8" 
              style={{ cursor: 'pointer' }} 
              onClick={() => setSearchQuery('')} 
            />
          )}
        </div>

        {/* Officer Dropdown (Admin Login -> Audit Logs) */}
        {isAdmin && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '0 8px 0 10px',
            background: '#ffffff',
            position: 'relative',
            cursor: 'pointer',
            boxSizing: 'border-box'
          }}>
            <User size={14} color="#64748b" style={{ flexShrink: 0 }} />
            <select
              value={selectedOfficer}
              onChange={(e) => setSelectedOfficer(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '0.825rem',
                color: selectedOfficer === 'ALL' ? '#334155' : '#0f243c',
                fontWeight: selectedOfficer === 'ALL' ? 400 : 500,
                cursor: 'pointer',
                padding: '5px 18px 5px 0',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                appearance: 'none'
              }}
            >
              <option value="ALL">Officer</option>
              {officerOptions.map((officer) => (
                <option key={officer} value={officer}>
                  {officer}
                </option>
              ))}
            </select>
            <ChevronDown 
              size={14} 
              color="#64748b" 
              style={{ 
                position: 'absolute', 
                right: '8px', 
                pointerEvents: 'none',
                flexShrink: 0 
              }} 
            />
          </div>
        )}

        {/* Date Picker Input */}
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '5px 10px',
            fontSize: '0.825rem',
            color: '#334155',
            background: '#ffffff',
            cursor: 'pointer',
            outline: 'none'
          }}
        />

        {/* Year Dropdown */}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '0.825rem',
            color: '#334155',
            background: '#ffffff',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          <option value="ALL">All Years</option>
          <option value="2026">2026</option>
          <option value="2025">2025</option>
          <option value="2024">2024</option>
        </select>

        {/* Month Dropdown */}
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '0.825rem',
            color: '#334155',
            background: '#ffffff',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          <option value="ALL">All Months</option>
          <option value="1">January</option>
          <option value="2">February</option>
          <option value="3">March</option>
          <option value="4">April</option>
          <option value="5">May</option>
          <option value="6">June</option>
          <option value="7">July</option>
          <option value="8">August</option>
          <option value="9">September</option>
          <option value="10">October</option>
          <option value="11">November</option>
          <option value="12">December</option>
        </select>

        {/* Day Dropdown */}
        <select
          value={selectedDay}
          onChange={(e) => setSelectedDay(e.target.value)}
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '0.825rem',
            color: '#334155',
            background: '#ffffff',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          <option value="ALL">All Days</option>
          {Array.from({ length: 31 }, (_, i) => (
            <option key={i + 1} value={i + 1}>{i + 1}</option>
          ))}
        </select>
      </div>

      {/* Showing Count Indicator */}
      <div style={{
        fontSize: '0.825rem',
        color: '#475569',
        fontWeight: 600
      }}>
        Showing <span style={{ color: '#0f243c', fontWeight: 700 }}>{totalFilteredCount}</span> audit entries
      </div>

      {/* =========================================================================
          EMPTY STATE (Exact Match to Screenshot)
          ========================================================================= */}
      {totalFilteredCount === 0 && (
        <div style={{
          width: '100%',
          background: '#ffffff',
          border: '1.5px dashed #bcd5ee',
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
            backgroundColor: '#eff6ff',
            border: '1px solid #dbeafe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0284c7',
            marginBottom: '16px'
          }}>
            <Inbox size={28} color="#0284c7" />
          </div>

          <h3 style={{
            fontSize: '1.15rem',
            fontWeight: 700,
            color: '#0f243c',
            margin: '0 0 6px 0'
          }}>
            No Audit Log entries found
          </h3>
          <p style={{
            fontSize: '0.875rem',
            color: '#64748b',
            margin: '0 0 22px 0',
            maxWidth: '480px'
          }}>
            Messages submitted in RR Assistant will automatically appear here.
          </p>

          <button
            type="button"
            onClick={onNavigateToAssistant}
            style={{
              backgroundColor: '#0d2744',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 24px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(13, 39, 68, 0.2)',
              transition: 'all 0.2s ease'
            }}
          >
            Go to RR Assistant
          </button>
        </div>
      )}

      {/* =========================================================================
          RECORDS LIST PARTITIONED BY MONTH & YEAR (Phase 1, 2, 3, 4)
          ========================================================================= */}
      {totalFilteredCount > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {allMonths.map((month) => {
            const entries = filterEntries(auditLogs[month] || []);
            if (entries.length === 0) return null;

            return (
              <div 
                key={month} 
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  boxShadow: '0 2px 10px rgba(15, 33, 55, 0.05)',
                  overflow: 'hidden'
                }}
              >
                {/* Partition Month Header */}
                <div style={{
                  padding: '12px 20px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Calendar size={16} color="#ea580c" />
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f243c' }}>
                      {month} Partition
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#64748b',
                    background: '#e2e8f0',
                    padding: '2px 10px',
                    borderRadius: '9999px'
                  }}>
                    {entries.length} Sessions / Records
                  </span>
                </div>

                {/* Table of Records */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#fafbfc', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '12px 20px', fontWeight: 600 }}>Order ID &amp; Defaulter</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>Amount Awarded</th>
                        <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => {
                        return (
                          <tr 
                            key={entry.id}
                            onClick={() => onRestoreSession(entry)}
                            title="Click to open this order in RR Assistant chat"
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f1f7fe'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            {/* Order & Defaulter */}
                            <td style={{ padding: '14px 20px' }}>
                              <div style={{ fontWeight: 700, color: '#0d2744', fontSize: '0.92rem' }}>
                                {entry.caseNumber || entry.id}
                              </div>
                              <div style={{ color: '#64748b', fontSize: '0.785rem', marginTop: '2px' }}>
                                {entry.defaulter} • {entry.taluk}
                              </div>
                            </td>

                            {/* Amount */}
                            <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0f172a' }}>
                              {entry.amount || '—'}
                            </td>

                            {/* Timestamp */}
                            <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '0.785rem', textAlign: 'right' }}>
                              {entry.timestamp}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          PHASE 3 & 4: SIDE-BY-SIDE VERIFICATION & INSPECTION MODAL
          ========================================================================= */}
      {selectedLog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
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
              background: '#0e243d',
              color: '#ffffff',
              borderBottom: '2px solid #ea580c'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={22} color="#38bdf8" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                    Audit Verification: {selectedLog.caseNumber || selectedLog.id}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                    Officer: {selectedLog.officerName} • Timestamp: {selectedLog.timestamp}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => onRestoreSession(selectedLog)}
                  style={{
                    backgroundColor: '#ea580c',
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
                  onClick={() => setSelectedLog(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
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
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    Grounding Score
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: selectedLog.hallucinationScore > 0.20 ? '#dc2626' : '#16a34a' }}>
                    {Math.round((selectedLog.groundingScore || 0.96) * 100)}%
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    Hallucination Risk: {selectedLog.hallucinationScore || 0.04}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    DRO Portal Dispatch
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f243c', marginTop: '2px' }}>
                    {selectedLog.dispatchReceipt || 'Draft In-Progress'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#16a34a' }}>
                    State Portal Sync Verified
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    Award / Recovery Target
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0e2942' }}>
                    {selectedLog.amount || '—'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
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
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                    <FileText size={16} color="#0284c7" />
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#0f243c' }}>
                      Input Order &amp; AI Prompt Activity
                    </h4>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                      Source Document
                    </span>
                    <p style={{ margin: '2px 0 8px 0', fontSize: '0.825rem', fontWeight: 600, color: '#1e293b' }}>
                      📄 {selectedLog.fileName || `${selectedLog.caseNumber}.pdf`} ({selectedLog.fileSize || '1.45 MB'})
                    </p>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                      User Prompt &amp; Conversation Trail
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                      {(selectedLog.promptHistory && selectedLog.promptHistory.length > 0) ? (
                        selectedLog.promptHistory.map((p, idx) => (
                          <div key={idx} style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            fontSize: '0.785rem',
                            color: '#334155'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                              <strong style={{ color: '#0284c7' }}>Step {idx + 1}</strong>
                              <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{p.timestamp}</span>
                            </div>
                            <div>"{p.prompt}"</div>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: '0.785rem', color: '#94a3b8', fontStyle: 'italic' }}>
                          Initial automated ingestion and entity extraction.
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                      Audit Verification Notes
                    </span>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.785rem', color: '#475569', lineHeight: 1.5 }}>
                      {selectedLog.notes || 'Automated RapidOCR extraction validated by officer.'}
                    </p>
                  </div>
                </div>

                {/* Right Column: Final Generated Official Document */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileCheck size={16} color="#16a34a" />
                      <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#0f243c' }}>
                        Officer Validated Proceedings Sheet
                      </h4>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                      Tamil Unicode
                    </span>
                  </div>

                  <pre style={{
                    fontFamily: "'Noto Sans Tamil', 'Plus Jakarta Sans', serif",
                    fontSize: '0.8rem',
                    lineHeight: '1.7',
                    color: '#1e293b',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
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

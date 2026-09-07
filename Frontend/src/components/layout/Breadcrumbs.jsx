import React from 'react';
import { ChevronRight, Home, Building2, FileText, CheckCircle } from 'lucide-react';

export default function Breadcrumbs({ 
  district = "ஈரோடு (Erode)", 
  taluk = "கொடுமுடி (Kodumudi)", 
  caseNumber = "MCOP-225/2022",
  activeView,
  setActiveView
}) {
  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.785rem',
      color: '#64748b',
      padding: '0.65rem 1.5rem',
      borderBottom: '1px solid #e2e8f0',
      background: '#eef4fa'
    }}>
      <div 
        onClick={() => setActiveView('rrAssistant')}
        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'var(--text-muted)' }}
      >
        <Home size={14} />
        <span>RR Assistant</span>
      </div>

      <ChevronRight size={13} color="var(--border-card)" />

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <Building2 size={14} />
        <span>{district}</span>
      </div>

      <ChevronRight size={13} color="var(--border-card)" />

      <span>{taluk}</span>

      {caseNumber && (
        <>
          <ChevronRight size={13} color="var(--border-card)" />
          <div 
            onClick={() => setActiveView('workspace')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.35rem', 
              color: '#38bdf8', 
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <FileText size={14} />
            <span>{caseNumber}</span>
          </div>
        </>
      )}

      {activeView === 'audit' && (
        <>
          <ChevronRight size={13} color="var(--border-card)" />
          <span style={{ color: '#a855f7', fontWeight: '600' }}>Compliance & Audit Logs</span>
        </>
      )}

      {activeView === 'droQueue' && (
        <>
          <ChevronRight size={13} color="var(--border-card)" />
          <span style={{ color: '#10b981', fontWeight: '600' }}>DRO State Portal Dispatch</span>
        </>
      )}
    </nav>
  );
}

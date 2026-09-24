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
      color: '#102C57',
      padding: '0.65rem 1.5rem',
      borderBottom: '1px solid #EADBC8',
      background: '#FEFAF6'
    }}>
      <div 
        onClick={() => setActiveView('rrAssistant')}
        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: '#102C57', fontWeight: 600 }}
      >
        <Home size={14} color="#102C57" />
        <span>RR Assistant</span>
      </div>

      <ChevronRight size={13} color="#DAC0A3" />

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#102C57' }}>
        <Building2 size={14} color="#102C57" />
        <span>{district}</span>
      </div>

      <ChevronRight size={13} color="#DAC0A3" />

      <span style={{ color: '#102C57' }}>{taluk}</span>

      {caseNumber && (
        <>
          <ChevronRight size={13} color="#DAC0A3" />
          <div 
            onClick={() => setActiveView('workspace')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.35rem', 
              color: '#102C57', 
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            <FileText size={14} color="#102C57" />
            <span>{caseNumber}</span>
          </div>
        </>
      )}

      {activeView === 'audit' && (
        <>
          <ChevronRight size={13} color="#DAC0A3" />
          <span style={{ color: '#102C57', fontWeight: '700' }}>Compliance & Audit Logs</span>
        </>
      )}

      {activeView === 'droQueue' && (
        <>
          <ChevronRight size={13} color="#DAC0A3" />
          <span style={{ color: '#102C57', fontWeight: '700' }}>DRO State Portal Dispatch</span>
        </>
      )}
    </nav>
  );
}

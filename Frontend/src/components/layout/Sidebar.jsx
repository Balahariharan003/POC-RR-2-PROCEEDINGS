import React from 'react';
import { 
  FileText, 
  History, 
  LayoutDashboard,
  Users,
  DatabaseBackup,
  ChevronLeft, 
  ChevronRight, 
  FileSearch,
  Send
} from 'lucide-react';

export default function Sidebar({ 
  isAdmin = false,
  activeView, 
  setActiveView, 
  isCollapsed, 
  setIsCollapsed,
  recentPetitions = [],
  onSelectRecent,
  mobileOpen = false,
  setMobileOpen
}) {
  const isRRActive = activeView === 'rrAssistant' || activeView === 'upload';
  const isInspectionActive = activeView === 'workspace';
  const isAuditActive = activeView === 'audit' || activeView === 'droQueue';

  const showLabels = !isCollapsed || mobileOpen;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen && setMobileOpen(false)}
          className="mobile-sidebar-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(16, 44, 87, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 48
          }}
        />
      )}

      <aside className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''} ${isCollapsed && !mobileOpen ? 'collapsed' : ''}`} style={{
        width: (isCollapsed && !mobileOpen) ? '64px' : '216px',
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), left 0.3s ease',
        backgroundColor: '#102C57',
        borderRight: '1px solid rgba(234, 219, 200, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: (isCollapsed && !mobileOpen) ? '1rem 0.5rem' : '1.25rem 0',
        height: 'calc(100vh - 64px)',
        position: 'sticky',
        top: '64px',
        flexShrink: 0,
        zIndex: 50
      }}>
        {/* Top Sidebar Menu */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: (isCollapsed && !mobileOpen) ? '0' : '0 0.75rem' }}>
          {isAdmin && [
            ['adminDashboard', 'Dashboard', LayoutDashboard],
            ['adminUsers', 'User Management', Users],
            ['adminBackup', 'Backup', DatabaseBackup]
          ].map(([view, label, Icon]) => (
            <button key={view} type="button" title={label} aria-label={label} aria-current={activeView === view ? 'page' : undefined} className={`rr-admin-nav ${activeView === view ? 'active' : ''}`} onClick={() => {
              setActiveView(view);
              if (mobileOpen && setMobileOpen) setMobileOpen(false);
            }}><Icon size={19} style={{ flexShrink: 0 }} />{showLabels && <span>{label}</span>}</button>
          ))}
          {/* Primary RR Assistant Item */}
          <div
            onClick={() => {
              setActiveView('rrAssistant');
              if (mobileOpen && setMobileOpen) setMobileOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: showLabels ? '0.75rem 1rem' : '0.75rem 0',
              justifyContent: showLabels ? 'flex-start' : 'center',
              borderRadius: '6px',
              backgroundColor: isRRActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              borderLeft: isRRActive ? '3px solid #DAC0A3' : '3px solid transparent',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            title={!showLabels ? "RR Assistant" : undefined}
          >
            <div style={{ color: isRRActive ? '#DAC0A3' : '#EADBC8' }}>
              <FileText size={20} />
            </div>
            {showLabels && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>
                  RR Assistant
                </span>
                <span style={{ fontSize: '0.7rem', color: '#DAC0A3', marginTop: '1px' }}>
                  Revenue Recovery Proceedings
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Sidebar Menu */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          padding: (isCollapsed && !mobileOpen) ? '0' : '0 0.75rem',
          borderTop: '1px solid rgba(234, 219, 200, 0.15)',
          paddingTop: '0.75rem'
        }}>
          {/* Audit Logs */}
          <div
            onClick={() => {
              setActiveView('audit');
              if (mobileOpen && setMobileOpen) setMobileOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: showLabels ? '0.6rem 1rem' : '0.6rem 0',
              justifyContent: showLabels ? 'flex-start' : 'center',
              borderRadius: '6px',
              color: isAuditActive ? '#ffffff' : '#EADBC8',
              backgroundColor: isAuditActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500
            }}
            title={!showLabels ? "Audit Logs" : undefined}
          >
            <History size={18} />
            {showLabels && <span>Audit Logs</span>}
          </div>

          {/* Collapse / Close Menu Button */}
          <div
            onClick={() => {
              if (mobileOpen && setMobileOpen) {
                setMobileOpen(false);
              } else {
                setIsCollapsed(!isCollapsed);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: showLabels ? '0.6rem 1rem' : '0.6rem 0',
              justifyContent: showLabels ? 'flex-start' : 'center',
              borderRadius: '6px',
              color: '#EADBC8',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500
            }}
            title={mobileOpen ? "Close Menu" : (isCollapsed ? "Expand" : "Collapse")}
          >
            {mobileOpen ? (
              <>
                <ChevronLeft size={18} />
                <span>Close Menu</span>
              </>
            ) : (
              <>
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                {!isCollapsed && <span>Collapse</span>}
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

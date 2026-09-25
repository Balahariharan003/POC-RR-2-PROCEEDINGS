import AdminNotifications from './AdminNotifications.jsx';
import React, { useState, useEffect } from 'react';
import { 
  Languages,
  User, 
  ChevronDown, 
  ChevronUp, 
  LogOut, 
  ShieldCheck, 
  FileText,
  Menu,
  X
} from 'lucide-react';

export default function AppHeader({ 
  currentLanguage = 'en', 
  setLanguage, 
  theme = 'dark', 
  setTheme, 
  backendStatus,
  currentCaseNumber,
  activeView,
  setActiveView,
  mobileMenuOpen,
  setMobileMenuOpen,
  currentUser,
  onLogout
}) {
  const [profileOpen, setProfileOpen] = useState(false);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.user-profile-badge')) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const isTamil = currentLanguage === 'ta';

  return (
    <>
    <header className="topbar">
      {/* Topbar Left: Hamburger + Emblem & Title Group */}
      <div className="topbar-left">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          className="mobile-hamburger-btn"
          onClick={() => setMobileMenuOpen && setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <img 
          src="/assets/tn_emblem.svg" 
          alt="Tamil Nadu Government Emblem" 
          className="emblem-logo"
        />
        <div className="topbar-title-group">
          <span className="topbar-title">
            <span className="topbar-title-full">RR Assistant</span>
            <span className="topbar-title-short">RR Assistant</span>
          </span>
          <span className="topbar-subtitle" style={{ color: 'var(--soft-sand, #EADBC8)' }}>
            {isTamil 
              ? 'வருவாய் வசூல் செயல்முறைகள் (Revenue Recovery Proceedings)'
              : 'Revenue Recovery Proceedings'}
          </span>
        </div>
      </div>

      {/* Topbar Right: Language Switcher & Officer Profile Menu */}
      <div className="topbar-right">
        {currentUser?.role === 'admin' && <AdminNotifications key={currentUser.id} user={currentUser} onViewActivity={() => { setActiveView('adminDashboard'); setProfileOpen(false); }} />}
        {/* Language Switcher */}
        <div className="lang-switch">
          <button 
            type="button"
            className={`lang-btn ${currentLanguage === 'en' ? 'active' : ''}`}
            aria-label="Switch to English"
            title="English"
            aria-pressed={currentLanguage === 'en'}
            onClick={() => setLanguage('en')}
          >
            {currentLanguage === 'en' ? 'English' : <Languages size={18} aria-hidden="true" />}
          </button>
          <button 
            type="button"
            className={`lang-btn ${currentLanguage === 'ta' ? 'active' : ''}`}
            aria-label="Switch to Tamil"
            title="Tamil"
            aria-pressed={currentLanguage === 'ta'}
            onClick={() => setLanguage('ta')}
          >
            {currentLanguage === 'ta' ? 'தமிழ்' : <Languages size={18} aria-hidden="true" />}
          </button>
        </div>

        {/* Officer Profile Badge */}
        <div className="user-profile-badge" onKeyDown={(e) => { if (e.key === 'Escape') setProfileOpen(false); }}>
          <button type="button" className="user-pill" aria-label="Officer profile menu" aria-expanded={profileOpen} onClick={() => setProfileOpen(!profileOpen)} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit' }}>
            <div className="avatar-circle">
              <User size={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
              <span className="user-name" style={{ color: '#FFFFFF', fontWeight: 600, fontSize: '0.825rem' }}>
                {currentUser?.name || 'Officer'}
              </span>
              <span style={{ color: 'var(--soft-sand, #EADBC8)', fontSize: '0.685rem', fontWeight: 400 }}>
                {currentUser?.role === 'admin' ? 'Admin' : 'User'}
              </span>
            </div>
            <span className="user-chevron" style={{ color: 'var(--soft-sand, #EADBC8)', fontSize: '0.65rem', marginLeft: '3px' }}>
              {profileOpen ? '▲' : '▼'}
            </span>
          </button>

          {/* User Profile Dropdown Card */}
          {profileOpen && (
            <div className="user-dropdown show">
              <div className="dropdown-header">
                <div className="dropdown-avatar">
                  <User size={24} />
                </div>
                <div className="dropdown-info">
                  <h4>{currentUser?.name || 'Officer'}</h4>
                  <p>{currentUser?.section || currentUser?.taluk || (currentUser?.role === 'admin' ? 'Administrator' : 'Officer')}</p>
                  <span className="dropdown-dept">Revenue &amp; Disaster Management</span>
                </div>
              </div>

              <div className="dropdown-divider"></div>

              <div 
                className="dropdown-item"
                onClick={(e) => {
                  e.stopPropagation();
                  setProfileOpen(false);
                  if (setActiveView) setActiveView('profile');
                }}
                style={{ cursor: 'pointer' }}
              >
                <User size={16} />
                <span>Officer Profile</span>
              </div>

              <button type="button"
                className="dropdown-item signout"
                onClick={(e) => {
                  e.stopPropagation();
                  setProfileOpen(false);
                  if (onLogout) onLogout();
                }}
                style={{ cursor: 'pointer' }}
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
    </>
  );
}


import React, { useState, useEffect } from 'react';
import { 
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
  setMobileMenuOpen
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
            <span className="topbar-title-full">AI Administrative Co-Pilot</span>
            <span className="topbar-title-short">AI Co-Pilot</span>
          </span>
          <span className="topbar-subtitle">
            {isTamil 
              ? 'அரசு குறைதீர்ப்பு முன்-செயலாக்கம் (Government Grievance Pre-Processing)'
              : 'Government Grievance Pre-Processing'}
          </span>
        </div>
      </div>

      {/* Topbar Right: Language Switcher & Officer Profile Menu */}
      <div className="topbar-right">
        {/* Language Switcher */}
        <div className="lang-switch">
          <button 
            type="button"
            className={`lang-btn ${currentLanguage === 'en' ? 'active' : ''}`}
            onClick={() => setLanguage('en')}
          >
            English
          </button>
          <button 
            type="button"
            className={`lang-btn ${currentLanguage === 'ta' ? 'active' : ''}`}
            onClick={() => setLanguage('ta')}
          >
            தமிழ்
          </button>
        </div>

        {/* Officer Profile Badge */}
        <div 
          className="user-profile-badge" 
          onClick={() => setProfileOpen(!profileOpen)}
        >
          <div className="user-pill">
            <div className="avatar-circle">
              <User size={17} />
            </div>
            <span className="user-name">S. Ramanathan</span>
            <span className="user-chevron">
              {profileOpen ? '▲' : '▼'}
            </span>
          </div>

          {/* User Profile Dropdown Card */}
          {profileOpen && (
            <div className="user-dropdown show">
              <div className="dropdown-header">
                <div className="dropdown-avatar">
                  <User size={24} />
                </div>
                <div className="dropdown-info">
                  <h4>S. Ramanathan</h4>
                  <p>Tahsildar • Grievance Cell</p>
                  <span className="dropdown-dept">Revenue &amp; Disaster Management</span>
                </div>
              </div>

              <div className="dropdown-divider"></div>

              <div className="dropdown-item">
                <User size={16} />
                <span>Officer Profile</span>
              </div>

              <div className="dropdown-item signout">
                <LogOut size={16} />
                <span>Sign Out</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}


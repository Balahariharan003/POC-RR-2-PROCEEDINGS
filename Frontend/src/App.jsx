import React, { useEffect, useState } from 'react';
import AppHeader from './components/layout/AppHeader.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import LoginPage from './components/auth/LoginPage.jsx';
import RRAssistantView from './components/workspace/RRAssistantView.jsx';
import AuditLogView from './components/audit/AuditLogView.jsx';
import AdminWorkspace from './components/admin/AdminWorkspace.jsx';
import OfficialProfile from './components/profile/OfficialProfile.jsx';
import { apiService } from './services/apiService.js';
import { recordActivity, setActivityActor } from './services/activityStore.js';
import { APP_CONFIG, STORAGE_KEYS } from './config/appConfig.js';

const readPreferences = () => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEYS.preferences) || 'null');
    return {
      language: value?.language === 'ta' ? 'ta' : APP_CONFIG.defaults.language,
      theme: value?.theme === 'dark' ? 'dark' : APP_CONFIG.defaults.theme,
    };
  } catch {
    return { language: APP_CONFIG.defaults.language, theme: APP_CONFIG.defaults.theme };
  }
};

export default function App() {
  const initialPreferences = readPreferences();
  const [currentUser, setCurrentUser] = useState(null);
  const [activeView, setActiveView] = useState('rrAssistant');
  const [currentLanguage, setLanguage] = useState(initialPreferences.language);
  const [theme, setTheme] = useState(initialPreferences.theme);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [backendStatus, setBackendStatus] = useState({ status: 'checking' });
  const [activeSession, setActiveSession] = useState(null);
  const [auditLogs, setAuditLogs] = useState({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const refreshAuditLogs = async () => {
    try {
      setAuditLogs(await apiService.getAuditLogs());
    } catch (error) {
      console.warn('Unable to load saved audit logs:', error);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    apiService.checkHealth().then(setBackendStatus);
  }, [theme]);

  useEffect(() => {
    refreshAuditLogs();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    try {
      localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify({ language: currentLanguage, theme }));
    } catch (error) {
      console.warn('Could not save preferences:', error);
    }
  }, [currentLanguage, theme, currentUser]);

  const handleRestoreSession = (session) => {
    setActiveSession(session);
    setActiveView('rrAssistant');
    setMobileMenuOpen(false);
  };

  const handleLogin = (user) => {
    setActivityActor(user);
    recordActivity('Signed in', { username: user?.username || user?.email }, user);
    setCurrentUser(user);
    setActiveSession(null);
    setActiveView(user.role === 'admin' || user.role === 'SUPER_ADMIN' ? 'adminDashboard' : 'rrAssistant');
    setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    recordActivity('Signed out', { username: currentUser?.username }, currentUser);
    await apiService.logout();
    setActivityActor(null);
    setCurrentUser(null);
    setActiveSession(null);
  };

  if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'SUPER_ADMIN';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
        backgroundColor: '#FEFAF6',
      }}
    >
      <AppHeader
        currentLanguage={currentLanguage}
        setLanguage={setLanguage}
        theme={theme}
        setTheme={setTheme}
        backendStatus={backendStatus}
        activeView={activeView}
        setActiveView={setActiveView}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <div
        style={{
          display: 'flex',
          flex: 1,
          height: 'calc(100vh - 64px)',
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Sidebar
          isAdmin={isAdmin}
          activeView={activeView}
          setActiveView={(view) => {
            setActiveView(view);
            setMobileMenuOpen(false);
          }}
          isCollapsed={sidebarCollapsed}
          setIsCollapsed={setSidebarCollapsed}
          mobileOpen={mobileMenuOpen}
          setMobileOpen={setMobileMenuOpen}
          onSelectRecent={(caseNumber) => {
            const record = Object.values(auditLogs)
              .flat()
              .find((row) => row.caseNumber === caseNumber);
            if (record) handleRestoreSession(record);
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minWidth: 0,
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <main
            className="main-work-area"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              padding: '1.25rem',
            }}
          >
            {isAdmin && ['adminDashboard', 'adminUsers', 'adminBackup', 'adminTemplates'].includes(activeView) && (
              <AdminWorkspace
                key={activeView}
                view={activeView}
                currentUser={currentUser}
                onNavigate={setActiveView}
                onUserUpdated={setCurrentUser}
                onRestored={() => {
                  setActivityActor(null);
                  setCurrentUser(null);
                  setActiveSession(null);
                  setActiveView('rrAssistant');
                }}
              />
            )}

            {activeView === 'profile' && (
              <OfficialProfile currentUser={currentUser} onUserUpdated={setCurrentUser} />
            )}

            {activeView === 'rrAssistant' && (
              <RRAssistantView
                currentUser={currentUser}
                currentLanguage={currentLanguage}
                activeSession={activeSession}
                onSaveAuditLog={refreshAuditLogs}
              />
            )}

            {(activeView === 'audit' || activeView === 'droQueue') && (
              <AuditLogView
                currentUser={currentUser}
                isAdmin={isAdmin}
                onRestoreSession={handleRestoreSession}
                onNavigateToAssistant={() => {
                  setActiveSession(null);
                  setActiveView('rrAssistant');
                }}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

import { recordActivity, setActivityActor } from './services/activityStore.js';
import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

import AppHeader from './components/layout/AppHeader.jsx';
import MyProfile from './components/layout/MyProfile.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import { ProceedingsPreviewModal, DroReceiptModal } from './components/layout/Modals.jsx';

import UploadLanding from './components/upload/UploadLanding.jsx';
import ProcessingOverlay from './components/upload/ProcessingOverlay.jsx';
import MobileQrModal from './components/upload/MobileQrModal.jsx';
import LoginPage from './components/auth/LoginPage.jsx';
import MobileCapturePage from './components/mobile/MobileCapturePage';
import DocumentEditorPreview from './components/workspace/DocumentEditorPreview.jsx';
import DocumentViewer from './components/workspace/DocumentViewer.jsx';
import FullDetailsForm from './components/workspace/FullDetailsForm.jsx';
import SummaryChatView from './components/workspace/SummaryChatView.jsx';
import RRAssistantView from './components/workspace/RRAssistantView.jsx';

import AuditLogView from './components/audit/AuditLogView.jsx';
import AdminWorkspace from './components/admin/AdminWorkspace.jsx';
import OfficialProfile from './components/profile/OfficialProfile.jsx';
import { readUsers, saveUsers } from './services/adminStore.js';

import { apiService } from './services/apiService.js';
import { DEFAULT_ENTITIES, DEFAULT_VALIDATION } from './data/schemas.js';


export default function App() {
  // Top-Level State Machine
  const [currentUser, setCurrentUser] = useState(null); // null shows LoginPage; { role, email, name } shows app
  const [activeView, setActiveView] = useState('rrAssistant'); // 'rrAssistant' | 'workspace' | 'audit' | 'droQueue'
  const [workspaceMode, setWorkspaceMode] = useState('editor'); // 'editor' (Matching Screenshots) | 'inspection' (Side-by-side OCR & Form)
  const [currentLanguage, setLanguage] = useState('en');
  const [theme, setTheme] = useState('dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [backendStatus, setBackendStatus] = useState({ status: 'checking' });

  // Ingestion & Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingFileName, setProcessingFileName] = useState('');
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Document & Extracted Entities
  const [currentEntities, setCurrentEntities] = useState(DEFAULT_ENTITIES);
  const [validationInsights, setValidationInsights] = useState(DEFAULT_VALIDATION);
  const [currentDocxFilename, setCurrentDocxFilename] = useState('');
  const [rawOcrText, setRawOcrText] = useState('');
  const [boundingBoxes, setBoundingBoxes] = useState([]);

  // Editable Document Content & Subject (Matching Screenshots 1 & 2)
  const [subjectText, setSubjectText] = useState('');
  const [documentContent, setDocumentContent] = useState('');

  // Cross-Component Interaction
  const [activeHighlightId, setActiveHighlightId] = useState(null);
  const [highlightedField, setHighlightedField] = useState(null);

  // Modals
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [droReceiptData, setDroReceiptData] = useState(null);
  const [isMobileQrModalOpen, setIsMobileQrModalOpen] = useState(false);

  // Active Restored Session & Audit Logs
  const [activeSession, setActiveSession] = useState(null);
  const [auditLogs, setAuditLogs] = useState({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Handle restoring a session from Audit Logs (ChatGPT / Gemini style)
  const handleRestoreSession = (session) => {
    setActiveSession(session);
    setActiveView('rrAssistant');
    setMobileMenuOpen(false);
  };

  // Initialize document sheet text
  useEffect(() => {
    const formatted = apiService.formatDocumentSheet(currentEntities, subjectText);
    setDocumentContent(formatted);
  }, []);

  // Check Backend Health on Mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const checkApi = async () => {
      const health = await apiService.checkHealth();
      setBackendStatus(health);
    };
    checkApi();
  }, [theme]);

  useEffect(() => {
    apiService.getAuditLogs().then(setAuditLogs).catch(error => console.warn('Unable to load saved audit logs:', error));
    try {
      const preferences = JSON.parse(localStorage.getItem('rr_preferences') || 'null');
      if (preferences) {
        setLanguage(preferences.language === 'ta' ? 'ta' : 'en');
        setTheme(preferences.theme === 'light' ? 'light' : 'dark');
      }
    } catch (error) { console.warn('Could not load preferences:', error); }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    try { localStorage.setItem('rr_preferences', JSON.stringify({ language: currentLanguage, theme })); }
    catch (error) { console.warn('Could not save preferences:', error); }
  }, [currentLanguage, theme, currentUser]);

  // Handle Document Ingestion (Upload Dropzone strictly for PDF / DOCX)
  const handleFileUpload = async (file) => {
    setProcessingFileName(file.name);
    setIsProcessing(true);

    try {
      const result = await apiService.uploadDocument(file);
      applyPipelineResult(result);
    } catch (err) {
      alert("Pipeline error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Sample MCOP Order Click or Mobile Petition Upload
  const handleLoadSample = async (uploadedDoc) => {
    const incomingFileName = (uploadedDoc && (uploadedDoc.fileName || uploadedDoc.name)) 
      ? (uploadedDoc.fileName || uploadedDoc.name) 
      : "sample_mcop_order.pdf";

    setProcessingFileName(incomingFileName);
    setIsProcessing(true);

    try {
      let result;
      if (uploadedDoc && uploadedDoc.file) {
        result = await apiService.uploadDocument(uploadedDoc.file);
      } else {
        result = await apiService.loadSampleDocument();
      }
      applyPipelineResult(result, incomingFileName);
    } catch (err) {
      alert("Sample pipeline error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const applyPipelineResult = (result, fileNameOverride) => {
  const applyPipelineResult = (result) => {
    recordActivity('Proceedings generated', { reference: result.entities?.case_details?.case_number || result.generated_docx_filename });
    setCurrentEntities(result.entities);
    setValidationInsights(result.validation_insights);
    setCurrentDocxFilename(fileNameOverride || result.generated_docx_filename);
    setRawOcrText(result.rawOcrText);
    setBoundingBoxes(result.bounding_boxes || []);

    // Format the new document content
    const initialSubject = `"உங்களைத் தேடி உங்கள் ஊரில்" திட்டம் — ${result.entities.jurisdiction.district} மாவட்டம், ${result.entities.jurisdiction.taluk} வட்டத்தில் மோட்டார் விபத்து இழப்பீட்டுத் தொகை ரூ.${Number(result.entities.financials.principal_amount).toLocaleString('en-IN')}/- ஐ வசூலித்து ஒப்படைக்க உத்தரவிடுதல்.`;
    setSubjectText(initialSubject);
    setDocumentContent(apiService.formatDocumentSheet(result.entities, initialSubject));

    setActiveView('workspace');
    setWorkspaceMode('editor');
  };

  // AI Prompt-based Re-generation (Requirement: prompt textarea to generate DOCX if wrong info)
  const handlePromptRegenerate = async (prompt) => {
    setIsRegenerating(true);
    try {
      const res = await apiService.regenerateWithPrompt(prompt, currentEntities, subjectText);
      recordActivity('Proceedings updated', { reference: res.entities?.case_details?.case_number || '' });
      setCurrentEntities(res.entities);
      setDocumentContent(res.documentContent);
      if (res.generated_docx_filename) {
        setCurrentDocxFilename(res.generated_docx_filename);
      }
      alert("✅ DOCX proceedings re-generated successfully based on your AI prompt!");
    } catch (err) {
      alert("Failed to re-generate with prompt: " + err.message);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Recalculate & Re-generate Proceedings Order from form fields
  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const res = await apiService.regenerateDocument(currentEntities);
      recordActivity('Proceedings updated', { reference: res.entities?.case_details?.case_number || '' });
      setCurrentEntities(res.entities);
      setValidationInsights(res.validation_insights || validationInsights);
      if (res.generated_docx_filename) {
        setCurrentDocxFilename(res.generated_docx_filename);
      }
      setDocumentContent(apiService.formatDocumentSheet(res.entities, subjectText));
      alert("Proceedings re-generated with updated entities!");
    } catch (err) {
      alert("Failed to update: " + err.message);
    } finally {
      setIsRecalculating(false);
    }
  };

  // Download Proceedings DOCX
  const handleDownloadDocx = () => {
    if (!currentDocxFilename) return;
    recordActivity('Proceedings download requested', { reference: currentDocxFilename });
    const url = apiService.getDownloadUrl(currentDocxFilename);
    window.open(url, '_blank');
  };

  // Download / Print as PDF
  const handleDownloadPdf = () => {
    recordActivity('Proceedings print requested', { reference: currentEntities?.case_details?.case_number || '' });
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${currentEntities.proceedings_roc_number || "Proceedings_Order"}</title>
          <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: 'Noto Sans Tamil', serif, sans-serif; font-size: 13px; line-height: 1.8; color: #000; padding: 20px; }
            pre { font-family: inherit; white-space: pre-wrap; word-wrap: break-word; font-size: 13px; line-height: 1.8; }
          </style>
        </head>
        <body>
          <pre>${documentContent}</pre>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Reset to New Document
  const handleNewDocument = () => {
    setActiveView('upload');
  };

  // Single-Click DRO Portal State Dispatch
  const handleDispatchDro = async () => {
    const isHighRisk = validationInsights?.hallucination_score > 0.20;
    if (isHighRisk) {
      const confirmDispatch = window.confirm(
        "Warning: Hallucination score exceeds 0.20 safety limit. Are you sure you have verified all fields against the tribunal order decree?"
      );
      if (!confirmDispatch) return;
    }

    try {
      const response = await apiService.dispatchToDRO({
        ...currentEntities,
        groundingScore: validationInsights?.grounding_score,
        hallucinationScore: validationInsights?.hallucination_score,
      });

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });

      const currentMonth = "September 2026";
      setAuditLogs((prev) => ({
        ...prev,
        [currentMonth]: [response.auditEntry, ...(prev[currentMonth] || [])]
      }));

      recordActivity('Proceedings dispatched', { reference: currentEntities?.case_details?.case_number || '', status: 'DISPATCHED' });
      setDroReceiptData(response);
    } catch (err) {
      alert("Dispatch error: " + err.message);
    }
  };

  // Handle RAG Citation Click in Chat
  const handleSelectCitation = (boxId, page) => {
    setActiveHighlightId(boxId);
    setTimeout(() => {
      setActiveHighlightId(null);
    }, 4000);
  };

  // Handle Bounding Box Click in DocumentViewer
  const handleBoxClick = (box) => {
    setActiveHighlightId(box.id);
    if (box.fieldKey) {
      setHighlightedField(box.fieldKey);
      setTimeout(() => setHighlightedField(null), 3500);
    }
  };

  // Handle Query in RAG Chat
  const handleSendRAGQuery = async (query) => {
    return await apiService.askRAGChat(query, {
      case_details: currentEntities.case_details,
      defaulter: currentEntities.defaulter,
      financials: currentEntities.financials,
      jurisdiction: currentEntities.jurisdiction,
      legal_acts: currentEntities.legal_acts,
      rawOcrText
    });
  };

 // Mobile capture route must work without login
if (window.location.pathname.startsWith('/capture/')) {
  const sessionId = window.location.pathname.split('/capture/')[1];

  return <MobileCapturePage sessionId={sessionId} />;
}

if (!currentUser) {
  return <LoginPage onLogin={(user) => {
    // Local directory only: the existing login remains a frontend demo.
    try {
      const users = readUsers();
      if (user.role === 'admin' && !users.length) {
        saveUsers([
          {
            ...user,
            id: crypto.randomUUID(),
            status: 'active',
            taluk: 'District administration'
          }
        ]);
      }
    } catch (error) {
      console.warn('Could not initialize officer directory:', error);
    }

    setCurrentUser(user);
    setActiveSession(null);
    setActiveView(user.role === 'admin' ? 'adminDashboard' : 'rrAssistant');
    setMobileMenuOpen(false);
  }} />;
}
  if (!currentUser) {
    return <LoginPage onLogin={(user) => {
      setActivityActor(user);
      recordActivity('Signed in');
      setCurrentUser(user);
      setActiveSession(null);
      setActiveView(user.role === 'admin' ? 'adminDashboard' : 'rrAssistant');
      setMobileMenuOpen(false);
    }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxHeight: '100vh', overflow: 'hidden', backgroundColor: '#FEFAF6' }}>
      {/* Top Application Header */}
      <AppHeader
        currentLanguage={currentLanguage}
        setLanguage={setLanguage}
        theme={theme}
        setTheme={setTheme}
        backendStatus={backendStatus}
        currentCaseNumber={currentEntities?.case_details?.case_number}
        activeView={activeView}
        setActiveView={setActiveView}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        currentUser={currentUser}
        onLogout={() => { recordActivity('Signed out'); setActivityActor(null); setCurrentUser(null); }}
      />

      {/* Main Body Area: Sidebar + Main Content */}
      <div style={{ display: 'flex', flex: 1, height: 'calc(100vh - 64px)', minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        {/* Left Navigation Sidebar */}
        <Sidebar
          isAdmin={currentUser.role === 'admin'}
          activeView={activeView}
          setActiveView={(view) => {
            setActiveView(view);
            setMobileMenuOpen(false);
          }}
          isCollapsed={sidebarCollapsed}
          setIsCollapsed={setSidebarCollapsed}
          mobileOpen={mobileMenuOpen}
          setMobileOpen={setMobileMenuOpen}
          onSelectRecent={caseNum => {
            const record = Object.values(auditLogs).flat().find(row => row.caseNumber === caseNum);
            if (record) handleRestoreSession(record);
          }}
        />

        {/* Dynamic Center Work Area */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
          {/* View Routing */}
          <main className="main-work-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '1rem', height: '100%' }}>
            {currentUser.role === 'admin' && ['adminDashboard', 'adminTemplates', 'adminUsers', 'adminBackup'].includes(activeView) && (
              <AdminWorkspace key={activeView} view={activeView} currentUser={currentUser} onNavigate={setActiveView} onRestored={() => {
          <main className="main-work-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '1.25rem' }}>
            {activeView === 'myProfile' && <MyProfile currentUser={currentUser} currentLanguage={currentLanguage}
              onUserUpdated={user => { setActivityActor(user); setCurrentUser(user); }}
              setLanguage={setLanguage}
              onBack={() => setActiveView(currentUser.role === 'admin' ? 'adminDashboard' : 'rrAssistant')} />}
            {currentUser.role === 'admin' && ['adminDashboard', 'adminUsers', 'adminBackup'].includes(activeView) && (
              <AdminWorkspace key={activeView} view={activeView} currentUser={currentUser} onUserUpdated={user => { setActivityActor(user); setCurrentUser(user); }} onNavigate={setActiveView} onRestored={() => {
                setActivityActor(null);
                setCurrentUser(null);
                setActiveSession(null);
                setActiveView('rrAssistant');
                apiService.getAuditLogs().then(setAuditLogs).catch(error => console.warn('Unable to load saved audit logs:', error));
                const preferences = JSON.parse(localStorage.getItem('rr_preferences') || 'null');
                setLanguage(preferences?.language || 'en');
                setTheme(preferences?.theme || 'dark');
              }} />
            )}
            {activeView === 'profile' && (
              <OfficialProfile currentUser={currentUser} />
            )}

            {activeView === 'upload' && (
              <UploadLanding
                onFileUpload={handleFileUpload}
                onLoadSample={handleLoadSample}
                onScanMobile={() => setIsMobileQrModalOpen(true)}
                currentLanguage={currentLanguage}
              />
            )}
            {activeView === 'rrAssistant' && (
              <RRAssistantView
                currentUser={currentUser}
                currentLanguage={currentLanguage}
                activeSession={activeSession}
                onSaveAuditLog={async () => {
                  const logs = await apiService.getAuditLogs();
                  setAuditLogs(logs);
                }}
                onSelectRecent={(caseNum) => {
                  setActiveView('workspace');
                }}
              />
            )}

            {activeView === 'workspace' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                {/* Workspace Mode Switcher (Editor Preview vs Full Entity Inspection) */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '0.75rem',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => setWorkspaceMode('editor')}
                      className={`btn ${workspaceMode === 'editor' ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                    >
                      📰 செயல்முறை ஆணை மாதிரி &amp; AI திருத்தம் (Document Editor &amp; AI Re-generation)
                    </button>
                    <button
                      onClick={() => setWorkspaceMode('inspection')}
                      className={`btn ${workspaceMode === 'inspection' ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                    >
                      🔍 முழு விவரங்கள் &amp; OCR ஆய்வு (Entities &amp; OCR Inspection)
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-emerald" style={{ fontSize: '0.72rem' }}>
                      Case: {currentEntities.case_details.case_number}
                    </span>
                    <button
                      onClick={handleDispatchDro}
                      className="btn btn-success"
                      style={{ padding: '0.4rem 0.9rem', fontSize: '0.785rem' }}
                    >
                      Dispatch to DRO Portal
                    </button>
                  </div>
                </div>

                {/* Mode 1: Document Editor & AI Prompt Re-generation (Matching Screenshots 1 & 2) */}
                {workspaceMode === 'editor' && (
                  <DocumentEditorPreview
                    entities={currentEntities}
                    subjectText={subjectText}
                    setSubjectText={setSubjectText}
                    documentContent={documentContent}
                    setDocumentContent={setDocumentContent}
                    onPromptRegenerate={handlePromptRegenerate}
                    onDownloadDocx={handleDownloadDocx}
                    onDownloadPdf={handleDownloadPdf}
                    onNewDocument={handleNewDocument}
                    isRegenerating={isRegenerating}
                  />
                )}

                {/* Mode 2: Full Entity Form, Document Viewer & RAG Chat */}
                {workspaceMode === 'inspection' && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(380px, 1fr) minmax(380px, 1fr) 340px',
                    gap: '1rem',
                    height: 'calc(100vh - 170px)',
                    boxSizing: 'border-box'
                  }}>
                    {/* 1. Document Viewer with Bounding Boxes */}
                    <DocumentViewer
                      boundingBoxes={boundingBoxes}
                      activeHighlightId={activeHighlightId}
                      onBoxClick={handleBoxClick}
                      rawOcrText={rawOcrText}
                      currentCaseNumber={currentEntities.case_details.case_number}
                    />

                    {/* 2. Full Details Form with Grounding/Hallucination Check */}
                    <FullDetailsForm
                      entities={currentEntities}
                      validationInsights={validationInsights}
                      onChange={(updated) => {
                        setCurrentEntities(updated);
                        setDocumentContent(apiService.formatDocumentSheet(updated, subjectText));
                      }}
                      onRecalculate={handleRecalculate}
                      onPreviewOrder={() => setIsPreviewModalOpen(true)}
                      onDownloadDocx={handleDownloadDocx}
                      onDispatchDro={handleDispatchDro}
                      isRecalculating={isRecalculating}
                      highlightedField={highlightedField}
                    />

                    {/* 3. RAG Summary & Interactive Chat View */}
                    <SummaryChatView
                      onSelectCitation={handleSelectCitation}
                      onSendQuery={handleSendRAGQuery}
                      currentCaseNumber={currentEntities.case_details.case_number}
                    />
                  </div>
                )}
              </div>
            )}

            {(activeView === 'audit' || activeView === 'droQueue') && (
              <AuditLogView
                currentUser={currentUser}
                isAdmin={currentUser.role === 'admin'}
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

      {/* Processing Pipeline Overlay (During Ingestion) */}
      <ProcessingOverlay
        isProcessing={isProcessing}
        currentFileName={processingFileName}
      />

      {/* Official Tamil Proceedings Sheet Preview Modal */}
      <ProceedingsPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        entities={currentEntities}
        onDownloadDocx={handleDownloadDocx}
      />

      {/* DRO Portal Dispatch Receipt Modal */}
      <DroReceiptModal
        isOpen={!!droReceiptData}
        onClose={() => setDroReceiptData(null)}
        receiptData={droReceiptData}
      />

      {/* Mobile QR Intake Modal */}
      <MobileQrModal
        isOpen={isMobileQrModalOpen}
        onClose={() => setIsMobileQrModalOpen(false)}
        onDocumentUploaded={handleLoadSample}
        onSimulateMobileUpload={handleLoadSample}
      />
    </div>
  );
}

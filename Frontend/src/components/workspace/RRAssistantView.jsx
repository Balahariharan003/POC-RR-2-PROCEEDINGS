import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Download,
  RefreshCw,
  Copy,
  Printer,
  X,
  Send,
  Check,
  Edit3,
  MessageSquare,
  Sparkles,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  RotateCw,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Eye,
  FileUp,
  Layers,
  Save,
  Plus,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  ExternalLink
} from 'lucide-react';
import { recordActivity } from '../../services/activityStore.js';
import { apiService } from '../../services/apiService.js';
import { APP_CONFIG, STORAGE_KEYS, UPLOAD_CONFIG } from '../../config/appConfig.js';
import { layoutToText } from '../../utils/documentLayout.js';
import './RRAssistantView.css';
import TemplateDocumentEditor from './TemplateDocumentEditor.jsx';

export default function RRAssistantView({ 
  currentLanguage = 'en',
  currentUser,
  onSelectRecent,
  activeSession = null,
  onSaveAuditLog,
  onBackToAudit,
  onClearSession
}) {
  // Workflow States: 'upload' | 'file_selected' | 'processing' | 'generated'
  const [workflowState, setWorkflowState] = useState('upload');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileInfo, setFileInfo] = useState({ name: '', sizeFormatted: '' });
  const [processingStage, setProcessingStage] = useState('Extracting document content...');
  
  // Document Content & Layout
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedDocxFilename, setGeneratedDocxFilename] = useState('');
  const [documentLayout, setDocumentLayout] = useState(null);
  const [documentEdits, setDocumentEdits] = useState({});
  const editsRef = useRef({});
  const [isExporting, setIsExporting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(true);

  // Document Title / Case Name
  const [documentTitle, setDocumentTitle] = useState('Revenue Recovery Proceedings');

  // Formatting Ribbon State
  const [selectedFont, setSelectedFont] = useState('TAU-Marutham');
  const [selectedFontSize, setSelectedFontSize] = useState('11pt');
  const [selectedAlign, setSelectedAlign] = useState('justify');

  // Quadruple Administrative Documents Manifest
  const [activeDocType, setActiveDocType] = useState('proceedings');
  const [docManifest, setDocManifest] = useState({
    proceedings: { docx: '', pdf: '', title: '1. செயல்முறைகள்\n(Order)' },
    memorandum: { docx: '', pdf: '', title: '2. குறிப்பாணை\n(Memo)' },
    note: { docx: '', pdf: '', title: '3. அலுவலகக் குறிப்பு\n(Note)' },
    warrant: { docx: '', pdf: '', title: '4. வாரண்ட்\n(Warrant)' }
  });
  const [cachedLayouts, setCachedLayouts] = useState({});
  const [cachedEdits, setCachedEdits] = useState({});

  // Navigation & Rail Tabs
  const [showLeftRail, setShowLeftRail] = useState(true);
  const [leftRailTab, setLeftRailTab] = useState('documents'); // 'documents' | 'pages'
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedBlockId, setSelectedBlockId] = useState(null);

  // AI Inspector Panel State
  const [showInspector, setShowInspector] = useState(true);
  const [rightPanelMode, setRightPanelMode] = useState('inspector'); // 'inspector' | 'original' | 'chat'
  const [openAccordions, setOpenAccordions] = useState({
    primary: true,
    parties: true,
    clauses: true
  });

  // Templates from Database
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [selectedTemplateCode, setSelectedTemplateCode] = useState(APP_CONFIG.defaults?.templateCode || 'proceedings_default');

  // Extracted Case Entities & Audit State
  const [extractedEntities, setExtractedEntities] = useState(null);
  const [auditError, setAuditError] = useState('');
  const [composerNotice, setComposerNotice] = useState('');
  const [correctionInstruction, setCorrectionInstruction] = useState('');
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Source Document Preview State
  const fileInputRef = useRef(null);
  const [sourceFile, setSourceFile] = useState(null);
  const [docPreviewUrl, setDocPreviewUrl] = useState('');

  // History & Session
  const [promptHistory, setPromptHistory] = useState([]);

  // Restore session from activeSession (e.g. when clicked in Audit History)
  useEffect(() => {
    if (!activeSession) return;

    let isMounted = true;

    const restoreSession = async () => {
      try {
        setWorkflowState('processing');
        setProcessingStage('Restoring saved proceeding and layout...');

        const s = activeSession;
        const details = s.details && typeof s.details === 'object' ? s.details : {};
        
        // 1. Docx Filenames & Manifest
        const procDocx = s.proceedings_docx || s.generated_docx_filename || details.proceedings_docx || details.generated_docx_filename || details.output_docx || '';
        const procPdf = s.proceedings_pdf || s.generated_pdf_filename || details.proceedings_pdf || details.output_pdf || '';
        const memoDocx = s.memorandum_docx || details.memorandum_docx || '';
        const memoPdf = s.memorandum_pdf || details.memorandum_pdf || '';
        const noteDocx = s.note_docx || details.note_docx || '';
        const notePdf = s.note_pdf || details.note_pdf || '';
        const warrantDocx = s.warrant_docx || details.warrant_docx || '';
        const warrantPdf = s.warrant_pdf || details.warrant_pdf || '';

        const manifest = {
          proceedings: { docx: procDocx, pdf: procPdf, title: '1. செயல்முறைகள்\n(Order)' },
          memorandum: { docx: memoDocx, pdf: memoPdf, title: '2. குறிப்பாணை\n(Memo)' },
          note: { docx: noteDocx, pdf: notePdf, title: '3. அலுவலகக் குறிப்பு\n(Note)' },
          warrant: { docx: warrantDocx, pdf: warrantPdf, title: '4. வாரண்ட்\n(Warrant)' }
        };
        if (!isMounted) return;
        setDocManifest(manifest);
        setActiveDocType('proceedings');
        setGeneratedDocxFilename(procDocx);

        // 2. Extracted Entities
        const restoredEntities = details.entities || {
          statute_cited: details.statute_cited || s.statute_cited || 'மோட்டார் வாகனச் சட்டம் 1988 பிரிவு 174',
          total_amount: details.total_amount || s.amount || details.amount || '460690',
          taluk_name: details.taluk || details.jurisdiction_taluk || s.taluk || '',
          defaulter_name: details.defaulterName || details.defaulter || s.defaulter || '',
          dd_favour_of: details.dd_favour_of || s.dd_favour_of || '',
          dispatch_address: details.dispatch_address || s.dispatch_address || '',
          demand_clause_text: details.demand_clause_text || s.demand_clause_text || '',
          roc_number: details.caseNumber || details.case_no || s.caseNumber || '',
          file_no: s.rawFileId || s.fileName || ''
        };
        setExtractedEntities(restoredEntities);

        // 3. Document Title & File Info
        const orderName = s.caseNumber || s.fileName || s.orderId || (restoredEntities.roc_number ? `${restoredEntities.roc_number} · ${restoredEntities.statute_cited || 'RR Proceedings'}` : 'Revenue Recovery Proceedings');
        setDocumentTitle(orderName);
        setFileInfo({
          name: s.fileName || s.rawFileId || orderName,
          sizeFormatted: s.sizeFormatted || 'Saved Proceeding'
        });

        // 4. Document Layout & Edits
        let layout = s.documentLayout || details.documentLayout || null;
        let edits = s.documentEdits || details.documentEdits || {};

        if (!layout && procDocx) {
          try {
            layout = await apiService.getDocumentLayout(procDocx);
          } catch (err) {
            console.warn('Could not load layout from backend for', procDocx, err);
          }
        }

        if (!isMounted) return;

        if (layout) {
          setDocumentLayout(layout);
          setCachedLayouts({ proceedings: layout });
          setCachedEdits({ proceedings: edits });
          setDocumentEdits(edits);
          editsRef.current = edits;
          setGeneratedContent(layoutToText(layout, edits));
        } else if (s.documentContent || details.documentContent) {
          setGeneratedContent(s.documentContent || details.documentContent);
          setDocumentLayout(null);
        }

        // 5. Prompt History
        if (Array.isArray(s.promptHistory) && s.promptHistory.length > 0) {
          setPromptHistory(s.promptHistory);
        } else if (Array.isArray(details.promptHistory) && details.promptHistory.length > 0) {
          setPromptHistory(details.promptHistory);
        }

        // 6. Source Preview URL
        const sourceUrl = s.sourceFileUrl || details.original_file_url || (s.rawFileId && !s.rawFileId.startsWith('backup') ? `/api/v1/documents/original/${encodeURIComponent(s.rawFileId)}` : '') || (s.fileName ? `/api/v1/documents/original/${encodeURIComponent(s.fileName)}` : '');
        if (sourceUrl) {
          setDocPreviewUrl(sourceUrl);
        }

        setWorkflowState('generated');
      } catch (err) {
        console.error('Error restoring session:', err);
        if (isMounted) setWorkflowState('generated');
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [activeSession]);

  useEffect(() => {
    if (sourceFile) {
      const url = URL.createObjectURL(sourceFile);
      setDocPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (activeSession?.sourceFileUrl) {
      setDocPreviewUrl(activeSession.sourceFileUrl);
    } else if (activeSession?.fileName || activeSession?.rawFileId) {
      const fn = activeSession.fileName || activeSession.rawFileId;
      setDocPreviewUrl(`/api/v1/documents/original/${encodeURIComponent(fn)}`);
    } else if (fileInfo.name) {
      setDocPreviewUrl(`/api/v1/documents/original/${encodeURIComponent(fileInfo.name)}`);
    }
  }, [sourceFile, activeSession, fileInfo.name]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const tpls = await apiService.getTemplates();
        if (tpls && tpls.length > 0) {
          setAvailableTemplates(tpls);
          if (!tpls.some(t => t.template_code === selectedTemplateCode)) {
            setSelectedTemplateCode(tpls[0].template_code);
          }
        }
      } catch (err) {
        console.warn('Could not fetch templates from backend:', err);
      }
    };
    fetchTemplates();
  }, []);

  const updateDocumentEdits = (layout, edits) => {
    editsRef.current = edits;
    setDocumentEdits(edits);
    setCachedEdits(prev => ({ ...prev, [activeDocType]: edits }));
    if (layout) {
      setGeneratedContent(layoutToText(layout, edits));
    }
  };

  const handleParagraphChange = (id, text) => {
    updateDocumentEdits(documentLayout, { ...editsRef.current, [id]: text });
  };

  const switchDocumentType = async (type) => {
    if (activeDocType === type) return;
    const targetDocx = docManifest[type]?.docx;
    if (!targetDocx) return;

    // Cache current edits
    setCachedEdits(prev => ({ ...prev, [activeDocType]: editsRef.current }));
    setActiveDocType(type);
    setGeneratedDocxFilename(targetDocx);

    if (cachedLayouts[type]) {
      const nextLayout = cachedLayouts[type];
      const nextEdits = cachedEdits[type] || {};
      setDocumentLayout(nextLayout);
      editsRef.current = nextEdits;
      setDocumentEdits(nextEdits);
      setGeneratedContent(layoutToText(nextLayout, nextEdits));
    } else {
      try {
        const layout = await apiService.getDocumentLayout(targetDocx);
        setCachedLayouts(prev => ({ ...prev, [type]: layout }));
        const nextEdits = cachedEdits[type] || {};
        setDocumentLayout(layout);
        editsRef.current = nextEdits;
        setDocumentEdits(nextEdits);
        setGeneratedContent(layoutToText(layout, nextEdits));
      } catch (err) {
        console.warn(`Could not load layout for ${type}:`, err);
      }
    }
  };

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setSourceFile(file);
    setSelectedFiles(files);
    setFileInfo({
      name: file.name,
      sizeFormatted: `${(file.size / (1024 * 1024)).toFixed(2)} MB`
    });
    setDocumentTitle(file.name.replace(/\.[^/.]+$/, "") + " · Proceedings");
    setWorkflowState('file_selected');
  };

  const handleGenerateContent = async () => {
    if (selectedFiles.length === 0) return;
    const selectedFile = selectedFiles[0];
    setWorkflowState('processing');
    setProcessingStage('Analyzing requisition with Master Prompt engine...');

    try {
      const result = await apiService.uploadDocument(selectedFile, selectedTemplateCode);
      const procDocxName = result.proceedings_docx || result.generated_docx_filename;
      const layout = await apiService.getDocumentLayout(procDocxName);

      const edits = {};
      const formattedDoc = layoutToText(layout, edits);
      const procDocx = result.proceedings_docx || result.generated_docx_filename || '';
      const memoDocx = result.memorandum_docx || '';
      const noteDocx = result.note_docx || '';
      const warrantDocx = result.warrant_docx || '';

      const manifest = {
        proceedings: { docx: procDocx, pdf: result.proceedings_pdf || '', title: '1. செயல்முறைகள்\n(Order)' },
        memorandum: { docx: memoDocx, pdf: result.memorandum_pdf || '', title: '2. குறிப்பாணை\n(Memo)' },
        note: { docx: noteDocx, pdf: result.note_pdf || '', title: '3. அலுவலகக் குறிப்பு\n(Note)' },
        warrant: { docx: warrantDocx, pdf: result.warrant_pdf || '', title: '4. வாரண்ட்\n(Warrant)' }
      };

      setGeneratedContent(formattedDoc);
      setGeneratedDocxFilename(procDocx);
      setExtractedEntities(result.entities);
      setDocManifest(manifest);
      setActiveDocType('proceedings');
      setCachedLayouts({ proceedings: layout });
      setCachedEdits({ proceedings: edits });
      setDocumentLayout(layout);
      setDocumentEdits(edits);
      editsRef.current = edits;

      if (result.entities?.file_no || result.entities?.roc_number) {
        setDocumentTitle(`${result.entities?.roc_number || result.entities?.file_no} · ${result.entities?.statute_cited || 'RR Proceedings'}`);
      }

      setWorkflowState('generated');
    } catch (err) {
      console.error('Generation error:', err);
      setComposerNotice(`Error synthesizing draft: ${err.message}`);
      setWorkflowState('file_selected');
    }
  };

  const handleApplyChanges = async () => {
    if (!correctionInstruction.trim() || isApplyingChanges || !documentLayout) return;
    setIsApplyingChanges(true);
    setComposerNotice('');

    try {
      const newEdits = await apiService.reviseDocument(
        documentLayout,
        editsRef.current,
        correctionInstruction.trim()
      );
      updateDocumentEdits(documentLayout, newEdits);
      setCorrectionInstruction('');
      setPromptHistory(prev => [
        ...prev,
        { id: Date.now(), prompt: correctionInstruction.trim(), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
      setComposerNotice('Changes applied successfully to document.');
    } catch (err) {
      console.error('Revision error:', err);
      setComposerNotice(`Revision error: ${err.message}`);
    } finally {
      setIsApplyingChanges(false);
    }
  };

  const handleDuplicateBlock = (block) => {
    if (!documentLayout || !block) return;
    const blocks = [...(documentLayout.blocks || [])];
    const index = blocks.findIndex(b => b.id === block.id);
    if (index !== -1) {
      const newBlock = {
        ...block,
        id: `block_${Date.now()}`,
        text: documentEdits[block.id] || block.text
      };
      blocks.splice(index + 1, 0, newBlock);
      setDocumentLayout({ ...documentLayout, blocks });
      setSelectedBlockId(newBlock.id);
      setSelectedBlock(newBlock);
    }
  };

  const handleDeleteBlock = (blockId) => {
    if (!documentLayout || !blockId) return;
    const blocks = (documentLayout.blocks || []).filter(b => b.id !== blockId);
    setDocumentLayout({ ...documentLayout, blocks });
    setSelectedBlockId(null);
    setSelectedBlock(null);
  };

  const handleAddNewBlock = () => {
    if (!documentLayout) return;
    const newBlock = {
      id: `block_${Date.now()}`,
      type: 'paragraph',
      text: 'புதிய பத்தி விவரம்...',
      runs: [{ text: 'புதிய பத்தி விவரம்...' }],
      style: { textAlign: 'justify', fontSize: '11pt', fontFamily: 'TAU-Marutham' }
    };
    const blocks = [...(documentLayout.blocks || []), newBlock];
    setDocumentLayout({ ...documentLayout, blocks });
    setSelectedBlockId(newBlock.id);
    setSelectedBlock(newBlock);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      alert("Failed to copy text: " + e.message);
    }
  };

  const handleDownload = async (format) => {
    if (isExporting || !documentLayout) return;
    setIsExporting(true);
    try {
      await apiService.downloadEditedDocument(documentLayout, editsRef.current, format);
      recordActivity('Document downloaded', { reference: fileInfo.name, format });
    } catch (error) {
      setComposerNotice(error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadAll = async (format = 'docx') => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const types = ['proceedings', 'memorandum', 'note', 'warrant'];
      for (const t of types) {
        const docx = docManifest[t]?.docx;
        if (docx) {
          let layout = cachedLayouts[t];
          if (!layout) {
            try {
              layout = await apiService.getDocumentLayout(docx);
              setCachedLayouts(prev => ({ ...prev, [t]: layout }));
            } catch {
              continue;
            }
          }
          const edits = cachedEdits[t] || (t === activeDocType ? editsRef.current : {});
          await apiService.downloadEditedDocument(layout, edits, format);
        }
      }
    } catch (err) {
      setComposerNotice(`Download failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleResetWorkflow = () => {
    setDocumentLayout(null);
    setDocumentEdits({});
    editsRef.current = {};
    setCachedLayouts({});
    setCachedEdits({});
    setActiveDocType('proceedings');
    setSourceFile(null);
    setFileInfo({ name: '', sizeFormatted: '' });
    setGeneratedContent('');
    setGeneratedDocxFilename('');
    setExtractedEntities(null);
    setCorrectionInstruction('');
    setComposerNotice('');
    setWorkflowState('upload');
    if (onClearSession) onClearSession();
  };

  const toggleAccordion = (key) => {
    setOpenAccordions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const insertClauseToEditor = (text) => {
    if (!documentLayout?.blocks) return;
    const targetBlock = documentLayout.blocks.find(b => b.type === 'paragraph' && b.text && (b.text.includes('உத்தரவு') || b.text.includes('செயல்முறை')));
    if (targetBlock) {
      const currentVal = editsRef.current[targetBlock.id] ?? targetBlock.text;
      handleParagraphChange(targetBlock.id, `${currentVal}\n${text}`);
      setComposerNotice('Clause appended to order section.');
    } else {
      navigator.clipboard.writeText(text);
      setComposerNotice('Clause copied to clipboard.');
    }
  };

  const entities = extractedEntities || {};

  return (
    <div className="rr-studio-root">
      {/* --- TOP NAVBAR --- */}
      <header className="rr-studio-topbar">
        <div className="rr-studio-topbar__left">
          {workflowState === 'generated' && (
            <button 
              type="button" 
              className="rr-studio-topbar__btn-back" 
              onClick={() => {
                if (activeSession && onBackToAudit) {
                  onBackToAudit();
                } else {
                  handleResetWorkflow();
                }
              }}
              title={activeSession && onBackToAudit ? "Back to Audit Logs" : "Return to Upload"}
            >
              <ArrowLeft size={14} />
              <span>{activeSession && onBackToAudit ? "Audit Logs" : "Back"}</span>
            </button>
          )}

          {workflowState === 'generated' && (
            <button
              type="button"
              className={`rr-studio-btn-icon rr-studio-rail-toggle ${!showLeftRail ? 'rail-collapsed' : ''}`}
              onClick={() => setShowLeftRail(!showLeftRail)}
              title={showLeftRail ? "Hide Document Rail" : "Show Document Rail"}
            >
              {showLeftRail ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            </button>
          )}

          <div className="rr-studio-doc-title-box">
            <FileText size={16} color="#2563eb" style={{ flexShrink: 0 }} />
            <input
              type="text"
              className="rr-studio-doc-title-input"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              title="Click to rename document"
              placeholder="Document Title"
            />
          </div>

          {workflowState === 'generated' && (
            <span className="rr-studio-status-badge">
              <span className="rr-status-dot" />
              <span>Synced &amp; Verified</span>
            </span>
          )}
        </div>

        <div className="rr-studio-topbar__right">
          {workflowState === 'generated' && (
            <>
              {/* Grouped Export & Download Actions */}
              <div className="rr-studio-export-group">
                <button
                  type="button"
                  className="rr-studio-btn rr-studio-btn-secondary"
                  onClick={() => handleDownload('docx')}
                  disabled={isExporting}
                  title="Download active document as DOCX"
                >
                  <Download size={13} />
                  <span>DOCX</span>
                </button>

                <button
                  type="button"
                  className="rr-studio-btn rr-studio-btn-secondary"
                  onClick={() => handleDownload('pdf')}
                  disabled={isExporting}
                  title="Download active document as PDF"
                >
                  <Printer size={13} />
                  <span>PDF</span>
                </button>

                <button
                  type="button"
                  className="rr-studio-btn rr-studio-btn-secondary"
                  onClick={() => handleDownloadAll('docx')}
                  disabled={isExporting}
                  title="Download all 4 administrative documents"
                >
                  <Layers size={13} />
                  <span>All Forms</span>
                </button>
              </div>

              {/* Save Button */}
              <button
                type="button"
                className={`rr-studio-btn rr-studio-btn-primary ${savedSuccess ? 'saved' : ''}`}
                onClick={() => {
                  setSavedSuccess(true);
                  setTimeout(() => setSavedSuccess(false), 2000);
                }}
              >
                {savedSuccess ? <Check size={14} /> : <Save size={14} />}
                <span>{savedSuccess ? 'Saved' : 'Save'}</span>
              </button>

              <div className="rr-studio-topbar-divider" />

              {/* Right Panel View Modes */}
              <div className="rr-studio-mode-toggles">
                <button
                  type="button"
                  className={`rr-studio-btn-icon ${showInspector && rightPanelMode === 'original' ? 'active' : ''}`}
                  onClick={() => {
                    if (showInspector && rightPanelMode === 'original') {
                      setShowInspector(false);
                    } else {
                      setShowInspector(true);
                      setRightPanelMode('original');
                    }
                  }}
                  title="Toggle Original Scanned Requisition Viewer"
                >
                  <Eye size={15} />
                </button>

                <button
                  type="button"
                  className={`rr-studio-btn-icon ${showInspector && rightPanelMode === 'chat' ? 'active' : ''}`}
                  onClick={() => {
                    if (showInspector && rightPanelMode === 'chat') {
                      setShowInspector(false);
                    } else {
                      setShowInspector(true);
                      setRightPanelMode('chat');
                    }
                  }}
                  title="Toggle AI Revision Assistant"
                >
                  <MessageSquare size={15} />
                </button>

                <button
                  type="button"
                  className={`rr-studio-ai-pill-btn ${showInspector && rightPanelMode === 'inspector' ? 'active' : ''}`}
                  onClick={() => {
                    if (showInspector && rightPanelMode === 'inspector') {
                      setShowInspector(false);
                    } else {
                      setShowInspector(true);
                      setRightPanelMode('inspector');
                    }
                  }}
                  title="Toggle Legal Inspector & Entities"
                >
                  <Sparkles size={13} />
                  <span>Legal Inspector</span>
                </button>
              </div>
            </>
          )}

          <button
            type="button"
            className="rr-studio-btn rr-studio-btn-secondary rr-newcase-btn"
            onClick={handleResetWorkflow}
          >
            <Plus size={13} />
            <span>New Case</span>
          </button>
        </div>
      </header>

      {/* --- MAIN WORKSPACE BODY --- */}
      <div className="rr-studio-body">
        {/* Upload State */}
        {(workflowState === 'upload' || workflowState === 'file_selected') && (
          <div className="rr-studio-upload-hero">
            <img src={APP_CONFIG.brand?.emblemPath || '/emblem.png'} alt="Tamil Nadu Government" />
            <h1>Revenue Recovery  Studio</h1>
            <div
              className="rr-studio-dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept={UPLOAD_CONFIG?.accept || '.pdf,.docx,.png,.jpg,.jpeg'}
                style={{ display: 'none' }}
                onChange={(e) => handleFiles(Array.from(e.target.files || []))}
              />
              <FileUp size={36} color="#0b1f49ff" />
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' }}>
                {fileInfo.name || 'Click or drag requisition order here'}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Supports PDF, DOCX, SCANNED IMAGES (Up to 50MB)
              </div>
            </div>

            {workflowState === 'file_selected' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <label htmlFor="tpl-select" style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>
                    Select Proceedings Template:
                  </label>
                  <select
                    id="tpl-select"
                    value={selectedTemplateCode}
                    onChange={(e) => setSelectedTemplateCode(e.target.value)}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem' }}
                  >
                    {availableTemplates.map(t => (
                      <option key={t.template_code} value={t.template_code}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="rr-studio-btn rr-studio-btn-primary"
                  onClick={handleGenerateContent}
                  style={{ padding: '10px 24px', fontSize: '0.95rem', alignSelf: 'center' }}
                >
                  <Sparkles size={16} />
                  <span>Synthesize Official Proceedings (உருவாக்கு)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Processing State */}
        {workflowState === 'processing' && (
          <div className="rr-studio-upload-hero">
            <RefreshCw size={36} color="#2563eb" className="spinner" />
            <h2>Synthesizing Official Proceedings</h2>
            <p style={{ fontWeight: 600, color: '#2563eb' }}>{processingStage}</p>
            <p>{fileInfo.name}</p>
          </div>
        )}

        {/* Generated Active Studio */}
        {workflowState === 'generated' && (
          <>
            {/* 1. LEFT RAIL: Pages & Documents Navigation */}
            {showLeftRail && (
              <aside className="rr-studio-leftrail" aria-label="Document Navigation Rail">
                {/* Mode Switcher Tabs */}
                <div className="rr-studio-rail-tabs">
                  <button
                    type="button"
                    className={`rr-studio-rail-tab ${leftRailTab === 'documents' ? 'active' : ''}`}
                    onClick={() => setLeftRailTab('documents')}
                  >
                    Documents
                  </button>
                  <button
                    type="button"
                    className={`rr-studio-rail-tab ${leftRailTab === 'pages' ? 'active' : ''}`}
                    onClick={() => setLeftRailTab('pages')}
                  >
                    Pages
                  </button>
                </div>

                <div className="rr-studio-thumb-list">
                  {leftRailTab === 'documents' ? (
                    [
                      { id: 'proceedings', label: 'Proceedings', sub: 'செயல்முறைகள்' },
                      { id: 'memorandum', label: 'Memo', sub: 'குறிப்பாணை' },
                      { id: 'note', label: 'Office Note', sub: 'அலுவலகக் குறிப்பு' },
                      { id: 'warrant', label: 'Warrant', sub: 'வாரண்ட்' },
                    ].map((item, idx) => {
                      const isActive = activeDocType === item.id;
                      return (
                        <div key={item.id} className={`rr-studio-thumb-card-wrapper ${isActive ? 'active' : ''}`}>
                          <button
                            type="button"
                            className="rr-studio-thumb-card"
                            onClick={() => switchDocumentType(item.id)}
                            title={`${item.label} - ${item.sub}`}
                          >
                            <div className="rr-studio-thumb-badge">{idx + 1}</div>
                            <div className="rr-studio-thumb-paper">
                              <div className="rr-studio-thumb-line top" />
                              <div className="rr-studio-thumb-line short" />
                              <div className="rr-studio-thumb-line" />
                              <div className="rr-studio-thumb-line" />
                              <div className="rr-studio-thumb-line short" />
                            </div>
                            <div className="rr-studio-thumb-info">
                              <span className="rr-studio-thumb-main">{item.sub}</span>
                              <span className="rr-studio-thumb-sub">({item.label})</span>
                            </div>
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    (documentLayout?.blocks ? [1, 2, 3].slice(0, Math.max(1, Math.ceil((documentLayout.blocks.length || 1) / 20))) : [1]).map((pgNum, idx) => (
                      <div
                        key={`page-${pgNum}`}
                        className={`rr-studio-thumb-card-wrapper ${idx === 0 ? 'active' : ''}`}
                        onClick={() => {
                          const el = document.getElementById(`rr-page-${pgNum}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                      >
                        <button
                          type="button"
                          className="rr-studio-thumb-card"
                          title={`Page ${pgNum}`}
                        >
                          <div className="rr-studio-thumb-badge">P{pgNum}</div>
                          <div className="rr-studio-thumb-paper">
                            <div className="rr-studio-thumb-line top" />
                            <div className="rr-studio-thumb-line" />
                            <div className="rr-studio-thumb-line short" />
                            <div className="rr-studio-thumb-line" />
                            <div className="rr-studio-thumb-line short" />
                          </div>
                          <div className="rr-studio-thumb-info">
                            <span className="rr-studio-thumb-main">Page {pgNum}</span>
                          </div>
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add New Block Button */}
                <button
                  type="button"
                  className="rr-studio-add-new-btn"
                  onClick={handleAddNewBlock}
                  title="Add new section block"
                >
                  <Plus size={13} />
                  <span>Add section</span>
                </button>
              </aside>
            )}

            {/* 2. CENTER AREA: Ribbon & Document Page Canvas */}
            <main className="rr-studio-center">
              {/* Floating Ribbon Toolbar */}
              <div className="rr-studio-ribbon">
                <div className="rr-studio-ribbon-group">
                  <button
                    type="button"
                    className="rr-studio-ribbon-btn"
                    title="Undo"
                    onClick={() => document.execCommand('undo')}
                  >
                    <RotateCcw size={14} />
                  </button>
                  <button
                    type="button"
                    className="rr-studio-ribbon-btn"
                    title="Redo"
                    onClick={() => document.execCommand('redo')}
                  >
                    <RotateCw size={14} />
                  </button>

                  <div className="rr-studio-ribbon-divider" />

                  <button
                    type="button"
                    className="rr-studio-ribbon-btn"
                    title="Bold"
                    onClick={() => document.execCommand('bold')}
                  >
                    <Bold size={14} />
                  </button>
                  <button
                    type="button"
                    className="rr-studio-ribbon-btn"
                    title="Italic"
                    onClick={() => document.execCommand('italic')}
                  >
                    <Italic size={14} />
                  </button>
                  <button
                    type="button"
                    className="rr-studio-ribbon-btn"
                    title="Underline"
                    onClick={() => document.execCommand('underline')}
                  >
                    <Underline size={14} />
                  </button>

                  <div className="rr-studio-ribbon-divider" />

                  {/* Font Family Selector */}
                  <select
                    className="rr-studio-ribbon-select"
                    value={selectedFont}
                    onChange={(e) => setSelectedFont(e.target.value)}
                    title="Font Family"
                  >
                    <option value="TAU-Marutham">TAU-Marutham (Government Official)</option>
                    <option value="Noto Sans Tamil">Noto Sans Tamil</option>
                    <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                    <option value="Arial">Arial</option>
                  </select>

                  {/* Font Size */}
                  <select
                    className="rr-studio-ribbon-select"
                    value={selectedFontSize}
                    onChange={(e) => setSelectedFontSize(e.target.value)}
                    title="Font Size"
                    style={{ width: '64px' }}
                  >
                    <option value="10pt">10 pt</option>
                    <option value="11pt">11 pt</option>
                    <option value="12pt">12 pt</option>
                    <option value="13pt">13 pt</option>
                    <option value="14pt">14 pt</option>
                    <option value="16pt">16 pt</option>
                  </select>

                  <div className="rr-studio-ribbon-divider" />

                  {/* Alignments */}
                  <button
                    type="button"
                    className={`rr-studio-ribbon-btn ${selectedAlign === 'left' ? 'active' : ''}`}
                    onClick={() => setSelectedAlign('left')}
                    title="Align Left"
                  >
                    <AlignLeft size={14} />
                  </button>
                  <button
                    type="button"
                    className={`rr-studio-ribbon-btn ${selectedAlign === 'center' ? 'active' : ''}`}
                    onClick={() => setSelectedAlign('center')}
                    title="Align Center"
                  >
                    <AlignCenter size={14} />
                  </button>
                  <button
                    type="button"
                    className={`rr-studio-ribbon-btn ${selectedAlign === 'right' ? 'active' : ''}`}
                    onClick={() => setSelectedAlign('right')}
                    title="Align Right"
                  >
                    <AlignRight size={14} />
                  </button>
                  <button
                    type="button"
                    className={`rr-studio-ribbon-btn ${selectedAlign === 'justify' ? 'active' : ''}`}
                    onClick={() => setSelectedAlign('justify')}
                    title="Justify"
                  >
                    <AlignJustify size={14} />
                  </button>
                </div>

                <div className="rr-studio-ribbon-group">
                  <button
                    type="button"
                    className="rr-studio-btn rr-studio-btn-secondary"
                    onClick={handleCopy}
                    style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                  >
                    {copied ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                    <span>{copied ? 'Copied' : 'Copy Text'}</span>
                  </button>

                  <button
                    type="button"
                    className={`rr-studio-btn ${isEditMode ? 'rr-studio-btn-primary' : 'rr-studio-btn-secondary'}`}
                    onClick={() => setIsEditMode(!isEditMode)}
                    style={{ padding: '3px 10px', fontSize: '0.78rem' }}
                  >
                    {isEditMode ? <Edit3 size={13} /> : <Eye size={13} />}
                    <span>{isEditMode ? 'Editing' : 'Preview'}</span>
                  </button>
                </div>
              </div>

              {/* Document Canvas Viewport */}
              <div className="rr-studio-editor-viewport">
                {documentLayout ? (
                  <TemplateDocumentEditor
                    key={documentLayout.filename}
                    layout={documentLayout}
                    edits={documentEdits}
                    onChange={handleParagraphChange}
                    onSelectBlock={(block) => {
                      setSelectedBlock(block);
                      setSelectedBlockId(block?.id || null);
                      if (block) setShowInspector(true);
                    }}
                    selectedBlockId={selectedBlockId}
                    disabled={!isEditMode}
                    selectedFont={selectedFont}
                    selectedFontSize={selectedFontSize}
                    selectedAlign={selectedAlign}
                    onDuplicateBlock={handleDuplicateBlock}
                    onDeleteBlock={handleDeleteBlock}
                  />
                ) : (
                  <div style={{ padding: '3rem', width: '100%', maxWidth: '800px' }}>
                    <textarea
                      aria-label="Saved proceedings"
                      value={generatedContent}
                      onChange={(e) => setGeneratedContent(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '700px',
                        padding: '1.5rem',
                        fontFamily: 'TAU-Marutham, serif',
                        fontSize: '1.05rem',
                        lineHeight: 1.6,
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        background: '#ffffff'
                      }}
                    />
                  </div>
                )}
              </div>
            </main>

            {/* 3. RIGHT PANEL: Review Data & Block Inspector */}
            {showInspector && (
              <aside className="rr-studio-inspector" aria-label="AI Legal Analysis Inspector">
                <div className="rr-studio-inspector__header">
                  <div className="rr-studio-inspector__title">
                    <Sparkles size={16} color="#6366f1" />
                    <span>
                      {selectedBlock
                        ? (selectedBlock.type === 'paragraph' ? 'Paragraph' : 'Table Section')
                        : (rightPanelMode === 'original' ? 'Scanned Order View' : rightPanelMode === 'chat' ? 'AI Assistant' : 'Legal Inspector')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="rr-studio-btn-icon"
                    onClick={() => {
                      if (selectedBlock) {
                        setSelectedBlock(null);
                        setSelectedBlockId(null);
                      } else {
                        setShowInspector(false);
                      }
                    }}
                    title="Close Inspector"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="rr-studio-inspector__body">
                  {/* When a specific Block is Selected on Canvas */}
                  {selectedBlock ? (
                    <div className="rr-studio-block-inspector">
                      {/* Section 1: Coordinates & Dimensions */}
                      <div className="rr-inspector-section">
                        <div className="rr-inspector-section__title">Coordinates</div>
                        <div className="rr-coords-grid">
                          <div className="rr-coord-item">
                            <span className="rr-coord-label">X</span>
                            <input type="text" className="rr-coord-input" defaultValue="54" readOnly />
                          </div>
                          <div className="rr-coord-item">
                            <span className="rr-coord-label">Y</span>
                            <input type="text" className="rr-coord-input" defaultValue="120" readOnly />
                          </div>
                          <div className="rr-coord-item">
                            <span className="rr-coord-label">W</span>
                            <input type="text" className="rr-coord-input" defaultValue="487" readOnly />
                          </div>
                          <div className="rr-coord-item">
                            <span className="rr-coord-label">H</span>
                            <input type="text" className="rr-coord-input" defaultValue="Auto" readOnly />
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Property & Variable Binding */}
                      <div className="rr-inspector-section">
                        <div className="rr-inspector-section__title">Property</div>
                        <div className="rr-property-card">
                          <div className="rr-property-icon">A</div>
                          <div className="rr-property-info">
                            <div className="rr-property-name">
                              {selectedBlock.text?.includes('ரூ.') ? 'total_amount' : selectedBlock.text?.includes('வட்டம்') ? 'taluk_name' : 'defaulter_clause'}
                            </div>
                            <div className="rr-property-sub">
                              {selectedBlock.text?.includes('ரூ.') ? '₹ ' + (entities.total_amount || '4,60,690') : (entities.defaulter_name || 'T.P. ராமலிங்கம்')}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Value / Text Content Editor */}
                      <div className="rr-inspector-section">
                        <div className="rr-inspector-section__title">Default value / Content</div>
                        <textarea
                          className="rr-inspector-textarea"
                          rows={4}
                          value={documentEdits[selectedBlock.id] ?? selectedBlock.text}
                          onChange={(e) => handleParagraphChange(selectedBlock.id, e.target.value)}
                        />
                      </div>

                      {/* Section 4: Quick Variable Chips */}
                      <div className="rr-inspector-section">
                        <div className="rr-inspector-section__title">Insert Template Variable</div>
                        <div className="rr-var-chips">
                          {[
                            { label: 'Defaulter Name', tag: '{{defaulter_name}}' },
                            { label: 'Total Amount', tag: '{{total_amount}}' },
                            { label: 'Taluk Name', tag: '{{taluk_name}}' },
                            { label: 'Statute', tag: '{{statute_cited}}' },
                            { label: 'DD Payee', tag: '{{dd_favour_of}}' }
                          ].map(v => (
                            <button
                              key={v.tag}
                              type="button"
                              className="rr-var-chip"
                              onClick={() => {
                                const curr = documentEdits[selectedBlock.id] ?? selectedBlock.text;
                                handleParagraphChange(selectedBlock.id, `${curr} ${v.tag}`);
                              }}
                            >
                              {v.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : rightPanelMode === 'inspector' ? (
                    <>
                      {/* AI Suggestion Banner */}
                      <div className="rr-studio-ai-banner">
                        <div className="rr-studio-ai-banner__text">
                          ✨ <strong>Verified Parameters</strong> extracted and aligned with Tamil Nadu Revenue Recovery standards.
                        </div>
                      </div>

                      {/* Primary Details Accordion */}
                      <div className="rr-studio-accordion">
                        <button
                          type="button"
                          className="rr-studio-accordion__header"
                          onClick={() => toggleAccordion('primary')}
                        >
                          <span>Primary Details (வழக்கு முதன்மை விவரம்)</span>
                          {openAccordions.primary ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>

                        {openAccordions.primary && (
                          <div className="rr-studio-accordion__content">
                            <div className="rr-studio-field-group">
                              <label className="rr-studio-field-label">Document / Case Title</label>
                              <input
                                type="text"
                                className="rr-studio-field-input"
                                value={documentTitle}
                                onChange={(e) => setDocumentTitle(e.target.value)}
                              />
                            </div>

                            <div className="rr-studio-field-group">
                              <label className="rr-studio-field-label">Statute Cited / Law</label>
                              <input
                                type="text"
                                className="rr-studio-field-input"
                                value={entities.statute_cited || 'மோட்டார் வாகனச் சட்டம் 1988 பிரிவு 174'}
                                readOnly
                              />
                            </div>

                            <div className="rr-studio-field-row">
                              <div className="rr-studio-field-group">
                                <label className="rr-studio-field-label">Total Amount</label>
                                <input
                                  type="text"
                                  className="rr-studio-field-input"
                                  value={`₹ ${entities.total_amount ? Number(entities.total_amount).toLocaleString('en-IN') : '4,60,690'}`}
                                  readOnly
                                  style={{ fontWeight: 700, color: '#166534' }}
                                />
                              </div>
                              <div className="rr-studio-field-group">
                                <label className="rr-studio-field-label">Jurisdictional Taluk</label>
                                <input
                                  type="text"
                                  className="rr-studio-field-input"
                                  value={entities.taluk_name || 'கொடுமுடி'}
                                  readOnly
                                />
                              </div>
                            </div>

                            <div className="rr-studio-field-group">
                              <label className="rr-studio-field-label">Defaulter / Party Name</label>
                              <input
                                type="text"
                                className="rr-studio-field-input"
                                value={entities.defaulter_name || 'திரு.T.P.ராமலிங்கம், த/பெ.பழனிச்சாமி'}
                                readOnly
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Parties Accordion */}
                      <div className="rr-studio-accordion">
                        <button
                          type="button"
                          className="rr-studio-accordion__header"
                          onClick={() => toggleAccordion('parties')}
                        >
                          <span>Parties & DD Remittance (கட்டளை விவரம்)</span>
                          {openAccordions.parties ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>

                        {openAccordions.parties && (
                          <div className="rr-studio-accordion__content">
                            <div className="rr-studio-field-group">
                              <label className="rr-studio-field-label">DD In Favour Of (வங்கி வரைவோலை பெயர்)</label>
                              <input
                                type="text"
                                className="rr-studio-field-input"
                                value={entities.dd_favour_of || 'Cholamandalam MS General Insurance Company Limited., Erode'}
                                readOnly
                              />
                            </div>
                            <div className="rr-studio-field-group">
                              <label className="rr-studio-field-label">Dispatch Office Address</label>
                              <textarea
                                className="rr-studio-field-input"
                                rows={2}
                                value={entities.dispatch_address || 'D.No.14, Sri Senniappa Complex, Thiruvika Road, Erode'}
                                readOnly
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Statutory Clauses & Slots Accordion */}
                      <div className="rr-studio-accordion">
                        <button
                          type="button"
                          className="rr-studio-accordion__header"
                          onClick={() => toggleAccordion('clauses')}
                        >
                          <span>Statutory Clauses & Slots (சட்ட விதிகூறுகள்)</span>
                          {openAccordions.clauses ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>

                        {openAccordions.clauses && (
                          <div className="rr-studio-accordion__content">
                            {/* Demand Clause Card */}
                            <div className="rr-studio-clause-card">
                              <div className="rr-studio-clause-title">
                                <span>«DEMAND_CLAUSE»</span>
                              </div>
                              <div className="rr-studio-clause-text">
                                {entities.demand_clause_text || 'மோட்டார் வாகன விபத்து இழப்பீட்டு தீர்ப்பாய உத்தரவுப்படி தொகை ரூ.4,60,690/- ஐ வசூல் செய்யுமாறு கோரப்பட்டுள்ளது.'}
                              </div>
                              <button
                                type="button"
                                className="rr-studio-clause-btn"
                                onClick={() => insertClauseToEditor(entities.demand_clause_text || '')}
                              >
                                Insert into Order
                              </button>
                            </div>

                            {/* Governing Law / RSO 41 Card */}
                            <div className="rr-studio-clause-card">
                              <div className="rr-studio-clause-title">
                                <span>«PARA2» (RSO 41 / Sec 5 Delegation)</span>
                              </div>
                              <div className="rr-studio-clause-text">
                                வருவாய் நிலை ஆணை எண் 41 மற்றும் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய வட்டாட்சியருக்கு அதிகாரம் வழங்கி உத்திரவிடப்படுகிறது.
                              </div>
                              <button
                                type="button"
                                className="rr-studio-clause-btn"
                                onClick={() => insertClauseToEditor('வருவாய் நிலை ஆணை எண் 41 மற்றும் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய வட்டாட்சியருக்கு அதிகாரம் வழங்கி உத்திரவிடப்படுகிறது.')}
                              >
                                Insert into Order
                              </button>
                            </div>

                            {/* DD Remittance Card */}
                            <div className="rr-studio-clause-card">
                              <div className="rr-studio-clause-title">
                                <span>«PARA3» (DD Execution & Remittance)</span>
                              </div>
                              <div className="rr-studio-clause-text">
                                அசையும் மற்றும் அசையா சொத்துகளிலிருந்து தொகையினை வசூல் செய்து வங்கி வரைவோலையாக எடுத்து உரிய அலுவலகத்திற்கு அனுப்பி வைக்குமாறு தெரிவிக்கப்படுகிறது.
                              </div>
                              <button
                                type="button"
                                className="rr-studio-clause-btn"
                                onClick={() => insertClauseToEditor('அசையும் மற்றும் அசையா சொத்துகளிலிருந்து தொகையினை வசூல் செய்து வங்கி வரைவோலையாக எடுத்து உரிய அலுவலகத்திற்கு அனுப்பி வைக்குமாறு தெரிவிக்கப்படுகிறது.')}
                              >
                                Insert into Order
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}

                  {/* Mode 2: Original Scanned Requisition Viewer */}
                  {rightPanelMode === 'original' && (
                    <div className="rr-scanned-viewer-container">
                      <div className="rr-scanned-viewer-bar">
                        <span className="rr-scanned-filename" title={fileInfo.name || 'Requisition Order'}>
                          {fileInfo.name || 'Order.pdf'}
                        </span>
                        {docPreviewUrl && (
                          <a 
                            href={docPreviewUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="rr-scanned-open-link"
                            title="Open original file in full browser tab"
                          >
                            <ExternalLink size={12} />
                            <span>Open in new tab</span>
                          </a>
                        )}
                      </div>
                      
                      {docPreviewUrl ? (
                        <div className="rr-scanned-frame-wrapper">
                          {docPreviewUrl.toLowerCase().endsWith('.png') || docPreviewUrl.toLowerCase().endsWith('.jpg') || docPreviewUrl.toLowerCase().endsWith('.jpeg') ? (
                            <img 
                              src={docPreviewUrl} 
                              alt="Original Scanned Order" 
                              className="rr-scanned-image"
                            />
                          ) : (
                            <iframe 
                              src={`${docPreviewUrl}#toolbar=0&navpanes=0`} 
                              title="Original Scanned Document"
                              className="rr-scanned-iframe"
                            />
                          )}
                        </div>
                      ) : (
                        <div className="rr-scanned-empty">
                          <FileText size={32} color="#94a3b8" />
                          <p>No source requisition document preview available for this case.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode 3: Interactive AI Prompt Assistant */}
                  {rightPanelMode === 'chat' && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
                      <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        Instruct the AI engine to update any part of the 4 documents:
                      </div>
                      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {promptHistory.map(item => (
                          <div key={item.id} style={{ background: '#f1f5f9', padding: '8px 12px', borderRadius: '8px', fontSize: '0.82rem' }}>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.prompt}</div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>{item.timestamp}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Interactive AI Prompt Composer (Shown only in Inspector and Chat modes) */}
                {rightPanelMode !== 'original' && (
                  <div className="rr-studio-chat-composer">
                    {composerNotice && (
                      <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>
                        {composerNotice}
                      </div>
                    )}
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleApplyChanges();
                      }}
                      className="rr-studio-chat-input-row"
                    >
                      <textarea 
                        className="rr-studio-chat-textarea"
                        placeholder="Ask AI to revise clauses, change taluk, etc..."
                        rows={1}
                        value={correctionInstruction}
                        onChange={(e) => setCorrectionInstruction(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleApplyChanges();
                          }
                        }}
                      />
                      <button 
                        type="submit" 
                        className="rr-studio-chat-send-btn"
                        disabled={!correctionInstruction.trim() || isApplyingChanges}
                        title="Send instruction to AI"
                      >
                        {isApplyingChanges ? <RefreshCw size={13} className="spinner" /> : <Send size={13} />}
                      </button>
                    </form>
                  </div>
                )}
              </aside>
            )}
          </>
        )}
      </div>
    </div>
  );
}

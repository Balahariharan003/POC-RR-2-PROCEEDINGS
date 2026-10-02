import { recordActivity } from '../../services/activityStore.js';
import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, RefreshCw, Copy, PlusCircle, Printer, X, Send, Paperclip, Check, Edit3, MessageSquare } from 'lucide-react';
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
  onSaveAuditLog
}) {
  // Workflow States: 'upload' | 'file_selected' | 'processing' | 'generated'
  const [workflowState, setWorkflowState] = useState('upload');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [generatedDocuments, setGeneratedDocuments] = useState([]);
  const [fileInfo, setFileInfo] = useState({ name: '', sizeFormatted: '' });

  const [processingStage, setProcessingStage] = useState('Extracting document content...');
  
  // Document Content & Correction
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedDocxFilename, setGeneratedDocxFilename] = useState('');
  const [documentLayout, setDocumentLayout] = useState(null);
  const [documentEdits, setDocumentEdits] = useState({});
  const editsRef = useRef({});
  const [isExporting, setIsExporting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Quadruple Administrative Documents State: 'proceedings' | 'memorandum' | 'note' | 'warrant'
  const [activeDocType, setActiveDocType] = useState('proceedings');
  const [docManifest, setDocManifest] = useState({
    proceedings: { docx: '', pdf: '', title: '1. செயல்முறைகள் (Proceedings / Order)' },
    memorandum: { docx: '', pdf: '', title: '2. குறிப்பாணை (Memorandum / Memo)' },
    note: { docx: '', pdf: '', title: '3. அலுவலகக் குறிப்பு (Office Note File)' },
    warrant: { docx: '', pdf: '', title: '4. வாரண்ட் (Judicial Warrant)' }
  });
  const [cachedLayouts, setCachedLayouts] = useState({});
  const [cachedEdits, setCachedEdits] = useState({});

  const updateDocumentEdits = (layout, edits) => {
    editsRef.current = edits;
    setDocumentEdits(edits);
    setCachedEdits(prev => ({ ...prev, [activeDocType]: edits }));
    setGeneratedContent(layoutToText(layout, edits));
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

  const [correctionInstruction, setCorrectionInstruction] = useState('');
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastUpdatedMessage, setLastUpdatedMessage] = useState('');
  const [promptHistory, setPromptHistory] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  const [selectedTemplateCode, setSelectedTemplateCode] = useState(APP_CONFIG.defaults.templateCode);


  const [extractedEntities, setExtractedEntities] = useState(null);
  const [auditError, setAuditError] = useState('');
  const [composerNotice, setComposerNotice] = useState('');

  const fileInputRef = useRef(null);
  const editStart = useRef('');
  const [sourceFile, setSourceFile] = useState(null);
  const [docPreviewUrl, setDocPreviewUrl] = useState('');
  const [showOriginalDoc, setShowOriginalDoc] = useState(false);

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
    } else {
      setDocPreviewUrl('');
    }
  }, [sourceFile, activeSession]);


  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const tpls = await apiService.getTemplates();
        if (tpls && tpls.length > 0) {

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

  useEffect(() => {
    apiService.getAuditLogs().catch(err => {
      setAuditError(err?.message || 'Unable to load saved audit records.');
    });
  }, []);

  useEffect(() => {
    if (activeSession) return;
    try {
      const draft = JSON.parse(localStorage.getItem(STORAGE_KEYS.draft) || 'null');
      if (draft && typeof draft.content === 'string' && draft.content) {
        setGeneratedContent(draft.content);
        setDocumentLayout(draft.layout || null);
        setGeneratedDocxFilename(draft.layout?.filename || '');
        setDocumentEdits(draft.edits || {});
        editsRef.current = draft.edits || {};
        setFileInfo({ name: draft.fileName || 'Saved proceedings', sizeFormatted: draft.fileSize || '' });
        setPromptHistory(Array.isArray(draft.promptHistory) ? draft.promptHistory : []);
        setCurrentSessionId(draft.sessionId || null);
        setWorkflowState('generated');
      }
    } catch (error) { setAuditError('Unable to load saved draft from browser storage.'); }
  }, []);

  useEffect(() => {
    if (workflowState !== 'generated') return;
    try {
      localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify({ content: generatedContent, layout: documentLayout, edits: documentEdits, fileName: fileInfo.name, fileSize: fileInfo.sizeFormatted, promptHistory, sessionId: currentSessionId }));
    } catch (error) { setAuditError('Draft could not be saved locally. Export the document to keep your changes.'); }
  }, [workflowState, generatedContent, documentLayout, documentEdits, fileInfo, promptHistory, currentSessionId]);

  // Restore session when activeSession prop changes (ChatGPT & Gemini style restore)
  useEffect(() => {
    if (activeSession) {
      setSelectedFiles([]);
      setGeneratedDocuments([]);
      setSourceFile(null);
      setShowOriginalDoc(false);
      const fn = activeSession.fileName || activeSession.caseNumber || activeSession.rawFileId || 'restored_order.pdf';
      setFileInfo({
        name: fn,
        sizeFormatted: activeSession.fileSize || 'Size not recorded'
      });
      setGeneratedContent(activeSession.documentContent || '');
      setDocumentLayout(activeSession.documentLayout || null);
      const docxName = activeSession.documentLayout?.filename || activeSession.generated_docx_filename || activeSession.details?.generated_docx_filename || '';
      setGeneratedDocxFilename(docxName);
      setDocumentEdits(activeSession.documentEdits || {});
      editsRef.current = activeSession.documentEdits || {};
      setPromptHistory(activeSession.promptHistory || []);
      setCurrentSessionId(activeSession.id || `AUD-${Date.now()}`);

      const procDocx = activeSession.proceedings_docx || activeSession.details?.proceedings_docx || docxName;
      const memoDocx = activeSession.memorandum_docx || activeSession.details?.memorandum_docx || '';
      const noteDocx = activeSession.note_docx || activeSession.details?.note_docx || '';
      const warrantDocx = activeSession.warrant_docx || activeSession.details?.warrant_docx || '';
      const manifest = {
        proceedings: { docx: procDocx, pdf: activeSession.proceedings_pdf || activeSession.details?.proceedings_pdf || '', title: '1. செயல்முறைகள் (Proceedings / Order)' },
        memorandum: { docx: memoDocx, pdf: activeSession.memorandum_pdf || activeSession.details?.memorandum_pdf || '', title: '2. குறிப்பாணை (Memorandum / Memo)' },
        note: { docx: noteDocx, pdf: activeSession.note_pdf || activeSession.details?.note_pdf || '', title: '3. அலுவலகக் குறிப்பு (Office Note File)' },
        warrant: { docx: warrantDocx, pdf: activeSession.warrant_pdf || activeSession.details?.warrant_pdf || '', title: '4. ஜப்தி / கைது வாரண்ட் (Judicial Warrant)' }
      };
      setDocManifest(manifest);
      setActiveDocType('proceedings');
      setCachedLayouts(activeSession.documentLayout ? { proceedings: activeSession.documentLayout } : {});
      setCachedEdits({ proceedings: activeSession.documentEdits || {} });

      setWorkflowState('generated');

      // If documentLayout is missing, fetch it dynamically from backend using docxName or caseNumber!
      const targetDocx = docxName || (activeSession.caseNumber ? `Proceedings_TNRERA_${activeSession.caseNumber.replace(/[^0-9]/g, '')}` : '');
      if (!activeSession.documentLayout && (docxName || activeSession.caseNumber)) {
        apiService.getDocumentLayout(targetDocx || docxName).then(layout => {
          if (layout) {
            setDocumentLayout(layout);
            setGeneratedDocxFilename(layout.filename || docxName);
            setCachedLayouts(prev => ({ ...prev, proceedings: layout }));
            if (!activeSession.documentContent || activeSession.documentContent.startsWith('Draft proceedings recorded for')) {
              setGeneratedContent(layoutToText(layout, activeSession.documentEdits || {}));
            }
          }
        }).catch(err => {
          console.warn('Could not load layout for restored session:', err);
        });
      }
    }
  }, [activeSession]);

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle file selection
  const handleFiles = async (files) => {
    const validFiles = [];
    const rejected = [];
    for (const file of files) {

    // Supported document & image validation
    const fileNameLower = file.name.toLowerCase();
    const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const isWord = (header[0] === 0x50 && header[1] === 0x4b) ||
      (header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0);
    const isValid = isWord || UPLOAD_CONFIG.extensions.some(ext => fileNameLower.endsWith(ext)) ||
                    file.type === 'application/pdf';

    if (!isValid) {
      rejected.push(file.name);
      continue;
    }
    validFiles.push(file);
    }
    setComposerNotice(rejected.length ? `Unsupported files: ${rejected.join(', ')}. Use ${UPLOAD_CONFIG.supportedLabel}.` : '');
    if (!validFiles.length) return;
    setSelectedFiles(previous => {
      const combined = workflowState === 'file_selected' ? [...previous] : [];
      for (const file of validFiles) {
        if (!combined.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) combined.push(file);
      }
      return combined;
    });
    setWorkflowState('file_selected');
  };

  // Trigger processing
  const handleGenerateContent = async () => {
    if (!selectedFiles.length) return;
    const completed = [];
    const failed = [];
    const failures = [];
    setGeneratedDocuments([]);
    setComposerNotice('');
    setWorkflowState('processing');
    setProcessingStage('Extracting document content');

    for (const [index, selectedFile] of selectedFiles.entries()) {
    const fileInfo = { name: selectedFile.name, sizeFormatted: formatFileSize(selectedFile.size) };
    setFileInfo(fileInfo);
    setProcessingStage(`Processing document ${index + 1} of ${selectedFiles.length}`);
    try {

      let result;
      let layout;
      const header = new Uint8Array(await selectedFile.slice(0, 4).arrayBuffer());
      if (/\.docx?$/i.test(selectedFile.name) || (header[0] === 0x50 && header[1] === 0x4b) ||
        (header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0)) {
        layout = await apiService.importWordDocument(selectedFile);
        result = {
          generated_docx_filename: layout.filename,
          proceedings_docx: layout.filename,
          proceedings_pdf: '',
          memorandum_docx: '',
          memorandum_pdf: '',
          note_docx: '',
          note_pdf: '',
          warrant_docx: '',
          warrant_pdf: '',
          documents: [],
          entities: {},
          validation_insights: {}
        };
      } else {
        result = await apiService.uploadDocument(selectedFile, selectedTemplateCode);
        const procDocxName = result.proceedings_docx || result.generated_docx_filename;
        layout = await apiService.getDocumentLayout(procDocxName);
      }
      let edits = {};
      if (correctionInstruction.trim()) {
        edits = await apiService.reviseDocument(layout, edits, correctionInstruction.trim());
      }
      const formattedDoc = layoutToText(layout, edits);
      const procDocx = result.proceedings_docx || result.generated_docx_filename || '';
      const memoDocx = result.memorandum_docx || '';
      const noteDocx = result.note_docx || '';
      const warrantDocx = result.warrant_docx || '';

      const manifest = {
        proceedings: { docx: procDocx, pdf: result.proceedings_pdf || '', title: '1. செயல்முறைகள் (Proceedings / Order)' },
        memorandum: { docx: memoDocx, pdf: result.memorandum_pdf || '', title: '2. குறிப்பாணை (Memorandum / Memo)' },
        note: { docx: noteDocx, pdf: result.note_pdf || '', title: '3. அலுவலகக் குறிப்பு (Office Note File)' },
        warrant: { docx: warrantDocx, pdf: result.warrant_pdf || '', title: '4. ஜப்தி / கைது வாரண்ட் (Judicial Warrant)' }
      };

      setGeneratedContent(formattedDoc);
      setGeneratedDocxFilename(procDocx);
      setExtractedEntities(result.entities);
      setDocManifest(manifest);
      setActiveDocType('proceedings');
      setCachedLayouts({ proceedings: layout });
      setCachedEdits({ proceedings: edits });
      
      const newSessionId = `AUD-${crypto.randomUUID()}`;
      const initialPrompt = {
        id: 1,
        prompt: `Ingested source order "${fileInfo.name || 'order.pdf'}" and synthesized draft proceedings.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setPromptHistory([initialPrompt]);
      setCurrentSessionId(newSessionId);

      completed.push({
        fileInfo,
        sourceFile: selectedFile,
        content: formattedDoc,
        filename: procDocx,
        layout,
        edits,
        entities: result.entities,
        promptHistory: [initialPrompt],
        sessionId: newSessionId,
        docManifest: manifest,
        cachedLayouts: { proceedings: layout },
        cachedEdits: { proceedings: edits },
        activeDocType: 'proceedings'
      });

      // Auto-save to Audit Log Trail
      try {
        await apiService.saveAuditLog({
          id: newSessionId,
          officerId: currentUser?.officerId || currentUser?.id,
          officerName: currentUser?.name,
          caseNumber: result.entities?.case_details?.case_number || fileInfo.name.replace(/\.[^/.]+$/, ""),
          fileName: fileInfo.name || "order.pdf",
          fileSize: fileInfo.sizeFormatted || "",
          defaulter: result.entities?.defaulter?.name || "",
          taluk: result.entities?.jurisdiction?.taluk || "",
          district: result.entities?.jurisdiction?.district || "",
          amount: `₹ ${Number(result.entities?.financials?.total_recoverable_amount || result.entities?.financials?.principal_amount || 0).toLocaleString('en-IN')}/-`,
          status: "DRAFT",
          groundingScore: result.validation_insights?.grounding_score ?? 0,
          hallucinationScore: result.validation_insights?.hallucination_score ?? 0,
          promptHistory: [initialPrompt],
          documentContent: formattedDoc,
          documentLayout: layout,
          documentEdits: edits,
          proceedings_docx: procDocx,
          proceedings_pdf: result.proceedings_pdf || '',
          memorandum_docx: memoDocx,
          memorandum_pdf: result.memorandum_pdf || '',
          note_docx: noteDocx,
          note_pdf: result.note_pdf || '',
          warrant_docx: warrantDocx,
          warrant_pdf: result.warrant_pdf || '',
          documents: result.documents || [],
          notes: "Automated OCR extraction and draft generation completed in RR Assistant."
        });
        if (onSaveAuditLog) await onSaveAuditLog();
        setAuditError('');
      } catch (saveErr) {
        setAuditError(saveErr?.message || 'Unable to save audit record.');
      }
    } catch (err) {
      failed.push(selectedFile);
      failures.push(`${selectedFile.name}: ${err.message}`);
    }
    }
    setGeneratedDocuments(completed);
    setSelectedFiles(failed);
    setComposerNotice(failures.length ? `Failed documents (reattach to retry): ${failures.join('; ')}` : '');
    if (completed.length) {
      openGeneratedDocument(completed[0]);
      setCorrectionInstruction('');
    } else {
      setWorkflowState('file_selected');
    }
  };

  const openGeneratedDocument = (document) => {
    setDocumentLayout(document.layout || null);
    editsRef.current = document.edits || {};
    setDocumentEdits(document.edits || {});
    setSourceFile(document.sourceFile || null);
    setShowOriginalDoc(false);
    setFileInfo(document.fileInfo);
    setGeneratedContent(document.content);
    setGeneratedDocxFilename(document.filename);
    setExtractedEntities(document.entities);
    setPromptHistory(document.promptHistory);
    setCurrentSessionId(document.sessionId);
    setActiveDocType(document.activeDocType || 'proceedings');
    if (document.docManifest) {
      setDocManifest(document.docManifest);
    } else {
      setDocManifest({
        proceedings: { docx: document.filename || '', pdf: '', title: '1. செயல்முறைகள் (Proceedings / Order)' },
        memorandum: { docx: document.memorandum_docx || '', pdf: '', title: '2. குறிப்பாணை (Memorandum / Memo)' },
        note: { docx: document.note_docx || '', pdf: '', title: '3. அலுவலகக் குறிப்பு (Office Note File)' },
        warrant: { docx: document.warrant_docx || '', pdf: '', title: '4. ஜப்தி / கைது வாரண்ட் (Judicial Warrant)' }
      });
    }
    setCachedLayouts(document.cachedLayouts || (document.layout ? { proceedings: document.layout } : {}));
    setCachedEdits(document.cachedEdits || { proceedings: document.edits || {} });
    setLastUpdatedMessage('');
    setWorkflowState('generated');
  };

  // Keep edits and revisions when switching between batch results.
  useEffect(() => {
    if (workflowState !== 'generated') return;
    setGeneratedDocuments(previous => previous.map(document => document.sessionId === currentSessionId
      ? { ...document, content: generatedContent, filename: generatedDocxFilename, layout: documentLayout, edits: documentEdits, promptHistory, docManifest, cachedLayouts, cachedEdits, activeDocType }
      : document));
  }, [workflowState, currentSessionId, generatedContent, generatedDocxFilename, documentLayout, documentEdits, promptHistory, docManifest, cachedLayouts, cachedEdits, activeDocType]);

  // Apply AI Correction / Modification (Section 7 & 8)
  const handleApplyChanges = async () => {
    if (!correctionInstruction.trim() || isApplyingChanges) return;

    setIsApplyingChanges(true);
    setLastUpdatedMessage('');

    try {
      const currentPromptText = correctionInstruction;
      if (!documentLayout) throw new Error('Reopen the Word document to revise it with its original template.');
      const edits = await apiService.reviseDocument(documentLayout, editsRef.current, currentPromptText);
      updateDocumentEdits(documentLayout, edits);
      const updatedText = layoutToText(documentLayout, edits);
      
      const newPromptItem = {
        id: promptHistory.length + 1,
        prompt: currentPromptText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const updatedHistory = [...promptHistory, newPromptItem];
      setPromptHistory(updatedHistory);
      setCorrectionInstruction('');
      setLastUpdatedMessage('Changes applied successfully by RR Assistant.');
      setTimeout(() => setLastUpdatedMessage(''), 4000);

      // Update Audit Log Trail
      try {
        await apiService.saveAuditLog({
          id: currentSessionId || `AUD-${Date.now()}`,
          caseNumber: fileInfo.name.replace(/\.[^/.]+$/, "") || "",
          fileName: fileInfo.name || "order.pdf",
          promptHistory: updatedHistory,
          documentContent: updatedText,
          documentLayout,
          documentEdits: edits,
          proceedings_docx: docManifest.proceedings.docx,
          memorandum_docx: docManifest.memorandum.docx,
          note_docx: docManifest.note.docx,
          warrant_docx: docManifest.warrant?.docx || '',
          status: "VERIFIED"
        });
        if (onSaveAuditLog) await onSaveAuditLog();
        setAuditError('');
      } catch (saveErr) {
        setAuditError(saveErr?.message || 'Unable to save audit record.');
      }
    } catch (err) {
      alert("Failed to apply changes: " + err.message);
    } finally {
      setIsApplyingChanges(false);
    }
  };

  // Copy text to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedContent);
      recordActivity('Proceedings copied', { reference: fileInfo.name });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      alert("Failed to copy text: " + e.message);
    }
  };

  const handleDownload = async (format) => {
    if (isExporting || isApplyingChanges) return;
    if (!documentLayout) {
      setComposerNotice('Reopen the original Word document to export this saved draft with its template.');
      return;
    }
    setIsExporting(true);
    try {
      await apiService.downloadEditedDocument(documentLayout, editsRef.current, format);
      recordActivity('Proceedings download requested', { reference: fileInfo.name });
    } catch (error) {
      setComposerNotice(error.message);
    } finally {
      setIsExporting(false);
    }
  };
  const handleDownloadDocx = () => handleDownload('docx');
  const handleDownloadPdf = () => handleDownload('pdf');

  const handleDownloadAll = async (format = 'docx') => {
    if (isExporting || isApplyingChanges) return;
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
            } catch (loadErr) {
              console.warn(`Could not fetch layout for ${t}:`, loadErr);
              continue;
            }
          }
          const edits = cachedEdits[t] || (t === activeDocType ? editsRef.current : {});
          await apiService.downloadEditedDocument(layout, edits, format);
        }
      }
      recordActivity('All 4 administrative documents downloaded', { reference: fileInfo.name, format });
    } catch (error) {
      setComposerNotice(`Download failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Reset to initial upload (Section 9 & 11)
  const handleResetWorkflow = () => {
    setDocumentLayout(null);
    setDocumentEdits({});
    editsRef.current = {};
    setCachedLayouts({});
    setCachedEdits({});
    setActiveDocType('proceedings');
    setDocManifest({
      proceedings: { docx: '', pdf: '', title: '1. செயல்முறைகள் (Proceedings / Order)' },
      memorandum: { docx: '', pdf: '', title: '2. குறிப்பாணை (Memorandum / Memo)' },
      note: { docx: '', pdf: '', title: '3. அலுவலகக் குறிப்பு (Office Note File)' },
      warrant: { docx: '', pdf: '', title: '4. ஜப்தி / கைது வாரண்ட் (Judicial Warrant)' }
    });
    setSourceFile(null);
    setShowOriginalDoc(false);
    if (generatedContent) recordActivity('Draft cleared', { reference: fileInfo.name });
    try { localStorage.removeItem(STORAGE_KEYS.draft); } catch (error) { console.warn('Could not clear draft:', error); }
    setPromptHistory([]);
    setCurrentSessionId(null);
    setSelectedFiles([]);
    setGeneratedDocuments([]);
    setFileInfo({ name: '', sizeFormatted: '' });
    setGeneratedContent('');
    setGeneratedDocxFilename('');
    setExtractedEntities(null);
    setCorrectionInstruction('');
    setComposerNotice('');
    setWorkflowState('upload');
  };

  const busy = workflowState === 'processing' || isApplyingChanges || isExporting;
  const isUploadScreen = workflowState === 'upload' || workflowState === 'file_selected';
  const handleComposerSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (workflowState === 'file_selected' && selectedFiles.length) {
      // Apply the accompanying instruction after extraction.
      await handleGenerateContent();
    } else if (workflowState === 'generated' && correctionInstruction.trim()) {
      await handleApplyChanges();
    } else {
      setComposerNotice('Attach a source document using the paperclip.');
    }
  };

  return (
    <section className="rr-assistant-chat" aria-label="RR Proceedings Assistant">
      <input type="file" multiple ref={fileInputRef}
        aria-label="Attach source documents"
        accept={UPLOAD_CONFIG.accept}
        onChange={(event) => {
          handleFiles(Array.from(event.target.files || []));
          event.target.value = '';
        }} hidden />
      {auditError && <div className="rr-assistant-chat__notice" role="alert">
        <span>{auditError}</span>
        <button type="button" aria-label="Dismiss error" onClick={() => setAuditError('')}><X size={16} /></button>
      </div>}

      <div className="rr-assistant-chat__body">
        {(workflowState === 'upload' || workflowState === 'file_selected') && (
          <div className="rr-assistant-chat__hero">
            <img src={APP_CONFIG.brand.emblemPath} alt="Tamil Nadu Government" />
            <h1>RR Proceedings Assistant</h1>
            <p>Upload a source document to generate RR proceedings in the fixed template.</p>
          </div>
        )}

        {workflowState === 'processing' && (
          <div className="rr-assistant-chat__hero" role="status" aria-live="polite">
            <RefreshCw size={28} className="spinner" aria-hidden="true" />
            <h2>Preparing your proceedings</h2>
            <p>{processingStage}</p>
            <p>{fileInfo.name}</p>
            <p>Reading the document, extracting details and preparing the fixed template. This may take a few minutes.</p>
          </div>
        )}

      {workflowState === 'generated' && (
        <div className="rr-restored-workspace" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
          {composerNotice && <p role="status">{composerNotice}</p>}

          {/* Unified Ultra-Slim Toolbar: Forms + Export Actions */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #EADBC8',
            borderRadius: '8px',
            padding: '0.45rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
            flexShrink: 0
          }}>
            {/* Left: Compact Form Switcher Segmented Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#102C57', marginRight: '0.2rem' }}>
                படிவங்கள்:
              </span>
              <div style={{ display: 'flex', background: '#FEFAF6', padding: '2px', borderRadius: '6px', border: '1px solid #EADBC8', gap: '2px' }}>
                {[
                  { id: 'proceedings', label: '1. செயல்முறைகள் (Order)', icon: '📄', available: Boolean(docManifest.proceedings.docx || generatedDocxFilename) },
                  { id: 'memorandum', label: '2. குறிப்பாணை (Memo)', icon: '📜', available: Boolean(docManifest.memorandum.docx) },
                  { id: 'note', label: '3. குறிப்பு (Note)', icon: '📝', available: Boolean(docManifest.note.docx) },
                  { id: 'warrant', label: '4. வாரண்ட் (Warrant)', icon: '⚖️', available: Boolean(docManifest.warrant?.docx) }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    disabled={busy || !tab.available}
                    onClick={() => switchDocumentType(tab.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.3rem 0.65rem',
                      fontSize: '0.75rem',
                      fontWeight: activeDocType === tab.id ? 700 : 500,
                      borderRadius: '4px',
                      border: 'none',
                      background: activeDocType === tab.id ? '#102C57' : 'transparent',
                      color: activeDocType === tab.id ? '#ffffff' : '#102C57',
                      cursor: tab.available ? 'pointer' : 'not-allowed',
                      opacity: tab.available ? 1 : 0.45,
                      transition: 'all 0.15s ease'
                    }}
                    title={tab.label}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Actions & File Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              {/* Compact Source File */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: '#102C57', fontWeight: 600 }}>
                <span>கோப்பு:</span>
                <select
                  aria-label="Select generated document"
                  value={currentSessionId || ''}
                  disabled={busy || generatedDocuments.length < 2}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    borderColor: '#DAC0A3',
                    borderRadius: '4px',
                    padding: '0.2rem 0.45rem',
                    maxWidth: '180px',
                    background: '#FEFAF6',
                    color: '#102C57'
                  }}
                  onChange={event => {
                    const document = generatedDocuments.find(item => item.sessionId === event.target.value);
                    if (document) openGeneratedDocument(document);
                  }}
                >
                  {generatedDocuments.length ? generatedDocuments.map(document => (
                    <option key={document.sessionId} value={document.sessionId}>{document.fileInfo.name}</option>
                  )) : <option value={currentSessionId || ''}>{fileInfo.name || 'Current document'}</option>}
                </select>
              </div>

              {/* Export Active: DOCX | PDF */}
              <div style={{ display: 'inline-flex', borderRadius: '5px', overflow: 'hidden', border: '1px solid #102C57' }}>
                <button
                  onClick={handleDownloadDocx}
                  disabled={busy}
                  style={{
                    fontSize: '0.74rem',
                    padding: '0.25rem 0.55rem',
                    background: '#102C57',
                    color: '#ffffff',
                    fontWeight: 600,
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    cursor: busy ? 'not-allowed' : 'pointer'
                  }}
                  title="Download active form as editable DOCX"
                >
                  <Download size={12} />
                  <span>DOCX</span>
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={busy}
                  style={{
                    fontSize: '0.74rem',
                    padding: '0.25rem 0.55rem',
                    background: '#1E3A8A',
                    color: '#ffffff',
                    fontWeight: 600,
                    borderLeft: '1px solid rgba(255,255,255,0.2)',
                    borderRight: 'none',
                    borderTop: 'none',
                    borderBottom: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    cursor: busy ? 'not-allowed' : 'pointer'
                  }}
                  title="Download active form as PDF"
                >
                  <Printer size={12} />
                  <span>PDF</span>
                </button>
              </div>

              {/* Export All 4: DOCX | PDF */}
              <div style={{ display: 'inline-flex', borderRadius: '5px', overflow: 'hidden', border: '1px solid #CBD5E1' }}>
                <button
                  onClick={() => handleDownloadAll('docx')}
                  disabled={busy}
                  style={{
                    fontSize: '0.74rem',
                    padding: '0.25rem 0.55rem',
                    background: '#F8FAFC',
                    color: '#1E293B',
                    fontWeight: 600,
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    cursor: busy ? 'not-allowed' : 'pointer'
                  }}
                  title="Download all 4 official administrative document forms (DOCX)"
                >
                  <Download size={12} />
                  <span>All 4</span>
                </button>
                <button
                  onClick={() => handleDownloadAll('pdf')}
                  disabled={busy}
                  style={{
                    fontSize: '0.74rem',
                    padding: '0.25rem 0.55rem',
                    background: '#F8FAFC',
                    color: '#1E293B',
                    fontWeight: 600,
                    borderLeft: '1px solid #E2E8F0',
                    borderRight: 'none',
                    borderTop: 'none',
                    borderBottom: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    cursor: busy ? 'not-allowed' : 'pointer'
                  }}
                  title="Download all 4 official administrative document forms (PDF)"
                >
                  <Printer size={12} />
                  <span>PDF</span>
                </button>
              </div>

              {/* Copy Text */}
              <button
                onClick={handleCopy}
                style={{
                  fontSize: '0.74rem',
                  padding: '0.25rem 0.55rem',
                  border: '1px solid #DAC0A3',
                  borderRadius: '5px',
                  color: '#102C57',
                  background: '#FEFAF6',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer'
                }}
                title="Copy current document text"
              >
                {copied ? <Check size={12} color="#047857" /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {/* New Upload */}
              <button
                onClick={handleResetWorkflow}
                disabled={busy}
                style={{
                  fontSize: '0.74rem',
                  padding: '0.25rem 0.55rem',
                  border: '1px solid #DAC0A3',
                  borderRadius: '5px',
                  color: '#102C57',
                  background: '#FEFAF6',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: busy ? 'not-allowed' : 'pointer'
                }}
                title="Start new upload"
              >
                <PlusCircle size={12} />
                <span>New</span>
              </button>
            </div>
          </div>

          <div className="rr-generated-layout" style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)',
            gap: '1rem',
            alignItems: 'flex-start',
            width: '100%'
          }}>
            {/* Proceedings document: 60% of the workspace */}
            <div className="rr-document-panel" style={{
              background: '#ffffff',
              border: '1px solid #EADBC8',
              borderRadius: '10px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '800px'
            }}>
              <div style={{
                padding: '0.5rem 1rem',
                background: '#FEFAF6',
                borderBottom: '1px solid #EADBC8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.78rem',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: '#102C57' }}>
                    <FileText size={14} color="#102C57" />
                    <span>{docManifest[activeDocType]?.title || 'Generated Document'}</span>
                  </div>
                  {isEditMode ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      background: '#FEF3C7',
                      color: '#92400E',
                      fontWeight: 600,
                      border: '1px solid #FDE68A'
                    }}>
                      ✏️ Edit Mode (திருத்தும் முறை)
                    </span>
                  ) : (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      background: '#F1F5F9',
                      color: '#475569',
                      fontWeight: 600,
                      border: '1px solid #E2E8F0'
                    }}>
                      👁️ Official Preview Mode (முன்னோட்டம்)
                    </span>
                  )}
                </div>

                <div>
                  {isEditMode ? (
                    <button
                      type="button"
                      onClick={() => setIsEditMode(false)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.25rem 0.65rem',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        color: '#ffffff',
                        background: '#047857',
                        border: '1px solid #059669',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(4,120,87,0.2)'
                      }}
                      title="Lock document and view clean official preview"
                    >
                      <Check size={13} />
                      <span>Done Editing (முடிக்க)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditMode(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.25rem 0.65rem',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        color: '#102C57',
                        background: '#FEFAF6',
                        border: '1px solid #DAC0A3',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                      title="Click to edit document text and paragraphs directly"
                    >
                      <Edit3 size={12} />
                      <span>Edit Document (திருத்து)</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="rr-document-editor" style={{ flex: 1, display: 'flex' }}>
                {documentLayout ? <TemplateDocumentEditor key={documentLayout.filename}
                  layout={documentLayout} edits={documentEdits} onChange={handleParagraphChange} disabled={busy || !isEditMode} />
                  : <textarea aria-label="Saved proceedings" value={generatedContent} readOnly style={{ width: '100%', minHeight: '600px', padding: '1rem' }} />}
              </div>
            </div>

            {/* Right Panel: Sticky Chat or Original Scanned Document Viewer (40% of workspace) */}
            <div style={{
              position: 'sticky',
              top: '0.75rem',
              alignSelf: 'flex-start',
              height: 'calc(100vh - 140px)',
              minHeight: '480px',
              maxHeight: '880px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {!showOriginalDoc ? (
                /* State 1: RR Assistant Chat Panel */
                <div className="rr-chat-panel" style={{
                  background: '#ffffff',
                  border: '1px solid #EADBC8',
                  borderRadius: '12px',
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  minHeight: 0
                }}>
                  <div className="rr-chat-heading" style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <MessageSquare size={18} />
                      <div><h3>RR Assistant</h3><p>Request changes to your proceedings</p></div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowOriginalDoc(true)}
                      style={{
                        backgroundColor: '#DAC0A3',
                        color: '#102C57',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '5px 11px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
                      }}
                      title="View Original Scanned Document"
                    >
                      <FileText size={13} />
                      <span>Original Order ◀</span>
                    </button>
                  </div>
                  <div className="rr-chat-history" role="log" aria-label="Proceedings conversation" aria-live="polite" style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto'
                  }}>
                    <div className="rr-chat-message rr-chat-assistant">Your proceedings are ready in the fixed template. Review the document on the left, or send an instruction to revise it.</div>
                    {promptHistory.slice(1).map((item) => (
                      <React.Fragment key={item.id}>
                        <div className="rr-chat-message rr-chat-user">{item.prompt}</div>
                        <div className="rr-chat-message rr-chat-assistant">The requested revision has been applied. Review the updated proceedings on the left.</div>
                      </React.Fragment>
                    ))}
                    {isApplyingChanges && <div className="rr-chat-message rr-chat-assistant">Updating proceedings…</div>}
                  </div>
                  {/* Correction input */}
                  <textarea
                    rows={2}
                    aria-label="Instructions for RR Assistant"
                    disabled={isApplyingChanges}
                    value={correctionInstruction}
                    onChange={(e) => setCorrectionInstruction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        if (correctionInstruction.trim() && !isApplyingChanges) {
                          handleApplyChanges();
                        }
                      }
                    }}
                    placeholder={currentLanguage === 'en' ? "Describe a change to the proceedings… (Enter to send, Shift+Enter for a new line)" : "இங்கே உங்கள் கேள்வியை தட்டச்சு செய்யவும்... (Enter அழுத்தவும்)"}
                    style={{
                      width: '100%',
                      padding: '12px 16px 4px 16px',
                      border: 'none',
                      outline: 'none',
                      fontSize: '0.92rem',
                      fontFamily: "'Noto Sans Tamil', 'Plus Jakarta Sans', sans-serif",
                      color: '#102C57',
                      resize: 'none',
                      background: 'transparent',
                      lineHeight: '1.5'
                    }}
                  />

                  {/* Bottom Bar: Action buttons & Send button */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 16px 12px 16px',
                    borderTop: '1px solid #FEFAF6',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    {/* Revision status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {lastUpdatedMessage && (
                        <span style={{ fontSize: '0.8rem', color: '#102C57', fontWeight: 600, marginLeft: '6px' }}>
                          ✓ {lastUpdatedMessage}
                        </span>
                      )}
                    </div>

                    {/* Right Send Button */}
                    <button
                      type="button"
                      onClick={handleApplyChanges}
                      disabled={isApplyingChanges || !correctionInstruction.trim()}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 16px',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        color: isApplyingChanges || !correctionInstruction.trim() ? '#102C57' : '#102C57',
                        background: isApplyingChanges || !correctionInstruction.trim() ? '#FEFAF6' : '#FEFAF6',
                        border: '1px solid #EADBC8',
                        borderRadius: '8px',
                        cursor: isApplyingChanges || !correctionInstruction.trim() ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>{isApplyingChanges ? (currentLanguage === 'en' ? "Sending..." : "அனுப்புகிறது...") : (currentLanguage === 'en' ? "Send" : "அனுப்பு")}</span>
                      <Send size={13} className={isApplyingChanges ? "spinner" : ""} />
                    </button>
                  </div>
                </div>
              ) : (
                /* State 2: Original Scanned Petition Document Viewer */
                <div className="rr-original-document-viewer" style={{
                  background: '#0B192C',
                  border: '1px solid #102C57',
                  borderRadius: '12px',
                  boxShadow: '0 8px 30px rgba(16, 44, 87, 0.25)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  minHeight: 0,
                  position: 'relative'
                }}>
                  {/* Header Bar: Page Pagination & Close Button */}
                  <div style={{
                    padding: '0.65rem 1rem',
                    background: '#102C57',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    flexShrink: 0
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                      <FileText size={16} color="#DAC0A3" />
                      <span style={{ color: '#EADBC8' }}>Original Order</span>
                    </div>

                    {/* Close button */}
                    <button
                      type="button"
                      onClick={() => setShowOriginalDoc(false)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.12)',
                        border: 'none',
                        color: '#ffffff',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.785rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>CLOSE</span>
                      <X size={14} />
                    </button>
                  </div>

                  {/* Scanned Image Viewing Container */}
                  <div style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overflowX: 'auto',
                    padding: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#040d1a'
                  }}>
                    {docPreviewUrl ? (
                      sourceFile?.type === 'application/pdf' || (sourceFile?.name || fileInfo?.name || activeSession?.fileName || docPreviewUrl || '').toLowerCase().includes('.pdf')
                        ? <iframe src={docPreviewUrl} title="Original scanned order" style={{ width: '100%', height: '100%', border: 0 }} />
                        : <img src={docPreviewUrl} alt="Original scanned order" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : <p style={{ color: '#EADBC8' }}>The original file is not available in this saved session. Attach it again to view it.</p>}
                  </div>

                  {/* Bottom Status Bar */}
                  <div style={{
                    padding: '0.55rem 1rem',
                    background: '#081424',
                    color: '#94A3B8',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    flexShrink: 0
                  }}>
                    <span style={{ color: '#22c55e', fontSize: '0.9rem' }}>✓</span>
                    <span>Scanned document is read-only for officer verification.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>

      {isUploadScreen && <div className="rr-assistant-chat__composer-wrap">
        <div className="rr-assistant-chat__attachments">
        {workflowState === 'file_selected' && selectedFiles.map((file, index) => (
          <div className="rr-assistant-chat__attachment" key={`${file.name}-${file.size}-${file.lastModified}`}>
            <FileText size={17} aria-hidden="true" />
            <span>{file.name}</span>
            <button type="button" aria-label={`Remove ${file.name}`} onClick={() => {
              setSelectedFiles(previous => previous.filter((_, fileIndex) => fileIndex !== index));
              if (selectedFiles.length === 1) setWorkflowState(generatedContent ? 'generated' : 'upload');
            }}><X size={16} /></button>
          </div>
        ))}
        </div>
        {composerNotice && <p className="rr-assistant-chat__status" role="status">{composerNotice}</p>}
        <form className="rr-assistant-chat__composer" onSubmit={handleComposerSubmit}>
          <button type="button" className="rr-assistant-chat__attach" aria-label="Attach source documents"
            title="Attach source documents" disabled={busy} onClick={() => fileInputRef.current?.click()}>
            <Paperclip size={21} aria-hidden="true" />
          </button>
          <textarea rows={1} aria-label="Message to RR Assistant"
            placeholder="Type your message or attach a source document…"
            value={correctionInstruction} disabled={busy}
            onChange={(event) => { setCorrectionInstruction(event.target.value); setComposerNotice(''); }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form.requestSubmit();
              }
            }} />
          <button type="submit" className="rr-assistant-chat__send" aria-label="Send message"
            title="Send message" disabled={busy || (!correctionInstruction.trim() && !(workflowState === 'file_selected' && selectedFiles.length))}>
            {busy ? <RefreshCw size={19} className="spinner" /> : <Send size={19} />}
          </button>
        </form>
      </div>}
    </section>
  );
}

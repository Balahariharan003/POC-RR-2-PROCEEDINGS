import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  UploadCloud, 
  Download, 
  RefreshCw, 
  Check, 
  Copy, 
  PlusCircle, 
  Printer, 
  X, 
  AlertCircle,
  FileCheck,
  Edit3,
  ArrowRight,
  MessageSquare,
  Send,
  Paperclip,
  Mic,
  Smartphone
} from 'lucide-react';
import { apiService } from '../../services/apiService.js';
import MobileQrModal from '../upload/MobileQrModal.jsx';

export default function RRAssistantView({ 
  currentLanguage = 'en',
  onSelectRecent,
  activeSession = null,
  onSaveAuditLog
}) {
  // Workflow States: 'upload' | 'file_selected' | 'processing' | 'generated'
  const [workflowState, setWorkflowState] = useState('upload');
  const [showMobileQr, setShowMobileQr] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileInfo, setFileInfo] = useState({ name: '', sizeFormatted: '' });
  const [isDragOver, setIsDragOver] = useState(false);
  const [processingStage, setProcessingStage] = useState('Extracting document content...');
  const [processingStageNum, setProcessingStageNum] = useState(1);
  
  // Document Content & Correction
  const [generatedContent, setGeneratedContent] = useState('');
  const [correctionInstruction, setCorrectionInstruction] = useState('');
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastUpdatedMessage, setLastUpdatedMessage] = useState('');
  const [promptHistory, setPromptHistory] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (activeSession) return;
    try {
      const draft = JSON.parse(localStorage.getItem('rr_draft') || 'null');
      if (draft && typeof draft.content === 'string' && draft.content) {
        setGeneratedContent(draft.content);
        setFileInfo({ name: draft.fileName || 'Saved proceedings', sizeFormatted: draft.fileSize || '' });
        setPromptHistory(Array.isArray(draft.promptHistory) ? draft.promptHistory : []);
        setCurrentSessionId(draft.sessionId || null);
        setWorkflowState('generated');
      }
    } catch (error) { console.warn('Could not load saved draft:', error); }
  }, []);

  useEffect(() => {
    if (workflowState !== 'generated') return;
    try {
      localStorage.setItem('rr_draft', JSON.stringify({ content: generatedContent, fileName: fileInfo.name, fileSize: fileInfo.sizeFormatted, promptHistory, sessionId: currentSessionId }));
    } catch (error) { setLastUpdatedMessage('Draft could not be saved locally. Export the document to keep your changes.'); }
  }, [workflowState, generatedContent, fileInfo, promptHistory, currentSessionId]);

  // Restore session when activeSession prop changes (ChatGPT & Gemini style restore)
  useEffect(() => {
    if (activeSession && activeSession.documentContent) {
      setSelectedFile(null);
      setFileInfo({
        name: activeSession.fileName || activeSession.caseNumber || 'restored_order.pdf',
        sizeFormatted: activeSession.fileSize || '1.45 MB'
      });
      setGeneratedContent(activeSession.documentContent);
      setPromptHistory(activeSession.promptHistory || []);
      setCurrentSessionId(activeSession.id || `AUD-${Date.now()}`);
      setWorkflowState('generated');
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
  const handleFile = (file) => {
    if (!file) return;

    // Supported document & image validation
    const validExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
    const fileNameLower = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileNameLower.endsWith(ext)) || 
                    file.type.startsWith('image/') || 
                    file.type === 'application/pdf';

    if (!isValid) {
      alert("Please upload a valid document format (PDF, JPG, PNG, or WEBP).");
      return;
    }

    setSelectedFile(file);
    setFileInfo({
      name: file.name,
      sizeFormatted: formatFileSize(file.size)
    });
    setWorkflowState('file_selected');
  };

  // Drag & drop handlers
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Load sample demonstration PDF
  const handleLoadSample = async () => {
    const mockFile = {
      name: "sample_mcop_order.pdf",
      sizeFormatted: "1.45 MB"
    };
    setSelectedFile(null);
    setFileInfo(mockFile);
    setWorkflowState('file_selected');
  };

  // Trigger processing
  const handleGenerateContent = async () => {
    setWorkflowState('processing');
    setProcessingStage('Extracting document content');
    setProcessingStageNum(1);

    try {
      const t1 = setTimeout(() => {
        setProcessingStage('Analyzing structure');
        setProcessingStageNum(2);
      }, 700);

      const t2 = setTimeout(() => {
        setProcessingStage('Generating official content');
        setProcessingStageNum(3);
      }, 1400);

      let result;
      if (selectedFile) {
        result = await apiService.uploadDocument(selectedFile);
      } else {
        result = await apiService.loadSampleDocument();
      }

      clearTimeout(t1);
      clearTimeout(t2);

      const formattedDoc = apiService.formatDocumentSheet(result.entities);
      setGeneratedContent(formattedDoc);
      
      const newSessionId = `AUD-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`;
      const initialPrompt = {
        id: 1,
        prompt: `Ingested source order "${fileInfo.name || 'order.pdf'}" and synthesized draft proceedings.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setPromptHistory([initialPrompt]);
      setCurrentSessionId(newSessionId);

      // Auto-save to Audit Log Trail
      await apiService.saveAuditLog({
        id: newSessionId,
        caseNumber: result.entities?.case_details?.case_number || fileInfo.name.replace(/\.[^/.]+$/, ""),
        fileName: fileInfo.name || "order.pdf",
        fileSize: fileInfo.sizeFormatted || "1.45 MB",
        defaulter: result.entities?.defaulter?.name || "திரு.T.P.ராமலிங்கம்",
        taluk: result.entities?.jurisdiction?.taluk || "கொடுமுடி",
        district: result.entities?.jurisdiction?.district || "ஈரோடு",
        amount: `₹ ${Number(result.entities?.financials?.principal_amount || 460690).toLocaleString('en-IN')}/-`,
        status: "DRAFT",
        groundingScore: result.validation_insights?.grounding_score ?? 0.96,
        hallucinationScore: result.validation_insights?.hallucination_score ?? 0.04,
        promptHistory: [initialPrompt],
        documentContent: formattedDoc,
        notes: "Automated OCR extraction and draft generation completed in RR Assistant."
      });

      if (onSaveAuditLog) onSaveAuditLog();
      setWorkflowState('generated');
    } catch (err) {
      alert("Error processing document: " + err.message);
      setWorkflowState('file_selected');
    }
  };

  // Apply AI Correction / Modification (Section 7 & 8)
  const handleApplyChanges = async () => {
    if (!correctionInstruction.trim() || isApplyingChanges) return;

    setIsApplyingChanges(true);
    setLastUpdatedMessage('');

    try {
      const currentPromptText = correctionInstruction;
      const updatedText = await apiService.modifyContent(generatedContent, currentPromptText);
      setGeneratedContent(updatedText);
      
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
      await apiService.saveAuditLog({
        id: currentSessionId,
        caseNumber: fileInfo.name.replace(/\.[^/.]+$/, "") || "MCOP-225/2022",
        fileName: fileInfo.name || "order.pdf",
        promptHistory: updatedHistory,
        documentContent: updatedText,
        status: "VERIFIED"
      });

      if (onSaveAuditLog) onSaveAuditLog();
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      alert("Failed to copy text: " + e.message);
    }
  };

  // Download DOCX containing CURRENT edited content (Section 8)
  const handleDownloadDocx = async () => {
    const filename = `Official_${fileInfo.name.replace(/\.[^/.]+$/, "") || "Document"}.docx`;
    await apiService.exportDocx(generatedContent, filename);
  };

  // Download / Print PDF containing CURRENT edited content (Section 8)
  const handleDownloadPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${fileInfo.name.replace(/\.[^/.]+$/, "") || "Official_Document"}</title>
          <style>
            @page { size: A4; margin: 20mm; }
            body { 
              font-family: 'Noto Sans Tamil', 'Plus Jakarta Sans', Calibri, Arial, sans-serif; 
              font-size: 13.5px; 
              line-height: 1.8; 
              color: #1e293b; 
              padding: 25px; 
              background: #fff;
            }
            pre { 
              font-family: inherit; 
              white-space: pre-wrap; 
              word-wrap: break-word; 
              font-size: 13.5px; 
              line-height: 1.8; 
            }
          </style>
        </head>
        <body>
          <pre>${generatedContent}</pre>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Reset to initial upload (Section 9 & 11)
  const handleResetWorkflow = () => {
    try { localStorage.removeItem('rr_draft'); } catch (error) { console.warn('Could not clear draft:', error); }
    setPromptHistory([]);
    setCurrentSessionId(null);
    setSelectedFile(null);
    setFileInfo({ name: '', sizeFormatted: '' });
    setGeneratedContent('');
    setCorrectionInstruction('');
    setWorkflowState('upload');
  };

  return (
    <div style={{
      maxWidth: workflowState === 'generated' ? 'none' : '1000px',
      margin: '0 auto',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      paddingBottom: '2.5rem'
    }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFile(e.target.files[0]);
                }
              }}
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf"
              style={{ display: 'none' }}
            />
      {/* =========================================================================
          STEP 1 & 4: INITIAL CENTERED UPLOAD WORKSPACE (RR ASSISTANT DESIGN)
          ========================================================================= */}
      {workflowState === 'upload' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: '20px',
          textAlign: 'center',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          {/* Tamil Nadu State Seal Emblem */}
          <img 
            src="/assets/tn_emblem.svg" 
            alt="Tamil Nadu Government" 
            style={{ 
              width: '76px', 
              height: '76px', 
              margin: '0 auto 18px auto', 
              display: 'block', 
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.08))' 
            }} 
          />

          {/* Heading & Subheading */}
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: '#102C57',
            margin: '0 0 8px 0',
            letterSpacing: '-0.01em'
          }}>
            RR Proceedings Assistant
          </h1>
          <p style={{
            fontSize: '0.95rem',
            color: '#3A4B63',
            maxWidth: '540px',
            lineHeight: 1.5,
            margin: '0 auto 30px auto'
          }}>
            Upload a source document to generate RR proceedings in the fixed template.
          </p>

          {/* Centered White Upload Card (Exact Match to Reference Screenshot) */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100%',
              maxWidth: '540px',
              backgroundColor: isDragOver ? '#FEFAF6' : '#FFFFFF',
              border: isDragOver ? '2px dashed #102C57' : '2px dashed #DAC0A3',
              borderRadius: '16px',
              padding: '48px 32px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(16, 44, 87, 0.05)',
              transition: 'all 0.25s ease'
            }}
          >


            {/* Upload Icon Circle */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#FEFAF6',
              border: '1px solid #EADBC8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#102C57',
              marginBottom: '18px'
            }}>
              <UploadCloud size={30} color="#102C57" />
            </div>

            {/* Title & Description */}
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#102C57',
              margin: '0 0 6px 0'
            }}>
              Upload Source Document
            </h3>
            <p style={{
              fontSize: '0.875rem',
              color: '#687991',
              margin: '0 0 22px 0'
            }}>
              Drag &amp; drop your document here
            </p>

            {/* Dark Navy Browse Button */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              style={{
                backgroundColor: '#102C57',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '12px 32px',
                fontSize: '0.95rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16, 44, 87, 0.2)',
                transition: 'all 0.2s ease'
              }}
            >
              <span>Browse Document</span>
            </button>

            {/* Supported Formats */}
            <p style={{
              fontSize: '0.775rem',
              color: '#687991',
              marginTop: '18px',
              marginBottom: 0,
              fontWeight: 500
            }}>
              PDF • JPG • PNG • WEBP
            </p>

            {/* OR Divider */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              width: '60%',
              margin: '22px 0 14px 0',
              color: '#DAC0A3',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              <span style={{ flex: 1, height: '1px', backgroundColor: '#DAC0A3' }} />
              <span style={{ padding: '0 12px', color: '#DAC0A3' }}>OR</span>
              <span style={{ flex: 1, height: '1px', backgroundColor: '#DAC0A3' }} />
            </div>

            {/* Mobile Scan Option */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowMobileQr(true); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#102C57',
                fontSize: '0.875rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: '6px'
              }}
            >
              <Smartphone size={18} />
              <span>Scan using mobile</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile QR Intake Modal */}
      <MobileQrModal 
        isOpen={showMobileQr} 
        onClose={() => setShowMobileQr(false)} 
        onSimulateMobileUpload={handleLoadSample} 
      />

      {/* =========================================================================
          STEP 2 & 5: FILE SELECTED — DOCUMENT INFO & GENERATE ACTION
          ========================================================================= */}
      {workflowState === 'file_selected' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: '2.5rem',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.35rem 0' }}>
              RR Assistant
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500, margin: 0 }}>
              Document Ready for Content Generation
            </p>
          </div>

          <div style={{
            width: '100%',
            maxWidth: '540px',
            background: '#ffffff',
            border: '1px solid #bcd5ee',
            borderRadius: '16px',
            padding: '2.5rem 2rem',
            boxShadow: '0 4px 20px rgba(15, 33, 55, 0.06)',
            textAlign: 'center'
          }}>
            <span style={{
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 700,
              color: '#64748b'
            }}>
              Uploaded Document
            </span>

            {/* PDF File Card Icon */}
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '10px',
              background: '#eff6ff',
              border: '1px solid #dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '1rem auto 0.75rem auto'
            }}>
              <FileText size={28} color="#0e2942" />
            </div>

            <div style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: '#1e293b',
              wordBreak: 'break-all',
              marginBottom: '0.35rem'
            }}>
              {fileInfo.name}
            </div>

            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.5rem' }}>
              File size: {fileInfo.sizeFormatted}
            </div>

            <button
              onClick={() => {
                setSelectedFile(null);
                setWorkflowState('upload');
              }}
              className="btn btn-ghost"
              style={{ fontSize: '0.785rem', color: '#dc2626', marginBottom: '1.5rem' }}
            >
              [ Change Document ]
            </button>

            <div>
              <button
                onClick={handleGenerateContent}
                className="btn"
                style={{
                  width: '100%',
                  background: '#0e2942',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  padding: '0.85rem',
                  borderRadius: '8px',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(14, 41, 66, 0.3)'
                }}
              >
                Generate Official Content
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 3 & 5: PROCESSING STATE
          ========================================================================= */}
      {workflowState === 'processing' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: '3.5rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '520px',
            background: '#ffffff',
            border: '1px solid #bcd5ee',
            borderRadius: '16px',
            padding: '3rem 2rem',
            boxShadow: '0 8px 24px rgba(15, 33, 55, 0.08)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto'
            }}>
              <RefreshCw size={28} color="#0e2942" className="spinner" />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.5rem 0' }}>
              Processing document...
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1.75rem 0' }}>
              {fileInfo.name}
            </p>

            {/* Step list progress */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: processingStageNum >= 1 ? '#15803d' : '#64748b', fontWeight: processingStageNum === 1 ? 600 : 400 }}>
                {processingStageNum > 1 ? <Check size={16} color="#15803d" /> : <RefreshCw size={14} className="spinner" color="#0e2942" />}
                <span>Extracting document content</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: processingStageNum >= 2 ? (processingStageNum > 2 ? '#15803d' : '#0e2942') : '#94a3b8', fontWeight: processingStageNum === 2 ? 600 : 400 }}>
                {processingStageNum > 2 ? <Check size={16} color="#15803d" /> : processingStageNum === 2 ? <RefreshCw size={14} className="spinner" color="#0e2942" /> : <span style={{ width: '14px', display: 'inline-block', textAlign: 'center' }}>○</span>}
                <span>Analyzing structure</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: processingStageNum >= 3 ? '#0e2942' : '#94a3b8', fontWeight: processingStageNum === 3 ? 600 : 400 }}>
                {processingStageNum === 3 ? <RefreshCw size={14} className="spinner" color="#0e2942" /> : <span style={{ width: '14px', display: 'inline-block', textAlign: 'center' }}>○</span>}
                <span>Generating official content</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 6, 7, 8, 9, 10, 11: GENERATED OFFICIAL CONTENT SCREEN & CORRECTIONS
          ========================================================================= */}
      {workflowState === 'generated' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top Title & Action Bar */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '1rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
          }}>
            {/* Title & Document Info */}
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.2rem 0' }}>
                Generated RR Proceedings
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Document Information:</span>
                <strong style={{ color: '#0e2942' }}>{fileInfo.name}</strong>
              </div>
            </div>

            {/* Download Options (Section 8) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={handleCopy}
                className="btn btn-outline"
                style={{
                  fontSize: '0.8rem',
                  padding: '0.5rem 0.85rem',
                  borderColor: '#cbd5e1',
                  color: '#334155'
                }}
              >
                {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={handleDownloadPdf}
                className="btn btn-outline"
                style={{
                  fontSize: '0.8rem',
                  padding: '0.5rem 1rem',
                  borderColor: '#bcd5ee',
                  color: '#0e2942',
                  background: '#eff6ff'
                }}
              >
                <Printer size={15} />
                <span>Download PDF</span>
              </button>

              <button
                onClick={handleDownloadDocx}
                className="btn"
                style={{
                  fontSize: '0.8rem',
                  padding: '0.5rem 1.15rem',
                  background: '#0e2942',
                  color: '#ffffff',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  boxShadow: '0 2px 6px rgba(14, 41, 66, 0.25)'
                }}
              >
                <Download size={15} />
                <span>Download DOCX</span>
              </button>

              <button
                onClick={handleResetWorkflow}
                className="btn btn-ghost"
                style={{ fontSize: '0.785rem', color: '#64748b' }}
              >
                <PlusCircle size={15} />
                <span>Upload Docs</span>
              </button>
            </div>
          </div>

          <div className="rr-generated-layout">
          {/* Editable proceedings: 60% of the workspace */}
          <div className="rr-document-panel" style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '0.75rem 1.25rem',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#1e293b' }}>
                <Edit3 size={15} color="#0e2942" />
                <span>Generated Content (Editable)</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Click directly in the area below to edit text, dates, names, or paragraphs
              </span>
            </div>

            {/* Official Document Textarea Editor */}
            <div className="rr-document-editor">
              <textarea
                aria-label="Editable RR proceedings"
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '0',
                  padding: '1.5rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: '#ffffff',
                  color: '#1e293b',
                  fontFamily: "'TAU-Marutham', 'Noto Sans Tamil', 'Latha', 'Plus Jakarta Sans', sans-serif",
                  fontSize: '0.94rem',
                  lineHeight: '1.85',
                  outline: 'none',
                  resize: 'none',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)'
                }}
              />
            </div>
          </div>

          {/* Proceedings chat: 40% of the workspace */}
          <div className="rr-chat-panel" style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div className="rr-chat-heading">
              <MessageSquare size={18} />
              <div><h3>RR Assistant</h3><p>Request changes to your proceedings</p></div>
            </div>
            <div className="rr-chat-history" role="log" aria-label="Proceedings conversation" aria-live="polite">
              <div className="rr-chat-message rr-chat-assistant">Your proceedings are ready in the fixed template. Review the document on the left, or send an instruction to revise it.</div>
              {promptHistory.slice(1).map((item) => (
                <React.Fragment key={item.id}>
                  <div className="rr-chat-message rr-chat-user">{item.prompt}</div>
                  <div className="rr-chat-message rr-chat-assistant">The requested revision has been applied. Review the updated proceedings on the left.</div>
                </React.Fragment>
              ))}
              {isApplyingChanges && <div className="rr-chat-message rr-chat-assistant">Updating proceedings…</div>}
            </div>
            {/* Existing correction input and actions */}
            <textarea
              rows={3}
              aria-label="Instructions for RR Assistant"
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
                padding: '16px 20px 8px 20px',
                border: 'none',
                outline: 'none',
                fontSize: '0.92rem',
                fontFamily: "'Noto Sans Tamil', 'Plus Jakarta Sans', sans-serif",
                color: '#1e293b',
                resize: 'none',
                background: 'transparent',
                lineHeight: '1.6'
              }}
            />

            {/* Bottom Bar: Action buttons & Send button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 16px 12px 16px',
              borderTop: '1px solid #f1f5f9',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              {/* Left Action Buttons: Attachment & Voice Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 12px',
                    fontSize: '0.825rem',
                    color: '#475569',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="Attach file"
                >
                  <Paperclip size={14} color="#64748b" />
                  <span>{currentLanguage === 'en' ? "Attach" : "இணைப்பு"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    alert(currentLanguage === 'en' ? "Voice input listening..." : "குரல் உள்ளீடு பதிவு செய்யப்படுகிறது...");
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 12px',
                    fontSize: '0.825rem',
                    color: '#475569',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="Voice input"
                >
                  <Mic size={14} color="#64748b" />
                  <span>{currentLanguage === 'en' ? "Voice Input" : "குரல் உள்ளீடு"}</span>
                </button>

                {lastUpdatedMessage && (
                  <span style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 600, marginLeft: '6px' }}>
                    ✓ {lastUpdatedMessage}
                  </span>
                )}
              </div>

              {/* Right Send Button matching Screenshot 2 */}
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
                  color: isApplyingChanges || !correctionInstruction.trim() ? '#94a3b8' : '#334155',
                  background: isApplyingChanges || !correctionInstruction.trim() ? '#f8fafc' : '#f1f5f9',
                  border: '1px solid #e2e8f0',
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
          </div>
        </div>
      )}
    </div>
  );
}

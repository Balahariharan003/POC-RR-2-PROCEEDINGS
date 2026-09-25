import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Edit3, 
  Copy, 
  Download, 
  PlusCircle, 
  ChevronUp, 
  ChevronDown, 
  Sparkles, 
  Check, 
  Printer,
  RefreshCw,
  Eye,
  FileCheck
} from 'lucide-react';

export default function DocumentEditorPreview({
  entities,
  subjectText,
  setSubjectText,
  documentContent,
  setDocumentContent,
  onPromptRegenerate,
  onDownloadDocx,
  onDownloadPdf,
  onNewDocument,
  isRegenerating
}) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [copied, setCopied] = useState(false);
  const documentRef = useRef(null);

  const refNumber = entities?.proceedings_roc_number || "ERD/MEM/2026/225201";
  const docDate = entities?.proceedings_date || new Date().toLocaleDateString('en-GB').replace(/\//g, '.');

  // Handle Copy text to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(documentContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert("Failed to copy text: " + err.message);
    }
  };

  // Submit Prompt to Re-generate DOCX
  const handlePromptSubmit = (e) => {
    e.preventDefault();
    if (!promptText.trim()) return;
    onPromptRegenerate(promptText);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
      maxWidth: '1200px',
      margin: '0 auto',
      width: '100%'
    }}>
      {/* 1. INPUTS & AI REVISION PROMPT SECTION (MATCHING SCREENSHOT 1) */}
      {/* 1. INPUTS & AI REVISION PROMPT SECTION (MATCHING SCREENSHOT 1) */}
      <div style={{
        borderRadius: '12px',
        border: '1px solid #DAC0A3',
        overflow: 'hidden',
        background: '#FFFFFF',
        boxShadow: '0 2px 10px rgba(16, 44, 87, 0.04)'
      }}>
        {/* Collapsible Header */}
        <div 
          onClick={() => setIsMinimized(!isMinimized)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.85rem 1.25rem',
            cursor: 'pointer',
            background: '#102C57',
            borderBottom: isMinimized ? 'none' : '1px solid #DAC0A3',
            userSelect: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.2rem' }}>📰</span>
            <h3 style={{ 
              margin: 0, 
              fontSize: '1rem', 
              fontWeight: 700, 
              color: '#FFFFFF',
              fontFamily: 'var(--font-tamil)'
            }}>
              செய்தி குறிப்பு / செயல்முறை ஆணை — உள்ளீடுகள் (Inputs & AI Re-generation Prompt)
            </h3>
            <span style={{
              fontSize: '0.7rem',
              color: '#FEFAF6',
              background: 'rgba(234, 219, 200, 0.25)',
              border: '1px solid #DAC0A3',
              padding: '0.15rem 0.6rem',
              borderRadius: '9999px',
              fontWeight: 600
            }}>
              {isMinimized ? "Click to expand" : "Click to minimize"}
            </span>
          </div>

          <div style={{ color: '#FEFAF6' }}>
            {isMinimized ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </div>
        </div>

        {/* Expandable Form Body */}
        {!isMinimized && (
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* பொருள் (Subject) * */}
            <div className="form-group">
              <label className="form-label" style={{ 
                color: '#102C57', 
                fontFamily: 'var(--font-tamil)', 
                fontSize: '0.9rem',
                textTransform: 'none',
                fontWeight: 700
              }}>
                பொருள் (Subject) *
              </label>
              <textarea
                rows={3}
                className="form-input"
                value={subjectText}
                onChange={(e) => setSubjectText(e.target.value)}
                style={{
                  fontFamily: 'var(--font-tamil)',
                  fontSize: '0.92rem',
                  lineHeight: '1.6',
                  borderRadius: '8px',
                  background: '#FEFAF6',
                  border: '1px solid #DAC0A3',
                  color: '#102C57',
                  resize: 'vertical'
                }}
                placeholder='"உங்களைத் தேடி உங்கள் ஊரில்" திட்டம் — ஈரோடு மாவட்டம், பெருந்துறை வட்டத்தில் பல்வேறு வளர்ச்சித் திட்டப் பணிகளை ஆய்வு செய்தல்...'
              />
            </div>

            {/* AI PROMPT TEXTAREA (REQUIREMENT: Prompt to generate/fix docx if wrong info) */}
            <div className="form-group" style={{
              background: 'rgba(234, 219, 200, 0.3)',
              padding: '1rem',
              borderRadius: '10px',
              border: '1px solid #DAC0A3'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ 
                  color: '#102C57', 
                  fontSize: '0.85rem', 
                  fontWeight: 700, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.4rem',
                  textTransform: 'none'
                }}>
                  <Sparkles size={16} color="#102C57" />
                  <span>AI வழிகாட்டல் / திருத்தக் குறிப்பு (AI Prompt to Re-generate DOCX)</span>
                </label>
                <span style={{ fontSize: '0.72rem', color: '#102C57' }}>
                  If DOCX contains wrong info, specify modifications here
                </span>
              </div>

              <textarea
                rows={2}
                className="form-input"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="எ.கா: தொகையை ரூ. 5,00,000 என மாற்றி, தாலுகாவை பெருந்துறை என திருத்தி புதிய DOCX ஆணையை உருவாக்கவும்... (e.g. Change defaulter address to Santhai Medu, Perundurai and set recovery amount to Rs. 5,00,000)"
                style={{
                  fontFamily: 'var(--font-tamil)',
                  fontSize: '0.88rem',
                  lineHeight: '1.5',
                  marginBottom: '0.65rem',
                  background: '#FFFFFF',
                  border: '1px solid #DAC0A3',
                  color: '#102C57'
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                {/* Quick chip suggestions */}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {[
                    "Change taluk to Perundurai",
                    "Set principal to ₹5,00,000",
                    "Format as Press Release",
                    "Update Insurer to United India Insurance"
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPromptText(chip)}
                      className="btn btn-ghost"
                      style={{
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.7rem',
                        borderRadius: '9999px',
                        background: '#FFFFFF',
                        border: '1px solid #DAC0A3',
                        color: '#102C57'
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handlePromptSubmit}
                  disabled={isRegenerating || !promptText.trim()}
                  className="btn btn-primary"
                  style={{ fontSize: '0.825rem', padding: '0.5rem 1rem', gap: '0.45rem' }}
                >
                  <RefreshCw size={14} className={isRegenerating ? "spinner" : ""} />
                  <span>{isRegenerating ? "Re-generating..." : "AI மூலம் திருத்தி DOCX உருவாக்கு"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. SUCCESS HEADER & ACTION BAR (MATCHING SCREENSHOT 2) */}
      <div style={{
        padding: '0.9rem 1.5rem',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        background: '#FFFFFF',
        border: '1px solid #DAC0A3',
        boxShadow: '0 2px 8px rgba(16, 44, 87, 0.04)'
      }}>
        {/* Left Success Message */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            background: 'rgba(16, 44, 87, 0.08)',
            border: '1px solid #DAC0A3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#102C57'
          }}>
            <FileCheck size={22} />
          </div>
          <div>
            <div style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              color: '#102C57',
              fontFamily: 'var(--font-tamil)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>வெற்றிகரமாக உருவாக்கப்பட்டது!</span>
              <span style={{ fontSize: '0.785rem', fontWeight: 600, color: '#102C57' }}>
                (Successfully Created!)
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#102C57', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
              <span>{refNumber}</span>
              <span>•</span>
              <span>{docDate}</span>
              <span>•</span>
              <span style={{
                fontSize: '0.65rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                background: 'rgba(234, 219, 200, 0.45)',
                border: '1px solid #DAC0A3',
                color: '#102C57',
                fontWeight: 600
              }}>
                Template
              </span>
            </div>
          </div>
        </div>

        {/* Right Action Buttons (Matching Screenshot 2: Edit, Copy, PDF, DOCX, + New Document) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Edit Button */}
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className="btn btn-outline"
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              color: isEditMode ? '#FFFFFF' : '#102C57',
              background: isEditMode ? '#102C57' : '#FFFFFF',
              borderColor: '#DAC0A3'
            }}
          >
            <Edit3 size={15} color={isEditMode ? '#FFFFFF' : '#102C57'} />
            <span>{isEditMode ? 'Done Editing' : 'Edit'}</span>
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="btn btn-outline"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', borderColor: '#DAC0A3', color: '#102C57', background: '#FFFFFF' }}
          >
            {copied ? <Check size={15} color="#102C57" /> : <Copy size={15} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          {/* PDF Button */}
          <button
            onClick={onDownloadPdf}
            className="btn btn-outline"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', borderColor: '#DAC0A3', color: '#102C57', background: '#FFFFFF' }}
          >
            <Printer size={15} />
            <span>PDF</span>
          </button>

          {/* DOCX Button (Primary Highlighted Button) */}
          <button
            onClick={onDownloadDocx}
            className="btn btn-primary"
            style={{
              padding: '0.45rem 1.15rem',
              fontSize: '0.8rem',
              fontWeight: 700
            }}
          >
            <Download size={15} />
            <span>DOCX</span>
          </button>

          {/* + New Document Button */}
          <button
            onClick={onNewDocument}
            className="btn btn-ghost"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', color: '#102C57' }}
          >
            <PlusCircle size={15} />
            <span>+ New Document</span>
          </button>
        </div>
      </div>

      {/* 3. DOCUMENT PREVIEW / INLINE EDITOR CONTAINER (MATCHING SCREENSHOT 2) */}
      <div style={{
        borderRadius: '12px',
        overflow: 'hidden',
        background: '#ffffff',
        color: '#102C57',
        boxShadow: '0 4px 20px rgba(16, 44, 87, 0.06)',
        border: '1px solid #DAC0A3'
      }}>
        {/* Document Preview Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.65rem 1.25rem',
          background: '#FEFAF6',
          borderBottom: '1px solid #EADBC8',
          fontSize: '0.785rem',
          color: '#102C57'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
            <FileText size={15} color="#102C57" />
            <span>Document Preview</span>
          </div>
          {isEditMode && (
            <span style={{ color: '#102C57', fontWeight: 600 }}>
              ✏️ Direct editing enabled — edit text below
            </span>
          )}
        </div>

        {/* Document Sheet Body */}
        <div style={{
          padding: '2.5rem',
          minHeight: '520px',
          fontFamily: "'Noto Sans Tamil', 'Plus Jakarta Sans', serif",
          lineHeight: '1.8',
          fontSize: '0.92rem',
          color: '#102C57'
        }}>
          {isEditMode ? (
            /* Inline Editable Textarea */
            <textarea
              value={documentContent}
              onChange={(e) => setDocumentContent(e.target.value)}
              style={{
                width: '100%',
                minHeight: '480px',
                border: '1px solid #DAC0A3',
                borderRadius: '6px',
                padding: '1.25rem',
                fontFamily: "'Noto Sans Tamil', 'Plus Jakarta Sans', serif",
                fontSize: '0.92rem',
                lineHeight: '1.8',
                color: '#102C57',
                background: '#FEFAF6',
                outline: 'none',
                resize: 'vertical'
              }}
            />
          ) : (
            /* Rendered Document Sheet */
            <div ref={documentRef} style={{ whiteSpace: 'pre-wrap' }}>
              {documentContent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

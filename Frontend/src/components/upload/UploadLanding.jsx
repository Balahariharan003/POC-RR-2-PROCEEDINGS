import React, { useRef, useState } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  FileCheck, 
  ArrowRight,
  ShieldCheck,
  Cpu,
  Layers,
  FileType
} from 'lucide-react';

export default function UploadLanding({ 
  onFileUpload, 
  onLoadSample, 
  currentLanguage 
}) {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const isTamil = currentLanguage === 'ta';

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <div style={{
      maxWidth: '1000px',
      margin: '0 auto',
      padding: '2.5rem 1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem'
    }}>
      {/* Title & Banner */}
      <div style={{ textAlign: 'center', maxWidth: '750px', margin: '0 auto' }}>
        <div className="badge badge-emerald" style={{ marginBottom: '0.75rem' }}>
          <Sparkles size={13} />
          <span>Tamil Nadu Revenue Recovery & Grievance Co-Pilot</span>
        </div>
        <h2 style={{
          fontSize: '2rem',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: 'var(--text-main)',
          marginBottom: '0.65rem',
          lineHeight: '1.25'
        }}>
          {isTamil 
            ? 'மனு ஆவணப் பதிவேற்றம் மற்றும் செயல்முறை ஆணை உருவாக்கம்' 
            : 'Petition Document Ingestion & Proceedings Generator'}
        </h2>
        <p style={{
          fontSize: '0.95rem',
          color: 'var(--text-muted)',
          lineHeight: '1.6'
        }}>
          {isTamil
            ? 'நீதிமன்ற உத்தரவு அல்லது மனு ஆவணங்களை (PDF / DOCX) பதிவேற்றி உடனடியாக செயல்முறை ஆணைகளை உருவாக்கி, திருத்தி DOCX மற்றும் PDF ஆக பதிவிறக்கவும்.'
            : 'Upload court orders or petitions (PDF / DOCX) to extract entities, review and edit content, revise with AI prompts, and download as DOCX & PDF.'}
        </p>
      </div>

      {/* Main Upload Dropzone (Strictly PDF / DOCX) */}
      <div 
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className="glass-panel"
        style={{
          padding: '3.5rem 2rem',
          textAlign: 'center',
          borderRadius: 'var(--radius-xl)',
          border: isDragOver ? '2px dashed #38bdf8' : '2px dashed var(--border-card)',
          background: isDragOver ? 'rgba(2, 132, 199, 0.12)' : 'var(--bg-card)',
          cursor: 'pointer',
          transition: 'all 0.25s ease',
          boxShadow: isDragOver ? '0 0 30px rgba(56, 189, 248, 0.25)' : 'var(--shadow-md)'
        }}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept=".pdf,.docx,.doc,.png,.jpg,.jpeg" 
          style={{ display: 'none' }} 
        />

        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.2), rgba(16, 185, 129, 0.2))',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem auto'
        }}>
          <UploadCloud size={36} color="#38bdf8" />
        </div>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
          {isTamil ? 'PDF அல்லது DOCX ஆவணத்தை இங்கு பதிவேற்றவும்' : 'Upload PDF or DOCX Petition'}
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)', marginBottom: '1.5rem' }}>
          Drag & drop your <strong>.pdf</strong> or <strong>.docx</strong> file here, or click to browse
        </p>

        {/* Action Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            style={{ padding: '0.7rem 1.75rem', fontSize: '0.9rem' }}
          >
            <FileType size={18} />
            <span>Browse PDF / DOCX</span>
          </button>
        </div>
      </div>

      {/* Instant Demo Shortcut Bar */}
      <div className="glass-panel" style={{
        padding: '1.25rem 1.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        borderRadius: 'var(--radius-lg)',
        borderLeft: '4px solid #10b981'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(16, 185, 129, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FileCheck size={22} color="#10b981" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {isTamil ? 'மாதிரி ஆவணம் மூலம் உடனடியாக இயக்கவும்' : 'Instant Evaluation: Built-in MCOP Sample'}
            </h4>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              Test the end-to-end pipeline and edit the generated proceedings document immediately.
            </p>
          </div>
        </div>

        <button 
          onClick={onLoadSample}
          className="btn btn-success"
          style={{ padding: '0.65rem 1.25rem', fontSize: '0.875rem' }}
        >
          <span>Run Sample Pipeline</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Feature Badges Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '1.25rem'
      }}>
        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem', color: '#38bdf8' }}>
            <Cpu size={18} />
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>OCR & Entity Extraction</h4>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            Rapid extraction of parties, tribunal case numbers, award principal, and jurisdiction taluk.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem', color: '#a855f7' }}>
            <Sparkles size={18} />
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>AI Prompt Re-generation</h4>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            If the generated document has wrong information, give a prompt to immediately revise and re-create the DOCX.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem', color: '#10b981' }}>
            <FileType size={18} />
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>DOCX & PDF Export</h4>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            Edit content inline and download formatted Word (.docx) proceedings and printable PDF documents.
          </p>
        </div>
      </div>
    </div>
  );
}

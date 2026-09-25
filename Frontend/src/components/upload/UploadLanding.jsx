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
  FileType,
  Smartphone
} from 'lucide-react';

export default function UploadLanding({ 
  onFileUpload, 
  onLoadSample, 
  currentLanguage,
  onScanMobile
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
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 0.85rem',
          borderRadius: '9999px',
          background: 'rgba(234, 219, 200, 0.45)',
          border: '1px solid #DAC0A3',
          color: '#102C57',
          fontSize: '0.785rem',
          fontWeight: 600,
          marginBottom: '0.75rem'
        }}>
          <Sparkles size={13} color="#102C57" />
          <span>Tamil Nadu RR Assistant</span>
        </div>
        <h2 style={{
          fontSize: '2rem',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: '#102C57',
          marginBottom: '0.65rem',
          lineHeight: '1.25'
        }}>
          {isTamil 
            ? 'மனு ஆவணப் பதிவேற்றம் மற்றும் செயல்முறை ஆணை உருவாக்கம்' 
            : 'RR Proceedings Generator'}
        </h2>
        <p style={{
          fontSize: '0.95rem',
          color: '#102C57',
          lineHeight: '1.6'
        }}>
          {isTamil
            ? 'நீதிமன்ற உத்தரவு அல்லது மனு ஆவணங்களை (PDF / DOCX) பதிவேற்றி உடனடியாக செயல்முறை ஆணைகளை உருவாக்கி, திருத்தி DOCX மற்றும் PDF ஆக பதிவிறக்கவும்.'
            : 'Upload source documents (PDF / DOCX) to populate the fixed RR proceedings template, review and revise the content, and download as DOCX or PDF.'}
        </p>
      </div>

      {/* Main Upload Dropzone (Strictly PDF / DOCX) */}
      <div 
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: '3.5rem 2rem',
          textAlign: 'center',
          borderRadius: '16px',
          border: isDragOver ? '2px dashed #102C57' : '2px dashed #DAC0A3',
          background: isDragOver ? 'rgba(234, 219, 200, 0.35)' : '#FFFFFF',
          cursor: 'pointer',
          transition: 'all 0.25s ease',
          boxShadow: '0 4px 20px rgba(16, 44, 87, 0.05)'
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
          background: 'rgba(16, 44, 87, 0.08)',
          border: '1px solid #EADBC8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem auto'
        }}>
          <UploadCloud size={36} color="#102C57" />
        </div>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.4rem', color: '#102C57' }}>
          {isTamil ? 'PDF அல்லது DOCX ஆவணத்தை இங்கு பதிவேற்றவும்' : 'Upload PDF or DOCX Source Document'}
        </h3>
        <p style={{ fontSize: '0.875rem', color: '#102C57', marginBottom: '1.5rem' }}>
          Drag & drop your <strong>.pdf</strong> or <strong>.docx</strong> file here, or click to browse
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            style={{ padding: '0.7rem 1.75rem', fontSize: '0.9rem' }}
          >
            <FileType size={18} />
            <span>Browse PDF / DOCX</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={(e) => {
              e.stopPropagation();
              if (onScanMobile) onScanMobile();
            }}
            style={{ 
              padding: '0.7rem 1.75rem', 
              fontSize: '0.9rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Smartphone size={18} />
            <span>Scan using mobile</span>
          </button>
        </div>
      </div>

      {/* Feature Badges Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '1.25rem'
      }}>
        <div style={{
          padding: '1.25rem',
          borderRadius: '12px',
          background: '#FFFFFF',
          border: '1px solid #EADBC8',
          boxShadow: '0 2px 8px rgba(16, 44, 87, 0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem', color: '#102C57' }}>
            <Cpu size={18} color="#102C57" />
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>OCR & Entity Extraction</h4>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#102C57', lineHeight: '1.5' }}>
            Rapid extraction of parties, tribunal case numbers, award principal, and jurisdiction taluk.
          </p>
        </div>

        <div style={{
          padding: '1.25rem',
          borderRadius: '12px',
          background: '#FFFFFF',
          border: '1px solid #EADBC8',
          boxShadow: '0 2px 8px rgba(16, 44, 87, 0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem', color: '#102C57' }}>
            <Sparkles size={18} color="#102C57" />
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>AI Prompt Re-generation</h4>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#102C57', lineHeight: '1.5' }}>
            If the generated document has wrong information, give a prompt to immediately revise and re-create the DOCX.
          </p>
        </div>

        <div style={{
          padding: '1.25rem',
          borderRadius: '12px',
          background: '#FFFFFF',
          border: '1px solid #EADBC8',
          boxShadow: '0 2px 8px rgba(16, 44, 87, 0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem', color: '#102C57' }}>
            <FileType size={18} color="#102C57" />
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>DOCX & PDF Export</h4>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#102C57', lineHeight: '1.5' }}>
            Edit content inline and download formatted Word (.docx) proceedings and printable PDF documents.
          </p>
        </div>
      </div>
    </div>
  );
}

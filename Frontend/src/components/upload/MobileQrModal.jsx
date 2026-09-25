import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { 
  Smartphone, 
  X, 
  CheckCircle2, 
  Loader2, 
  RefreshCw 
} from 'lucide-react';
import { 
  createUploadSession, 
  subscribeToUpload, 
  cleanupUploadSession 
} from '../../services/uploadSessionService';

export default function MobileQrModal({ isOpen, onClose, onDocumentUploaded, onSimulateMobileUpload }) {
  const [sessionId, setSessionId] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(299); // 04:59
  const [isReceived, setIsReceived] = useState(false);
  const [receivedFileMeta, setReceivedFileMeta] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const unsubscribeRef = useRef(null);
  const sessionIdRef = useRef('');

  const handleUploadSuccess = useCallback(async (uploadedData) => {
    setIsReceived(true);
    setReceivedFileMeta(uploadedData);

    const isPdf = Boolean(
      uploadedData.isPdf ||
      (uploadedData.fileType && uploadedData.fileType.toLowerCase().includes('pdf')) ||
      (uploadedData.fileName && uploadedData.fileName.toLowerCase().endsWith('.pdf'))
    );

    const previewUrl = uploadedData.dataUrl || (uploadedData.file ? URL.createObjectURL(uploadedData.file) : null);
    
    let fileObj = uploadedData.file || null;
    if (!fileObj && uploadedData.dataUrl) {
      try {
        const res = await fetch(uploadedData.dataUrl);
        const blob = await res.blob();
        const fallbackExt = isPdf ? '.pdf' : '.jpg';
        const fallbackMime = isPdf ? 'application/pdf' : 'image/jpeg';
        fileObj = new File([blob], uploadedData.fileName || `mobile_petition_${Date.now()}${fallbackExt}`, {
          type: blob.type || uploadedData.fileType || fallbackMime
        });
      } catch (err) {
        console.warn('Could not convert dataUrl to File:', err);
      }
    }

    const uploadedDoc = {
      file: fileObj,
      id: `PET-${uploadedData.sessionId ? uploadedData.sessionId.substring(0, 6).toUpperCase() : Math.floor(100 + Math.random() * 900)}`,
      fileName: uploadedData.fileName || (isPdf ? 'mobile_petition.pdf' : 'mobile_petition.jpg'),
      fileSize: uploadedData.fileSize || (isPdf ? '2.4 MB' : '1.8 MB'),
      fileType: uploadedData.fileType || (isPdf ? 'PDF Document (Mobile)' : 'Scanned Image (Mobile)'),
      isPdf: isPdf,
      previewUrl: previewUrl,
      uploadedAt: `Today at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      totalPages: 1,
      language: 'Tamil',
      confidenceScore: 95,
      status: 'Processing',
      summary: '',
      portalDetails: null,
      rawOcrText: '',
      qaDatabase: []
    };

    setTimeout(() => {
      if (onDocumentUploaded) onDocumentUploaded(uploadedDoc);
      if (onSimulateMobileUpload) onSimulateMobileUpload(uploadedDoc);
      onClose();
    }, 900);
  }, [onDocumentUploaded, onSimulateMobileUpload, onClose]);

  const initSession = useCallback(async () => {
    setIsGenerating(true);
    setIsReceived(false);
    setReceivedFileMeta(null);
    setSecondsRemaining(299);

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    try {
      const sessionResult = await createUploadSession();
      const newSessionId = typeof sessionResult === 'object' ? sessionResult.sessionId : sessionResult;
      const networkHost = typeof sessionResult === 'object' ? sessionResult.networkHost : null;

      console.log('NETWORK HOST:', networkHost);

      setSessionId(newSessionId);
      sessionIdRef.current = newSessionId;

      // Prioritize LAN Wi-Fi network host so phone cameras connect immediately
      let targetOrigin = window.location.origin;
      console.log('TARGET ORIGIN BEFORE:', targetOrigin);
console.log('NETWORK HOST:', networkHost);
      if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && networkHost) {
        targetOrigin = networkHost;
      }

      const targetUrl = `http://10.12.171.109:5173/capture/${newSessionId}`;

console.log('FINAL QR URL:', targetUrl);

      const dataUrl = await QRCode.toDataURL(targetUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: '#102C57',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      setQrDataUrl(dataUrl);

      unsubscribeRef.current = subscribeToUpload(newSessionId, (uploadedData) => {
        handleUploadSuccess(uploadedData);
      });
    } catch (err) {
      console.error('Failed to initialize QR session:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [handleUploadSuccess]);

  // Initialize new session when modal opens
  useEffect(() => {
    if (!isOpen) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (sessionIdRef.current) {
        cleanupUploadSession(sessionIdRef.current);
        sessionIdRef.current = '';
      }
      return;
    }

    initSession();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [isOpen, initSession]);

  // Countdown timer for 5 minutes
  useEffect(() => {
    if (!isOpen || isReceived || secondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isReceived, secondsRemaining]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(16, 44, 87, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem'
      }}
      onClick={onClose}
      role="dialog" 
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <div 
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #DAC0A3',
          boxShadow: '0 20px 50px rgba(16, 44, 87, 0.25)',
          padding: '1.75rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Close (X) Button - Top Right Corner */}
        <button 
          type="button" 
          onClick={onClose}
          aria-label="Close modal"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: '#687991',
            cursor: 'pointer',
            padding: '0.4rem',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 44, 87, 0.08)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <X size={20} />
        </button>

        {/* Heading: Scan using mobile */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          marginBottom: '1.25rem',
          marginTop: '0.25rem'
        }}>
          <Smartphone size={22} color="#102C57" />
          <h3 id="qr-modal-title" style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#102C57',
            margin: 0,
            letterSpacing: '-0.01em'
          }}>
            Scan using mobile
          </h3>
        </div>

        {/* Modal Body */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          {/* Normal / Waiting State */}
          {!isReceived && secondsRemaining > 0 && (
            <>
              {/* Centered QR Code Box */}
              <div 
                style={{
                  background: '#FEFAF6',
                  border: '1px solid #EADBC8',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.25rem',
                  maxWidth: '220px',
                  width: '100%',
                  aspectRatio: '1',
                  boxSizing: 'border-box',
                  boxShadow: '0 2px 8px rgba(16, 44, 87, 0.04)'
                }}
                title="Scan with phone camera to capture petition"
              >
                {isGenerating ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '180px' }}>
                    <Loader2 size={32} color="#102C57" className="spinner" />
                  </div>
                ) : qrDataUrl ? (
                  <img 
                    src={qrDataUrl} 
                    alt={`QR Code for capture session ${sessionId}`} 
                    style={{
                      width: '100%',
                      height: '100%',
                      maxWidth: '180px',
                      maxHeight: '180px',
                      objectFit: 'contain',
                      borderRadius: '6px'
                    }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '180px' }}>
                    <Loader2 size={32} color="#102C57" className="spinner" />
                  </div>
                )}
              </div>

              {/* Description Text */}
              <p style={{
                fontSize: '0.875rem',
                color: '#3A4B63',
                lineHeight: '1.5',
                margin: '0 0 1rem 0',
                maxWidth: '360px',
                textAlign: 'center'
              }}>
                Scan this QR code with your phone camera to capture and upload the petition document.
              </p>

              {/* Waiting Status Pill with Pulsing Dot */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.85rem',
                borderRadius: '9999px',
                background: 'rgba(16, 44, 87, 0.06)',
                border: '1px solid #EADBC8',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#102C57',
                marginBottom: '0.75rem'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  display: 'inline-block'
                }}></span>
                <span>Waiting for document...</span>
              </div>

              {/* Session Expiry Text */}
              <div style={{
                fontSize: '0.8rem',
                color: '#687991',
                marginBottom: '1.5rem',
                textAlign: 'center'
              }}>
                Session expires in <strong style={{ fontFamily: 'monospace', color: '#102C57', fontWeight: 700 }}>{formatTime(secondsRemaining)}</strong>
              </div>
            </>
          )}

          {/* Expired State */}
          {!isReceived && secondsRemaining === 0 && (
            <div style={{ padding: '1rem 0 1.5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                padding: '0.41rem 1rem',
                borderRadius: '9999px',
                background: '#fee2e2',
                color: '#991b1b',
                fontSize: '0.8rem',
                fontWeight: 600
              }}>
                Session expired
              </div>
              <p style={{ fontSize: '0.875rem', color: '#687991', margin: 0, textAlign: 'center' }}>
                The temporary mobile upload session has timed out.
              </p>
              <button 
                type="button" 
                onClick={initSession}
                className="btn btn-primary"
                style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <RefreshCw size={15} />
                <span>Generate New QR</span>
              </button>
            </div>
          )}

          {/* Success / Document Received State */}
          {isReceived && (
            <div style={{ padding: '1rem 0 1.5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#166534'
              }}>
                <CheckCircle2 size={36} />
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#102C57' }}>
                Petition uploaded successfully
              </div>
              <div style={{ fontSize: '0.85rem', color: '#687991' }}>
                Loading document into workspace...
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#102C57', fontFamily: 'monospace' }}>
                <Loader2 size={14} className="spinner" />
                <span>{receivedFileMeta?.fileName || 'petition.jpg'}</span>
              </div>
            </div>
          )}

        </div>

        {/* Cancel Button Centered at Bottom */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <button 
            type="button" 
            onClick={onClose}
            style={{
              backgroundColor: '#FEFAF6',
              border: '1px solid #DAC0A3',
              color: '#102C57',
              borderRadius: '8px',
              padding: '0.65rem 2rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              minWidth: '140px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#EADBC8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FEFAF6';
            }}
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}

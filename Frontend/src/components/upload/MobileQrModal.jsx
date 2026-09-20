import React, { useState } from 'react';
import { X, Smartphone, Wifi, Camera, RefreshCw, Send, CheckCircle2 } from 'lucide-react';

export default function MobileQrModal({ isOpen, onClose, onSimulateMobileUpload }) {
  const [paired, setPaired] = useState(false);
  const localUrl = `http://${window.location.hostname || '192.168.1.42'}:5173/mobile-intake?session=ERD-${Math.floor(1000 + Math.random()*9000)}`;

  if (!isOpen) return null;

  const handleSimulate = () => {
    setPaired(true);
    setTimeout(() => {
      onSimulateMobileUpload();
      onClose();
    }, 1200);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(16, 44, 87, 0.65)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1050,
      padding: '1.5rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        padding: '2rem',
        borderRadius: '16px',
        background: '#FFFFFF',
        border: '1px solid #DAC0A3',
        boxShadow: '0 25px 60px rgba(16, 44, 87, 0.25)',
        textAlign: 'center',
        position: 'relative'
      }}>
        <button 
          onClick={onClose}
          className="btn btn-ghost"
          style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.4rem', color: '#687991' }}
        >
          <X size={18} />
        </button>

        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(16, 44, 87, 0.08)',
          border: '1px solid #EADBC8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem auto'
        }}>
          <Smartphone size={28} color="#102C57" />
        </div>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.4rem 0', color: '#102C57' }}>
          Pair Smartphone for Live Document Scanning
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#3A4B63', margin: '0 0 1.5rem 0' }}>
          Field staff can capture source documents using mobile camera. Images stream in real-time over local Wi-Fi.
        </p>

        {/* Dynamic QR Code Canvas */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '1.25rem',
          display: 'inline-block',
          border: '1px solid #EADBC8',
          boxShadow: '0 4px 16px rgba(16, 44, 87, 0.08)',
          marginBottom: '1.25rem'
        }}>
          {/* Stylized QR Code SVG */}
          <svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="180" height="180" fill="white"/>
            {/* Top-Left Finder */}
            <rect x="15" y="15" width="45" height="45" rx="6" fill="#102C57"/>
            <rect x="23" y="23" width="29" height="29" rx="3" fill="white"/>
            <rect x="29" y="29" width="17" height="17" rx="2" fill="#102C57"/>
            
            {/* Top-Right Finder */}
            <rect x="120" y="15" width="45" height="45" rx="6" fill="#102C57"/>
            <rect x="128" y="23" width="29" height="29" rx="3" fill="white"/>
            <rect x="134" y="29" width="17" height="17" rx="2" fill="#102C57"/>
            
            {/* Bottom-Left Finder */}
            <rect x="15" y="120" width="45" height="45" rx="6" fill="#102C57"/>
            <rect x="23" y="128" width="29" height="29" rx="3" fill="white"/>
            <rect x="29" y="134" width="17" height="17" rx="2" fill="#102C57"/>
            
            {/* Dynamic Code Matrix Elements */}
            <rect x="75" y="20" width="15" height="15" fill="#3A4B63"/>
            <rect x="95" y="25" width="10" height="25" fill="#3A4B63"/>
            <rect x="20" y="75" width="20" height="15" fill="#3A4B63"/>
            <rect x="50" y="70" width="15" height="20" fill="#3A4B63"/>
            <rect x="75" y="75" width="30" height="30" rx="4" fill="#102C57"/>
            <rect x="115" y="80" width="20" height="15" fill="#3A4B63"/>
            <rect x="145" y="70" width="15" height="25" fill="#3A4B63"/>
            <rect x="75" y="120" width="25" height="15" fill="#3A4B63"/>
            <rect x="110" y="125" width="20" height="20" fill="#3A4B63"/>
            <rect x="140" y="135" width="25" height="25" fill="#3A4B63"/>
            <rect x="90" y="145" width="15" height="15" fill="#3A4B63"/>
          </svg>
        </div>

        {/* Connection Details */}
        <div style={{
          background: '#FEFAF6',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          border: '1px solid #EADBC8',
          fontSize: '0.75rem',
          color: '#3A4B63',
          fontFamily: 'var(--font-mono)',
          wordBreak: 'break-all',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem'
        }}>
          <Wifi size={14} color="#102C57" />
          <span>{localUrl}</span>
        </div>

        {/* Simulation / Action Trigger */}
        <button 
          onClick={handleSimulate}
          disabled={paired}
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.75rem', gap: '0.65rem' }}
        >
          {paired ? (
            <>
              <CheckCircle2 size={18} color="#FFFFFF" />
              <span>Smartphone Paired! Ingesting Stream...</span>
            </>
          ) : (
            <>
              <Camera size={18} />
              <span>Simulate Mobile Camera Intake</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

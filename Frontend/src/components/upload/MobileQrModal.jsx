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
      background: 'rgba(3, 7, 18, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1050,
      padding: '1.5rem'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '520px',
        padding: '2rem',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
        textAlign: 'center',
        position: 'relative'
      }}>
        <button 
          onClick={onClose}
          className="btn btn-ghost"
          style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.4rem' }}
        >
          <X size={18} />
        </button>

        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(56, 189, 248, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem auto'
        }}>
          <Smartphone size={28} color="#38bdf8" />
        </div>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.4rem 0', color: '#f8fafc' }}>
          Pair Smartphone for Live Document Scanning
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.5rem 0' }}>
          Field staff can capture physical petition sheets using mobile camera. Images stream in real-time over local Wi-Fi.
        </p>

        {/* Dynamic QR Code Canvas */}
        <div style={{
          background: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          display: 'inline-block',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          marginBottom: '1.25rem'
        }}>
          {/* Stylized QR Code SVG */}
          <svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="180" height="180" fill="white"/>
            {/* Top-Left Finder */}
            <rect x="15" y="15" width="45" height="45" rx="6" fill="#0f172a"/>
            <rect x="23" y="23" width="29" height="29" rx="3" fill="white"/>
            <rect x="29" y="29" width="17" height="17" rx="2" fill="#0284c7"/>
            
            {/* Top-Right Finder */}
            <rect x="120" y="15" width="45" height="45" rx="6" fill="#0f172a"/>
            <rect x="128" y="23" width="29" height="29" rx="3" fill="white"/>
            <rect x="134" y="29" width="17" height="17" rx="2" fill="#0284c7"/>
            
            {/* Bottom-Left Finder */}
            <rect x="15" y="120" width="45" height="45" rx="6" fill="#0f172a"/>
            <rect x="23" y="128" width="29" height="29" rx="3" fill="white"/>
            <rect x="29" y="134" width="17" height="17" rx="2" fill="#0284c7"/>
            
            {/* Dynamic Code Matrix Elements */}
            <rect x="75" y="20" width="15" height="15" fill="#1e293b"/>
            <rect x="95" y="25" width="10" height="25" fill="#1e293b"/>
            <rect x="20" y="75" width="20" height="15" fill="#1e293b"/>
            <rect x="50" y="70" width="15" height="20" fill="#1e293b"/>
            <rect x="75" y="75" width="30" height="30" rx="4" fill="#0284c7"/>
            <rect x="115" y="80" width="20" height="15" fill="#1e293b"/>
            <rect x="145" y="70" width="15" height="25" fill="#1e293b"/>
            <rect x="75" y="120" width="25" height="15" fill="#1e293b"/>
            <rect x="110" y="125" width="20" height="20" fill="#1e293b"/>
            <rect x="140" y="135" width="25" height="25" fill="#1e293b"/>
            <rect x="90" y="145" width="15" height="15" fill="#1e293b"/>
          </svg>
        </div>

        {/* Connection Details */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.75rem',
          color: 'var(--text-dim)',
          fontFamily: 'var(--font-mono)',
          wordBreak: 'break-all',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem'
        }}>
          <Wifi size={14} color="#10b981" />
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
              <CheckCircle2 size={18} color="#10b981" />
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

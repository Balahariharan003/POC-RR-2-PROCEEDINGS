import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, Clock, FileText, Cpu, Calculator, Award } from 'lucide-react';

export default function ProcessingOverlay({ isProcessing, currentFileName }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [elapsed, setElapsed] = useState(0);

  const steps = [
    {
      id: 1,
      title: "Document Ingestion & High-DPI Rendering",
      desc: "Decompressing PDF/Image stream at 300 DPI for layout analysis",
      icon: FileText
    },
    {
      id: 2,
      title: "PaddleOCR Spatial Geometry Extraction",
      desc: "Detecting Tamil & English text boxes and reading order layout",
      icon: Cpu
    },
    {
      id: 3,
      title: "Local LLM Legal Entity Parsing (Qwen 2.5)",
      desc: "Extracting defaulter, beneficiary, court decree, and claim award",
      icon: Award
    },
    {
      id: 4,
      title: "Grounding Assessment & Math Validation",
      desc: "Verifying principal amounts, calculating interest, and Tamil currency words",
      icon: Calculator
    },
    {
      id: 5,
      title: "Proceedings Order Synthesis",
      desc: "Formatting Tamil Nadu District Collector Proceedings Form 5",
      icon: CheckCircle
    }
  ];

  useEffect(() => {
    if (!isProcessing) {
      setCurrentStep(1);
      setElapsed(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsed((prev) => +(prev + 0.1).toFixed(1));
    }, 100);

    // Progressive step advancement for smooth visual feedback
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev < 5 ? prev + 1 : 5));
    }, 900);

    return () => {
      clearInterval(timer);
      clearInterval(stepInterval);
    };
  }, [isProcessing]);

  if (!isProcessing) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 7, 18, 0.88)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1.5rem'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '620px',
        padding: '2.5rem',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
        border: '1px solid rgba(56, 189, 248, 0.3)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.2), rgba(16, 185, 129, 0.2))',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem auto'
          }}>
            <Loader2 size={32} color="#38bdf8" className="spinner" />
          </div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.35rem 0', color: '#f8fafc' }}>
            5-Step Revenue Recovery Pipeline
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Processing <strong style={{ color: '#38bdf8' }}>{currentFileName || "petition document"}</strong> • {elapsed}s elapsed
          </p>
        </div>

        {/* Steps Stepper List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {steps.map((step) => {
            const Icon = step.icon;
            const isDone = currentStep > step.id;
            const isCurrent = currentStep === step.id;

            return (
              <div 
                key={step.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: isCurrent 
                    ? 'rgba(2, 132, 199, 0.15)' 
                    : isDone 
                      ? 'rgba(16, 185, 129, 0.08)' 
                      : 'rgba(15, 23, 42, 0.4)',
                  border: isCurrent 
                    ? '1px solid rgba(56, 189, 248, 0.4)' 
                    : isDone 
                      ? '1px solid rgba(16, 185, 129, 0.2)' 
                      : '1px solid var(--border-subtle)',
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: isDone ? '#10b981' : isCurrent ? '#0284c7' : 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  flexShrink: 0
                }}>
                  {isDone ? <CheckCircle size={18} /> : isCurrent ? <Loader2 size={16} className="spinner" /> : step.id}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: isCurrent ? 700 : 600, 
                    color: isCurrent ? '#38bdf8' : isDone ? '#34d399' : 'var(--text-dim)',
                    marginBottom: '0.15rem'
                  }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {step.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

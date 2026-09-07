import React, { useState } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  FileText, 
  Layers, 
  ChevronLeft, 
  ChevronRight,
  Sparkles
} from 'lucide-react';

export default function DocumentViewer({ 
  boundingBoxes = [], 
  activeHighlightId, 
  onBoxClick,
  rawOcrText = "",
  currentCaseNumber = "MCOP-225/2022"
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showBoxes, setShowBoxes] = useState(true);
  const [activeTab, setActiveTab] = useState('visual'); // 'visual' | 'raw'
  const [hoveredBox, setHoveredBox] = useState(null);

  const pageBoxes = boundingBoxes.filter((b) => b.page === currentPage);

  const handleZoom = (delta) => {
    setZoomLevel((prev) => Math.min(1.8, Math.max(0.7, +(prev + delta).toFixed(1))));
  };

  return (
    <div className="glass-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden'
    }}>
      {/* Viewer Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.65rem 1rem',
        borderBottom: '1px solid var(--border-card)',
        background: 'rgba(15, 23, 42, 0.7)',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        {/* Left Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            onClick={() => setActiveTab('visual')}
            className={`btn ${activeTab === 'visual' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.785rem' }}
          >
            <Layers size={14} />
            <span>Interactive Layout</span>
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`btn ${activeTab === 'raw' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.785rem' }}
          >
            <FileText size={14} />
            <span>Raw OCR Text</span>
          </button>
        </div>

        {/* Center Page Nav */}
        {activeTab === 'visual' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="btn btn-ghost"
              style={{ padding: '0.25rem', borderRadius: 'var(--radius-sm)' }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '0.785rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Page {currentPage} of 2
            </span>
            <button
              onClick={() => setCurrentPage(2)}
              disabled={currentPage === 2}
              className="btn btn-ghost"
              style={{ padding: '0.25rem', borderRadius: 'var(--radius-sm)' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Right Zoom & Layer Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {activeTab === 'visual' && (
            <>
              <button
                onClick={() => setShowBoxes(!showBoxes)}
                className="btn btn-ghost"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', gap: '0.35rem' }}
                title="Toggle OCR Bounding Boxes"
              >
                {showBoxes ? <Eye size={14} color="#38bdf8" /> : <EyeOff size={14} />}
                <span>OCR Boxes</span>
              </button>

              <button
                onClick={() => handleZoom(-0.1)}
                className="btn btn-ghost"
                style={{ padding: '0.35rem' }}
                title="Zoom Out"
              >
                <ZoomOut size={15} />
              </button>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', minWidth: '40px', textAlign: 'center' }}>
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => handleZoom(0.1)}
                className="btn btn-ghost"
                style={{ padding: '0.35rem' }}
                title="Zoom In"
              >
                <ZoomIn size={15} />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="btn btn-ghost"
                style={{ padding: '0.35rem' }}
                title="Reset Zoom"
              >
                <RotateCcw size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Canvas View */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        position: 'relative',
        background: 'var(--bg-primary)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '2rem'
      }}>
        {activeTab === 'visual' ? (
          <div 
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
              width: '595px', // Standard A4 Aspect Ratio 1:1.414
              minHeight: '842px',
              background: '#fcfbf7', // Document parchment paper color
              color: '#1e293b',
              boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
              borderRadius: '4px',
              position: 'relative',
              padding: '2.5rem',
              fontFamily: "'Noto Sans Tamil', 'Plus Jakarta Sans', serif",
              userSelect: 'none'
            }}
          >
            {/* Scanned Document Header Graphic */}
            <div style={{ textAlign: 'center', borderBottom: '1px solid #94a3b8', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.72rem', letterSpacing: '0.1em', color: '#64748b', textTransform: 'uppercase' }}>
                State of Tamil Nadu • Judiciary Records
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
                {currentPage === 1 
                  ? "மோட்டார் வாகன விபத்து இழப்பீட்டு தீர்ப்பாயம், ஈரோடு" 
                  : "சான்றிதழ் மற்றும் தீர்ப்பு விவரக் குறிப்பு - பக்கம் 2"}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                வழக்கு எண்: {currentCaseNumber} • உத்தரவு நகல்
              </div>
            </div>

            {/* Document Watermark */}
            <div style={{
              position: 'absolute',
              top: '40%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-30deg)',
              fontSize: '4.5rem',
              fontWeight: 900,
              color: 'rgba(0, 0, 0, 0.03)',
              pointerEvents: 'none',
              letterSpacing: '0.1em'
            }}>
              OFFICIAL DECREE
            </div>

            {/* Render OCR Bounding Boxes */}
            {showBoxes && pageBoxes.map((box) => {
              const isActiveHighlight = activeHighlightId === box.id;
              const isHovered = hoveredBox?.id === box.id;

              return (
                <div
                  key={box.id}
                  onClick={() => onBoxClick?.(box)}
                  onMouseEnter={() => setHoveredBox(box)}
                  onMouseLeave={() => setHoveredBox(null)}
                  style={{
                    position: 'absolute',
                    left: `${box.bbox.x}%`,
                    top: `${box.bbox.y}%`,
                    width: `${box.bbox.w}%`,
                    height: `${box.bbox.h}%`,
                    border: isActiveHighlight 
                      ? '2px solid #0284c7' 
                      : isHovered 
                        ? '1.5px solid #10b981' 
                        : '1px dashed rgba(2, 132, 199, 0.55)',
                    background: isActiveHighlight 
                      ? 'rgba(2, 132, 199, 0.25)' 
                      : isHovered 
                        ? 'rgba(16, 185, 129, 0.18)' 
                        : 'rgba(2, 132, 199, 0.08)',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isActiveHighlight ? '0 0 15px rgba(2, 132, 199, 0.8)' : 'none',
                    zIndex: isActiveHighlight ? 20 : isHovered ? 15 : 10
                  }}
                >
                  {/* Confidence Pill on Hover/Active */}
                  {(isHovered || isActiveHighlight) && (
                    <div style={{
                      position: 'absolute',
                      bottom: '105%',
                      left: '0',
                      background: '#0f172a',
                      color: '#ffffff',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.68rem',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      pointerEvents: 'none',
                      zIndex: 30
                    }}>
                      <span style={{ color: '#38bdf8', fontWeight: 600 }}>{box.id}</span>
                      <span>OCR: {Math.round(box.confidence * 100)}%</span>
                      <span style={{ color: '#94a3b8' }}>• {box.fieldKey}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Document Body Background Sample Text */}
            <div style={{ fontSize: '0.85rem', lineHeight: '2.1', color: '#334155' }}>
              {currentPage === 1 ? (
                <div>
                  <p style={{ marginBottom: '1.25rem' }}>
                    ஈரோடு மாவட்டம், மோட்டார் விபத்து இழப்பீட்டு தீர்ப்பாயம் மற்றும் சார்பு நீதிமன்றத்தில் நிலுவையில் உள்ள வழக்கு எண் MCOP-225/2022 மற்றும் மனு எண் I.A.No.08/2026 உத்தரவு.
                  </p>
                  <p style={{ marginBottom: '1.25rem' }}>
                    <strong>மனுதாரர்:</strong> Cholamandalam MS General Insurance Co. Ltd., Erode.
                  </p>
                  <p style={{ marginBottom: '1.25rem' }}>
                    <strong>எதிர்மனுதாரர்:</strong> திரு.T.P.ராமலிங்கம், த/பெ.பழனிச்சாமி, கதவு எண் 90/6, சந்தை மேடு, சிவகிரி, கொடுமுடி வட்டம், ஈரோடு மாவட்டம்.
                  </p>
                  <p style={{ marginBottom: '1.25rem' }}>
                    மேற்படி எதிர்மனுதாரரிடமிருந்து நீதிமன்ற தீர்ப்பின்படி ரூ. 4,60,690/- (ரூபாய் நான்கு இலட்சத்து அறுபதாயிரத்து அறுநூற்றி தொண்ணூறு மட்டும்) தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் நிலவரி பாக்கி போல் வசூலிக்க மாவட்ட ஆட்சியருக்கு பரிந்துரைக்கப்படுகிறது.
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ marginBottom: '1.25rem' }}>
                    மோட்டார் வாகனச் சட்டம் 1988 பிரிவு 174-ன் கீழ் வழங்கப்பட்ட சான்றிதழ் விவரங்கள்:
                  </p>
                  <p style={{ marginBottom: '1.25rem' }}>
                    இழப்பீட்டுத் தொகைக்கு ஆண்டுக்கு 7.5% வட்டி கணக்கிடப்பட்டு கொடுமுடி வருவாய் வட்டாட்சியர் அவர்கள் மூலம் பாக்கிதாரரின் சொத்துக்கள் மீது ஜப்தி நடவடிக்கை மேற்கொண்டு வசூலிக்க ஆணை பிறப்பிக்கப்படுகிறது.
                  </p>
                  <div style={{ marginTop: '5rem', textAlign: 'right' }}>
                    <p style={{ fontWeight: 700 }}>சிறப்பு சார்பு நீதிபதி,</p>
                    <p>மோட்டார் வாகன விபத்து இழப்பீட்டு தீர்ப்பாயம்,</p>
                    <p>ஈரோடு.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Raw OCR Text View */
          <div style={{ width: '100%', maxWidth: '800px' }}>
            <textarea
              readOnly
              value={rawOcrText}
              style={{
                width: '100%',
                height: '500px',
                background: 'rgba(15, 23, 42, 0.7)',
                color: '#38bdf8',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                lineHeight: '1.6',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-card)',
                outline: 'none',
                resize: 'none'
              }}
            />
          </div>
        )}
      </div>

      {/* Viewer Footer Note */}
      <div style={{
        padding: '0.5rem 1rem',
        background: 'rgba(15, 23, 42, 0.85)',
        borderTop: '1px solid var(--border-card)',
        fontSize: '0.72rem',
        color: 'var(--text-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Sparkles size={12} color="#38bdf8" />
          <span>Click any bounding box to navigate to the extracted entity in the officer verification form.</span>
        </div>
        <span>{pageBoxes.length} text elements detected</span>
      </div>
    </div>
  );
}

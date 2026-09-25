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
  currentCaseNumber = ""
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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      borderRadius: '12px',
      border: '1px solid #DAC0A3',
      background: '#FFFFFF',
      overflow: 'hidden'
    }}>
      {/* Viewer Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.65rem 1rem',
        borderBottom: '1px solid #DAC0A3',
        background: '#102C57',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        {/* Left Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            onClick={() => setActiveTab('visual')}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.785rem',
              borderRadius: '6px',
              border: '1px solid #DAC0A3',
              background: activeTab === 'visual' ? '#FEFAF6' : 'transparent',
              color: activeTab === 'visual' ? '#102C57' : '#EADBC8',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Layers size={14} color={activeTab === 'visual' ? '#102C57' : '#DAC0A3'} />
            <span>Interactive Layout</span>
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.785rem',
              borderRadius: '6px',
              border: '1px solid #DAC0A3',
              background: activeTab === 'raw' ? '#FEFAF6' : 'transparent',
              color: activeTab === 'raw' ? '#102C57' : '#EADBC8',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <FileText size={14} color={activeTab === 'raw' ? '#102C57' : '#DAC0A3'} />
            <span>Raw OCR Text</span>
          </button>
        </div>

        {/* Center Page Nav */}
        {activeTab === 'visual' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              style={{
                padding: '0.25rem',
                borderRadius: '4px',
                background: 'transparent',
                border: 'none',
                color: currentPage === 1 ? '#102C57' : '#FEFAF6',
                cursor: currentPage === 1 ? 'default' : 'pointer'
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '0.785rem', color: '#FEFAF6', fontWeight: 600 }}>
              Page {currentPage} of 2
            </span>
            <button
              onClick={() => setCurrentPage(2)}
              disabled={currentPage === 2}
              style={{
                padding: '0.25rem',
                borderRadius: '4px',
                background: 'transparent',
                border: 'none',
                color: currentPage === 2 ? '#102C57' : '#FEFAF6',
                cursor: currentPage === 2 ? 'default' : 'pointer'
              }}
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
                style={{
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.75rem',
                  gap: '0.35rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'rgba(234, 219, 200, 0.15)',
                  border: '1px solid #DAC0A3',
                  borderRadius: '6px',
                  color: '#FEFAF6',
                  cursor: 'pointer'
                }}
                title="Toggle OCR Bounding Boxes"
              >
                {showBoxes ? <Eye size={14} color="#DAC0A3" /> : <EyeOff size={14} color="#EADBC8" />}
                <span>OCR Boxes</span>
              </button>

              <button
                onClick={() => handleZoom(-0.1)}
                style={{
                  padding: '0.35rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#FEFAF6',
                  cursor: 'pointer'
                }}
                title="Zoom Out"
              >
                <ZoomOut size={15} />
              </button>
              <span style={{ fontSize: '0.75rem', color: '#EADBC8', minWidth: '40px', textAlign: 'center' }}>
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => handleZoom(0.1)}
                style={{
                  padding: '0.35rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#FEFAF6',
                  cursor: 'pointer'
                }}
                title="Zoom In"
              >
                <ZoomIn size={15} />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                style={{
                  padding: '0.35rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#FEFAF6',
                  cursor: 'pointer'
                }}
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
        background: '#FEFAF6',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '2rem'
      }}>
        {activeTab === 'visual' ? (
          <div style={{ whiteSpace: 'pre-wrap', padding: '2rem', background: '#fff' }}>{rawOcrText || 'Upload a document to view extracted text.'}</div>
        ) : (
          /* Raw OCR Text View */
          <div style={{ width: '100%', maxWidth: '800px' }}>
            <textarea
              readOnly
              value={rawOcrText}
              style={{
                width: '100%',
                height: '500px',
                background: '#FFFFFF',
                color: '#102C57',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                lineHeight: '1.6',
                padding: '1.25rem',
                borderRadius: '8px',
                border: '1px solid #DAC0A3',
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
        background: '#102C57',
        borderTop: '1px solid #DAC0A3',
        fontSize: '0.72rem',
        color: '#EADBC8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Sparkles size={12} color="#DAC0A3" />
          <span>Click any bounding box to navigate to the extracted entity in the officer verification form.</span>
        </div>
        <span style={{ color: '#FEFAF6', fontWeight: 600 }}>{pageBoxes.length} text elements detected</span>
      </div>
    </div>
  );
}

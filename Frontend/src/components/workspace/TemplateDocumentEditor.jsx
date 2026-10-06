import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  Copy,
  Trash2,
  Plus,
  Layers,
  Sparkles,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import './TemplateDocumentEditor.css';

function getRunsHtml(block, value, activeFont, activeStyle = {}) {
  if (value !== undefined && value !== block.text) {
    return value ? value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>') : '<br/>';
  }
  if (block.runs && block.runs.length > 0) {
    return block.runs.map(run => {
      const styleParts = [];
      const fw = activeStyle.fontWeight || run.style?.fontWeight;
      const fs = activeStyle.fontStyle || run.style?.fontStyle;
      const td = activeStyle.textDecoration || run.style?.textDecoration;
      const fsz = activeStyle.fontSize || run.style?.fontSize;

      if (fw && fw !== 'normal') styleParts.push(`font-weight: ${fw}`);
      if (fs && fs !== 'normal') styleParts.push(`font-style: ${fs}`);
      if (td && td !== 'none') styleParts.push(`text-decoration: ${td}`);
      if (fsz) styleParts.push(`font-size: ${fsz}`);
      if (activeFont) styleParts.push(`font-family: ${activeFont}`);

      const styleAttr = styleParts.length > 0 ? ` style="${styleParts.join('; ')}"` : '';
      const escapedText = (run.text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>');
      return `<span${styleAttr}>${escapedText}</span>`;
    }).join('');
  }
  const text = value || block.text || '';
  return text ? text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>') : '<br/>';
}

function paginateBlocks(blocks) {
  if (!blocks || blocks.length === 0) return [[]];

  const PAGE_CAPACITY_PT = 680; // Printable height on A4 sheet
  const pages = [];
  let currentPage = [];
  let currentHeight = 0;

  blocks.forEach((block) => {
    let blockHeight = 24;
    if (block.type === 'table') {
      const rows = block.rows || [];
      blockHeight = Math.max(60, rows.length * 45);
    } else if (block.type === 'paragraph') {
      const txt = block.text || '';
      if (!txt.trim()) {
        blockHeight = 14;
      } else if (txt.length <= 60) {
        blockHeight = 24;
      } else if (txt.length <= 150) {
        blockHeight = 44;
      } else if (txt.length <= 300) {
        blockHeight = 78;
      } else {
        blockHeight = Math.ceil(txt.length / 70) * 18 + 14;
      }
    }

    if (currentPage.length > 0 && currentHeight + blockHeight > PAGE_CAPACITY_PT) {
      pages.push(currentPage);
      currentPage = [block];
      currentHeight = blockHeight;
    } else {
      currentPage.push(block);
      currentHeight += blockHeight;
    }
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

function EditableParagraph({
  block,
  value,
  onChange,
  onSelect,
  isSelected,
  disabled,
  selectedFont,
  selectedFontSize,
  selectedAlign,
  blockStyle = {},
  onStartResize
}) {
  const element = useRef(null);
  const isComposingRef = useRef(false);

  const activeFont = blockStyle.fontFamily || block.style?.fontFamily || (selectedFont ? `${selectedFont}, serif` : 'TAU-Marutham, serif');
  const activeFontSize = blockStyle.fontSize || block.style?.fontSize || selectedFontSize || '11pt';
  const activeAlign = blockStyle.textAlign || block.style?.textAlign || 'left';
  const activeLineHeight = blockStyle.lineHeight || block.style?.lineHeight || '1.6';

  useLayoutEffect(() => {
    if (!element.current) return;
    const currentText = (element.current.innerText || '').replace(/\r/g, '');
    const targetText = value !== undefined ? value : (block.text || '');

    // Sync innerHTML if text differs (e.g. on Undo / Redo) or if not currently focused
    if (document.activeElement !== element.current || currentText !== targetText) {
      element.current.innerHTML = getRunsHtml(block, value, activeFont, { ...block.style, ...blockStyle });
    }
  }, [value, block.text, block.runs, block.id, activeFont, activeFontSize, blockStyle]);

  const pStyle = {
    ...block.style,
    ...blockStyle,
    fontFamily: activeFont,
    fontSize: activeFontSize,
    textAlign: activeAlign,
    lineHeight: activeLineHeight,
    minHeight: blockStyle.minHeight,
    textIndent: (activeAlign === 'center' || activeAlign === 'right') ? '0' : (blockStyle.textIndent !== undefined ? blockStyle.textIndent : (block.style?.textIndent || undefined)),
  };

  const wrapperStyle = {
    width: blockStyle.width || block.style?.width || '100%',
    maxWidth: '100%',
    marginLeft: activeAlign === 'center' ? 'auto' : activeAlign === 'right' ? 'auto' : undefined,
    marginRight: activeAlign === 'center' ? 'auto' : undefined,
    marginBottom: blockStyle.marginBottom || block.style?.margin?.split(' ')?.[2] || '0.4rem',
  };

  return (
    <div
      id={`block-${block.id}`}
      className={`rr-block-wrapper ${isSelected ? 'is-selected' : ''}`}
      style={wrapperStyle}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelect) onSelect(block);
      }}
    >
      <p
        ref={element}
        style={pStyle}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-label="Edit document paragraph"
        aria-multiline="true"
        onFocus={() => onSelect && onSelect(block)}
        onCompositionStart={() => { isComposingRef.current = true; }}
        onCompositionEnd={(e) => {
          isComposingRef.current = false;
          onChange(block.id, e.currentTarget.innerText.replace(/\r/g, ''));
        }}
        onInput={event => {
          if (!isComposingRef.current) {
            onChange(block.id, event.currentTarget.innerText.replace(/\r/g, ''));
          }
        }}
        onPaste={event => {
          event.preventDefault();
          const text = event.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
        }}
      />

      {/* Interactive Box Sizing Handles (Visible on Selected Block) */}
      {isSelected && !disabled && (
        <>
          <div
            className="rr-resize-handle right"
            title="Drag to adjust width"
            onMouseDown={(e) => onStartResize && onStartResize(e, block.id, 'right')}
          />
          <div
            className="rr-resize-handle bottom"
            title="Drag to adjust height"
            onMouseDown={(e) => onStartResize && onStartResize(e, block.id, 'bottom')}
          />
          <div
            className="rr-resize-handle corner"
            title="Drag to resize box"
            onMouseDown={(e) => onStartResize && onStartResize(e, block.id, 'corner')}
          />
        </>
      )}
    </div>
  );
}

export default function TemplateDocumentEditor({
  layout,
  edits,
  onChange,
  onSelectBlock,
  selectedBlockId,
  disabled,
  selectedFont,
  selectedFontSize,
  selectedAlign,
  blockStyles = {},
  onUpdateBlockStyle,
  onDuplicateBlock,
  onDeleteBlock
}) {
  const container = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [activeDropdown, setActiveDropdown] = useState(false);
  const [tableColumnRatios, setTableColumnRatios] = useState({});
  const userInteractedZoom = useRef(false);

  useLayoutEffect(() => {
    if (!container.current || !layout?.page?.page_width) return;
    const observer = new ResizeObserver(([entry]) => {
      if (userInteractedZoom.current) return;
      // Auto fit to available viewport width nicely
      const availableWidth = entry.contentRect.width - 64;
      const targetWidth = (layout.page.page_width * 96) / 72;
      if (availableWidth > 0 && targetWidth > 0) {
        const calculatedZoom = Math.min(1.1, Math.max(0.4, availableWidth / targetWidth));
        setZoom(calculatedZoom);
      }
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [layout?.page?.page_width]);

  if (!layout || !layout.blocks) {
    return (
      <div className="rr-template-scroll" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        <div className="rr-loading-pulse">Rendering official Word document canvas...</div>
      </div>
    );
  }

  const handleZoomChange = (delta) => {
    userInteractedZoom.current = true;
    setZoom(prev => Math.min(2.0, Math.max(0.3, Number((prev + delta).toFixed(2)))));
  };

  const setExactZoom = (val) => {
    userInteractedZoom.current = true;
    setZoom(val);
    setActiveDropdown(false);
  };

  const resetZoom = () => {
    userInteractedZoom.current = false;
    if (container.current && layout?.page?.page_width) {
      const availableWidth = container.current.offsetWidth - 64;
      const targetWidth = (layout.page.page_width * 96) / 72;
      if (availableWidth > 0 && targetWidth > 0) {
        setZoom(Math.min(1.1, Math.max(0.4, availableWidth / targetWidth)));
      } else {
        setZoom(1.0);
      }
    } else {
      setZoom(1.0);
    }
    setActiveDropdown(false);
  };

  // Direct Mouse Drag Resizing Engine
  const handleStartResize = (e, blockId, handleType) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const el = document.getElementById(`block-${blockId}`);
    const parentWidth = el?.parentElement?.offsetWidth || 500;
    const initialWidthPx = el?.offsetWidth || parentWidth;
    const initialHeightPx = el?.offsetHeight || 30;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (handleType === 'right' || handleType === 'corner') {
        const newWidthPx = initialWidthPx + deltaX;
        const newPercent = Math.min(100, Math.max(25, Math.round((newWidthPx / parentWidth) * 100)));
        if (onUpdateBlockStyle) onUpdateBlockStyle(blockId, 'width', `${newPercent}%`);
      }
      if (handleType === 'bottom' || handleType === 'corner') {
        const newHeightPx = Math.max(20, initialHeightPx + deltaY);
        if (onUpdateBlockStyle) onUpdateBlockStyle(blockId, 'minHeight', `${newHeightPx}px`);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Table Column Divider Resizing
  const handleStartTableColResize = (e, tableId) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const tableEl = document.getElementById(`table-${tableId}`);
    const tableWidth = tableEl?.offsetWidth || 500;
    const initialRatio = tableColumnRatios[tableId] || 15;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / tableWidth) * 100;
      const newRatio = Math.min(45, Math.max(10, Math.round(initialRatio + deltaPercent)));
      setTableColumnRatios(prev => ({ ...prev, [tableId]: newRatio }));
      if (onUpdateBlockStyle) onUpdateBlockStyle(tableId, 'col1Ratio', newRatio);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const selectedBlock = layout.blocks.find(b => b.id === selectedBlockId) || null;
  const pages = paginateBlocks(layout.blocks);

  const renderBlocks = (blocks) => blocks.map((block, index) => {
    const isSelected = selectedBlockId === block.id;
    const bStyle = blockStyles[block.id] || {};

    if (block.type === 'paragraph') {
      return (
        <EditableParagraph
          key={block.id || `p-${index}`}
          block={block}
          value={edits[block.id] ?? block.text}
          onChange={onChange}
          onSelect={onSelectBlock}
          isSelected={isSelected}
          disabled={disabled}
          selectedFont={selectedFont}
          selectedFontSize={selectedFontSize}
          selectedAlign={selectedAlign}
          blockStyle={bStyle}
          onStartResize={handleStartResize}
        />
      );
    }

    // Table block (e.g. unbordered 2-column for பொருள் / பார்வை with draggable column resizer)
    const col1Width = tableColumnRatios[block.id] || bStyle.col1Ratio || 15;
    const col2Width = 100 - col1Width;

    return (
      <div
        key={`table-wrap-${index}`}
        id={`table-${block.id}`}
        className={`rr-block-wrapper table-wrap ${isSelected ? 'is-selected' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (onSelectBlock) onSelectBlock(block);
        }}
      >
        <table className="rr-official-table">
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => {
                  const calculatedWidth = cellIndex === 0 ? `${col1Width}%` : `${col2Width}%`;
                  return (
                    <td
                      key={cellIndex}
                      colSpan={cell.colSpan}
                      style={{
                        width: calculatedWidth,
                        verticalAlign: 'top',
                        padding: '3px 8px 3px 0',
                        position: 'relative'
                      }}
                    >
                      {renderBlocks(cell.blocks)}

                      {/* Interactive Column Resizer on first column */}
                      {cellIndex === 0 && !disabled && (
                        <div
                          className="rr-table-col-resizer"
                          title="Drag to resize column width"
                          onMouseDown={(e) => handleStartTableColResize(e, block.id)}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Selected Table Outline Handles */}
        {isSelected && !disabled && (
          <div
            className="rr-resize-handle corner"
            title="Table Section"
            style={{ pointerEvents: 'none' }}
          />
        )}
      </div>
    );
  });

  return (
    <div
      className="rr-template-scroll"
      ref={container}
      onClick={() => onSelectBlock && onSelectBlock(null)}
    >
      {/* Floating Mini Context Toolbar above active block */}
      {selectedBlock && !disabled && (
        <div className="rr-floating-block-toolbar" style={{ pointerEvents: 'auto' }}>
          <button
            type="button"
            className="rr-floating-btn"
            onClick={(e) => { e.stopPropagation(); setActiveDropdown(!activeDropdown); }}
          >
            <span>{selectedBlock.type === 'paragraph' ? 'Paragraph' : 'Table Section'}</span>
            <ChevronDown size={12} />
          </button>

          <div className="rr-floating-divider" />

          <button
            type="button"
            className="rr-floating-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (selectedBlock.text) navigator.clipboard?.writeText(selectedBlock.text);
            }}
            title="Copy block text"
          >
            <Copy size={13} />
          </button>

          {onDuplicateBlock && (
            <button
              type="button"
              className="rr-floating-btn"
              onClick={(e) => { e.stopPropagation(); onDuplicateBlock(selectedBlock); }}
              title="Duplicate block"
            >
              <Layers size={13} />
            </button>
          )}

          {onDeleteBlock && (
            <button
              type="button"
              className="rr-floating-btn delete-btn"
              onClick={(e) => { e.stopPropagation(); onDeleteBlock(selectedBlock.id); }}
              title="Delete block"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}

      {/* Pages Stack: Multi-page A4 Realistic Document Canvas Sheets */}
      <div
        className="rr-pages-stack"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top center'
        }}
      >
        {pages.map((pageBlocks, pageIndex) => (
          <article
            key={`page-${pageIndex + 1}`}
            id={`rr-page-${pageIndex + 1}`}
            className={`rr-template-page ${disabled ? 'preview-mode' : 'edit-mode'}`}
            aria-label={`Official Revenue Recovery Document - Page ${pageIndex + 1}`}
            style={{
              width: `${layout.page?.page_width || 595.3}pt`,
              minHeight: `${layout.page?.page_height || 841.9}pt`,
              padding: `${layout.page?.top_margin || 54}pt ${layout.page?.right_margin || 54}pt ${layout.page?.bottom_margin || 54}pt ${layout.page?.left_margin || 54}pt`,
              fontFamily: selectedFont ? `${selectedFont}, serif` : 'TAU-Marutham, serif'
            }}
          >
            {renderBlocks(pageBlocks)}

            {/* Document Page Footer */}
            <div className="rr-page-footer">
              <span className="rr-page-number">பக்கம் {pageIndex + 1} / {pages.length}</span>
            </div>
          </article>
        ))}
      </div>

      {/* Floating Bottom Zoom Dock (Matches Reference UI) */}
      <div className="rr-canvas-zoom-dock" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="rr-zoom-btn"
          onClick={(e) => { e.stopPropagation(); handleZoomChange(-0.1); }}
          title="Zoom Out"
        >
          <ZoomOut size={14} />
        </button>

        <div className="rr-zoom-level-wrapper">
          <button
            type="button"
            className="rr-zoom-dropdown-trigger"
            onClick={(e) => { e.stopPropagation(); setActiveDropdown(!activeDropdown); }}
          >
            <span>{Math.round(zoom * 100)}%</span>
            <ChevronDown size={12} />
          </button>

          {activeDropdown && (
            <div className="rr-zoom-menu" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setExactZoom(0.5)}>50%</button>
              <button type="button" onClick={() => setExactZoom(0.75)}>75%</button>
              <button type="button" onClick={() => setExactZoom(0.9)}>90%</button>
              <button type="button" onClick={() => setExactZoom(1.0)}>100% (Actual Size)</button>
              <button type="button" onClick={() => setExactZoom(1.1)}>110%</button>
              <button type="button" onClick={() => setExactZoom(1.25)}>125%</button>
              <button type="button" onClick={() => setExactZoom(1.5)}>150%</button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="rr-zoom-btn"
          onClick={(e) => { e.stopPropagation(); handleZoomChange(0.1); }}
          title="Zoom In"
        >
          <ZoomIn size={14} />
        </button>

        <button
          type="button"
          className="rr-zoom-btn"
          onClick={(e) => { e.stopPropagation(); resetZoom(); }}
          title="Reset Fit to Width"
        >
          <Maximize2 size={13} />
        </button>
      </div>
    </div>
  );
}

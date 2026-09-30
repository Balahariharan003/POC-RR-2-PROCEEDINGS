import React, { useLayoutEffect, useRef, useState } from 'react';
import './TemplateDocumentEditor.css';

function EditableParagraph({ block, value, onChange, disabled }) {
  const element = useRef(null);
  useLayoutEffect(() => {
    if (element.current && document.activeElement !== element.current && element.current.innerText !== value) {
      element.current.textContent = value;
    }
  }, [value, block.text]);
  return <p ref={element} style={block.style} contentEditable={!disabled}
    suppressContentEditableWarning role="textbox" aria-label="Edit document paragraph" aria-multiline="true"
    onInput={event => onChange(block.id, event.currentTarget.innerText.replace(/\r/g, ''))}
    onPaste={event => {
      event.preventDefault();
      const text = event.clipboardData.getData('text/plain');
      // Paste text into the current paragraph without importing foreign HTML/styles.
      document.execCommand('insertText', false, text);
    }}>
    {block.runs.map((run, index) => <span key={index} style={run.style}>{run.text}</span>)}
  </p>;
}

export default function TemplateDocumentEditor({ layout, edits, onChange, disabled }) {
  const container = useRef(null);
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => setZoom(Math.min(1, Math.max(0.3, (entry.contentRect.width - 32) / (layout.page.page_width * 96 / 72)))));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [layout.page.page_width]);
  const render = blocks => blocks.map((block, index) => block.type === 'paragraph'
    ? <EditableParagraph key={block.id} block={block} value={edits[block.id] ?? block.text} onChange={onChange} disabled={disabled} />
    : <table key={`table-${index}`}><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>
        {row.map((cell, cellIndex) => <td key={cellIndex} colSpan={cell.colSpan} style={{ width: cell.width }}>{render(cell.blocks)}</td>)}
      </tr>)}</tbody></table>);
  return <div className="rr-template-scroll" ref={container}>
    <article className="rr-template-page" aria-label="Editable RR proceedings" style={{
      zoom, width: `${layout.page.page_width}pt`, minHeight: `${layout.page.page_height}pt`,
      padding: `${layout.page.top_margin}pt ${layout.page.right_margin}pt ${layout.page.bottom_margin}pt ${layout.page.left_margin}pt`
    }}>{render(layout.blocks)}</article>
  </div>;
}

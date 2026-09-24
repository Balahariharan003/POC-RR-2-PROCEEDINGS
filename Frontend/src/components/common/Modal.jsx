import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import './Modal.css';

export default function Modal({ title, onClose, children, className = '' }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog.showModal();
    (dialog.querySelector('input:not([disabled])') || dialog.querySelector('button')).focus();
    return () => { dialog.close(); if (opener?.isConnected) opener.focus(); };
  }, []);

  function containFocus(event) {
    if (event.key !== 'Tab') return;
    const controls = [...ref.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')].filter(node => node.getClientRects().length);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return <dialog ref={ref} className={`rr-modal ${className}`} aria-labelledby={titleId} onKeyDown={containFocus}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="rr-modal-heading"><h2 id={titleId}>{title}</h2><button type="button" className="btn btn-ghost" aria-label={`Close ${title}`} onClick={onClose}><X size={18} aria-hidden="true" /></button></header>
    {children}
  </dialog>;
}

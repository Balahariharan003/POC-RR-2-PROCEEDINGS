import React from 'react';
import Modal from '../common/Modal.jsx';
export default function MobileQrModal({ isOpen, onClose }) {
  return isOpen ? <Modal title="Mobile Upload" onClose={onClose}><p>Mobile scanning is not connected yet. Please use Browse Document to upload a real source file.</p><div className="rr-modal-actions"><button className="btn btn-primary" onClick={onClose}>Close</button></div></Modal> : null;
}

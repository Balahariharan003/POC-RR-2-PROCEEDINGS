import { recordActivity } from '../../services/activityStore.js';
import React, { useEffect, useRef, useState } from 'react';
import { createBackup, restoreBackup, validateBackup } from '../../services/adminStore.js';
import Modal from '../common/Modal.jsx';
import './BackupPage.css';

const HISTORY_KEY = 'rr_backup_history';
function readHistory() {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  if (!Array.isArray(history)) throw new Error('Unable to load recent backups.');
  return history.map(item => {
    if (!item?.id || !Number.isFinite(Date.parse(item.createdAt))) throw new Error('Unable to load recent backups.');
    validateBackup(item.backup);
    return item;
  });
}
function download(item) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(item.backup, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = `rr-assistant-backup-${item.createdAt.replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  recordActivity('Backup download requested', { reference: item.createdAt });
}
export default function BackupPage({ onRestored }) {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const fileInputRef = useRef(null);
  useEffect(() => {
    const load = () => {
      try { setHistory(readHistory()); setError(''); } catch (e) { setError(e.message); }
    };
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);
  function makeBackup() {
    setError('');
    try {
      const backup = createBackup();
      const item = { id: crypto.randomUUID(), createdAt: backup.createdAt, backup };
      const updated = [item, ...readHistory()];
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      recordActivity('Backup created', { reference: item.createdAt });
      setHistory(updated); download(item);
    } catch (e) { setError(`Backup could not be created. ${e.message}`); }
  }
  async function importBackupFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('Select a valid RR Assistant version 1 backup.');
      }
      const backup = validateBackup(parsed);
      const createdAt = typeof backup.createdAt === 'string' && Number.isFinite(Date.parse(backup.createdAt))
        ? backup.createdAt
        : new Date().toISOString();
      setPending({ id: crypto.randomUUID(), createdAt, backup, fileName: file.name, type: 'Imported' });
    } catch (e) { setError(`Import failed. ${e.message}`); }
  }
  function restore() {
    try {
      restoreBackup(pending.backup);
      if (pending.type === 'Imported') {
        try {
          const entry = { id: pending.id, createdAt: pending.createdAt, backup: pending.backup, type: 'Imported' };
          const existing = readHistory().filter(item => item.id !== entry.id);
          localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...existing]));
        } catch { /* ignore history write failure */ }
      }
      recordActivity('Backup restored', { reference: pending.fileName || pending.createdAt });
      setPending(null);
      onRestored();
    } catch (e) { setError(`Restore failed. ${e.message}`); setPending(null); }
  }
  const last = history[0];
  return <section className="rr-admin rr-backup-page">
    <header><h1>Backup</h1><p>Manage system backups and restore points.</p></header>
    <p className="rr-backup-scope">Backups contain saved officers, proceedings and preferences, excluding passwords. Original uploads and server files are not included.</p>
    {error && <div className="rr-admin-alert" role="alert">{error}</div>}
    <article className="rr-admin-card"><h2>Backup Overview</h2>
      <dl className="rr-backup-overview">
        <div><dt>Last Backup</dt><dd>{last ? new Date(last.createdAt).toLocaleString('en-IN') : 'No backups yet'}</dd></div>
        <div><dt>Backup Status</dt><dd>{last ? 'Completed' : 'Not created'}</dd></div>
        <div><dt>Backup Type</dt><dd>{last ? (last.type || 'Manual') : '—'}</dd></div>
      </dl>
      <div className="rr-admin-actions">
        <button type="button" className="btn btn-primary" onClick={makeBackup}>Create Backup</button>
        <button type="button" className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>Import Backup</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          aria-label="Import backup file"
          onChange={importBackupFile}
          style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, overflow: 'hidden', pointerEvents: 'none' }}
          tabIndex={-1}
        />
      </div>
    </article>
    <article className="rr-admin-card"><h2>Recent Backups</h2>
      <div className="rr-admin-table-scroll rr-backup-table"><table>
        <thead><tr>{['Date / Time', 'Type', 'Status', 'Action'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{history.length ? history.map(item => <tr key={item.id}>
          <td>{new Date(item.createdAt).toLocaleString('en-IN')}</td><td>{item.type || 'Manual'}</td><td><span className="rr-admin-status">Completed</span></td>
          <td><div className="rr-admin-actions"><button type="button" className="btn btn-ghost" onClick={() => download(item)}>Download</button><button type="button" className="btn btn-ghost" onClick={() => setPending(item)}>Restore</button></div></td>
        </tr>) : <tr><td colSpan={4} className="rr-backup-empty">No backups yet. Create or import a backup to save or restore a point.</td></tr>}</tbody>
      </table></div>
    </article>
    {pending && <Modal title="Restore Backup" onClose={() => setPending(null)}>
      <p>Restore the backup from {new Date(pending.createdAt).toLocaleString('en-IN')}{pending.fileName ? ` (${pending.fileName})` : ''}? This replaces saved officers, proceedings and preferences and signs you out. Passwords are not changed.</p>
      <div className="rr-modal-actions"><button type="button" className="btn btn-outline" onClick={() => setPending(null)}>Cancel</button><button type="button" className="btn btn-primary" onClick={restore}>Restore Backup</button></div>
    </Modal>}
  </section>;
}

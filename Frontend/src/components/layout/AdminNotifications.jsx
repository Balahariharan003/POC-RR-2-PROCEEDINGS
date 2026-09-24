import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { ACTIVITY_EVENT, readActivities } from '../../services/activityStore.js';
import './AdminNotifications.css';

export default function AdminNotifications({ user, onViewActivity }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [seen, setSeen] = useState([]);
  const [error, setError] = useState('');
  const ref = useRef(null);
  const trigger = useRef(null);
  const key = `rr_notifications_seen_${user.id}`;
  useEffect(() => {
    const refresh = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(key) || '[]');
        if (!Array.isArray(saved)) throw new Error('Invalid notification data');
        setSeen(saved);
        setItems(readActivities().filter(item => item.actorId !== user.id).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)));
        setError('');
      } catch { setError('Unable to load notifications.'); }
    };
    refresh();
    window.addEventListener(ACTIVITY_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(ACTIVITY_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, [key, user.id]);
  useEffect(() => {
    const outside = event => { if (!ref.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  const unread = items.filter(item => !seen.includes(item.id)).length;
  function markRead() {
    try { const ids = items.map(item => item.id); localStorage.setItem(key, JSON.stringify(ids)); setSeen(ids); }
    catch { setError('Unable to save read status.'); }
  }
  return <div className="rr-notifications" ref={ref} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } }}>
    <button ref={trigger} type="button" className="rr-notification-bell" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} aria-controls="rr-notification-panel" onClick={() => setOpen(value => !value)}><Bell size={19} />{unread > 0 && <span className="rr-notification-count">{unread > 99 ? '99+' : unread}</span>}</button>
    {open && <section id="rr-notification-panel" className="rr-notification-panel" aria-label="User activity notifications">
      <header><h2>Notifications</h2><button type="button" aria-label="Close notifications" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={17} /></button></header>
      {error && <p role="alert">{error}</p>}
      {unread > 0 && <button type="button" className="rr-mark-read" onClick={markRead}><Check size={15} />Mark all as read</button>}
      {items.length ? <ul>{items.slice(0, 20).map(item => <li key={item.id} className={seen.includes(item.id) ? '' : 'unread'}>
        <div><strong>{item.actorName || 'User'}</strong><span>{item.action}{item.reference ? ` · ${item.reference}` : ''}</span><time dateTime={item.timestamp}>{new Date(item.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</time></div>
        {!seen.includes(item.id) && <span className="rr-unread-dot" aria-label="Unread" />}
      </li>)}</ul> : !error && <p>No user activity yet.</p>}
      <footer><button type="button" onClick={() => { setOpen(false); onViewActivity(); }}>View Recent Activity</button></footer>
    </section>}
  </div>;
}

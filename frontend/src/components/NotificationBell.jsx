import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { getNotifications, markAllRead, markNotifRead } from '../lib/api';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationBell({ onNavigateToDeal }) {
  const [notifs, setNotifs] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const fetchNotifs = useCallback(async () => {
    const n = await getNotifications().catch(() => null);
    if (n) setNotifs(n);
  }, []);

  useEffect(() => {
    fetchNotifs();
    const t = setInterval(fetchNotifs, 15000);
    return () => clearInterval(t);
  }, [fetchNotifs]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notifs.filter((n) => !n.read).length;

  const handleMarkAll = async () => {
    await markAllRead().catch(() => {});
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClickNotif = async (notif) => {
    if (!notif.read) {
      await markNotifRead(notif.id).catch(() => {});
      setNotifs((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n));
    }
    if (notif.deal_id && onNavigateToDeal) onNavigateToDeal(notif.deal_id);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative" data-testid="notification-bell">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-white/5"
        style={{ color: open ? '#7c6dfa' : 'rgba(255,255,255,0.4)' }}
        data-testid="bell-btn"
      >
        <Bell size={15} />
        {unread > 0 && (
          <span
            data-testid="notif-badge"
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-white font-bold"
            style={{ background: '#f05252', minWidth: 16, height: 16, fontSize: 9, padding: '0 3px' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-xl overflow-hidden z-50"
          style={{ background: '#13131c', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
          data-testid="notif-dropdown"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.07)]">
            <span className="text-white text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button onClick={handleMarkAll}
                className="text-[rgba(255,255,255,0.4)] hover:text-white text-xs transition-colors"
                data-testid="mark-all-read-btn">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="px-4 py-6 text-center text-[rgba(255,255,255,0.25)] text-xs">
                No notifications yet
              </div>
            ) : (
              notifs.map((n) => (
                <button
                  key={n.id}
                  data-testid={`notif-item-${n.type}`}
                  onClick={() => handleClickNotif(n)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/3 border-b border-[rgba(255,255,255,0.04)]"
                  style={{ background: n.read ? 'transparent' : 'rgba(124,109,250,0.04)' }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                    style={{ background: n.read ? 'transparent' : '#7c6dfa' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[rgba(255,255,255,0.8)] text-xs leading-snug">{n.message}</p>
                    <p className="text-[rgba(255,255,255,0.25)] text-xs mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

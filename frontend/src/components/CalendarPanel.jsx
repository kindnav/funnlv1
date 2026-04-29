import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CalendarDays } from 'lucide-react';
import { getCalendarEvents } from '../lib/api';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtEventTime(start, end) {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const mins = Math.round((e - s) / 60000);
    const time = s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${time} · ${mins} min`;
  } catch {
    return '';
  }
}

function eventDayLabel(dateStr) {
  try {
    const d        = new Date(dateStr);
    const today    = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString())    return 'Today';
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function SkeletonRow() {
  return (
    <div style={{ margin: '0 12px 10px', borderRadius: 10, padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="animate-pulse" style={{ height: 12, width: '65%', background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: 8 }} />
      <div className="animate-pulse" style={{ height: 10, width: '40%', background: 'rgba(255,255,255,0.05)', borderRadius: 4 }} />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CalendarPanel({ onClose, onNavigateToDeal }) {
  const [events,          setEvents]          = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [calendarEnabled, setCalendarEnabled] = useState(true);
  const intervalRef = useRef(null);
  const navigate    = useNavigate();

  const load = () => {
    getCalendarEvents().then(res => {
      setCalendarEnabled(res.calendar_enabled ?? true);
      setEvents(res.events || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Auto-refresh every 5 minutes
    intervalRef.current = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(intervalRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Group events by day label
  const grouped = [];
  let lastDay = null;
  for (const ev of events) {
    const day = eventDayLabel(ev.start);
    if (day !== lastDay) {
      grouped.push({ type: 'separator', label: day });
      lastDay = day;
    }
    grouped.push({ type: 'event', data: ev });
  }

  return (
    <div
      style={{
        width: 320,
        height: '100%',
        background: '#131320',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
        zIndex: 20,
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center gap-2 shrink-0"
        style={{ height: 48, padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <CalendarDays size={15} style={{ color: '#4285F4' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', flex: 1 }}>Scheduled Calls</span>
        <button
          onClick={onClose}
          className="flex items-center justify-center transition-all"
          style={{ width: 28, height: 28, borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Loading */}
        {loading && (
          <div style={{ paddingTop: 12 }}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        )}

        {/* Not connected */}
        {!loading && !calendarEnabled && (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16 gap-3">
            <CalendarDays size={32} style={{ color: 'rgba(255,255,255,0.12)' }} />
            <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>Connect Google Calendar</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
              Grant calendar access in Integrations to see your scheduled calls here.
            </p>
            <button
              onClick={() => navigate('/integrations')}
              className="px-4 py-2 rounded-xl text-xs font-medium transition-all"
              style={{ background: 'rgba(124,109,250,0.1)', border: '1px solid rgba(124,109,250,0.25)', color: '#a89cf7', cursor: 'pointer' }}
            >
              Go to Integrations
            </button>
          </div>
        )}

        {/* Connected but no events */}
        {!loading && calendarEnabled && events.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16 gap-3">
            <CalendarDays size={32} style={{ color: 'rgba(255,255,255,0.12)' }} />
            <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>No upcoming calls</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
              Events scheduled from Funnl deals will appear here.
            </p>
          </div>
        )}

        {/* Events list */}
        {!loading && grouped.map((row, idx) => {
          if (row.type === 'separator') {
            return (
              <div
                key={`sep-${row.label}-${idx}`}
                style={{ padding: '10px 16px 4px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.25)' }}
              >
                {row.label}
              </div>
            );
          }

          const ev = row.data;
          return (
            <div
              key={ev.id}
              style={{
                margin: '0 12px 8px',
                borderRadius: 10,
                padding: '10px 12px 10px 15px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderLeft: '3px solid #4285F4',
                position: 'relative',
              }}
            >
              {/* Title */}
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ev.title}
              </p>

              {/* Time */}
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: ev.deal_id ? 8 : 6 }}>
                {fmtEventTime(ev.start, ev.end)}
              </p>

              {/* View deal chip */}
              {ev.deal_id && (
                <button
                  onClick={() => { onNavigateToDeal && onNavigateToDeal(ev.deal_id); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 500, color: '#a89cf7',
                    background: 'rgba(124,109,250,0.12)', border: '1px solid rgba(124,109,250,0.25)',
                    borderRadius: 999, padding: '2px 8px', cursor: 'pointer', marginBottom: 6,
                  }}
                >
                  ← View deal
                </button>
              )}

              {/* Open in Calendar */}
              {ev.html_link && (
                <div>
                  <a
                    href={ev.html_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                  >
                    Open in Google Calendar →
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

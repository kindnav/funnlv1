import { useState, useEffect } from 'react';
import { X, Calendar, ExternalLink, Clock } from 'lucide-react';
import { scheduleCall } from '../lib/api';

// Add 3 business days to today (skip Sat/Sun)
function defaultDate() {
  const d = new Date();
  let added = 0;
  while (added < 3) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

export default function CalendarModal({ deal, onClose }) {
  const company  = deal.company_name || deal.sender_name || 'Unknown';
  const founder  = deal.sender_name || '';

  const [title,       setTitle]       = useState(`Intro call — ${company} (${founder})`);
  const [date,        setDate]        = useState(defaultDate());
  const [time,        setTime]        = useState('10:00');
  const [duration,    setDuration]    = useState(30);
  const [description, setDescription] = useState('');
  const [guestEmail,  setGuestEmail]  = useState(deal.sender_email || '');
  const [saving,      setSaving]      = useState(false);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState('');

  // Build description from deal data on mount
  useEffect(() => {
    const parts = [];
    if (deal.summary) parts.push(`AI Summary:\n${deal.summary}`);
    if (deal.thesis_match_score != null) parts.push(`Thesis Fit: ${deal.thesis_match_score}/100`);
    if (deal.relevance_score != null) parts.push(`Score: ${deal.relevance_score}/10`);
    if (deal.sender_email) parts.push(`Founder email: ${deal.sender_email}`);
    setDescription(parts.join('\n\n'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!date || !time) { setError('Please select a date and time.'); return; }
    setSaving(true);
    setError('');
    try {
      const data = await scheduleCall(deal.id, {
        title, date, time, duration_minutes: duration,
        description, guest_email: guestEmail,
      });
      setResult(data);
    } catch (err) {
      if (err?.message === 'calendar_scope_required') {
        setError('Calendar access not granted. Re-connect Google in Settings to enable Calendar.');
      } else {
        setError(err?.message || 'Failed to create event — please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    background: '#080810',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '8px 12px',
    fontSize: 13,
    color: '#fff',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 6,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#131320',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 16,
          padding: 24,
          width: 440,
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Calendar size={16} style={{ color: '#7c6dfa' }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Schedule a Call</span>
          </div>
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

        {result ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(61,214,140,0.1)', border: '1px solid rgba(61,214,140,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={20} style={{ color: '#3dd68c' }} />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 6 }}>Call added to Calendar</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                {title} · {date} at {time}
              </p>
            </div>
            {result.html_link && (
              <a
                href={result.html_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm transition-colors"
                style={{ color: '#4da6ff' }}
              >
                <ExternalLink size={13} />
                View in Google Calendar
              </a>
            )}
            <button
              onClick={onClose}
              style={{ marginTop: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 20px', fontSize: 13, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Close
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <div className="flex flex-col gap-4">
            {/* Title */}
            <div>
              <label style={labelStyle}>Event Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'rgba(124,109,250,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
            </div>

            {/* Date + Time row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  style={{ ...inputStyle, colorScheme: 'dark' }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(124,109,250,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>
              <div>
                <label style={labelStyle}>Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  style={{ ...inputStyle, colorScheme: 'dark' }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(124,109,250,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label style={labelStyle}>Duration</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[30, 45, 60].map(d => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                      background: duration === d ? 'rgba(124,109,250,0.15)' : 'rgba(255,255,255,0.04)',
                      border: duration === d ? '1px solid rgba(124,109,250,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      color: duration === d ? '#a89cf7' : 'rgba(255,255,255,0.55)',
                    }}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>

            {/* Guest email */}
            <div>
              <label style={labelStyle}>Guest Email (founder)</label>
              <input
                type="email"
                value={guestEmail}
                onChange={e => setGuestEmail(e.target.value)}
                style={inputStyle}
                placeholder="founder@company.com"
                onFocus={e => (e.target.style.borderColor = 'rgba(124,109,250,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                onFocus={e => (e.target.style.borderColor = 'rgba(124,109,250,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
            </div>

            {/* Error */}
            {error && (
              <p style={{ fontSize: 12, color: '#f05252', background: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                {error}
              </p>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                onClick={onClose}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                style={{
                  flex: 2, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  background: saving ? 'rgba(124,109,250,0.4)' : '#7c6dfa',
                  border: 'none', color: '#fff', opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Adding to Calendar…' : 'Add to Calendar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { RefreshCw, X, Sparkles } from 'lucide-react';
import { getTodaysBrief } from '../lib/api';

// ── localStorage key for dismiss-for-today ────────────────────────────────────
function getTodayKey() {
  return `funnl_brief_dismissed_${new Date().toISOString().slice(0, 10)}`;
}

export default function TodaysBrief({ dealCount }) {
  const [brief,     setBrief]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(getTodayKey()) === 'true'
  );
  const [error, setError] = useState(false);

  const load = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    try {
      const res = await getTodaysBrief(forceRefresh);
      if (res?.brief) {
        setBrief(res.brief);
        setError(false);
      } else {
        // not_enough_deals or generation_failed — hide silently
        setBrief(null);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Only fetch if not dismissed and there are enough deals to be meaningful
    if (!dismissed && dealCount >= 3) {
      load();
    } else {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = () => {
    localStorage.setItem(getTodayKey(), 'true');
    setDismissed(true);
  };

  const handleRefresh = () => load(true);

  // ── Don't render if dismissed, no brief, or not enough deals ─────────────
  if (dismissed || (!loading && !brief)) return null;

  return (
    <div
      className="shrink-0 mx-5 mb-1"
      style={{
        background: 'rgba(124,109,250,0.06)',
        border: '1px solid rgba(124,109,250,0.18)',
        borderLeft: '3px solid #7c6dfa',
        borderRadius: 12,
        padding: '14px 16px',
      }}
    >
      {/* ── Header row ── */}
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={13} style={{ color: '#7c6dfa', flexShrink: 0 }} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#a89cf7',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            flex: 1,
          }}
        >
          Today's Focus
        </span>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          title="Regenerate"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: refreshing || loading ? 'wait' : 'pointer',
            color: 'rgba(255,255,255,0.25)',
            padding: 4,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; }}
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
        </button>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          title="Dismiss for today"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.2)',
            padding: 4,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.2)'; }}
        >
          <X size={12} />
        </button>
      </div>

      {/* ── Body ── */}
      {loading ? (
        /* Skeleton shimmer */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[85, 70, 55].map(w => (
            <div
              key={w}
              className="animate-pulse"
              style={{
                height: 12,
                width: `${w}%`,
                borderRadius: 4,
                background: 'rgba(124,109,250,0.12)',
              }}
            />
          ))}
        </div>
      ) : error ? (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
          Could not generate brief — try refreshing.
        </p>
      ) : (
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.7,
            color: 'rgba(255,255,255,0.85)',
            margin: 0,
          }}
        >
          {brief}
        </p>
      )}
    </div>
  );
}

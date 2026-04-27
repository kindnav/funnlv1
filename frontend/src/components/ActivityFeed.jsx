import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import { getActivityFeed } from '../lib/api';

// ── Relative timestamp ───────────────────────────────────────────────────────
function fmtRel(ts) {
  const diff = Math.round((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// ── Day-bucket label ─────────────────────────────────────────────────────────
function dayLabel(ts) {
  const d     = new Date(ts);
  const today = new Date();
  const yest  = new Date(today); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString())  return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <div
        className="w-2 h-2 rounded-full shrink-0 mt-1.5 animate-pulse"
        style={{ background: 'rgba(255,255,255,0.1)' }}
      />
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="h-3 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.08)', width: '60%' }} />
        <div className="h-2.5 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.05)', width: '40%' }} />
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function ActivityFeed({ userId, refreshTrigger }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const intervalRef = useRef(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setSpinning(true);
    try {
      const data = await getActivityFeed();
      if (data) setItems(data);
    } catch {
      // silently swallow — activity feed is non-critical
    } finally {
      setLoading(false);
      if (manual) setTimeout(() => setSpinning(false), 600);
    }
  }, []);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => load(), 60_000);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  // Refresh when sync completes (refreshTrigger increments)
  useEffect(() => {
    if (refreshTrigger > 0) load();
  }, [refreshTrigger, load]);

  // Group items by day
  const grouped = [];
  let lastDay = null;
  for (const item of items) {
    const day = dayLabel(item.timestamp);
    if (day !== lastDay) {
      grouped.push({ type: 'separator', label: day });
      lastDay = day;
    }
    grouped.push({ type: 'item', data: item });
  }

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        height: '100%',
        background: '#131320',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
          }}
        >
          Activity
        </span>
        <button
          onClick={() => load(true)}
          title="Refresh"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.25)',
            display: 'flex',
            alignItems: 'center',
            padding: 4,
            borderRadius: 6,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; }}
        >
          <RefreshCw size={13} className={spinning ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Loading skeletons */}
        {loading && (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        )}

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center py-16">
            <Activity size={28} style={{ color: 'rgba(255,255,255,0.1)' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
                No activity yet
              </p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Activity appears here as deals move through your pipeline
              </p>
            </div>
          </div>
        )}

        {/* Activity list */}
        {!loading && grouped.map((row, idx) => {
          if (row.type === 'separator') {
            return (
              <div
                key={`sep-${row.label}`}
                style={{
                  padding: '8px 20px 4px',
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'rgba(255,255,255,0.2)',
                }}
              >
                {row.label}
              </div>
            );
          }

          const item = row.data;
          const isLast = idx === grouped.length - 1 ||
            (grouped[idx + 1] && grouped[idx + 1].type === 'separator');

          return (
            <div
              key={item.id}
              className="flex items-start gap-3 transition-colors"
              style={{
                padding: '11px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                cursor: 'default',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Timeline dot + connector */}
              <div className="flex flex-col items-center shrink-0" style={{ marginTop: 4, width: 8 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: item.color,
                    boxShadow: `0 0 6px ${item.color}80`,
                    flexShrink: 0,
                  }}
                />
                {!isLast && (
                  <div
                    style={{
                      width: 1,
                      flex: 1,
                      minHeight: 20,
                      background: 'rgba(255,255,255,0.06)',
                      marginTop: 4,
                    }}
                  />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p
                  className="truncate"
                  style={{ fontSize: 13, fontWeight: 500, color: '#ffffff', lineHeight: 1.4 }}
                >
                  {item.title}
                </p>
                <p
                  className="truncate"
                  style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}
                >
                  {item.subtitle}
                </p>
              </div>

              {/* Timestamp */}
              <span
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.25)',
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {fmtRel(item.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

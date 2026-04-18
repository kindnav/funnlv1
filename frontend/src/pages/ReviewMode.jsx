import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Star, ArrowUp, ChevronRight } from 'lucide-react';
import { getDeals, updateDeal } from '../lib/api';

const SWIPE_X = 110;
const SWIPE_Y = 90;

const scoreColor = (s) => {
  if (s == null) return 'rgba(255,255,255,0.3)';
  if (s >= 7) return '#3dd68c';
  if (s >= 4) return '#f5a623';
  return '#f05252';
};

// ── Card Content (pure presentational) ──────────────────────────────────────
function CardContent({ deal: d }) {
  return (
    <div className="absolute inset-0 p-5 flex flex-col overflow-hidden pointer-events-none">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h1 className="text-2xl font-bold text-white leading-tight flex-1">
            {d.company_name || d.sender_name || '—'}
          </h1>
          <span
            className="shrink-0 px-2 py-0.5 rounded text-xs font-medium border mt-0.5"
            style={d.warm_or_cold === 'Warm' ? {
              background: 'rgba(61,214,140,0.1)', color: '#3dd68c', border: '1px solid rgba(61,214,140,0.25)',
            } : {
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {d.warm_or_cold === 'Warm' ? 'Warm' : 'Cold'}
          </span>
        </div>
        <p className="text-sm text-[rgba(255,255,255,0.45)] mb-3 leading-snug">
          {d.founder_name
            ? `${d.founder_name}${d.founder_role ? ` · ${d.founder_role}` : ''}`
            : (d.sender_name || d.sender_email || '—')}
        </p>
        {/* Pills */}
        <div className="flex flex-wrap gap-1.5">
          {d.sector && (
            <span className="px-2 py-0.5 rounded text-xs border"
              style={{ background: 'rgba(124,109,250,0.1)', color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.2)' }}>
              {d.sector}
            </span>
          )}
          {d.stage && (
            <span className="px-2 py-0.5 rounded text-xs border"
              style={{ background: 'rgba(77,166,255,0.08)', color: '#4da6ff', border: '1px solid rgba(77,166,255,0.18)' }}>
              {d.stage}
            </span>
          )}
          {d.geography && (
            <span className="px-2 py-0.5 rounded text-xs border"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {d.geography}
            </span>
          )}
        </div>
      </div>

      <div className="w-full h-px bg-[rgba(255,255,255,0.06)] mb-3" />

      {/* Summary */}
      <div className="flex-1 overflow-hidden mb-3">
        <p className="text-sm leading-relaxed text-[rgba(255,255,255,0.65)]"
          style={{ display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {d.summary || 'No AI summary available.'}
        </p>
      </div>

      {/* Signal flags */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
          style={d.deck_attached ? {
            background: 'rgba(61,214,140,0.08)', border: '1px solid rgba(61,214,140,0.2)', color: '#3dd68c',
          } : {
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.22)',
          }}>
          {d.deck_attached ? 'Deck attached ✓' : 'Deck —'}
        </div>
        <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
          style={d.traction_mentioned ? {
            background: 'rgba(61,214,140,0.08)', border: '1px solid rgba(61,214,140,0.2)', color: '#3dd68c',
          } : {
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.22)',
          }}>
          {d.traction_mentioned ? 'Traction ✓' : 'Traction —'}
        </div>
      </div>

      {/* Score */}
      <div className="flex items-end justify-between">
        <div className="flex flex-col">
          <span className="font-bold font-mono leading-none" style={{ fontSize: '3rem', color: scoreColor(d.relevance_score) }}>
            {d.relevance_score ?? '—'}
          </span>
          <span className="text-[rgba(255,255,255,0.3)] text-xs mt-0.5 uppercase tracking-wider">
            relevance score
          </span>
        </div>
        <div className="text-right">
          <span className="inline-block px-3 py-1.5 rounded-md text-xs border"
            style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
            {d.category || 'Other'}
          </span>
          {d.check_size_requested && (
            <p className="text-[rgba(255,255,255,0.25)] text-xs mt-1 font-mono">
              Ask: {d.check_size_requested}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ReviewMode() {
  const [deals, setDeals] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [loading, setLoading] = useState(true);
  const [animating, setAnimating] = useState(false);

  // DOM refs for 60fps drag (no React re-renders during drag)
  const cardRef = useRef(null);
  const overlayRef = useRef(null);
  const labelRef = useRef(null);
  const nextCardRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, moved: false });
  const navigate = useNavigate();

  useEffect(() => {
    getDeals().then(data => {
      const q = (data || [])
        .filter(d => d.status === 'New')
        .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
      setDeals(q);
      setLoading(false);
    });
  }, []);

  // Lock body scroll in review mode
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Attach passive:false touchmove to card for scroll prevention
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const handler = (e) => {
      if (dragRef.current.active) e.preventDefault();
    };
    card.addEventListener('touchmove', handler, { passive: false });
    return () => card.removeEventListener('touchmove', handler);
  }, [currentIndex, loading]); // re-attach when card changes

  const total = deals.length;
  const currentDeal = deals[currentIndex];
  const nextDeal = deals[currentIndex + 1];
  const remaining = total - currentIndex;
  const progress = total > 0 ? Math.min((cleared / total) * 100, 100) : 0;

  // ── Core commit action ─────────────────────────────────────────────────────
  const commitAction = useCallback((action) => {
    if (animating || !deals[currentIndex]) return;
    const deal = deals[currentIndex];
    setAnimating(true);

    // Optimistic API update
    const statusMap = { pipeline: 'pipeline', archive: 'archived', review: 'Reviewed' };
    updateDeal(deal.id, { status: statusMap[action] }).catch(console.error);

    // Fly-off animation
    const card = cardRef.current;
    const overlay = overlayRef.current;
    const next = nextCardRef.current;

    if (card) {
      card.style.transition = 'transform 0.38s cubic-bezier(0.4, 0, 0.6, 1), opacity 0.30s ease-out';
      if (action === 'pipeline') {
        card.style.transform = 'translateX(130vw) rotate(25deg)';
      } else if (action === 'archive') {
        card.style.transform = 'translateX(-130vw) rotate(-25deg)';
      } else {
        card.style.transform = 'translateY(-110vh) scale(0.85)';
      }
      card.style.opacity = '0';
    }
    if (overlay) {
      overlay.style.transition = 'opacity 0.15s';
      overlay.style.opacity = '0';
    }
    // Next card scales up
    if (next) {
      next.style.transition = 'transform 0.38s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s';
      next.style.transform = 'scale(1) translateY(0px)';
      next.style.opacity = '1';
    }

    setTimeout(() => {
      setCurrentIndex(i => i + 1);
      setCleared(c => c + 1);
      setAnimating(false);
    }, 380);
  }, [animating, currentIndex, deals]);

  // ── Drag helpers ───────────────────────────────────────────────────────────
  function applyDrag(dx, dy) {
    const card = cardRef.current;
    const overlay = overlayRef.current;
    const label = labelRef.current;
    if (!card) return;

    const rotation = Math.max(-18, Math.min(18, dx * 0.065));
    const ty = Math.min(0, dy * 0.2);
    card.style.transform = `translateX(${dx}px) translateY(${ty}px) rotate(${rotation}deg)`;

    if (!overlay || !label) return;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const isUp = absY > absX && dy < -25;
    const isRight = dx > 25 && !isUp;
    const isLeft = dx < -25 && !isUp;
    const mag = isUp ? absY : absX;
    const opacity = Math.min(mag / 65, 0.92);

    if (isRight) {
      overlay.style.background = 'linear-gradient(to left, rgba(61,214,140,0.5) 0%, rgba(61,214,140,0.12) 60%, transparent 100%)';
      overlay.style.opacity = opacity;
      label.textContent = 'Added to Pipeline ✓';
      label.style.color = '#3dd68c';
    } else if (isLeft) {
      overlay.style.background = 'linear-gradient(to right, rgba(240,82,82,0.5) 0%, rgba(240,82,82,0.12) 60%, transparent 100%)';
      overlay.style.opacity = opacity;
      label.textContent = 'Archived ✕';
      label.style.color = '#f05252';
    } else if (isUp) {
      overlay.style.background = 'linear-gradient(to bottom, rgba(77,166,255,0.45) 0%, rgba(77,166,255,0.1) 60%, transparent 100%)';
      overlay.style.opacity = opacity;
      label.textContent = 'Marked for Review ↑';
      label.style.color = '#4da6ff';
    } else {
      overlay.style.opacity = '0';
    }
  }

  function snapBack() {
    const card = cardRef.current;
    const overlay = overlayRef.current;
    if (card) {
      card.style.transition = 'transform 0.42s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      card.style.transform = 'translateX(0) rotate(0deg)';
    }
    if (overlay) {
      overlay.style.transition = 'opacity 0.22s';
      overlay.style.opacity = '0';
    }
  }

  function handleRelease(dx, dy) {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const moved = absX > 8 || absY > 8;

    if (!moved) {
      // Tap → view full detail
      snapBack();
      navigate('/', { state: { openDealId: currentDeal?.id } });
      return;
    }
    const isUp = absY > absX && dy < -SWIPE_Y;
    if (isUp) commitAction('review');
    else if (dx > SWIPE_X) commitAction('pipeline');
    else if (dx < -SWIPE_X) commitAction('archive');
    else snapBack();
  }

  // ── Touch handlers ─────────────────────────────────────────────────────────
  const onTouchStart = useCallback((e) => {
    if (animating) return;
    const t = e.touches[0];
    dragRef.current = { active: true, startX: t.clientX, startY: t.clientY };
    if (cardRef.current) cardRef.current.style.transition = 'none';
  }, [animating]);

  const onTouchMove = useCallback((e) => {
    if (!dragRef.current.active) return;
    const t = e.touches[0];
    applyDrag(t.clientX - dragRef.current.startX, t.clientY - dragRef.current.startY);
  }, []); // eslint-disable-line

  const onTouchEnd = useCallback((e) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    const t = e.changedTouches[0];
    handleRelease(t.clientX - dragRef.current.startX, t.clientY - dragRef.current.startY);
  }, [currentDeal, navigate, commitAction]); // eslint-disable-line

  // ── Mouse handlers (desktop) ───────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    if (animating) return;
    e.preventDefault();
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY };
    if (cardRef.current) cardRef.current.style.transition = 'none';

    const onMove = (ev) => {
      if (!dragRef.current.active) return;
      applyDrag(ev.clientX - dragRef.current.startX, ev.clientY - dragRef.current.startY);
    };
    const onUp = (ev) => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      handleRelease(ev.clientX - dragRef.current.startX, ev.clientY - dragRef.current.startY);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [animating, currentDeal, navigate, commitAction]); // eslint-disable-line

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (animating || !currentDeal) return;
      if (e.key === 'ArrowRight') commitAction('pipeline');
      else if (e.key === 'ArrowLeft') commitAction('archive');
      else if (e.key === 'ArrowUp') { e.preventDefault(); commitAction('review'); }
      else if (e.key === 'Enter') navigate('/', { state: { openDealId: currentDeal.id } });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [animating, currentDeal, commitAction, navigate]);

  // ── Reset card DOM after index change ─────────────────────────────────────
  useEffect(() => {
    const card = cardRef.current;
    const overlay = overlayRef.current;
    if (card) {
      card.style.transition = 'none';
      card.style.transform = 'translateX(0) rotate(0deg)';
      card.style.opacity = '1';
    }
    if (overlay) overlay.style.opacity = '0';
  }, [currentIndex]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#0c0c12] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-[#7c6dfa] border-t-transparent animate-spin" />
          <span className="text-[rgba(255,255,255,0.4)] text-sm font-mono">Loading deals...</span>
        </div>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!currentDeal) {
    return (
      <div
        className="h-screen w-screen flex flex-col items-center justify-center gap-6 px-6 text-center"
        style={{ background: '#0c0c12' }}
        data-testid="review-empty-state"
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(61,214,140,0.08)', border: '2px solid rgba(61,214,140,0.25)' }}
        >
          <Check size={32} className="text-[#3dd68c]" />
        </div>
        <div>
          <h2 className="text-white text-2xl font-bold mb-2">All caught up</h2>
          <p className="text-[rgba(255,255,255,0.4)] text-sm leading-relaxed max-w-xs mx-auto">
            No unreviewed deals — check back after the next sync
          </p>
          {cleared > 0 && (
            <p className="text-[rgba(255,255,255,0.2)] text-xs mt-2 font-mono">
              {cleared} deal{cleared !== 1 ? 's' : ''} triaged this session
            </p>
          )}
        </div>
        <button
          data-testid="review-back-btn"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all active:scale-95"
          style={{ background: '#7c6dfa', boxShadow: '0 0 20px rgba(124,109,250,0.35)' }}
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </button>
      </div>
    );
  }

  // ── Main swipe interface ───────────────────────────────────────────────────
  const d = currentDeal;

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ background: '#0c0c12' }}
      data-testid="review-mode"
    >
      {/* ── Progress bar ───────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-safe pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <button
            data-testid="review-nav-back"
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-[rgba(255,255,255,0.4)] hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            <span className="font-mono text-xs">Dashboard</span>
          </button>
          <span className="font-mono text-xs text-[rgba(255,255,255,0.35)]" data-testid="review-remaining">
            {remaining} unreviewed
          </span>
          <span className="font-mono text-xs text-[rgba(255,255,255,0.22)]">
            {cleared}/{total}
          </span>
        </div>
        <div className="w-full h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(to right, #7c6dfa, #5b4de8)',
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      </div>

      {/* ── Card stack ─────────────────────────────────────────────────── */}
      <div className="flex-1 relative px-4 py-2 overflow-hidden">
        {/* Background card (next deal preview) */}
        {nextDeal && (
          <div
            ref={nextCardRef}
            className="absolute inset-x-4 inset-y-2 rounded-2xl"
            style={{
              background: '#13131c',
              border: '1px solid rgba(255,255,255,0.05)',
              transform: 'scale(0.94) translateY(18px)',
              opacity: 0.45,
              zIndex: 1,
            }}
          />
        )}

        {/* Current card — draggable */}
        <div
          ref={cardRef}
          data-testid="review-card"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          className="absolute inset-x-4 inset-y-2 rounded-2xl cursor-grab active:cursor-grabbing"
          style={{
            background: '#13131c',
            border: '1px solid rgba(255,255,255,0.09)',
            zIndex: 2,
            willChange: 'transform',
            boxShadow: '0 24px 72px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
          }}
        >
          {/* Swipe direction overlay */}
          <div
            ref={overlayRef}
            className="absolute inset-0 rounded-2xl z-20 pointer-events-none flex items-center justify-center"
            style={{ opacity: 0 }}
          >
            <span
              ref={labelRef}
              className="text-xl font-bold px-4 py-2 rounded-xl"
              style={{
                background: 'rgba(0,0,0,0.3)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                color: '#fff',
              }}
            />
          </div>

          {/* Card content */}
          <CardContent deal={d} />
        </div>
      </div>

      {/* ── Swipe direction hints ───────────────────────────────────────── */}
      <div className="shrink-0 px-4 pb-1 flex justify-between pointer-events-none">
        <span className="text-xs font-mono" style={{ color: 'rgba(240,82,82,0.35)' }}>← Archive</span>
        <span className="text-xs font-mono" style={{ color: 'rgba(77,166,255,0.35)' }}>↑ Review</span>
        <span className="text-xs font-mono" style={{ color: 'rgba(61,214,140,0.35)' }}>Pipeline →</span>
      </div>

      {/* ── Button bar ─────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pb-6 pt-1">
        <div className="grid grid-cols-4 gap-2">
          <button
            data-testid="review-btn-archive"
            onClick={() => commitAction('archive')}
            disabled={animating}
            className="h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'rgba(240,82,82,0.1)', border: '1px solid rgba(240,82,82,0.22)' }}
          >
            <X size={20} className="text-[#f05252]" />
            <span className="text-[#f05252] text-xs font-medium">Archive</span>
          </button>

          <button
            data-testid="review-btn-pipeline"
            onClick={() => commitAction('pipeline')}
            disabled={animating}
            className="h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'rgba(124,109,250,0.12)', border: '1px solid rgba(124,109,250,0.28)' }}
          >
            <Star size={20} className="text-[#7c6dfa]" />
            <span className="text-[#7c6dfa] text-xs font-medium">Pipeline</span>
          </button>

          <button
            data-testid="review-btn-review"
            onClick={() => commitAction('review')}
            disabled={animating}
            className="h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'rgba(77,166,255,0.1)', border: '1px solid rgba(77,166,255,0.22)' }}
          >
            <ArrowUp size={20} className="text-[#4da6ff]" />
            <span className="text-[#4da6ff] text-xs font-medium">Review</span>
          </button>

          <button
            data-testid="review-btn-detail"
            onClick={() => navigate('/', { state: { openDealId: d.id } })}
            disabled={animating}
            className="h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            <ChevronRight size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Details</span>
          </button>
        </div>

        {/* Keyboard shortcuts — desktop only */}
        <div className="hidden md:flex items-center justify-center gap-5 mt-3">
          {[
            { key: '←', label: 'Archive', color: '#f05252' },
            { key: '→', label: 'Pipeline', color: '#7c6dfa' },
            { key: '↑', label: 'Review', color: '#4da6ff' },
            { key: '↵', label: 'Details', color: 'rgba(255,255,255,0.4)' },
          ].map(({ key, label, color }) => (
            <span key={key} className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.22)' }}>
              <kbd
                className="px-1.5 py-0.5 rounded text-xs font-mono"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color }}
              >
                {key}
              </kbd>
              <span className="text-xs">{label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

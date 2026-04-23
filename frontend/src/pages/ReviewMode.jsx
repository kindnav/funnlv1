import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Star, ArrowDown, ChevronRight } from 'lucide-react';
import { getDeals, updateDealStage } from '../lib/api';
import { toast } from '../components/ui/sonner';
import { PassModal } from '../components/review/PassModal';
import { WatchlistModal } from '../components/review/WatchlistModal';
import { CardContent } from '../components/review/CardContent';

const SWIPE_X = 110;
const SWIPE_Y = 90;

// ── Main Component ────────────────────────────────────────────────────────────
export default function ReviewMode() {
  const [deals, setDeals] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [loading, setLoading] = useState(true);
  const [animating, setAnimating] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [pendingDeal, setPendingDeal] = useState(null);

  const cardRef = useRef(null);
  const overlayRef = useRef(null);
  const labelRef = useRef(null);
  const nextCardRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    getDeals().then(data => {
      const q = (data || [])
        .filter(d => d.deal_stage === 'Inbound' || (!d.deal_stage && d.status === 'New'))
        .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
      setDeals(q);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const handler = (e) => { if (dragRef.current.active) e.preventDefault(); };
    card.addEventListener('touchmove', handler, { passive: false });
    return () => card.removeEventListener('touchmove', handler);
  }, [currentIndex, loading]);

  const total = deals.length;
  const currentDeal = deals[currentIndex];
  const nextDeal = deals[currentIndex + 1];
  const remaining = total - currentIndex;
  const progress = total > 0 ? Math.min((cleared / total) * 100, 100) : 0;

  // ── Fly-off animation helper ──────────────────────────────────────────────
  function flyOff(direction) {
    const card = cardRef.current;
    const overlay = overlayRef.current;
    const next = nextCardRef.current;
    if (card) {
      card.style.transition = 'transform 0.38s cubic-bezier(0.4,0,0.6,1), opacity 0.30s ease-out';
      if (direction === 'right') card.style.transform = 'translateX(130vw) rotate(25deg)';
      else if (direction === 'left') card.style.transform = 'translateX(-130vw) rotate(-25deg)';
      else if (direction === 'up') card.style.transform = 'translateY(-110vh) scale(0.85)';
      else if (direction === 'down') card.style.transform = 'translateY(110vh) scale(0.85)';
      card.style.opacity = '0';
    }
    if (overlay) { overlay.style.transition = 'opacity 0.15s'; overlay.style.opacity = '0'; }
    if (next) {
      next.style.transition = 'transform 0.38s cubic-bezier(0.22,1,0.36,1), opacity 0.3s';
      next.style.transform = 'scale(1) translateY(0px)';
      next.style.opacity = '1';
    }
  }

  function advance() {
    setTimeout(() => {
      setCurrentIndex(i => i + 1);
      setCleared(c => c + 1);
      setAnimating(false);
    }, 380);
  }

  // ── Core commit action ─────────────────────────────────────────────────────
  const commitAction = useCallback((action) => {
    if (animating || !deals[currentIndex]) return;
    const deal = deals[currentIndex];
    setAnimating(true);

    if (action === 'first-look') {
      updateDealStage(deal.id, 'First Look').catch(console.error);
      toast('Moved to First Look', { duration: 2500 });
      flyOff('right');
      advance();

    } else if (action === 'pass') {
      // Fly off left, then show pass modal
      setPendingDeal(deal);
      flyOff('left');
      setTimeout(() => {
        setCurrentIndex(i => i + 1);
        setCleared(c => c + 1);
        setAnimating(false);
        setShowPassModal(true);
      }, 380);

    } else if (action === 'watchlist') {
      // Fly off up, then show watchlist modal
      setPendingDeal(deal);
      flyOff('up');
      setTimeout(() => {
        setCurrentIndex(i => i + 1);
        setCleared(c => c + 1);
        setAnimating(false);
        setShowWatchlistModal(true);
      }, 380);

    } else if (action === 'draft') {
      // Navigate to detail panel for drafting reply (no card fly-off needed)
      setAnimating(false);
      navigate('/', { state: { openDealId: deal.id } });
    }
  }, [animating, currentIndex, deals, navigate]); // eslint-disable-line

  const handlePassSubmit = useCallback((reason) => {
    if (pendingDeal) {
      updateDealStage(pendingDeal.id, 'Passed', reason ? { pass_reason: reason } : {}).catch(console.error);
      toast(`Passed${reason ? ` — ${reason}` : ''}`, { duration: 2500 });
    }
    setShowPassModal(false);
    setPendingDeal(null);
  }, [pendingDeal]);

  const handleWatchlistSubmit = useCallback((date) => {
    if (pendingDeal) {
      updateDealStage(pendingDeal.id, 'Watch List', { watchlist_revisit_date: date }).catch(console.error);
      toast('Added to Watch List', { duration: 2500 });
    }
    setShowWatchlistModal(false);
    setPendingDeal(null);
  }, [pendingDeal]);

  // ── Drag helpers ───────────────────────────────────────────────────────────
  function applyDrag(dx, dy) {
    const card = cardRef.current;
    const overlay = overlayRef.current;
    const label = labelRef.current;
    if (!card) return;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const isUp = absY > absX && dy < -25;
    const isDown = absY > absX && dy > 25;
    const isRight = dx > 25 && !isUp && !isDown;
    const isLeft = dx < -25 && !isUp && !isDown;

    const rotation = (isRight || isLeft) ? Math.max(-18, Math.min(18, dx * 0.065)) : 0;
    const tx = (isRight || isLeft) ? dx : 0;
    const ty = (isUp || isDown) ? dy * 0.7 : 0;
    card.style.transform = `translateX(${tx}px) translateY(${ty}px) rotate(${rotation}deg)`;

    if (!overlay || !label) return;
    const mag = (isUp || isDown) ? absY : absX;
    const opacity = Math.min(mag / 65, 0.92);

    if (isRight) {
      overlay.style.background = 'linear-gradient(to left, rgba(61,214,140,0.55) 0%, rgba(61,214,140,0.12) 60%, transparent 100%)';
      overlay.style.opacity = opacity;
      label.textContent = 'First Look →';
      label.style.color = '#3dd68c';
    } else if (isLeft) {
      overlay.style.background = 'linear-gradient(to right, rgba(240,82,82,0.55) 0%, rgba(240,82,82,0.12) 60%, transparent 100%)';
      overlay.style.opacity = opacity;
      label.textContent = 'Pass ✕';
      label.style.color = '#f05252';
    } else if (isUp) {
      overlay.style.background = 'linear-gradient(to bottom, rgba(251,191,36,0.5) 0%, rgba(251,191,36,0.1) 60%, transparent 100%)';
      overlay.style.opacity = opacity;
      label.textContent = '★ Watch List';
      label.style.color = '#fbbf24';
    } else if (isDown) {
      overlay.style.background = 'linear-gradient(to top, rgba(77,166,255,0.45) 0%, rgba(77,166,255,0.1) 60%, transparent 100%)';
      overlay.style.opacity = opacity;
      label.textContent = 'Draft Reply ↓';
      label.style.color = '#4da6ff';
    } else {
      overlay.style.opacity = '0';
    }
  }

  function snapBack() {
    const card = cardRef.current;
    const overlay = overlayRef.current;
    if (card) {
      card.style.transition = 'transform 0.42s cubic-bezier(0.175,0.885,0.32,1.275)';
      card.style.transform = 'translateX(0) rotate(0deg)';
    }
    if (overlay) { overlay.style.transition = 'opacity 0.22s'; overlay.style.opacity = '0'; }
  }

  function handleRelease(dx, dy) {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const moved = absX > 8 || absY > 8;

    if (!moved) {
      snapBack();
      navigate('/', { state: { openDealId: currentDeal?.id } });
      return;
    }
    const isUp = absY > absX && dy < -SWIPE_Y;
    const isDown = absY > absX && dy > SWIPE_Y;
    if (isUp) commitAction('watchlist');
    else if (isDown) commitAction('draft');
    else if (dx > SWIPE_X) commitAction('first-look');
    else if (dx < -SWIPE_X) commitAction('pass');
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

  // ── Mouse handlers ─────────────────────────────────────────────────────────
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
      if (animating || !currentDeal || showPassModal || showWatchlistModal) return;
      if (e.key === 'ArrowRight') commitAction('first-look');
      else if (e.key === 'ArrowLeft') commitAction('pass');
      else if (e.key === 'ArrowUp') { e.preventDefault(); commitAction('watchlist'); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); commitAction('draft'); }
      else if (e.key === 'Enter') navigate('/', { state: { openDealId: currentDeal.id } });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [animating, currentDeal, commitAction, navigate, showPassModal, showWatchlistModal]);

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
          <span className="text-[rgba(255,255,255,0.4)] text-sm font-mono">Loading inbound deals...</span>
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
        <style>{`
          @keyframes pulse-ring {
            0%, 100% { box-shadow: 0 0 0 0 rgba(61,214,140,0.15); }
            50% { box-shadow: 0 0 0 14px rgba(61,214,140,0); }
          }
        `}</style>
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(61,214,140,0.08)', border: '2px solid rgba(61,214,140,0.25)', animation: 'pulse-ring 2.4s ease-in-out infinite' }}
        >
          <Check size={32} className="text-[#3dd68c]" />
        </div>
        <div>
          <h2 className="text-white text-2xl font-bold mb-2">Inbox cleared</h2>
          <p className="text-[rgba(255,255,255,0.4)] text-sm leading-relaxed max-w-xs mx-auto">
            No inbound deals to review. New emails will appear here automatically.
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

  const d = currentDeal;

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden relative"
      style={{ background: '#0c0c12' }}
      data-testid="review-mode"
    >
      {/* ── Progress bar ────────────────────────────────────────────────── */}
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
            {remaining} inbound
          </span>
          <span className="font-mono text-xs text-[rgba(255,255,255,0.22)]">{cleared}/{total}</span>
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

      {/* ── Card stack ──────────────────────────────────────────────────── */}
      <div className="flex-1 relative px-4 py-2 overflow-hidden flex items-center justify-center">
        <div className="relative w-full h-full" style={{ maxHeight: '660px', maxWidth: '520px' }}>
          {nextDeal && (
            <div
              ref={nextCardRef}
              className="absolute inset-x-0 inset-y-0 rounded-2xl"
              style={{
                background: '#13131c',
                border: '1px solid rgba(255,255,255,0.05)',
                transform: 'scale(0.94) translateY(18px)',
                opacity: 0.45,
                zIndex: 1,
              }}
            />
          )}
          <div
            ref={cardRef}
            data-testid="review-card"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onMouseDown={onMouseDown}
            className="absolute inset-0 rounded-2xl cursor-grab active:cursor-grabbing"
            style={{
              background: '#13131c',
              border: '1px solid rgba(255,255,255,0.09)',
              zIndex: 2,
              willChange: 'transform',
              boxShadow: '0 24px 72px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
            }}
          >
            <div
              ref={overlayRef}
              className="absolute inset-0 rounded-2xl z-20 pointer-events-none flex items-center justify-center"
              style={{ opacity: 0 }}
            >
              <span
                ref={labelRef}
                className="text-xl font-bold px-4 py-2 rounded-xl"
                style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', color: '#fff' }}
              />
            </div>
            <CardContent deal={d} />
          </div>
        </div>
      </div>

      {/* ── Swipe hints ──────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pb-1">
        <div className="flex justify-between pointer-events-none">
          <span className="text-xs font-mono" style={{ color: 'rgba(240,82,82,0.4)' }}>← Pass</span>
          <span className="text-xs font-mono" style={{ color: 'rgba(251,191,36,0.4)' }}>↑ Watch List</span>
          <span className="text-xs font-mono" style={{ color: 'rgba(77,166,255,0.4)' }}>↓ Draft Reply</span>
          <span className="text-xs font-mono" style={{ color: 'rgba(61,214,140,0.4)' }}>First Look →</span>
        </div>
      </div>

      {/* ── Button bar ───────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pb-6 pt-1">
        <div className="grid grid-cols-4 gap-2">
          <button
            data-testid="review-btn-pass"
            onClick={() => commitAction('pass')}
            disabled={animating}
            className="h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'rgba(240,82,82,0.1)', border: '1px solid rgba(240,82,82,0.22)' }}
          >
            <X size={20} className="text-[#f05252]" />
            <span className="text-[#f05252] text-xs font-medium">Pass</span>
          </button>

          <button
            data-testid="review-btn-watchlist"
            onClick={() => commitAction('watchlist')}
            disabled={animating}
            className="h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.22)' }}
          >
            <Star size={20} className="text-[#fbbf24]" />
            <span className="text-[#fbbf24] text-xs font-medium">Watch List</span>
          </button>

          <button
            data-testid="review-btn-draft"
            onClick={() => commitAction('draft')}
            disabled={animating}
            className="h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'rgba(77,166,255,0.1)', border: '1px solid rgba(77,166,255,0.22)' }}
          >
            <ArrowDown size={20} className="text-[#4da6ff]" />
            <span className="text-[#4da6ff] text-xs font-medium">Draft Reply</span>
          </button>

          <button
            data-testid="review-btn-first-look"
            onClick={() => commitAction('first-look')}
            disabled={animating}
            className="h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'rgba(61,214,140,0.1)', border: '1px solid rgba(61,214,140,0.22)' }}
          >
            <Check size={20} className="text-[#3dd68c]" />
            <span className="text-[#3dd68c] text-xs font-medium">First Look</span>
          </button>
        </div>

        {/* Keyboard hints — desktop */}
        <div className="hidden md:flex items-center justify-center gap-5 mt-3">
          {[
            { key: '←', label: 'Pass', color: '#f05252' },
            { key: '↑', label: 'Watch List', color: '#fbbf24' },
            { key: '↓', label: 'Draft Reply', color: '#4da6ff' },
            { key: '→', label: 'First Look', color: '#3dd68c' },
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

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {showPassModal && (
        <PassModal
          deal={pendingDeal}
          onSubmit={handlePassSubmit}
          onSkip={() => { handlePassSubmit(''); }}
        />
      )}
      {showWatchlistModal && (
        <WatchlistModal
          deal={pendingDeal}
          onSubmit={handleWatchlistSubmit}
          onSkip={() => { setShowWatchlistModal(false); setPendingDeal(null); updateDealStage(pendingDeal?.id, 'Watch List').catch(console.error); }}
        />
      )}
    </div>
  );
}

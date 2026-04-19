import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowRight, X, Check } from 'lucide-react';

const PAD = 8;          // px of breathing room around the spotlight
const TOOLTIP_W = 296;  // fixed tooltip width

const STEPS = [
  {
    testId: 'fund-thesis-btn',
    title: 'Fund Focus',
    body: 'Your investment criteria live here. Claude uses this to score every inbound pitch 0–100 against your specific focus — not a generic algorithm.',
  },
  {
    testId: 'fit-pct-header',
    title: 'Focus Match Score',
    body: 'Every email gets a score showing how closely it aligns with your fund focus. Once you set your focus, this shows 0–100. Until then it shows a 1–10 signal quality score.',
  },
  {
    testId: '__first_deal__', // swapped out dynamically
    title: 'One-click Actions',
    body: 'Click any row to open the deal detail panel. Reject, request more info, or forward to a partner — Claude drafts the email for you in one click.',
  },
  {
    testId: 'review-mode-btn',
    title: 'Review Mode',
    body: 'Swipe through pre-scored deals like Tinder. Right = pipeline, left = archive. Fastest way to clear your deal inbox — works great on mobile too.',
  },
];

function calcTooltipPos(rect) {
  const gap = 14;
  const estH = 200;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = rect.left + rect.width / 2;

  // Prefer below, fall back to above
  let top = rect.top + rect.height + PAD + gap;
  if (top + estH > vh - 16) top = rect.top - PAD - gap - estH;

  // Centre horizontally, clamp to screen edges
  let left = cx - TOOLTIP_W / 2;
  left = Math.max(16, Math.min(left, vw - TOOLTIP_W - 16));

  return { top, left };
}

export default function ProductTour({ firstDealId, onDismiss }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const [visible, setVisible] = useState(false);

  // Swap in the real first-deal testId for step 2 — memoised to avoid
  // recreating the array on every render (which would break the useEffect deps)
  const steps = useMemo(() =>
    STEPS.map((s, i) =>
      i === 2 ? { ...s, testId: firstDealId ? `deal-row-${firstDealId}` : null } : s
    ).filter(s => s.testId),
  [firstDealId]);

  const measure = useCallback(() => {
    const el = document.querySelector(`[data-testid="${steps[step]?.testId}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top - PAD,
      left: r.left - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
    });
  }, [step, steps]);

  useEffect(() => {
    setVisible(false);
    setRect(null);
    const t1 = setTimeout(() => {
      measure();
      setTimeout(() => setVisible(true), 40);
    }, step === 0 ? 120 : 60);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t1); window.removeEventListener('resize', measure); };
  }, [step, measure]);

  const handleNext = () => {
    if (step < steps.length - 1) setStep(s => s + 1);
    else handleDismiss();
  };

  // Close tour — does not persist, so it reappears on next login
  const handleDismiss = () => {
    onDismiss();
  };

  // X button — same as dismiss
  const handleClose = () => onDismiss();

  if (!steps[step]) return null;

  const isLast = step === steps.length - 1;
  const tipPos = rect ? calcTooltipPos(rect) : null;

  return (
    // Full-screen click blocker
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9000 }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {/* Spotlight — box-shadow creates the dark overlay outside the cutout */}
      {rect && (
        <div
          style={{
            position: 'fixed',
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            borderRadius: 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
            border: '1.5px solid rgba(124,109,250,0.6)',
            pointerEvents: 'none',
            zIndex: 9001,
            transition: [
              'top 0.34s cubic-bezier(.4,0,.2,1)',
              'left 0.34s cubic-bezier(.4,0,.2,1)',
              'width 0.34s cubic-bezier(.4,0,.2,1)',
              'height 0.34s cubic-bezier(.4,0,.2,1)',
              'opacity 0.22s ease',
            ].join(', '),
            opacity: visible ? 1 : 0,
          }}
        />
      )}

      {/* Tooltip card */}
      {rect && tipPos && (
        <div
          style={{
            position: 'fixed',
            top: tipPos.top,
            left: tipPos.left,
            width: TOOLTIP_W,
            background: '#15151f',
            border: '1px solid rgba(124,109,250,0.25)',
            borderRadius: 14,
            padding: '18px 20px 16px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,109,250,0.07)',
            zIndex: 9002,
            fontFamily: "'DM Sans', system-ui, sans-serif",
            transition: 'opacity 0.26s ease, transform 0.26s ease',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(8px)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Step counter + close */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#7c6dfa', fontWeight: 700, letterSpacing: '0.07em' }}>
              {step + 1} of {steps.length}
            </span>
            <button
              data-testid="tour-close-btn"
              onClick={handleClose}
              title="Close tour"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.22)', padding: 0, lineHeight: 1 }}
            >
              <X size={13} />
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
            {steps.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1, height: 2.5, borderRadius: 2,
                  background: i <= step ? '#7c6dfa' : 'rgba(255,255,255,0.08)',
                  transition: 'background 0.3s ease',
                }}
              />
            ))}
          </div>

          <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 7, lineHeight: 1.3 }}>
            {steps[step].title}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12.5, lineHeight: 1.65, marginBottom: 16 }}>
            {steps[step].body}
          </p>

          {/* Footer actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {!isLast ? (
              <button
                data-testid="tour-skip-btn"
                onClick={handleDismiss}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'rgba(255,255,255,0.2)', padding: 0 }}
              >
                Skip tour
              </button>
            ) : <span />}

            <button
              data-testid={isLast ? 'tour-finish-btn' : 'tour-next-btn'}
              onClick={handleNext}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 15px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                background: 'linear-gradient(135deg, #7c6dfa, #5b4de8)',
                color: '#fff', border: 'none', cursor: 'pointer',
                boxShadow: '0 0 16px rgba(124,109,250,0.3)',
              }}
            >
              {isLast
                ? <><Check size={12} /> Got it</>
                : <>Next <ArrowRight size={12} /></>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

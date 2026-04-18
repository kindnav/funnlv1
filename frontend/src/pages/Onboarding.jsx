import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Brain, Target, Zap, Check } from 'lucide-react';
import { getFundSettings, saveFundSettings, markOnboardingComplete, triggerSync } from '../lib/api';

const HOW_IT_WORKS = [
  {
    icon: Brain,
    color: '#7c6dfa',
    step: '01',
    title: 'Claude reads every inbound email',
    desc: 'Every pitch email is automatically classified, scored 1–10 for relevance to your thesis, founder extracted, deck detected — all in seconds.',
    delay: 0,
  },
  {
    icon: Target,
    color: '#4da6ff',
    step: '02',
    title: 'Scored against your exact thesis',
    desc: 'The fund thesis you just entered powers a custom scoring model. A B2C social app won\'t score well if you\'re a deep-tech fund.',
    delay: 100,
  },
  {
    icon: Zap,
    color: '#3dd68c',
    step: '03',
    title: 'Review and act in one swipe',
    desc: 'Open Review Mode on mobile and swipe through your pre-triaged deals. Pipeline the best, archive the noise. AI drafts your replies.',
    delay: 200,
  },
];

// ── Step 1: Fund setup form ────────────────────────────────────────────────────
function StepFundSetup({ form, setForm, onNext, onSkip }) {
  const [saving, setSaving] = useState(false);

  const handleNext = async () => {
    setSaving(true);
    try { await saveFundSettings(form); } catch (_) {}
    setSaving(false);
    onNext();
  };

  return (
    <div
      className="w-full max-w-lg rounded-2xl p-8"
      style={{ background: '#13131c', border: '1px solid rgba(255,255,255,0.09)' }}
    >
      <h1 className="text-2xl font-bold text-white mb-1.5">Set up your fund profile</h1>
      <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.45)' }}>
        This is what powers thesis-matched scoring for every inbound email.
      </p>

      <div className="flex flex-col gap-5">
        {/* Fund name */}
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Fund name
            <span className="ml-1.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.22)' }}>optional</span>
          </label>
          <input
            data-testid="onboarding-fund-name"
            value={form.fund_name}
            onChange={e => setForm(f => ({ ...f, fund_name: e.target.value }))}
            placeholder="e.g. Future Frontier Capital"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#fff' }}
            onFocus={e => (e.target.style.borderColor = 'rgba(124,109,250,0.55)')}
            onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.09)')}
          />
        </div>

        {/* Thesis — the hero field */}
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Investment thesis
            <span className="ml-1.5 text-[10px]" style={{ color: '#f05252' }}>required for best results</span>
          </label>
          <textarea
            data-testid="onboarding-thesis"
            value={form.thesis}
            onChange={e => setForm(f => ({ ...f, thesis: e.target.value }))}
            placeholder="e.g. We invest in pre-seed B2B SaaS companies building AI-native tools for enterprise workflows. We look for founders with 5+ years domain expertise, early traction ($10k+ MRR or 100+ paying customers), and a clear distribution moat..."
            rows={6}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              color: '#fff',
              lineHeight: 1.65,
            }}
            onFocus={e => (e.target.style.borderColor = 'rgba(124,109,250,0.55)')}
            onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.09)')}
          />
          <p className="mt-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>
            The more specific, the better Claude scores deals against your thesis.
          </p>
        </div>

        {/* Sectors + Stage side by side */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Sector focus <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 10 }}>optional</span>
            </label>
            <input
              data-testid="onboarding-sectors"
              value={form.sectors}
              onChange={e => setForm(f => ({ ...f, sectors: e.target.value }))}
              placeholder="AI, SaaS, Fintech..."
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#fff' }}
              onFocus={e => (e.target.style.borderColor = 'rgba(124,109,250,0.45)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.09)')}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Stage <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 10 }}>optional</span>
            </label>
            <input
              data-testid="onboarding-stages"
              value={form.stages}
              onChange={e => setForm(f => ({ ...f, stages: e.target.value }))}
              placeholder="Pre-seed, Seed..."
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#fff' }}
              onFocus={e => (e.target.style.borderColor = 'rgba(124,109,250,0.45)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.09)')}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-8">
        <button
          data-testid="onboarding-skip-btn"
          onClick={onSkip}
          className="text-xs transition-colors"
          style={{ color: 'rgba(255,255,255,0.22)' }}
          onMouseEnter={e => (e.target.style.color = 'rgba(255,255,255,0.45)')}
          onMouseLeave={e => (e.target.style.color = 'rgba(255,255,255,0.22)')}
        >
          Skip for now
        </button>
        <button
          data-testid="onboarding-continue-btn"
          onClick={handleNext}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #7c6dfa, #5b4de8)',
            boxShadow: '0 0 24px rgba(124,109,250,0.3)',
          }}
        >
          {saving ? 'Saving...' : 'Continue'}
          {!saving && <ArrowRight size={14} />}
        </button>
      </div>
    </div>
  );
}

// ── Step 2: How it works + feature cards ─────────────────────────────────────
function StepHowItWorks({ onComplete }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 80); }, []);

  return (
    <div className="w-full max-w-lg">
      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}
      >
        <h1 className="text-2xl font-bold text-white mb-1.5 text-center">
          Here's how Signalflow works
        </h1>
        <p className="text-sm mb-8 text-center" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Your inbox is being scanned in the background right now.
        </p>
      </div>

      <div className="flex flex-col gap-4 mb-8">
        {HOW_IT_WORKS.map((item) => (
          <div
            key={item.step}
            data-testid={`how-it-works-card-${item.step}`}
            className="flex items-start gap-4 p-5 rounded-xl"
            style={{
              background: '#13131c',
              border: '1px solid rgba(255,255,255,0.07)',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateX(0)' : 'translateX(28px)',
              transition: `opacity 0.55s ease ${item.delay + 120}ms, transform 0.55s ease ${item.delay + 120}ms`,
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${item.color}14`, border: `1px solid ${item.color}28` }}
            >
              <item.icon size={18} style={{ color: item.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[10px] font-bold"
                  style={{ color: item.color, fontFamily: 'monospace' }}
                >
                  {item.step}
                </span>
                <p className="text-sm font-semibold text-white">{item.title}</p>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.5s ease 500ms',
        }}
      >
        <button
          data-testid="onboarding-go-dashboard-btn"
          onClick={onComplete}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.99]"
          style={{
            background: 'linear-gradient(135deg, #7c6dfa, #5b4de8)',
            boxShadow: '0 0 32px rgba(124,109,250,0.35)',
          }}
        >
          <Check size={15} />
          Go to my dashboard
        </button>
        <p className="text-center text-xs mt-3" style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
          First sync running in background · deals appear automatically
        </p>
      </div>
    </div>
  );
}

// ── Main onboarding wizard ───────────────────────────────────────────────────
export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [slideDir, setSlideDir] = useState(1); // 1 = forward, -1 = back
  const [animating, setAnimating] = useState(false);
  const [form, setForm] = useState({ fund_name: '', thesis: '', sectors: '', stages: '' });
  const navigate = useNavigate();

  useEffect(() => {
    // Inject DM Sans if not already loaded
    if (!document.querySelector('link[data-dmsans]')) {
      const link = document.createElement('link');
      link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap';
      link.rel = 'stylesheet';
      link.dataset.dmsans = '1';
      document.head.appendChild(link);
    }
    // Pre-populate from existing settings
    getFundSettings().then(s => {
      if (!s) return;
      setForm({
        fund_name: s.fund_name || '',
        thesis: s.thesis || '',
        sectors: s.sectors || '',
        stages: s.stages || '',
      });
      // Returning users who already finished onboarding go straight to dashboard
      if (s.onboarding_complete) {
        navigate('/', { replace: true });
      }
    }).catch(() => {});
  }, []); // eslint-disable-line

  const goToStep = (next) => {
    if (animating) return;
    setAnimating(true);
    setSlideDir(next > step ? 1 : -1);
    setTimeout(() => {
      setStep(next);
      setAnimating(false);
    }, 280);
  };

  const handleSkip = async () => {
    await markOnboardingComplete().catch(() => {});
    triggerSync().catch(() => {});
    navigate('/', { replace: true });
  };

  const handleStep1Next = () => {
    // Trigger background sync once thesis is saved
    triggerSync().catch(() => {});
    goToStep(2);
  };

  const handleComplete = async () => {
    await markOnboardingComplete().catch(() => {});
    navigate('/', { replace: true });
  };

  return (
    <div
      style={{
        background: '#0c0c12',
        minHeight: '100vh',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: '#fff',
        overflowX: 'hidden',
      }}
    >
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: '5%', left: '20%', width: '60%', height: '50%',
          background: 'radial-gradient(ellipse, rgba(124,109,250,0.07) 0%, transparent 70%)',
        }} />
        {/* Grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }} />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-5 py-14 sm:py-20">
        {/* Brand header */}
        <div className="flex items-center gap-2.5 mb-10">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm text-white"
            style={{
              background: 'linear-gradient(135deg, #7c6dfa, #5b4de8)',
              boxShadow: '0 0 20px rgba(124,109,250,0.4)',
            }}
          >
            S
          </div>
          <span className="text-white font-semibold">Signalflow</span>
        </div>

        {/* Step progress dots */}
        <div className="flex items-center gap-3 mb-10">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-3">
              <div
                className="flex items-center justify-center rounded-full text-xs font-bold transition-all duration-500"
                style={{
                  width: 28, height: 28,
                  ...(step > s ? {
                    background: 'rgba(61,214,140,0.15)',
                    border: '1px solid rgba(61,214,140,0.4)',
                    color: '#3dd68c',
                  } : step === s ? {
                    background: '#7c6dfa',
                    color: '#fff',
                    boxShadow: '0 0 14px rgba(124,109,250,0.5)',
                  } : {
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.3)',
                  }),
                }}
              >
                {step > s ? <Check size={12} /> : s}
              </div>
              {s < 2 && (
                <div
                  className="h-px w-12 transition-all duration-500"
                  style={{ background: step > s ? '#7c6dfa' : 'rgba(255,255,255,0.08)' }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Animated step content */}
        <div
          data-testid="onboarding-page"
          className="w-full flex justify-center"
          style={{
            opacity: animating ? 0 : 1,
            transform: animating
              ? `translateX(${slideDir * -30}px)`
              : 'translateX(0)',
            transition: 'opacity 0.28s ease, transform 0.28s ease',
          }}
        >
          {step === 1 && (
            <StepFundSetup
              form={form}
              setForm={setForm}
              onNext={handleStep1Next}
              onSkip={handleSkip}
            />
          )}
          {step === 2 && (
            <StepHowItWorks onComplete={handleComplete} />
          )}
        </div>
      </div>
    </div>
  );
}

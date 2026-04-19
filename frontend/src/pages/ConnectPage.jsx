import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Mail, Brain, Zap, Target, Clock, Layers, Database, MessageSquare, Users } from 'lucide-react';
import { getDbStatus } from '../lib/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// ── Scroll reveal hook ────────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

// ── Sub-components ────────────────────────────────────────────────────────────
function RevealSection({ children, delay = 0, className = '' }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

const STEPS = [
  {
    icon: Mail,
    color: '#7c6dfa',
    num: '01',
    title: 'Connect your Gmail',
    desc: 'One click Google OAuth. Read-only access. We never send emails on your behalf without your permission.',
  },
  {
    icon: Brain,
    color: '#4da6ff',
    num: '02',
    title: 'Claude AI reads every email',
    desc: 'Every inbound email is automatically classified, scored 1–10 for relevance to your fund focus, and summarized in plain English.',
  },
  {
    icon: Zap,
    color: '#3dd68c',
    num: '03',
    title: 'Review what matters',
    desc: 'See only what deserves your attention. Swipe to pipeline, archive noise, and respond to the best deals first.',
  },
];

const FEATURES = [
  {
    icon: Target,
    color: '#7c6dfa',
    title: 'Focus-matched scoring',
    desc: 'Every email scored against your specific fund focus, not a generic algorithm.',
  },
  {
    icon: Clock,
    color: '#4da6ff',
    title: 'Auto-ingestion every 15 minutes',
    desc: 'New emails processed automatically. Open your dashboard to a pre-triaged inbox.',
  },
  {
    icon: Layers,
    color: '#3dd68c',
    title: 'Swipe review mode',
    desc: 'Mobile-optimized card swiping for reviewing deals on the go. Tinder for deal flow.',
  },
  {
    icon: Database,
    color: '#f5a623',
    title: 'Full deal intelligence',
    desc: 'Stage, sector, geography, check size, traction signals, deck detection — all extracted automatically.',
  },
  {
    icon: MessageSquare,
    color: '#f05252',
    title: 'One-click draft replies',
    desc: 'Claude drafts contextually appropriate responses based on email category and score.',
  },
  {
    icon: Users,
    color: '#2dd4bf',
    title: 'Built for small teams',
    desc: 'No $500/month CRM required. Built specifically for student funds, angels, and emerging managers.',
  },
];

// ── Google G SVG ──────────────────────────────────────────────────────────────
function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white shrink-0">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ConnectPage() {
  const [dbReady, setDbReady] = useState(true);
  const [urlError, setUrlError] = useState(null);
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    // Inject DM Sans + DM Mono from Google Fonts
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) setUrlError(err);
    getDbStatus().then((s) => setDbReady(s.tables_ready));
    // Stagger hero in
    setTimeout(() => setHeroVisible(true), 80);
    return () => { try { document.head.removeChild(link); } catch (_) {} };
  }, []);

  const handleConnect = () => {
    window.location.href = `${BACKEND_URL}/api/auth/google`;
  };

  return (
    <div
      style={{
        background: '#0c0c12',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: '#fff',
        minHeight: '100vh',
        overflowX: 'hidden',
      }}
    >
      {/* Ambient gradient */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: '-10%', left: '20%', width: '60%', height: '50%',
          background: 'radial-gradient(ellipse, rgba(124,109,250,0.08) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', top: '40%', right: '10%', width: '40%', height: '40%',
          background: 'radial-gradient(ellipse, rgba(77,166,255,0.05) 0%, transparent 70%)',
        }} />
        {/* Grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }} />
      </div>

      {/* ── Sticky Nav ──────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 sm:px-10 h-14"
        style={{
          background: 'rgba(12,12,18,0.9)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-white font-bold tracking-tight" style={{ fontSize: 20, letterSpacing: '-0.03em' }}>funnl</span>
          <span className="px-1.5 py-0.5 rounded" style={{ fontSize: 9, fontWeight: 700, color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.35)', letterSpacing: '0.08em', lineHeight: 1.8 }}>
            BETA
          </span>
        </div>
        <button
          data-testid="nav-connect-btn"
          onClick={handleConnect}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
          style={{
            background: 'linear-gradient(135deg, #7c6dfa, #5b4de8)',
            boxShadow: '0 0 20px rgba(124,109,250,0.3)',
          }}
        >
          <GoogleG />
          <span>Sign in</span>
        </button>
      </nav>

      <div className="relative z-10">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="px-6 sm:px-10 pt-20 pb-16 sm:pt-28 sm:pb-24 max-w-5xl mx-auto text-center">
          <div style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.7s ease 0s, transform 0.7s ease 0s',
          }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
              style={{ background: 'rgba(124,109,250,0.1)', border: '1px solid rgba(124,109,250,0.2)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-[#7c6dfa]" style={{ boxShadow: '0 0 6px #7c6dfa' }} />
              <span className="text-[#a89cf7] text-xs font-medium" style={{ fontFamily: "'DM Mono', monospace" }}>
                Free during beta — no credit card needed
              </span>
            </div>
          </div>

          <div style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? 'translateY(0)' : 'translateY(24px)',
            transition: 'opacity 0.7s ease 120ms, transform 0.7s ease 120ms',
          }}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 tracking-tight">
              Your inbox is your deal flow.
              <br />
              <span style={{
                background: 'linear-gradient(90deg, #7c6dfa 0%, #4da6ff 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Let AI handle the triage.
              </span>
            </h1>
          </div>

          <div style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? 'translateY(0)' : 'translateY(24px)',
            transition: 'opacity 0.7s ease 200ms, transform 0.7s ease 200ms',
          }}>
            <p className="text-base sm:text-lg leading-relaxed mb-10 max-w-2xl mx-auto"
              style={{ color: 'rgba(255,255,255,0.5)' }}>
              Connect your Gmail and instantly turn inbound emails into structured, scored, actionable deal flow intelligence. Built for emerging fund managers, student funds, and angel investors.
            </p>
          </div>

          <div style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? 'translateY(0)' : 'translateY(24px)',
            transition: 'opacity 0.7s ease 280ms, transform 0.7s ease 280ms',
          }}>
            {urlError && (
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg mb-6"
                style={{ background: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.2)' }}>
                <AlertTriangle size={14} className="text-[#f05252] shrink-0" />
                <p className="text-[#f05252] text-sm">Auth error: {urlError}. Please try again.</p>
              </div>
            )}

            <button
              data-testid="connect-gmail-btn"
              onClick={handleConnect}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-xl text-white font-semibold text-base transition-all"
              style={{
                background: 'linear-gradient(135deg, #7c6dfa, #5b4de8)',
                boxShadow: '0 0 40px rgba(124,109,250,0.4)',
              }}
            >
              <GoogleG />
              Connect Gmail — it's free
            </button>

            <p className="mt-4 text-xs" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: "'DM Mono', monospace" }}>
              Read-only Gmail access &nbsp;·&nbsp; Your data stays private &nbsp;·&nbsp; Disconnect anytime
            </p>
          </div>
        </section>

        {/* ── Beta Banner ──────────────────────────────────────────────── */}
        <RevealSection className="max-w-3xl mx-auto px-6 sm:px-10 pb-16">
          <div className="rounded-2xl px-8 py-7 text-center"
            style={{
              background: 'rgba(124,109,250,0.06)',
              border: '1px solid rgba(124,109,250,0.18)',
            }}>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-4"
              style={{ background: 'rgba(124,109,250,0.15)', border: '1px solid rgba(124,109,250,0.25)' }}>
              <span className="text-[#7c6dfa] text-xs font-bold tracking-widest" style={{ fontFamily: "'DM Mono', monospace" }}>
                FREE BETA
              </span>
            </div>
            <p className="text-white font-medium mb-2">
              funnl is free during beta.
            </p>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Connect your Gmail and start triaging your deal flow in under 2 minutes.
            </p>
            <button
              onClick={handleConnect}
              data-testid="beta-connect-btn"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold text-sm transition-all"
              style={{
                background: 'rgba(124,109,250,0.18)',
                border: '1px solid rgba(124,109,250,0.4)',
                boxShadow: '0 0 20px rgba(124,109,250,0.15)',
              }}
            >
              <GoogleG />
              Join the beta — it's free
            </button>
          </div>
        </RevealSection>

        {/* ── How it Works ─────────────────────────────────────────────── */}
        <section className="px-6 sm:px-10 pb-20 max-w-5xl mx-auto">
          <RevealSection className="text-center mb-12">
            <p className="text-xs font-medium tracking-widest mb-3 uppercase"
              style={{ color: '#7c6dfa', fontFamily: "'DM Mono', monospace" }}>
              How it works
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              From inbox to insight in minutes
            </h2>
          </RevealSection>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {STEPS.map((step, i) => (
              <RevealSection key={step.num} delay={i * 80}>
                <div className="h-full rounded-2xl p-6"
                  style={{
                    background: '#13131c',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}>
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${step.color}14`, border: `1px solid ${step.color}28` }}>
                      <step.icon size={18} style={{ color: step.color }} />
                    </div>
                    <span className="font-bold text-2xl"
                      style={{ color: 'rgba(255,255,255,0.06)', fontFamily: "'DM Mono', monospace" }}>
                      {step.num}
                    </span>
                  </div>
                  <h3 className="text-white font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {step.desc}
                  </p>
                </div>
              </RevealSection>
            ))}
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────────── */}
        <section className="px-6 sm:px-10 pb-20 max-w-5xl mx-auto">
          <RevealSection className="text-center mb-12">
            <p className="text-xs font-medium tracking-widest mb-3 uppercase"
              style={{ color: '#4da6ff', fontFamily: "'DM Mono', monospace" }}>
              Features
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Everything a fund manager needs
            </h2>
          </RevealSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((feat, i) => (
              <RevealSection key={feat.title} delay={i * 60}>
                <div className="rounded-xl p-5 h-full"
                  style={{
                    background: '#13131c',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-4"
                    style={{ background: `${feat.color}12`, border: `1px solid ${feat.color}22` }}>
                    <feat.icon size={15} style={{ color: feat.color }} />
                  </div>
                  <h3 className="text-white font-semibold text-sm mb-1.5">{feat.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
                    {feat.desc}
                  </p>
                </div>
              </RevealSection>
            ))}
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────── */}
        <RevealSection className="px-6 sm:px-10 pb-20 max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Start triaging in 2 minutes
          </h2>
          <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Connect Gmail once. Claude handles everything after that.
          </p>
          {!dbReady && (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg mb-6"
              style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.2)' }}>
              <AlertTriangle size={13} className="text-[#f5a623]" />
              <p className="text-[rgba(255,255,255,0.5)] text-xs">
                Run the database migration SQL in Supabase before connecting.
              </p>
            </div>
          )}
          <button
            data-testid="footer-connect-btn"
            onClick={handleConnect}
            className="inline-flex items-center gap-3 px-8 py-4 rounded-xl text-white font-semibold text-base transition-all"
            style={{
              background: 'linear-gradient(135deg, #7c6dfa, #5b4de8)',
              boxShadow: '0 0 40px rgba(124,109,250,0.35)',
            }}
          >
            <GoogleG />
            Connect Gmail — it's free
          </button>
          <p className="mt-4 text-xs" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: "'DM Mono', monospace" }}>
            Read-only Gmail access &nbsp;·&nbsp; Your data stays private &nbsp;·&nbsp; Disconnect anytime
          </p>
        </RevealSection>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer className="px-6 py-8 text-center"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)', fontFamily: "'DM Mono', monospace" }}>
            funnl &nbsp;·&nbsp; Built for emerging fund managers &nbsp;·&nbsp; Privacy &nbsp;·&nbsp; Terms
          </p>
        </footer>
      </div>
    </div>
  );
}

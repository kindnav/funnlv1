import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Zap, Inbox, Bookmark } from 'lucide-react';

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

const VALUE_PROPS = [
  {
    icon: Zap,
    color: '#7c6dfa',
    title: 'Scores every founder email 1–10 against your thesis',
    desc: 'Every inbound pitch is automatically classified, scored for relevance to your specific fund focus, and summarised in plain English.',
  },
  {
    icon: Inbox,
    color: '#4da6ff',
    title: 'Swipe-to-triage turns 50 emails into 5 decisions',
    desc: 'Review Mode surfaces only what deserves your attention. Swipe to pipeline, archive noise, respond to the best deals first.',
  },
  {
    icon: Bookmark,
    color: '#3dd68c',
    title: 'Never lose track of a warm intro again',
    desc: 'Follow-up date reminders and Watch List revisit dates keep every relationship in the pipeline, not your memory.',
  },
];

const FAQS = [
  {
    q: 'Is my email data private?',
    a: 'Your emails are analyzed by Claude (Anthropic) to extract deal signals. Only the fields we extract — company name, scores, summary — are stored. Raw email bodies are never saved to our database.',
  },
  {
    q: 'What emails does it analyze?',
    a: 'Only emails that look like founder pitches, warm intros, or LP communications. Newsletters, receipts, and automated mail are filtered out before analysis — so your deal flow stays clean.',
  },
  {
    q: 'How is this different from a CRM?',
    a: 'A CRM stores what you type. Funnl reads what founders send you, scores it automatically, and tells you what to do next. Zero data entry required.',
  },
];

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

export default function ConnectPage() {
  const [urlError, setUrlError] = useState(null);
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) setUrlError(err);
    setTimeout(() => setHeroVisible(true), 80);
    return () => { try { document.head.removeChild(link); } catch { /* safe */ } };
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
      {/* Ambient gradient + grid */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', left: '20%', width: '60%', height: '50%', background: 'radial-gradient(ellipse, rgba(124,109,250,0.08) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', top: '40%', right: '10%', width: '40%', height: '40%', background: 'radial-gradient(ellipse, rgba(77,166,255,0.05) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
      </div>

      {/* ── Sticky Nav ── */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 sm:px-10 h-14"
        style={{ background: 'rgba(12,12,18,0.9)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-white font-bold tracking-tight" style={{ fontSize: 20, letterSpacing: '-0.03em' }}>funnl</span>
        </div>
        <button
          data-testid="nav-connect-btn"
          onClick={handleConnect}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #7c6dfa, #5b4de8)', boxShadow: '0 0 20px rgba(124,109,250,0.3)' }}
        >
          <GoogleG />
          <span>Sign in</span>
        </button>
      </nav>

      <div className="relative z-10">
        {/* ── Hero ── */}
        <section className="px-6 sm:px-10 pt-20 pb-16 sm:pt-28 sm:pb-24 max-w-5xl mx-auto text-center">
          <div style={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.7s ease 0s, transform 0.7s ease 0s' }}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-5 tracking-tight">
              Your deal flow inbox,
              <br />
              <span style={{ background: 'linear-gradient(90deg, #7c6dfa 0%, #4da6ff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                handled by AI
              </span>
            </h1>
          </div>

          <div style={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.7s ease 120ms, transform 0.7s ease 120ms' }}>
            <p className="text-base sm:text-lg leading-relaxed mb-10 max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Connect Gmail → AI scores every pitch → 15 minutes a day on what matters
            </p>
          </div>

          <div style={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.7s ease 200ms, transform 0.7s ease 200ms' }}>
            {urlError && (
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg mb-6" style={{ background: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.2)' }}>
                <AlertTriangle size={14} className="text-[#f05252] shrink-0" />
                <p className="text-[#f05252] text-sm">Auth error: {urlError}. Please try again.</p>
              </div>
            )}

            <button
              data-testid="connect-gmail-btn"
              onClick={handleConnect}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-xl text-white font-semibold text-base transition-all"
              style={{ background: 'linear-gradient(135deg, #7c6dfa, #5b4de8)', boxShadow: '0 0 40px rgba(124,109,250,0.4)' }}
            >
              <GoogleG />
              Connect Gmail — start free trial
            </button>

            <p className="mt-4 text-xs" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: "'DM Mono', monospace" }}>
              14-day free trial &nbsp;·&nbsp; $29/month after &nbsp;·&nbsp; Cancel anytime
            </p>
          </div>
        </section>

        {/* ── Value props ── */}
        <section className="px-6 sm:px-10 pb-20 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {VALUE_PROPS.map((vp, i) => (
              <RevealSection key={vp.title} delay={i * 80}>
                <div className="h-full rounded-2xl p-6" style={{ background: '#13131c', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${vp.color}14`, border: `1px solid ${vp.color}28` }}>
                    <vp.icon size={18} style={{ color: vp.color }} />
                  </div>
                  <h3 className="text-white font-semibold mb-2 leading-snug">{vp.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>{vp.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </section>

        {/* ── Pricing ── */}
        <RevealSection className="px-6 sm:px-10 pb-20 max-w-md mx-auto">
          <div className="rounded-2xl p-8 text-center" style={{ background: '#13131c', border: '1px solid rgba(124,109,250,0.25)', boxShadow: '0 0 40px rgba(124,109,250,0.08)' }}>
            <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#7c6dfa', fontFamily: "'DM Mono', monospace" }}>
              Funnl Pro
            </p>
            <div className="flex items-baseline justify-center gap-1 mb-1">
              <span className="text-white text-5xl font-bold">$29</span>
              <span className="text-[rgba(255,255,255,0.4)]">/ month</span>
            </div>
            <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: "'DM Mono', monospace" }}>
              14-day free trial &nbsp;·&nbsp; cancel anytime
            </p>
            <ul className="space-y-3 mb-8 text-left">
              {[
                'AI scores every pitch against your thesis',
                'Gmail sync + automatic email triage',
                'Follow-up date reminders',
                'Fund team collaboration',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(124,109,250,0.15)', border: '1px solid rgba(124,109,250,0.3)' }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#7c6dfa]" />
                  </div>
                  {f}
                </li>
              ))}
            </ul>
            <button
              data-testid="pricing-connect-btn"
              onClick={handleConnect}
              className="w-full py-3 rounded-lg text-white font-semibold text-sm transition-all"
              style={{ background: 'linear-gradient(135deg, #7c6dfa, #5b4de8)', boxShadow: '0 0 20px rgba(124,109,250,0.3)' }}
            >
              <GoogleG className="inline mr-2" />
              Connect Gmail — start trial
            </button>
          </div>
        </RevealSection>

        {/* ── FAQ ── */}
        <section className="px-6 sm:px-10 pb-20 max-w-2xl mx-auto">
          <RevealSection className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Common questions</h2>
          </RevealSection>
          <div className="space-y-6">
            {FAQS.map((faq, i) => (
              <RevealSection key={faq.q} delay={i * 60}>
                <div className="rounded-xl p-5" style={{ background: '#13131c', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-white font-semibold text-sm mb-2">{faq.q}</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{faq.a}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </section>

        {/* ── Final CTA ── */}
        <RevealSection className="px-6 sm:px-10 pb-20 max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Start triaging in 2 minutes
          </h2>
          <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Connect Gmail once. Claude handles everything after that.
          </p>
          <button
            data-testid="footer-connect-btn"
            onClick={handleConnect}
            className="inline-flex items-center gap-3 px-8 py-4 rounded-xl text-white font-semibold text-base transition-all"
            style={{ background: 'linear-gradient(135deg, #7c6dfa, #5b4de8)', boxShadow: '0 0 40px rgba(124,109,250,0.35)' }}
          >
            <GoogleG />
            Connect Gmail — start free trial
          </button>
          <p className="mt-4 text-xs" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: "'DM Mono', monospace" }}>
            14-day free trial &nbsp;·&nbsp; $29/month after &nbsp;·&nbsp; Cancel anytime
          </p>
        </RevealSection>

        {/* ── Footer ── */}
        <footer className="px-6 py-8 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)', fontFamily: "'DM Mono', monospace" }}>
            funnl &nbsp;·&nbsp; Built for emerging fund managers &nbsp;·&nbsp;{' '}
            <Link to="/privacy" className="underline underline-offset-2 hover:text-[rgba(255,255,255,0.5)] transition-colors">
              Privacy
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}

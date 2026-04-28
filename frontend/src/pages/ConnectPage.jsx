import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Zap, Layers, Bell, MessageSquare, Users, Building2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// ── Colored Google G ──────────────────────────────────────────────────────────
function GoogleGColored() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

// ── Dot-circle logo (8 dots arranged in a circle like Image 1) ────────────────
function LogoDots() {
  const OPACITIES = [1, 0.55, 0.3, 0.55, 1, 0.55, 0.3, 0.55];
  return (
    <svg width="36" height="36" viewBox="0 0 36 36">
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i * 45 - 90) * (Math.PI / 180);
        const r = 14;
        const x = 18 + r * Math.cos(angle);
        const y = 18 + r * Math.sin(angle);
        return <circle key={i} cx={x} cy={y} r={2.2} fill="white" opacity={OPACITIES[i]} />;
      })}
    </svg>
  );
}

// ── Stagger fade-in helper ────────────────────────────────────────────────────
function FadeIn({ delay = 0, triggered, children, style = {} }) {
  return (
    <div
      style={{
        opacity: triggered ? 1 : 0,
        transform: triggered ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 500ms cubic-bezier(0.16,1,0.3,1) ${delay}ms,
                     transform 500ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Static star particles (computed once at module load) ──────────────────────
const PARTICLES = Array.from({ length: 48 }, (_, i) => ({
  id: i,
  left: `${((i * 137.5) % 100).toFixed(2)}%`,
  top:  `${((i * 97.3 + 11) % 100).toFixed(2)}%`,
  size: i % 5 === 0 ? 2 : 1,
  opacity: ((i % 7) * 0.05 + 0.08).toFixed(2),
}));

// ── Mock deal rows for preview card ──────────────────────────────────────────
const DEALS = [
  { score: 9, name: 'VaultAI',   cat: 'Founder pitch', color: '#3dd68c' },
  { score: 7, name: 'GreenLoop', cat: 'Warm intro',    color: '#f5a623' },
  { score: 6, name: 'NestAI',    cat: 'Founder pitch', color: '#f5a623' },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function ConnectPage() {
  const [urlError,    setUrlError]    = useState(null);
  const [mounted,     setMounted]     = useState(false);
  const [panelOpen,   setPanelOpen]   = useState(false);
  const [rightReady,  setRightReady]  = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) setUrlError(err);
    // Trigger entry waterfall
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleOpenPanel = () => {
    setPanelOpen(true);
    // Stagger right-panel content in after the panel slide finishes
    setTimeout(() => setRightReady(true), 320);
  };

  const handleConnect = () => {
    window.location.href = `${BACKEND_URL}/api/auth/google`;
  };

  return (
    <>
      <style>{`
        @keyframes floatA {
          0%, 100% { transform: translateY(0px);  }
          50%       { transform: translateY(-7px); }
        }
        @keyframes floatB {
          0%, 100% { transform: translateY(-7px); }
          50%       { transform: translateY(0px);  }
        }
      `}</style>

      {/* Page background */}
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `
            radial-gradient(ellipse at 15% 88%, rgba(120,55,25,0.18) 0%, transparent 48%),
            radial-gradient(ellipse at 85% 88%, rgba(38,38,90,0.22)  0%, transparent 48%),
            #0a0a0f
          `,
          fontFamily: "'DM Sans', system-ui, sans-serif",
          color: '#fff',
          padding: '20px',
          boxSizing: 'border-box',
        }}
      >
        {/* ── Outer card ────────────────────────────────────────────────── */}
        <div
          style={{
            width: '90vw',
            maxWidth: 1200,
            height: '90vh',
            borderRadius: 12,
            background: '#0f0f14',
            border: '1px solid rgba(255,255,255,0.06)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'row',
          }}
        >

          {/* ── LEFT PANEL ─────────────────────────────────────────────── */}
          <div
            style={{
              flex:       panelOpen ? '0 0 42%' : '1 1 100%',
              display:    'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding:    panelOpen ? '0 0 0 60px' : '0',
              transition: 'flex 520ms cubic-bezier(0.16,1,0.3,1), padding 520ms cubic-bezier(0.16,1,0.3,1)',
              minWidth: 0,
            }}
          >
            {/* Content column — fixed width, shifts alignment on split */}
            <div
              style={{
                width: 320,
                maxWidth: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: panelOpen ? 'flex-start' : 'center',
                transition: 'align-items 520ms ease',
                padding: panelOpen ? '0' : '0 20px',
              }}
            >
              {/* Logo */}
              <FadeIn delay={0} triggered={mounted}>
                <LogoDots />
              </FadeIn>

              {/* Heading */}
              <FadeIn delay={80} triggered={mounted} style={{ marginTop: 18 }}>
                <h1
                  style={{
                    fontSize: 26,
                    fontWeight: 600,
                    color: '#fff',
                    letterSpacing: '-0.02em',
                    margin: 0,
                    textAlign: panelOpen ? 'left' : 'center',
                    transition: 'text-align 300ms ease',
                  }}
                >
                  {panelOpen ? 'Welcome back to Funnl' : 'Welcome to Funnl'}
                </h1>
              </FadeIn>

              {/* Subheading */}
              <FadeIn delay={160} triggered={mounted} style={{ marginTop: 8 }}>
                <p
                  style={{
                    fontSize: 14,
                    color: 'rgba(255,255,255,0.45)',
                    margin: 0,
                    textAlign: panelOpen ? 'left' : 'center',
                    transition: 'text-align 300ms ease',
                  }}
                >
                  Connect your Gmail to get started
                </p>
              </FadeIn>

              {/* Error banner */}
              {urlError && (
                <div
                  style={{
                    marginTop: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(240,82,82,0.08)',
                    border: '1px solid rgba(240,82,82,0.2)',
                    width: '100%',
                  }}
                >
                  <AlertTriangle size={14} style={{ color: '#f05252', flexShrink: 0 }} />
                  <p style={{ fontSize: 13, color: '#f05252', margin: 0 }}>
                    Auth error: {urlError}. Please try again.
                  </p>
                </div>
              )}

              {/* Google button */}
              <FadeIn delay={240} triggered={mounted} style={{ marginTop: 28, width: '100%' }}>
                <button
                  data-testid="connect-gmail-btn"
                  onClick={handleConnect}
                  style={{
                    width: '100%',
                    height: 48,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'background 150ms ease',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                >
                  <GoogleGColored />
                  Continue with Google
                </button>
              </FadeIn>

              {/* "See how it works" — only visible before panel opens */}
              <div
                style={{
                  width: '100%',
                  overflow: 'hidden',
                  maxHeight: panelOpen ? 0 : 60,
                  opacity: panelOpen ? 0 : 1,
                  marginTop: panelOpen ? 0 : 12,
                  transition: 'max-height 400ms ease, opacity 300ms ease, margin-top 400ms ease',
                }}
              >
                <FadeIn delay={320} triggered={mounted} style={{ width: '100%' }}>
                  <button
                    data-testid="see-how-btn"
                    onClick={handleOpenPanel}
                    style={{
                      width: '100%',
                      height: 48,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#ffffff',
                      border: 'none',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#0a0a0f',
                      cursor: 'pointer',
                      transition: 'background 150ms ease',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.88)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#ffffff')}
                  >
                    See how it works →
                  </button>
                </FadeIn>
              </div>

              {/* Trial text — collapses when panel opens */}
              <div
                style={{
                  overflow: 'hidden',
                  maxHeight: panelOpen ? 0 : 40,
                  opacity: panelOpen ? 0 : 1,
                  marginTop: panelOpen ? 0 : 16,
                  transition: 'max-height 400ms ease, opacity 300ms ease, margin-top 400ms ease',
                }}
              >
                <FadeIn delay={400} triggered={mounted}>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    14-day free trial · No credit card required
                  </p>
                </FadeIn>
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL (product preview) ──────────────────────────── */}
          <div
            style={{
              flex:       panelOpen ? '1' : '0 0 0%',
              opacity:    panelOpen ? 1 : 0,
              overflow:   'hidden',
              borderRadius: '0 10px 10px 0',
              background: `radial-gradient(
                ellipse at 50% 30%,
                rgba(55,75,190,0.45) 0%,
                rgba(18,18,58,0.85) 40%,
                #07070f 100%
              )`,
              display:    'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position:   'relative',
              transition: 'flex 520ms cubic-bezier(0.16,1,0.3,1), opacity 400ms ease',
            }}
          >
            {/* Star particles */}
            {PARTICLES.map(p => (
              <div
                key={p.id}
                style={{
                  position: 'absolute',
                  left: p.left,
                  top: p.top,
                  width: p.size,
                  height: p.size,
                  borderRadius: '50%',
                  background: '#fff',
                  opacity: p.opacity,
                  pointerEvents: 'none',
                }}
              />
            ))}

            {/* Feature showcase — header + 2×3 grid */}
            <div style={{ width: '100%', maxWidth: 500, margin: '0 auto', padding: '24px 32px' }}>

              {/* Header + subtitle */}
              <FadeIn delay={0} triggered={rightReady}>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: '0 0 4px', lineHeight: 1.4 }}>
                    Everything you need to run a smarter fund
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                    Connects with Notion, Slack, and your existing workflow
                  </p>
                </div>
              </FadeIn>

              {/* 2×3 grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto auto', gap: 10 }}>

                {/* ── Card 1: AI Inbox Triage ── */}
                <FadeIn delay={0} triggered={rightReady}>
                  <div style={{
                    background: 'rgba(18,18,42,0.92)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 14, padding: 14,
                    boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                    animation: 'floatA 4s ease-in-out infinite',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'rgba(245,166,35,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Zap size={14} style={{ color: '#f5a623' }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>AI Inbox Triage</span>
                    </div>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '6px 0 10px', lineHeight: 1.5 }}>
                      Every pitch scored 1-10 against your focus
                    </p>
                    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                      {[
                        { score: 9, name: 'VaultAI',  cat: 'Pitch', color: '#3dd68c' },
                        { score: 7, name: 'GreenLoop', cat: 'Intro', color: '#f5a623' },
                        { score: 4, name: 'NestAI',    cat: 'Pitch', color: '#f05252' },
                      ].map((r, i) => (
                        <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: i < 2 ? 7 : 0 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                            background: `${r.color}1e`, border: `1px solid ${r.color}55`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, fontWeight: 700, color: r.color,
                          }}>{r.score}</div>
                          <span style={{ fontSize: 11, fontWeight: 500, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.38)', background: 'rgba(255,255,255,0.07)', borderRadius: 999, padding: '1px 6px', flexShrink: 0 }}>{r.cat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </FadeIn>

                {/* ── Card 2: Swipe to Decide ── */}
                <FadeIn delay={80} triggered={rightReady}>
                  <div style={{
                    background: 'rgba(18,18,42,0.92)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 14, padding: 14,
                    boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                    animation: 'floatB 4s ease-in-out infinite',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'rgba(124,109,250,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Layers size={14} style={{ color: '#7c6dfa' }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Swipe to Decide</span>
                    </div>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '6px 0 10px', lineHeight: 1.5 }}>
                      Tinder-style deal decisions. Right to pipeline, left to pass.
                    </p>
                    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                      {/* Rotated mini card */}
                      <div style={{
                        background: 'rgba(124,109,250,0.08)',
                        border: '1px solid rgba(124,109,250,0.2)',
                        borderRadius: 10, padding: '8px 12px',
                        transform: 'rotate(-3deg)',
                        marginBottom: 8,
                      }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: '0 0 2px' }}>VaultAI</p>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#3dd68c', margin: 0 }}>9/10</p>
                      </div>
                      {/* Action hints */}
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 5 }}>
                        {[
                          { label: '← Pass',       color: '#f05252' },
                          { label: '→ First Look', color: '#3dd68c' },
                          { label: '↑ Watch',      color: '#2dd4bf' },
                        ].map(a => (
                          <span key={a.label} style={{
                            fontSize: 10, color: a.color,
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: 999, padding: '2px 8px',
                            whiteSpace: 'nowrap',
                          }}>
                            {a.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </FadeIn>

                {/* ── Card 3: Follow-up Reminders ── */}
                <FadeIn delay={160} triggered={rightReady}>
                  <div style={{
                    background: 'rgba(18,18,42,0.92)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 14, padding: 14,
                    boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                    animation: 'floatA 4s ease-in-out infinite',
                    animationDelay: '0.8s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'rgba(45,212,191,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Bell size={14} style={{ color: '#2dd4bf' }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Never Miss a Follow-up</span>
                    </div>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '6px 0 10px', lineHeight: 1.5 }}>
                      Set reminders, get notified when deals go cold
                    </p>
                    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f5a623', flexShrink: 0, marginTop: 3 }} />
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 600, color: '#fff', margin: 0 }}>VaultAI</p>
                          <p style={{ fontSize: 10, color: '#f5a623', margin: 0 }}>Follow-up due today</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2dd4bf', flexShrink: 0, marginTop: 3 }} />
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: 0 }}>GreenLoop · in 3 days</p>
                      </div>
                    </div>
                  </div>
                </FadeIn>

                {/* ── Card 4: AI Call Prep ── */}
                <FadeIn delay={240} triggered={rightReady}>
                  <div style={{
                    background: 'rgba(18,18,42,0.92)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 14, padding: 14,
                    boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                    animation: 'floatB 4s ease-in-out infinite',
                    animationDelay: '0.8s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'rgba(77,166,255,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <MessageSquare size={14} style={{ color: '#4da6ff' }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>AI Call Prep</span>
                    </div>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '6px 0 10px', lineHeight: 1.5 }}>
                      One-click brief before every founder call
                    </p>
                    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 3px' }}>Objective</p>
                      <p style={{ fontSize: 11, color: '#fff', margin: '0 0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Determine if traction is real...</p>
                      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0 0 8px' }} />
                      <p style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 3px' }}>5 Key Questions</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>1. What is your MRR growth...</p>
                    </div>
                  </div>
                </FadeIn>

                {/* ── Card 5: Contact Intelligence ── */}
                <FadeIn delay={320} triggered={rightReady}>
                  <div style={{
                    background: 'rgba(18,18,42,0.92)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 14, padding: 14,
                    boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                    animation: 'floatA 4s ease-in-out infinite',
                    animationDelay: '1.6s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'rgba(77,166,255,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Users size={14} style={{ color: '#4da6ff' }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Contact Intelligence</span>
                    </div>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '6px 0 10px', lineHeight: 1.5 }}>
                      Every founder auto-saved with deal history and notes
                    </p>
                    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                      {[
                        { initials: 'MC', name: 'Marcus Chen',  badge: '2 deals',  badgeColor: '#2dd4bf', avatarColor: '#7c6dfa' },
                        { initials: 'AK', name: 'Anika Kumar',  badge: 'Returning', badgeColor: '#f5a623', avatarColor: '#4da6ff' },
                        { initials: 'JP', name: 'James Park',   badge: '1 deal',   badgeColor: null,      avatarColor: '#3dd68c' },
                      ].map((c, i) => (
                        <div key={c.initials} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < 2 ? 6 : 0 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                            background: `${c.avatarColor}33`, color: c.avatarColor,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, fontWeight: 700,
                          }}>{c.initials}</div>
                          <span style={{ fontSize: 12, fontWeight: i === 2 ? 400 : 500, color: i === 2 ? 'rgba(255,255,255,0.5)' : '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                          <span style={{
                            fontSize: 10, borderRadius: 999, padding: '1px 6px', flexShrink: 0,
                            color: c.badgeColor || 'rgba(255,255,255,0.3)',
                            background: c.badgeColor ? `${c.badgeColor}1a` : 'rgba(255,255,255,0.06)',
                          }}>{c.badge}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </FadeIn>

                {/* ── Card 6: Shared Fund Workspace ── */}
                <FadeIn delay={400} triggered={rightReady}>
                  <div style={{
                    background: 'rgba(18,18,42,0.92)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 14, padding: 14,
                    boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                    animation: 'floatB 4s ease-in-out infinite',
                    animationDelay: '1.6s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'rgba(245,166,35,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Building2 size={14} style={{ color: '#f5a623' }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Shared Fund Workspace</span>
                    </div>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '6px 0 10px', lineHeight: 1.5 }}>
                      Invite your team, vote on deals, build pipeline together
                    </p>
                    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                      {/* Fund label */}
                      <p style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 8px' }}>
                        YBK Ventures
                      </p>
                      {/* Overlapping avatars */}
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                        {[
                          { initials: 'NK', color: '#7c6dfa' },
                          { initials: 'AK', color: '#4da6ff' },
                          { initials: 'MJ', color: '#3dd68c' },
                        ].map((a, i) => (
                          <div key={a.initials} style={{
                            width: 24, height: 24, borderRadius: '50%',
                            background: `${a.color}33`, color: a.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, fontWeight: 700,
                            marginLeft: i > 0 ? -6 : 0,
                            border: '1px solid rgba(18,18,42,0.92)',
                          }}>{a.initials}</div>
                        ))}
                      </div>
                      {/* Member count */}
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '0 0 8px' }}>
                        3 partners · 12 deals this week
                      </p>
                      {/* Vote row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>VaultAI</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {[
                            { symbol: '✓', color: '#3dd68c' },
                            { symbol: '✓', color: '#3dd68c' },
                            { symbol: '?', color: '#f5a623' },
                          ].map((v, i) => (
                            <div key={i} style={{
                              width: 18, height: 18, borderRadius: '50%',
                              background: `${v.color}1e`, border: `1px solid ${v.color}55`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 9, fontWeight: 700, color: v.color,
                            }}>{v.symbol}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </FadeIn>

              </div>
            </div>
          </div>

          {/* ── Footer (pinned to bottom of card) ──────────────────────── */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 28px',
              pointerEvents: 'none',
            }}
          >
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', pointerEvents: 'auto' }}>
              © 2025 Funnl
            </span>
            <div style={{ display: 'flex', gap: 20, pointerEvents: 'auto' }}>
              <Link
                to="/privacy"
                style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.28)')}
              >
                Privacy Policy
              </Link>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>Support</span>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

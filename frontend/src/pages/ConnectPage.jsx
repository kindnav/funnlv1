import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

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

            {/* Floating cards stack */}
            <div style={{ position: 'relative', width: 340, height: 360 }}>

              {/* Card 1 — back (Inbound Deals list) */}
              <FadeIn delay={0} triggered={rightReady}>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: 288,
                    background: 'rgba(20,20,42,0.92)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    padding: '18px 20px',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
                    animation: 'floatA 4s ease-in-out infinite',
                    zIndex: 1,
                  }}
                >
                  <p style={{
                    fontSize: 11, fontWeight: 600,
                    color: 'rgba(255,255,255,0.45)',
                    letterSpacing: '0.07em', textTransform: 'uppercase',
                    margin: '0 0 14px',
                  }}>
                    Inbound Deals
                  </p>
                  {DEALS.map(row => (
                    <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      {/* Score circle */}
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: `${row.color}1e`,
                        border: `1px solid ${row.color}55`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: row.color, flexShrink: 0,
                      }}>
                        {row.score}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#fff', flex: 1 }}>
                        {row.name}
                      </span>
                      <span style={{
                        fontSize: 10, color: 'rgba(255,255,255,0.4)',
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap',
                      }}>
                        {row.cat}
                      </span>
                    </div>
                  ))}
                </div>
              </FadeIn>

              {/* Card 2 — front (Stat + sparkline) */}
              <FadeIn delay={140} triggered={rightReady}>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: 248,
                    background: 'rgba(13,13,34,0.97)',
                    border: '1px solid rgba(255,255,255,0.13)',
                    borderRadius: 16,
                    padding: '18px 20px',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                    animation: 'floatB 4s ease-in-out infinite',
                    zIndex: 2,
                  }}
                >
                  <p style={{
                    fontSize: 10, fontWeight: 600,
                    color: 'rgba(255,255,255,0.35)',
                    letterSpacing: '0.07em', textTransform: 'uppercase',
                    margin: '0 0 6px',
                  }}>
                    This Week
                  </p>
                  <p style={{ fontSize: 38, fontWeight: 700, color: '#fff', margin: '0 0 3px', lineHeight: 1 }}>
                    23
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', margin: '0 0 18px' }}>
                    deals analyzed by AI
                  </p>
                  {/* Sparkline */}
                  <svg width="100%" height="42" viewBox="0 0 208 42" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#7c6dfa" stopOpacity="0.35"/>
                        <stop offset="100%" stopColor="#7c6dfa" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    <path
                      d="M0 34 L34 26 L68 30 L102 16 L136 11 L170 6 L208 2"
                      fill="none" stroke="#7c6dfa" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"
                    />
                    <path
                      d="M0 34 L34 26 L68 30 L102 16 L136 11 L170 6 L208 2 L208 42 L0 42 Z"
                      fill="url(#sg)"
                    />
                    {/* End dot */}
                    <circle cx="208" cy="2" r="3" fill="#7c6dfa"/>
                  </svg>
                </div>
              </FadeIn>
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

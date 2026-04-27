import { Link } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-white font-semibold text-base mb-3">{title}</h2>
    <div className="text-sm leading-relaxed space-y-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
      {children}
    </div>
  </div>
);

export default function PrivacyPage() {
  return (
    <div
      style={{ background: '#0c0c12', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#fff', minHeight: '100vh' }}
    >
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 sm:px-10 h-14"
        style={{ background: 'rgba(12,12,18,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <Link to="/" className="flex items-center gap-2">
          <span className="text-white font-bold tracking-tight" style={{ fontSize: 20, letterSpacing: '-0.03em' }}>funnl</span>
        </Link>
        <a
          href={`${BACKEND_URL}/api/auth/google`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #7c6dfa, #5b4de8)' }}
        >
          Sign in
        </a>
      </nav>

      <main className="px-6 sm:px-10 py-16 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm mb-10" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
          Last updated: April 2026
        </p>

        <Section title="Overview">
          <p>Funnl is a deal flow management tool for venture capital investors. This policy explains what data we collect, how we use it, and your rights.</p>
        </Section>

        <Section title="What we collect">
          <p><strong className="text-[rgba(255,255,255,0.7)]">Account data:</strong> Your name, email address, and profile picture from Google OAuth.</p>
          <p><strong className="text-[rgba(255,255,255,0.7)]">Gmail access:</strong> We request read-only access to your Gmail inbox to identify inbound deal flow emails. We also request send access if you choose to enable one-click email replies.</p>
          <p><strong className="text-[rgba(255,255,255,0.7)]">Extracted deal fields:</strong> For emails we identify as relevant, we extract and store structured fields only — company name, sender name, AI-generated scores, summaries, and signals. We do not store raw email bodies in our database.</p>
          <p><strong className="text-[rgba(255,255,255,0.7)]">Usage data:</strong> Basic interaction logs to maintain service reliability.</p>
        </Section>

        <Section title="How we use your data">
          <p>Email content is sent to Anthropic's Claude API for analysis. Anthropic's data usage policies apply to this processing. We use the results to populate your deal flow dashboard and score emails against your fund thesis.</p>
          <p>We do not sell your data, share it with third parties for advertising, or use it to train AI models.</p>
        </Section>

        <Section title="Third-party services">
          <p>Funnl uses the following third-party services:</p>
          <ul className="list-disc ml-4 space-y-1 mt-1">
            <li><strong className="text-[rgba(255,255,255,0.7)]">Google OAuth & Gmail API</strong> — authentication and email access</li>
            <li><strong className="text-[rgba(255,255,255,0.7)]">Anthropic (Claude API)</strong> — AI email analysis</li>
            <li><strong className="text-[rgba(255,255,255,0.7)]">Supabase</strong> — database hosting (EU/US)</li>
            <li><strong className="text-[rgba(255,255,255,0.7)]">Stripe</strong> — payment processing</li>
          </ul>
        </Section>

        <Section title="Data retention & deletion">
          <p>Your data is retained as long as your account is active. To delete your account and all associated data, email us at the address below. We will process deletion requests within 30 days.</p>
        </Section>

        <Section title="Security">
          <p>Gmail tokens are stored encrypted. All data is transmitted over HTTPS. We use httpOnly cookies for session management to prevent XSS token theft.</p>
        </Section>

        <Section title="Contact">
          <p>For privacy questions or deletion requests, contact us at: <span className="text-[#7c6dfa]">privacy@funnl.app</span></p>
        </Section>
      </main>

      <footer className="px-6 py-8 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
          funnl &nbsp;·&nbsp;{' '}
          <Link to="/" className="underline underline-offset-2 hover:text-[rgba(255,255,255,0.5)] transition-colors">
            Home
          </Link>
        </p>
      </footer>
    </div>
  );
}

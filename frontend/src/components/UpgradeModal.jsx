import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { createCheckoutSession } from '../lib/api';

export default function UpgradeModal({ onClose }) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      await createCheckoutSession();
    } catch {
      setLoading(false);
    }
  };

  const features = [
    'AI scores every pitch against your thesis',
    'Gmail sync + automatic email triage',
    'Follow-up date reminders',
    'Cancel anytime',
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: '#13131c', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-white font-semibold text-base">Your free trial has ended</h2>
            <p className="text-[rgba(255,255,255,0.4)] text-xs mt-1">Subscribe to continue syncing deals</p>
          </div>
          <button onClick={onClose} className="text-[rgba(255,255,255,0.3)] hover:text-white transition-colors ml-4 shrink-0">
            <X size={16} />
          </button>
        </div>

        <div
          className="rounded-xl p-4 mb-5"
          style={{ background: 'rgba(124,109,250,0.06)', border: '1px solid rgba(124,109,250,0.18)' }}
        >
          <div className="flex items-baseline gap-1 mb-3">
            <span className="text-white text-3xl font-bold">$29</span>
            <span className="text-[rgba(255,255,255,0.4)] text-sm">/ month</span>
          </div>
          <ul className="space-y-2">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                <Check size={12} className="text-[#3dd68c] shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-all disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, #7c6dfa, #5b4de8)',
            boxShadow: '0 0 20px rgba(124,109,250,0.3)',
          }}
        >
          {loading ? 'Redirecting to checkout…' : 'Start subscription'}
        </button>
        <button
          onClick={onClose}
          className="w-full mt-2 py-2 text-xs text-[rgba(255,255,255,0.3)] hover:text-[rgba(255,255,255,0.5)] transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

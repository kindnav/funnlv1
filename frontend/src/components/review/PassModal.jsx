import { useState } from 'react';

const PASS_PRESETS = [
  'Team not right',
  'Market too small',
  'Too early',
  'Not in thesis',
  'No traction',
  'Valuation too high',
];

export function PassModal({ deal, onSubmit, onSkip }) {
  const [reason, setReason] = useState('');
  return (
    <div
      data-testid="pass-modal"
      className="absolute inset-0 z-50 flex items-end justify-center pb-6 px-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full rounded-2xl p-5"
        style={{ background: '#1a1a26', border: '1px solid rgba(240,82,82,0.25)', maxWidth: '520px' }}
      >
        <p className="text-white font-semibold text-sm mb-1">Why are you passing?</p>
        <p className="text-[rgba(255,255,255,0.4)] text-xs mb-4">
          {deal?.company_name || deal?.sender_name || 'This deal'}
        </p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PASS_PRESETS.map((p) => (
            <button
              key={p}
              data-testid={`pass-preset-${p.toLowerCase().replace(/ /g, '-')}`}
              onClick={() => setReason(p)}
              className="px-2.5 py-1 rounded-lg text-xs transition-all"
              style={reason === p ? {
                background: 'rgba(240,82,82,0.2)', color: '#f05252',
                border: '1px solid rgba(240,82,82,0.4)',
              } : {
                background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          data-testid="pass-reason-text"
          type="text"
          placeholder="Or type a custom reason..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full bg-[#0c0c12] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-xs text-white placeholder-[rgba(255,255,255,0.2)] focus:outline-none focus:border-[#f05252] transition-colors mb-3"
        />
        <div className="flex gap-2">
          <button
            data-testid="pass-submit-btn"
            onClick={() => onSubmit(reason)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: 'rgba(240,82,82,0.15)', color: '#f05252', border: '1px solid rgba(240,82,82,0.35)' }}
          >
            Confirm Pass
          </button>
          <button
            data-testid="pass-skip-btn"
            onClick={onSkip}
            className="px-4 py-2.5 rounded-xl text-xs transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

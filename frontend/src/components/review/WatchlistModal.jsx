import { useState } from 'react';

const WATCHLIST_PRESETS = [
  { label: '1 month', months: 1 },
  { label: '3 months', months: 3 },
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
];

function addMonths(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function WatchlistModal({ deal, onSubmit, onSkip }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [customDate, setCustomDate] = useState('');
  const activeDate = customDate || selectedDate;

  return (
    <div
      data-testid="watchlist-modal"
      className="absolute inset-0 z-50 flex items-end justify-center pb-6 px-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full rounded-2xl p-5"
        style={{ background: '#1a1a26', border: '1px solid rgba(251,191,36,0.25)', maxWidth: '520px' }}
      >
        <p className="text-white font-semibold text-sm mb-1">When should we revisit?</p>
        <p className="text-[rgba(255,255,255,0.4)] text-xs mb-4">
          {deal?.company_name || deal?.sender_name || 'This deal'}
        </p>
        <div className="flex gap-2 mb-3">
          {WATCHLIST_PRESETS.map(({ label, months }) => {
            const d = addMonths(months);
            return (
              <button
                key={label}
                data-testid={`watchlist-preset-${label.replace(/ /g, '-')}`}
                onClick={() => { setSelectedDate(d); setCustomDate(''); }}
                className="flex-1 py-2 rounded-lg text-xs transition-all"
                style={selectedDate === d && !customDate ? {
                  background: 'rgba(251,191,36,0.18)', color: '#fbbf24',
                  border: '1px solid rgba(251,191,36,0.4)',
                } : {
                  background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <input
          data-testid="watchlist-custom-date"
          type="date"
          value={customDate}
          onChange={(e) => { setCustomDate(e.target.value); setSelectedDate(''); }}
          className="w-full bg-[#0c0c12] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#fbbf24] transition-colors mb-3"
          style={{ colorScheme: 'dark' }}
        />
        <div className="flex gap-2">
          <button
            data-testid="watchlist-submit-btn"
            disabled={!activeDate}
            onClick={() => activeDate && onSubmit(activeDate)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.35)' }}
          >
            Add to Watch List
          </button>
          <button
            data-testid="watchlist-skip-btn"
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

/**
 * StatsBar — pure presentational component showing 5 summary metrics.
 * Accepts the full deals array and computes stats locally so Dashboard
 * doesn't need to pre-compute and pass individual numbers.
 */
export function StatsBar({ deals }) {
  const total = deals.length;
  const pitches = deals.filter(d => d.category === 'Founder pitch').length;
  const scores = deals.map(d => d.relevance_score).filter(s => s != null);
  const avg = scores.length
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
    : '—';
  const high = deals.filter(d => (d.relevance_score || 0) >= 7).length;
  const unreviewed = deals.filter(
    d => d.deal_stage === 'Inbound' || (!d.deal_stage && d.status === 'New'),
  ).length;

  const metrics = [
    { label: 'Total Inbound',   value: total,     color: 'rgba(255,255,255,0.7)' },
    { label: 'Founder Pitches', value: pitches,   color: '#7c6dfa' },
    { label: 'Avg Score',       value: avg,       color: '#f5a623' },
    { label: 'Strong Fit',      value: high,      color: '#3dd68c' },
    { label: 'Unreviewed',      value: unreviewed,color: '#4da6ff' },
  ];

  return (
    <div className="h-16 shrink-0 border-b border-[rgba(255,255,255,0.05)] flex items-center px-5 gap-1 bg-[#0c0c12]">
      {metrics.map(({ label, value, color }) => (
        <div key={label} className="flex-1 flex flex-col items-center justify-center">
          <span
            className="text-xl font-bold font-mono"
            style={{ color }}
            data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}
          >
            {value}
          </span>
          <span className="text-[rgba(255,255,255,0.3)] text-xs uppercase tracking-wider mt-0.5 hidden sm:block">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

const scoreColor = (s) => {
  if (s == null) return 'rgba(255,255,255,0.3)';
  if (s >= 7) return '#3dd68c';
  if (s >= 4) return '#f5a623';
  return '#f05252';
};

export function CardContent({ deal: d }) {
  return (
    <div className="absolute inset-0 p-5 flex flex-col overflow-hidden pointer-events-none">
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h1 className="text-2xl font-bold text-white leading-tight flex-1">
            {d.company_name || d.sender_name || '—'}
          </h1>
          <span
            className="shrink-0 px-2 py-0.5 rounded text-xs font-medium border mt-0.5"
            style={d.warm_or_cold === 'Warm' ? {
              background: 'rgba(61,214,140,0.1)', color: '#3dd68c', border: '1px solid rgba(61,214,140,0.25)',
            } : {
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {d.warm_or_cold === 'Warm' ? 'Warm' : 'Cold'}
          </span>
        </div>
        <p className="text-sm text-[rgba(255,255,255,0.45)] mb-3 leading-snug">
          {d.founder_name
            ? `${d.founder_name}${d.founder_role ? ` · ${d.founder_role}` : ''}`
            : (d.sender_name || d.sender_email || '—')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {d.sector && (
            <span className="px-2 py-0.5 rounded text-xs border"
              style={{ background: 'rgba(124,109,250,0.1)', color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.2)' }}>
              {d.sector}
            </span>
          )}
          {d.stage && (
            <span className="px-2 py-0.5 rounded text-xs border"
              style={{ background: 'rgba(77,166,255,0.08)', color: '#4da6ff', border: '1px solid rgba(77,166,255,0.18)' }}>
              {d.stage}
            </span>
          )}
          {d.geography && (
            <span className="px-2 py-0.5 rounded text-xs border"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {d.geography}
            </span>
          )}
        </div>
      </div>

      <div className="w-full h-px bg-[rgba(255,255,255,0.06)] mb-3" />

      <div className="flex-1 overflow-hidden mb-3">
        <p className="text-sm leading-relaxed text-[rgba(255,255,255,0.65)]"
          style={{ display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {d.summary || 'No AI summary available.'}
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
          style={d.deck_attached ? {
            background: 'rgba(61,214,140,0.08)', border: '1px solid rgba(61,214,140,0.2)', color: '#3dd68c',
          } : {
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.22)',
          }}>
          {d.deck_attached ? 'Deck ✓' : 'Deck —'}
        </div>
        <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
          style={d.traction_mentioned ? {
            background: 'rgba(61,214,140,0.08)', border: '1px solid rgba(61,214,140,0.2)', color: '#3dd68c',
          } : {
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.22)',
          }}>
          {d.traction_mentioned ? 'Traction ✓' : 'Traction —'}
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div className="flex flex-col">
          <span className="font-bold font-mono leading-none" style={{ fontSize: '3rem', color: scoreColor(d.relevance_score) }}>
            {d.relevance_score ?? '—'}
          </span>
          <span className="text-[rgba(255,255,255,0.3)] text-xs mt-0.5 uppercase tracking-wider">
            relevance score
          </span>
        </div>
        <div className="text-right">
          <span className="inline-block px-3 py-1.5 rounded-md text-xs border"
            style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
            {d.category || 'Other'}
          </span>
          {d.check_size_requested && (
            <p className="text-[rgba(255,255,255,0.25)] text-xs mt-1 font-mono">
              Ask: {d.check_size_requested}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

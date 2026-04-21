import { useState, useEffect, useCallback } from 'react';
import { getDealVotes, castVote } from '../lib/api';
import { MemberAvatar } from './MemberAvatar';

const VOTE_CFG = {
  pass:      { label: 'Pass',     desc: 'Not for us',            activeColor: '#f05252', bg: 'rgba(240,82,82,0.12)',    border: 'rgba(240,82,82,0.4)'    },
  not_now:   { label: 'Not Now',  desc: 'Wrong timing / stage',  activeColor: '#9ca3af', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.4)' },
  monitor:   { label: 'Monitor',  desc: 'Check back in 3-6mo',   activeColor: '#4da6ff', bg: 'rgba(77,166,255,0.12)',   border: 'rgba(77,166,255,0.4)'   },
  dig_in:    { label: 'Dig In',   desc: 'Start due diligence',   activeColor: '#f5a623', bg: 'rgba(245,166,35,0.12)',  border: 'rgba(245,166,35,0.4)'  },
  champion:  { label: 'Champion', desc: 'Fast track internally',  activeColor: '#3dd68c', bg: 'rgba(61,214,140,0.12)',  border: 'rgba(61,214,140,0.4)'  },
};

function getLeaningBadge(votes) {
  if (votes.length < 2) return null;
  const counts = {};
  votes.forEach((v) => { counts[v.vote] = (counts[v.vote] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const [topVote, topCount] = top;
  const allSame = topCount === votes.length;
  const cfg = {
    champion: { label: allSame ? 'Strong champion' : 'Leaning champion', color: '#3dd68c', bg: 'rgba(61,214,140,0.1)' },
    dig_in:   { label: allSame ? 'Team wants to dig in' : 'Leaning dig in', color: '#f5a623', bg: 'rgba(245,166,35,0.1)' },
    monitor:  { label: 'Worth monitoring', color: '#4da6ff', bg: 'rgba(77,166,255,0.1)' },
    not_now:  { label: 'Not now', color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' },
    pass:     { label: allSame ? 'Team pass' : 'Leaning pass', color: '#f05252', bg: 'rgba(240,82,82,0.1)' },
  };
  // Check if there's a clear majority or it's split
  const uniqueVotes = Object.keys(counts).length;
  if (uniqueVotes > 2 || (uniqueVotes === 2 && Math.abs(Object.values(counts)[0] - Object.values(counts)[1]) <= 1)) {
    return { label: 'Split decision', color: '#f5a623', bg: 'rgba(245,166,35,0.1)' };
  }
  return cfg[topVote] || null;
}

export function VotingSection({ dealId }) {
  const [votes, setVotes] = useState([]);
  const [casting, setCasting] = useState(false);

  const fetchVotes = useCallback(async () => {
    const v = await getDealVotes(dealId).catch(() => null);
    if (v) setVotes(v);
  }, [dealId]);

  useEffect(() => {
    fetchVotes();
    const t = setInterval(fetchVotes, 5000);
    return () => clearInterval(t);
  }, [fetchVotes]);

  const myVote = votes.find((v) => v.is_me)?.vote;
  const leaning = getLeaningBadge(votes);

  const handleVote = async (v) => {
    if (casting) return;
    setCasting(true);
    try { await castVote(dealId, v); await fetchVotes(); }
    finally { setCasting(false); }
  };

  return (
    <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)]" data-testid="voting-section">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold">Team Vote</p>
        {leaning && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: leaning.bg, color: leaning.color, border: `1px solid ${leaning.color}44` }}>
            {leaning.label}
          </span>
        )}
      </div>

      {/* Vote buttons — 5 options in a 2+3 or wrap grid */}
      <div className="grid grid-cols-5 gap-1.5 mb-3">
        {Object.entries(VOTE_CFG).map(([key, cfg]) => {
          const active = myVote === key;
          return (
            <button
              key={key}
              data-testid={`vote-btn-${key}`}
              disabled={casting}
              onClick={() => handleVote(key)}
              title={cfg.desc}
              className="py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 flex flex-col items-center gap-0.5"
              style={{
                background: active ? cfg.bg : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? cfg.border : 'rgba(255,255,255,0.07)'}`,
                color: active ? cfg.activeColor : 'rgba(255,255,255,0.35)',
                boxShadow: active ? `0 0 10px ${cfg.activeColor}22` : 'none',
              }}
            >
              <span className="font-semibold text-xs leading-tight">{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tally */}
      {votes.length > 0 && (
        <div className="space-y-1.5">
          {Object.entries(VOTE_CFG).map(([key, cfg]) => {
            const voters = votes.filter((v) => v.vote === key);
            if (!voters.length) return null;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs font-mono w-16 shrink-0 truncate" style={{ color: cfg.activeColor }}>
                  {cfg.label}:
                </span>
                <div className="flex gap-1 flex-wrap">
                  {voters.map((v) => (
                    <MemberAvatar key={v.user_id} name={v.display_name} size={20} title={v.display_name} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {votes.length === 0 && (
        <p className="text-[rgba(255,255,255,0.2)] text-xs">No votes yet. Cast the first vote.</p>
      )}
    </div>
  );
}

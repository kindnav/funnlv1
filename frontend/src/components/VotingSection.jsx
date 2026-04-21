import { useState, useEffect, useCallback } from 'react';
import { getDealVotes, castVote } from '../lib/api';
import { MemberAvatar } from './MemberAvatar';

const VOTE_CFG = {
  yes:   { label: '✓ Yes',   activeColor: '#3dd68c', bg: 'rgba(61,214,140,0.12)',   border: 'rgba(61,214,140,0.4)'   },
  maybe: { label: '? Maybe', activeColor: '#f5a623', bg: 'rgba(245,166,35,0.12)',  border: 'rgba(245,166,35,0.4)'  },
  no:    { label: '✗ No',    activeColor: '#f05252', bg: 'rgba(240,82,82,0.12)',    border: 'rgba(240,82,82,0.4)'    },
};

function getLeaningBadge(yes, maybe, no, total) {
  if (total < 2) return null;
  const allSame = yes === total || no === total || maybe === total;
  if (yes > no && yes > maybe)
    return { label: allSame ? 'Strong yes' : 'Leaning yes', color: '#3dd68c', bg: 'rgba(61,214,140,0.1)' };
  if (no > yes && no > maybe)
    return { label: allSame ? 'Strong no' : 'Leaning no', color: '#f05252', bg: 'rgba(240,82,82,0.1)' };
  return { label: 'Split decision', color: '#f5a623', bg: 'rgba(245,166,35,0.1)' };
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
  const yesVoters = votes.filter((v) => v.vote === 'yes');
  const noVoters = votes.filter((v) => v.vote === 'no');
  const maybeVoters = votes.filter((v) => v.vote === 'maybe');
  const leaning = getLeaningBadge(yesVoters.length, maybeVoters.length, noVoters.length, votes.length);

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

      {/* Vote buttons */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {Object.entries(VOTE_CFG).map(([key, cfg]) => {
          const active = myVote === key;
          return (
            <button
              key={key}
              data-testid={`vote-btn-${key}`}
              disabled={casting}
              onClick={() => handleVote(key)}
              className="py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              style={{
                background: active ? cfg.bg : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? cfg.border : 'rgba(255,255,255,0.08)'}`,
                color: active ? cfg.activeColor : 'rgba(255,255,255,0.4)',
                boxShadow: active ? `0 0 10px ${cfg.activeColor}22` : 'none',
              }}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Tally */}
      {votes.length > 0 && (
        <div className="text-xs text-[rgba(255,255,255,0.35)] mb-3 font-mono">
          {yesVoters.length} Yes · {maybeVoters.length} Maybe · {noVoters.length} No
        </div>
      )}

      {/* Voter groups */}
      {votes.length > 0 && (
        <div className="space-y-2">
          {[
            { key: 'yes', voters: yesVoters, color: '#3dd68c' },
            { key: 'maybe', voters: maybeVoters, color: '#f5a623' },
            { key: 'no', voters: noVoters, color: '#f05252' },
          ].filter(({ voters }) => voters.length > 0).map(({ key, voters, color }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs font-mono w-10 shrink-0 capitalize" style={{ color }}>{key}:</span>
              <div className="flex gap-1.5 flex-wrap">
                {voters.map((v) => (
                  <MemberAvatar key={v.user_id} name={v.display_name} size={22} title={v.display_name} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {votes.length === 0 && (
        <p className="text-[rgba(255,255,255,0.2)] text-xs">No votes yet. Cast the first vote.</p>
      )}
    </div>
  );
}

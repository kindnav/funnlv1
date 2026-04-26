import { Trash2 } from 'lucide-react';
import { MemberAvatar } from '../MemberAvatar';

// ── Local style helpers (mirror Dashboard-level constants) ───────────────────
const CATEGORY_STYLES = {
  'Founder pitch':                    'bg-[#7c6dfa]/10 text-[#7c6dfa] border-[#7c6dfa]/30',
  'Warm intro':                       'bg-[#4da6ff]/10 text-[#4da6ff] border-[#4da6ff]/30',
  'LP / investor relations':          'bg-[#2dd4bf]/10 text-[#2dd4bf] border-[#2dd4bf]/30',
  'Portfolio company update':         'bg-[#3dd68c]/10 text-[#3dd68c] border-[#3dd68c]/30',
  'Co-investor / syndicate':          'bg-[#a594ff]/10 text-[#a594ff] border-[#a594ff]/30',
  'Accelerator / program application':'bg-[#2dd4bf]/10 text-[#2dd4bf] border-[#2dd4bf]/30',
  'Event invitation':                 'bg-[#f5a623]/10 text-[#f5a623] border-[#f5a623]/30',
  'Press / media':                    'bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.5)] border-[rgba(255,255,255,0.12)]',
  'Student / informational request':  'bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.35)] border-[rgba(255,255,255,0.08)]',
  'Unprocessed':                      'bg-[#f05252]/10 text-[#f05252] border-[#f05252]/30',
  'Service provider / vendor':        'bg-[#f05252]/10 text-[#f05252] border-[#f05252]/30',
  'Recruiter / hiring':               'bg-[#f05252]/10 text-[#f05252] border-[#f05252]/30',
  'Spam / irrelevant':                'bg-[#f05252]/10 text-[#f05252] border-[#f05252]/30',
};
const getCatStyle = (cat) =>
  CATEGORY_STYLES[cat] || 'bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.35)] border-[rgba(255,255,255,0.08)]';

const getThresholdColor = (score) => {
  if (score >= 7) return '#3dd68c';
  if (score >= 4) return '#f5a623';
  return '#f05252';
};

const getScoreStyle = (s) => {
  if (s >= 7) return 'bg-[#3dd68c]/10 text-[#3dd68c] border-[#3dd68c]/30';
  if (s >= 4) return 'bg-[#f5a623]/10 text-[#f5a623] border-[#f5a623]/30';
  return 'bg-[#f05252]/10 text-[#f05252] border-[#f05252]/30';
};

const STAGE_STYLES = {
  'Inbound':         { bg: 'rgba(124,109,250,0.1)',  color: '#7c6dfa',               border: 'rgba(124,109,250,0.3)' },
  'First Look':      { bg: 'rgba(77,166,255,0.1)',   color: '#4da6ff',               border: 'rgba(77,166,255,0.3)'  },
  'In Conversation': { bg: 'rgba(245,166,35,0.1)',   color: '#f5a623',               border: 'rgba(245,166,35,0.3)'  },
  'Due Diligence':   { bg: 'rgba(61,214,140,0.12)',  color: '#3dd68c',               border: 'rgba(61,214,140,0.3)'  },
  'Closed':          { bg: 'rgba(61,214,140,0.18)',  color: '#22c55e',               border: 'rgba(61,214,140,0.4)'  },
  'Passed':          { bg: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)', border: 'rgba(255,255,255,0.08)' },
  'Watch List':      { bg: 'rgba(251,191,36,0.1)',   color: '#fbbf24',               border: 'rgba(251,191,36,0.3)'  },
};

const StatusDot = ({ status }) => {
  if (status === 'New')
    return <div className="w-2 h-2 rounded-full bg-[#7c6dfa] shadow-[0_0_6px_rgba(124,109,250,0.9)]" />;
  if (status === 'Reviewed')
    return <div className="w-2 h-2 rounded-full bg-[#3dd68c] opacity-50" />;
  return <div className="w-2 h-2 rounded-full bg-[rgba(255,255,255,0.15)]" />;
};

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return '—';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ── Component ─────────────────────────────────────────────────────────────────
export function DealRow({ deal, isSelected, viewMode, fundMembers, onSelect, onDelete }) {
  const stageStyle = STAGE_STYLES[deal.deal_stage] || STAGE_STYLES['Inbound'];
  const assignedMember = fundMembers?.find((m) => m.user_id === deal.assigned_to);

  return (
    <tr
      data-testid={`deal-row-${deal.id}`}
      onClick={() => onSelect(deal)}
      className={`border-b border-[rgba(255,255,255,0.03)] cursor-pointer transition-colors group ${
        isSelected ? 'bg-[rgba(124,109,250,0.07)]' : 'hover:bg-[rgba(255,255,255,0.02)]'
      }`}
    >
      <td className="px-3 py-2.5 w-8">
        <StatusDot status={deal.status} />
      </td>
      <td className="px-3 py-2.5 w-14">
        {deal.thesis_match_score != null ? (
          <span
            className="inline-flex items-center justify-center h-6 px-1.5 rounded border font-mono text-xs font-bold"
            style={{
              minWidth: 36,
              background: `${getThresholdColor(deal.thesis_match_score)}1a`,
              borderColor: `${getThresholdColor(deal.thesis_match_score)}4d`,
              color: getThresholdColor(deal.thesis_match_score),
            }}
          >
            {deal.thesis_match_score}
          </span>
        ) : (
          <span className={`inline-flex items-center justify-center w-8 h-6 rounded border font-mono text-xs font-bold ${getScoreStyle(deal.relevance_score || 0)}`}>
            {deal.relevance_score || '—'}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 min-w-[140px] max-w-[160px]">
        <p className="text-white text-sm font-medium truncate">{deal.sender_name || '—'}</p>
        <p className="text-[rgba(255,255,255,0.3)] text-xs truncate font-mono">{deal.sender_email}</p>
      </td>
      <td className="px-3 py-2.5 min-w-[130px] max-w-[150px]">
        <p className="text-[rgba(255,255,255,0.8)] text-sm truncate">{deal.company_name || '—'}</p>
        {deal.sector && (
          <p className="text-[rgba(255,255,255,0.3)] text-xs truncate">{deal.sector}</p>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border whitespace-nowrap ${getCatStyle(deal.category)}`}>
          {deal.category || 'Other'}
        </span>
      </td>
      <td className="px-3 py-2.5 max-w-[180px]">
        <p className="text-[rgba(255,255,255,0.6)] text-xs truncate">{deal.subject}</p>
      </td>
      <td className="px-3 py-2.5 max-w-[240px]">
        <p className="text-[rgba(255,255,255,0.45)] text-xs line-clamp-2 leading-relaxed">
          {deal.summary || '—'}
        </p>
      </td>
      <td className="px-3 py-2.5 max-w-[140px]">
        <p className="text-[rgba(255,255,255,0.45)] text-xs truncate">{deal.next_action || '—'}</p>
      </td>

      {/* Fund-only columns */}
      {viewMode === 'fund-dashboard' && (
        <>
          <td className="px-3 py-2.5">
            {deal.inbox_owner_name ? (
              <MemberAvatar name={deal.inbox_owner_name} size={24} title={deal.inbox_owner_name} />
            ) : <span className="text-[rgba(255,255,255,0.2)] text-xs">—</span>}
          </td>
          <td className="px-3 py-2.5">
            {assignedMember ? (
              <MemberAvatar name={assignedMember.display_name} size={24} title={assignedMember.display_name} />
            ) : <span className="text-[rgba(255,255,255,0.2)] text-xs">—</span>}
          </td>
          <td className="px-3 py-2.5">
            <span
              className="px-1.5 py-0.5 rounded text-xs whitespace-nowrap"
              style={{
                background: stageStyle.bg,
                color: stageStyle.color,
                border: `1px solid ${stageStyle.border}`,
              }}
            >
              {deal.deal_stage || 'New'}
            </span>
          </td>
          <td className="px-3 py-2.5">
            <span className="text-xs font-mono text-[rgba(255,255,255,0.35)]">
              {deal._vote_tally || '—'}
            </span>
          </td>
        </>
      )}

      <td className="px-3 py-2.5 whitespace-nowrap">
        <p className="text-[rgba(255,255,255,0.3)] text-xs font-mono">
          {fmtDate(deal.received_date || deal.created_at)}
        </p>
      </td>
      <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
        <button
          data-testid={`delete-deal-${deal.id}`}
          onClick={() => onDelete(deal.id)}
          className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded transition-all hover:bg-[rgba(240,82,82,0.18)] hover:text-[#f05252]"
          title="Remove from dashboard"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
}

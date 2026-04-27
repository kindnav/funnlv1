import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronRight, ChevronLeft, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { getDeals, updateDealStage } from '../lib/api';
import DetailPanel from '../components/DetailPanel';

const STAGES = [
  { key: 'Inbound',          label: 'Inbound',          color: '#7c6dfa' },
  { key: 'First Look',       label: 'First Look',       color: '#4da6ff' },
  { key: 'In Conversation',  label: 'In Conversation',  color: '#f5a623' },
  { key: 'Due Diligence',    label: 'Due Diligence',    color: '#a594ff' },
  { key: 'Closed',           label: 'Closed',           color: '#22c55e' },
  { key: 'Passed',           label: 'Passed',           color: '#f05252' },
  { key: 'Watch List',       label: 'Watch List',       color: '#fbbf24' },
];
const STAGE_KEYS = STAGES.map((s) => s.key);

const ThesisMini = ({ score }) => {
  if (score == null) return null;
  const color = score >= 70 ? '#3dd68c' : score >= 45 ? '#f5a623' : '#f05252';
  return (
    <span className="text-xs font-bold font-mono px-1.5 py-0.5 rounded-md" style={{
      background: `${color}18`, border: `1px solid ${color}40`, color,
    }}>
      {score}
    </span>
  );
};

const dealAge = (deal) => {
  const date = deal.updated_at || deal.created_at;
  if (!date) return null;
  const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1d';
  return `${days}d`;
};

const DealCard = ({ deal, stageIndex, onMove, onOpen, isSelected }) => {
  const age = dealAge(deal);
  const ageColor = !age || age === 'Today'
    ? 'rgba(255,255,255,0.2)'
    : age.includes('d') && parseInt(age) > 14
      ? '#f5a623'
      : 'rgba(255,255,255,0.2)';

  return (
    <div
      data-testid={`pipeline-card-${deal.id}`}
      onClick={() => onOpen(deal)}
      className="cursor-pointer group mb-3"
      style={{
        background: isSelected ? 'rgba(124,109,250,0.08)' : '#131320',
        border: isSelected ? '1px solid rgba(124,109,250,0.3)' : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: '14px 16px',
        boxShadow: isSelected
          ? '0 0 0 1px rgba(124,109,250,0.2), 0 4px 24px rgba(0,0,0,0.3)'
          : '0 4px 24px rgba(0,0,0,0.3)',
        transition: 'all 0.15s ease',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          {deal.company_name && (
            <p className="text-white text-sm font-semibold leading-tight truncate">{deal.company_name}</p>
          )}
          <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{deal.sender_name}</p>
        </div>
        <ThesisMini score={deal.thesis_match_score} />
      </div>

      {deal.summary && (
        <p className="text-xs leading-relaxed mb-2.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {deal.summary}
        </p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {deal.sector && (
          <span className="text-xs px-1.5 py-0.5 rounded-md font-mono"
            style={{ background: 'rgba(124,109,250,0.08)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(124,109,250,0.15)' }}>
            {deal.sector}
          </span>
        )}
        {deal.stage && (
          <span className="text-xs px-1.5 py-0.5 rounded-md"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {deal.stage}
          </span>
        )}
        {deal.relevance_score != null && (
          <span className="text-xs px-1.5 py-0.5 rounded-md font-mono ml-auto"
            style={{
              background: deal.relevance_score >= 7 ? 'rgba(61,214,140,0.08)' : 'rgba(245,166,35,0.08)',
              color: deal.relevance_score >= 7 ? '#3dd68c' : '#f5a623',
              border: `1px solid ${deal.relevance_score >= 7 ? 'rgba(61,214,140,0.2)' : 'rgba(245,166,35,0.2)'}`,
            }}>
            {deal.relevance_score}/10
          </span>
        )}
      </div>

      {age && (
        <p className="text-xs font-mono mt-1" style={{ color: ageColor }}>{age} in this stage</p>
      )}

      {/* Move arrows */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-2" onClick={(e) => e.stopPropagation()}>
        {stageIndex > 0 && (
          <button
            data-testid={`move-back-${deal.id}`}
            onClick={() => onMove(deal, STAGE_KEYS[stageIndex - 1])}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <ChevronLeft size={11} />
            {STAGES[stageIndex - 1].label}
          </button>
        )}
        {stageIndex < STAGE_KEYS.length - 1 && (
          <button
            data-testid={`move-forward-${deal.id}`}
            onClick={() => onMove(deal, STAGE_KEYS[stageIndex + 1])}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs ml-auto transition-all"
            style={{
              background: `${STAGES[stageIndex + 1].color}15`,
              color: STAGES[stageIndex + 1].color,
              border: `1px solid ${STAGES[stageIndex + 1].color}30`,
            }}
          >
            {STAGES[stageIndex + 1].label}
            <ChevronRight size={11} />
          </button>
        )}
      </div>
    </div>
  );
};

export default function Pipeline({ user, onLogout }) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState(null);

  const fetchDeals = useCallback(async () => {
    try {
      const d = await getDeals();
      if (d) setDeals(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const handleMove = async (deal, newStage) => {
    await updateDealStage(deal.id, newStage);
    setDeals((prev) => prev.map((d) => d.id === deal.id ? { ...d, deal_stage: newStage } : d));
    if (selectedDeal?.id === deal.id) setSelectedDeal({ ...deal, deal_stage: newStage });
  };

  const handleDealUpdated = (updated) => {
    setDeals((prev) => prev.map((d) => d.id === updated.id ? updated : d));
    if (selectedDeal?.id === updated.id) setSelectedDeal(updated);
  };

  const grouped = STAGE_KEYS.reduce((acc, key) => {
    acc[key] = deals.filter((d) => (d.deal_stage || 'Inbound') === key);
    return acc;
  }, {});

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: '100vh', background: '#080810' }}
      data-testid="pipeline-page"
    >
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center px-5 gap-4"
        style={{ height: 48, borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#080810' }}
      >
        <span className="font-semibold text-white" style={{ fontSize: 16 }}>Pipeline</span>

        {/* Stage counts summary */}
        <div className="flex items-center gap-4 ml-4">
          {STAGES.map(({ key, label, color }) => (
            <div key={key} className="hidden md:flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
              <span className="text-xs font-bold font-mono" style={{ color }}>{grouped[key]?.length ?? 0}</span>
            </div>
          ))}
        </div>

        <button
          onClick={fetchDeals}
          className="ml-auto flex items-center justify-center transition-all"
          style={{
            width: 32, height: 32, borderRadius: '50%',
            color: 'rgba(255,255,255,0.35)', background: 'transparent', border: 'none', cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ── Kanban board + detail panel ─────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-[#7c6dfa] border-t-transparent animate-spin" />
                <span className="text-sm font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading pipeline...</span>
              </div>
            </div>
          ) : (
            <div className="flex h-full" style={{ gap: 1 }}>
              {STAGES.map(({ key, label, color }, stageIndex) => (
                <div
                  key={key}
                  className="flex flex-col min-w-[270px] flex-1"
                  style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}
                >
                  {/* Column header — uppercase label style (Image 2) */}
                  <div
                    className="flex items-center gap-2 px-4 py-3 shrink-0"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#0b0b18' }}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: color, boxShadow: `0 0 6px ${color}80` }}
                    />
                    <span
                      className="font-semibold uppercase tracking-wider"
                      style={{ fontSize: 11, letterSpacing: '0.07em', color: 'rgba(255,255,255,0.5)' }}
                    >
                      {label}
                    </span>
                    <span
                      className="ml-auto font-mono font-bold px-1.5 py-0.5 rounded-md text-xs"
                      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
                    >
                      {grouped[key]?.length ?? 0}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-3">
                    {(grouped[key] || []).length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 opacity-25">
                        <div className="w-8 h-8 rounded-full border border-dashed mb-2" style={{ borderColor: color }} />
                        <p className="text-xs" style={{ color }}>No deals here</p>
                      </div>
                    ) : (
                      (grouped[key] || []).map((deal) => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          stageIndex={stageIndex}
                          onMove={handleMove}
                          onOpen={setSelectedDeal}
                          isSelected={selectedDeal?.id === deal.id}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedDeal && (
          <DetailPanel
            deal={selectedDeal}
            onClose={() => setSelectedDeal(null)}
            onDealUpdated={handleDealUpdated}
          />
        )}
      </div>
    </div>
  );
}

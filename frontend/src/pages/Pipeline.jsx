import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, BookOpen, LayoutGrid, RefreshCw, ChevronRight, ChevronLeft, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { getDeals, updateDeal } from '../lib/api';
import DetailPanel from '../components/DetailPanel';

const STAGES = [
  { key: 'Pipeline',     label: 'Pipeline',      color: '#7c6dfa', dot: 'bg-[#7c6dfa]' },
  { key: 'New',          label: 'Inbox',          color: '#4da6ff', dot: 'bg-[#4da6ff]' },
  { key: 'In Review',    label: 'In Review',      color: '#f5a623', dot: 'bg-[#f5a623]' },
  { key: 'In Diligence', label: 'In Diligence',   color: '#2dd4bf', dot: 'bg-[#2dd4bf]' },
  { key: 'Passed',       label: 'Passed',          color: '#f05252', dot: 'bg-[#f05252]' },
  { key: 'Archived',     label: 'Archived',        color: 'rgba(255,255,255,0.3)', dot: 'bg-[rgba(255,255,255,0.3)]' },
];
const STAGE_KEYS = STAGES.map((s) => s.key);

// Normalize old/inconsistent status values to canonical ones
const normalizeStatus = (s) => {
  if (!s) return 'New';
  const m = { pipeline: 'Pipeline', archived: 'Archived', Reviewed: 'In Review', reviewed: 'In Review' };
  return m[s] || s;
};

const ThesisMini = ({ score }) => {
  if (score == null) return null;
  const color = score >= 70 ? '#3dd68c' : score >= 45 ? '#f5a623' : '#f05252';
  return (
    <span className="text-xs font-bold font-mono px-1.5 py-0.5 rounded" style={{
      background: `${color}18`, border: `1px solid ${color}40`, color,
    }}>
      {score}
    </span>
  );
};

const DealCard = ({ deal, stageIndex, onMove, onOpen, isSelected }) => (
  <div
    data-testid={`pipeline-card-${deal.id}`}
    onClick={() => onOpen(deal)}
    className="rounded-xl p-3.5 cursor-pointer transition-all mb-2.5 group"
    style={{
      background: isSelected ? 'rgba(124,109,250,0.1)' : '#13131c',
      border: isSelected ? '1px solid rgba(124,109,250,0.35)' : '1px solid rgba(255,255,255,0.07)',
      boxShadow: isSelected ? '0 0 0 1px rgba(124,109,250,0.2)' : 'none',
    }}
  >
    <div className="flex items-start justify-between gap-2 mb-2">
      <div className="min-w-0">
        {deal.company_name && (
          <p className="text-white text-sm font-semibold leading-tight truncate">{deal.company_name}</p>
        )}
        <p className="text-[rgba(255,255,255,0.4)] text-xs truncate">{deal.sender_name}</p>
      </div>
      <ThesisMini score={deal.thesis_match_score} />
    </div>

    {deal.summary && (
      <p className="text-[rgba(255,255,255,0.4)] text-xs leading-relaxed mb-2.5 line-clamp-2">{deal.summary}</p>
    )}

    <div className="flex items-center gap-1.5 flex-wrap mb-2">
      {deal.sector && (
        <span className="text-xs px-1.5 py-0.5 rounded font-mono"
          style={{ background: 'rgba(124,109,250,0.08)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(124,109,250,0.15)' }}>
          {deal.sector}
        </span>
      )}
      {deal.stage && (
        <span className="text-xs px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {deal.stage}
        </span>
      )}
      {deal.relevance_score != null && (
        <span className="text-xs px-1.5 py-0.5 rounded font-mono ml-auto"
          style={{
            background: deal.relevance_score >= 7 ? 'rgba(61,214,140,0.08)' : 'rgba(245,166,35,0.08)',
            color: deal.relevance_score >= 7 ? '#3dd68c' : '#f5a623',
            border: `1px solid ${deal.relevance_score >= 7 ? 'rgba(61,214,140,0.2)' : 'rgba(245,166,35,0.2)'}`,
          }}>
          {deal.relevance_score}/10
        </span>
      )}
    </div>

    {/* Move arrows */}
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
      {stageIndex > 0 && (
        <button
          data-testid={`move-back-${deal.id}`}
          onClick={() => onMove(deal, STAGE_KEYS[stageIndex - 1])}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
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
          className="flex items-center gap-1 px-2 py-1 rounded text-xs ml-auto transition-all"
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

export default function Pipeline({ user, onLogout }) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const navigate = useNavigate();

  const fetchDeals = useCallback(async () => {
    try {
      const d = await getDeals();
      if (d) setDeals(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const handleMove = async (deal, newStatus) => {
    await updateDeal(deal.id, { status: newStatus });
    setDeals((prev) => prev.map((d) => d.id === deal.id ? { ...d, status: newStatus } : d));
    if (selectedDeal?.id === deal.id) setSelectedDeal({ ...deal, status: newStatus });
  };

  const handleDealUpdated = (updated) => {
    setDeals((prev) => prev.map((d) => d.id === updated.id ? updated : d));
    if (selectedDeal?.id === updated.id) setSelectedDeal(updated);
  };

  const grouped = STAGE_KEYS.reduce((acc, key) => {
    acc[key] = deals.filter((d) => normalizeStatus(d.status) === key);
    return acc;
  }, {});

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0c0c12] overflow-hidden" data-testid="pipeline-page">
      {/* Nav */}
      <nav className="h-14 shrink-0 border-b border-[rgba(255,255,255,0.07)] flex items-center px-5 gap-4">
        <div className="flex items-center gap-2.5 mr-auto">
          <div className="w-7 h-7 rounded flex items-center justify-center text-white font-bold text-xs shrink-0"
            style={{ background: 'linear-gradient(135deg,#7c6dfa,#5b4de8)' }}>
            FF
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="text-[rgba(255,255,255,0.45)] hover:text-white text-sm font-medium transition-colors"
            >
              Dashboard
            </button>
            <span className="text-[rgba(255,255,255,0.15)]">/</span>
            <span className="text-white text-sm font-semibold">Pipeline</span>
          </div>
        </div>

        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all"
          style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.07)', background: 'transparent' }}>
          <LayoutGrid size={12} />
          <span className="hidden sm:inline">Deal Inbox</span>
        </button>
        <button onClick={() => navigate('/settings')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all"
          style={{ background: 'rgba(124,109,250,0.08)', border: '1px solid rgba(124,109,250,0.25)', color: '#7c6dfa' }}>
          <BookOpen size={13} />
          <span className="hidden sm:inline">Fund Focus</span>
        </button>
        <button onClick={onLogout} className="text-[rgba(255,255,255,0.35)] hover:text-white transition-colors p-1">
          <LogOut size={15} />
        </button>
      </nav>

      {/* Summary counts */}
      <div className="h-10 shrink-0 border-b border-[rgba(255,255,255,0.05)] flex items-center px-5 gap-6">
        {STAGES.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
            <span className="text-xs font-bold font-mono" style={{ color }}>{grouped[key]?.length ?? 0}</span>
          </div>
        ))}
        <button onClick={fetchDeals} className="ml-auto text-[rgba(255,255,255,0.3)] hover:text-white transition-colors">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Kanban board + optional detail panel */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-[#7c6dfa] border-t-transparent animate-spin" />
                <span className="text-[rgba(255,255,255,0.3)] text-sm font-mono">Loading pipeline...</span>
              </div>
            </div>
          ) : (
            <div className="flex h-full gap-px">
              {STAGES.map(({ key, label, color }, stageIndex) => (
                <div key={key} className="flex flex-col min-w-[280px] flex-1 border-r border-[rgba(255,255,255,0.05)] last:border-r-0">
                  {/* Column header */}
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[rgba(255,255,255,0.05)] shrink-0"
                    style={{ background: `${color}06` }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                    <span className="text-white text-sm font-semibold">{label}</span>
                    <span className="ml-auto text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
                      {grouped[key]?.length ?? 0}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-3">
                    {(grouped[key] || []).length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 opacity-30">
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

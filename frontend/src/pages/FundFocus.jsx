import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Check, BookOpen, Save, Sparkles, ChevronDown,
} from 'lucide-react';
import { getFundSettings, saveFundSettings } from '../lib/api';
import { toast } from '../components/ui/sonner';

const FUND_TYPES = [
  'VC Fund', 'Student VC Org', 'Accelerator', 'Angel Network',
  'Family Office', 'Corporate VC', 'Micro-VC', 'Other',
];
const ALL_STAGES = ['Pre-seed', 'Seed', 'Series A', 'Series B+', 'Growth', 'Any Stage'];

export default function FundFocus() {
  const navigate = useNavigate();

  const [thesis, setThesis] = useState({
    fund_name: '', fund_type: '', thesis: '', sectors: '', check_size: '', stages: [],
  });
  const [loading, setLoading] = useState(true);
  const [thesisSaving, setThesisSaving] = useState(false);
  const [thesisSaved, setThesisSaved] = useState(false);

  useEffect(() => {
    getFundSettings().then((f) => {
      if (f && Object.keys(f).length > 0) {
        setThesis({
          fund_name:  f.fund_name  || '',
          fund_type:  f.fund_type  || '',
          thesis:     f.thesis     || '',
          sectors:    f.sectors    || '',
          check_size: f.check_size || '',
          stages:     f.stages     || [],
        });
      }
    }).finally(() => setLoading(false));
  }, []);

  const toggleStage = (stage) => {
    setThesis((t) => ({
      ...t,
      stages: t.stages.includes(stage)
        ? t.stages.filter((s) => s !== stage)
        : [...t.stages, stage],
    }));
  };

  const handleSave = async () => {
    setThesisSaving(true);
    try {
      await saveFundSettings(thesis);
      setThesisSaved(true);
      toast.success('Fund focus saved — AI scoring recalibrated.');
      setTimeout(() => setThesisSaved(false), 2500);
    } catch {
      toast.error('Failed to save — please try again.');
    } finally {
      setThesisSaving(false);
    }
  };

  const inputCls =
    'w-full bg-[#0c0c12] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[rgba(255,255,255,0.25)] focus:outline-none focus:border-[#7c6dfa] transition-colors';
  const labelCls = 'block text-[rgba(255,255,255,0.45)] text-xs uppercase tracking-wider font-semibold mb-1.5';

  let saveBtnIcon;
  if (thesisSaving) saveBtnIcon = <RefreshCw size={13} className="animate-spin" />;
  else if (thesisSaved) saveBtnIcon = <Check size={13} />;
  else saveBtnIcon = <Save size={13} />;

  let saveBtnLabel;
  if (thesisSaving) saveBtnLabel = 'Saving...';
  else if (thesisSaved) saveBtnLabel = 'Saved!';
  else saveBtnLabel = 'Save Fund Focus';

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0c0c12] overflow-hidden">
      {/* Nav */}
      <nav className="h-14 shrink-0 border-b border-[rgba(255,255,255,0.07)] flex items-center px-5 gap-3 bg-[#0c0c12]">
        <button
          data-testid="back-to-dashboard"
          onClick={() => navigate('/')}
          className="text-[rgba(255,255,255,0.4)] hover:text-white transition-colors flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft size={15} />
          Dashboard
        </button>
        <div className="flex items-center gap-2 ml-4">
          <div
            className="w-6 h-6 rounded flex items-center justify-center"
            style={{ background: 'rgba(124,109,250,0.2)', border: '1px solid rgba(124,109,250,0.3)' }}
          >
            <BookOpen size={13} className="text-[#7c6dfa]" />
          </div>
          <span className="text-white font-semibold text-sm">Fund Focus</span>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Callout */}
          <div
            className="rounded-xl px-5 py-4 flex items-start gap-4"
            style={{
              background: 'linear-gradient(135deg, rgba(124,109,250,0.15), rgba(91,77,232,0.08))',
              border: '1px solid rgba(124,109,250,0.35)',
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: 'rgba(124,109,250,0.2)' }}
            >
              <Sparkles size={15} className="text-[#7c6dfa]" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-0.5">Set your Fund Focus first</p>
              <p className="text-[rgba(255,255,255,0.45)] text-xs leading-relaxed">
                The AI uses your investment focus to calibrate relevance scores for every inbound email.
                Fill in the form below — the more specific, the better your deal scoring.
              </p>
            </div>
          </div>

          {/* Fund Focus form */}
          <div className="bg-[#13131c] border border-[rgba(255,255,255,0.07)] rounded-xl p-6">
            {loading ? (
              <div className="flex items-center gap-2 text-[rgba(255,255,255,0.3)] text-sm py-4">
                <RefreshCw size={13} className="animate-spin" /> Loading your fund focus...
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen size={15} className="text-[#7c6dfa]" />
                  <h2 className="text-white font-semibold text-sm">Fund Focus</h2>
                  <span
                    className="ml-auto px-2 py-0.5 rounded text-xs font-mono"
                    style={{ background: 'rgba(124,109,250,0.1)', color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.2)' }}
                  >
                    AI-calibrated
                  </span>
                </div>
                <p className="text-[rgba(255,255,255,0.35)] text-xs mb-5 leading-relaxed">
                  Describe your fund's focus. Claude uses this to score every email's relevance — a student VC org focused
                  on edtech will see different scores than a growth-stage fintech fund.
                </p>

                <div className="space-y-4">
                  {/* Fund name + type */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Fund Name</label>
                      <input
                        data-testid="fund-name-input"
                        type="text"
                        placeholder="Future Frontier Capital"
                        value={thesis.fund_name}
                        onChange={(e) => setThesis({ ...thesis, fund_name: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Fund Type</label>
                      <div className="relative">
                        <select
                          data-testid="fund-type-select"
                          value={thesis.fund_type}
                          onChange={(e) => setThesis({ ...thesis, fund_type: e.target.value })}
                          className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                          style={{ background: '#0c0c12' }}
                        >
                          <option value="">Select type...</option>
                          {FUND_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.3)] pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Investment focus textarea */}
                  <div>
                    <label className={labelCls}>Investment Focus</label>
                    <textarea
                      data-testid="thesis-input"
                      rows={5}
                      placeholder="E.g. We invest in pre-seed and seed B2B SaaS companies with strong founder-market fit in fintech, devtools, and enterprise AI. We look for technical founders with domain expertise building in large markets..."
                      value={thesis.thesis}
                      onChange={(e) => setThesis({ ...thesis, thesis: e.target.value })}
                      className={`${inputCls} resize-none leading-relaxed`}
                    />
                  </div>

                  {/* Sector focus + check size */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Sector Focus</label>
                      <input
                        data-testid="sectors-input"
                        type="text"
                        placeholder="AI/ML, Fintech, Climate, EdTech"
                        value={thesis.sectors}
                        onChange={(e) => setThesis({ ...thesis, sectors: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Check Size Range</label>
                      <input
                        data-testid="check-size-input"
                        type="text"
                        placeholder="$250K – $1.5M"
                        value={thesis.check_size}
                        onChange={(e) => setThesis({ ...thesis, check_size: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  {/* Preferred stages */}
                  <div>
                    <label className={labelCls}>Preferred Stages</label>
                    <div className="flex flex-wrap gap-2">
                      {ALL_STAGES.map((stage) => {
                        const active = thesis.stages.includes(stage);
                        return (
                          <button
                            key={stage}
                            data-testid={`stage-${stage.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                            onClick={() => toggleStage(stage)}
                            type="button"
                            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all border"
                            style={{
                              background:   active ? 'rgba(124,109,250,0.15)' : 'rgba(255,255,255,0.03)',
                              borderColor:  active ? 'rgba(124,109,250,0.4)'  : 'rgba(255,255,255,0.08)',
                              color:        active ? '#7c6dfa'                : 'rgba(255,255,255,0.4)',
                            }}
                          >
                            {stage}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* How it affects scoring */}
                  <div
                    className="flex items-start gap-2.5 rounded-lg p-3 text-xs"
                    style={{ background: 'rgba(124,109,250,0.05)', border: '1px solid rgba(124,109,250,0.12)' }}
                  >
                    <Sparkles size={12} className="text-[#7c6dfa] mt-0.5 shrink-0" />
                    <p className="text-[rgba(255,255,255,0.45)] leading-relaxed">
                      Claude will score emails 8–10 only when they align with your investment focus, stage, and sectors.
                      Emails outside your focus are automatically filtered out before reaching your dashboard.
                    </p>
                  </div>

                  {/* Save */}
                  <div className="flex justify-end">
                    <button
                      data-testid="save-thesis-btn"
                      onClick={handleSave}
                      disabled={thesisSaving}
                      className="flex items-center gap-2 text-sm font-medium px-5 py-2 rounded-lg transition-all disabled:opacity-50"
                      style={{
                        background:   thesisSaved ? 'rgba(61,214,140,0.15)' : '#7c6dfa',
                        color:        thesisSaved ? '#3dd68c' : 'white',
                        border:       thesisSaved ? '1px solid rgba(61,214,140,0.3)' : 'none',
                        boxShadow:    thesisSaved ? 'none' : '0 0 16px rgba(124,109,250,0.3)',
                      }}
                    >
                      {saveBtnIcon}
                      {saveBtnLabel}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

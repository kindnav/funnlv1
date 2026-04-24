import { useState } from 'react';
import { UserPlus, XCircle, Archive, Check, Bookmark, Trash2 } from 'lucide-react';
import { updateDeal, upsertContact, deleteDeal } from '../../lib/api';
import { toast } from '../ui/sonner';

const normalizeStatus = (s) => {
  if (!s) return 'New';
  const m = { pipeline: 'Pipeline', archived: 'Archived', Reviewed: 'In Review', reviewed: 'In Review' };
  return m[s] || s;
};

export function CategorizeDealSection({ deal, onDealUpdated, onDelete }) {
  const [saving, setSaving] = useState(null);

  const currentStatus = normalizeStatus(deal.status);
  const isPipeline = currentStatus === 'Pipeline';
  const isInReview = currentStatus === 'In Review';
  const isPassed   = currentStatus === 'Passed';
  const isArchived = currentStatus === 'Archived';

  const pipelineBtnStyle = isPipeline
    ? { background: 'rgba(124,109,250,0.2)', border: '1px solid rgba(124,109,250,0.5)', color: '#a89cf7' }
    : { background: 'rgba(124,109,250,0.08)', border: '1px solid rgba(124,109,250,0.25)', color: '#7c6dfa' };
  const reviewBtnStyle = isInReview
    ? { background: 'rgba(245,166,35,0.18)', border: '1px solid rgba(245,166,35,0.5)', color: '#f5a623' }
    : { background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.2)', color: '#f5a623' };
  const passBtnStyle = isPassed
    ? { background: 'rgba(240,82,82,0.15)', border: '1px solid rgba(240,82,82,0.4)', color: '#f05252' }
    : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' };
  const archiveBtnStyle = isArchived
    ? { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)' }
    : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' };

  let pipelineBtnLabel;
  if (saving === 'pipeline') pipelineBtnLabel = 'Saving…';
  else if (isPipeline) pipelineBtnLabel = '✓ In Pipeline';
  else pipelineBtnLabel = 'Add to Pipeline';

  let reviewBtnLabel;
  if (saving === 'reviewed') reviewBtnLabel = 'Saving…';
  else if (isInReview) reviewBtnLabel = '✓ In Review';
  else reviewBtnLabel = 'Save for Review';

  const handleAction = async (field, value, label) => {
    setSaving(label);
    try {
      await updateDeal(deal.id, { [field]: value });
      onDealUpdated({ ...deal, [field]: value });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)] space-y-2">
      <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold mb-3">
        Categorize Deal
      </p>

      {/* Add to Pipeline */}
      <button
        data-testid="action-add-pipeline"
        disabled={saving === 'pipeline'}
        onClick={async () => {
          if (saving === 'pipeline') return;
          setSaving('pipeline');
          try {
            await updateDeal(deal.id, { status: 'Pipeline' });
            onDealUpdated({ ...deal, status: 'Pipeline' });
            const res = await upsertContact(deal, 'In Pipeline');
            if (res?.returning) toast.info(`Returning founder — ${res.name || 'Contact'} updated`);
            else toast.success(`Added to Pipeline · Contact saved`);
          } catch {
            toast.error('Action failed — please try again');
          }
          setSaving(null);
        }}
        className="w-full flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition-all disabled:opacity-40"
        style={pipelineBtnStyle}
      >
        <UserPlus size={14} />
        {pipelineBtnLabel}
      </button>

      {/* Save for Review */}
      <button
        data-testid="action-mark-reviewed"
        disabled={saving === 'reviewed'}
        onClick={async () => {
          if (saving === 'reviewed') return;
          setSaving('reviewed');
          try {
            await updateDeal(deal.id, { status: 'In Review' });
            onDealUpdated({ ...deal, status: 'In Review' });
            const res = await upsertContact(deal, 'In Review');
            if (res?.returning) toast.info(`Returning founder — ${res.name || 'Contact'} updated`);
            else toast.success(`Saved for Review · Contact saved`);
          } catch {
            toast.error('Action failed — please try again');
          }
          setSaving(null);
        }}
        className="w-full flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition-all disabled:opacity-40"
        style={reviewBtnStyle}
      >
        <Bookmark size={14} />
        {reviewBtnLabel}
      </button>

      {/* Pass */}
      <button
        data-testid="action-pass"
        onClick={() => handleAction('status', 'Passed', 'passed')}
        disabled={saving === 'passed' || isPassed}
        className="w-full flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition-all disabled:opacity-40"
        style={passBtnStyle}
      >
        <XCircle size={14} />
        {isPassed ? '✓ Passed' : 'Pass'}
      </button>

      {/* Archive */}
      <button
        data-testid="action-archive"
        onClick={() => handleAction('status', 'Archived', 'archive')}
        disabled={saving === 'archive' || isArchived}
        className="w-full flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition-all disabled:opacity-40"
        style={archiveBtnStyle}
      >
        <Archive size={14} />
        {isArchived ? '✓ Archived' : 'Archive'}
      </button>

      {isArchived && (
        <button
          data-testid="action-restore"
          onClick={() => handleAction('status', 'New', 'restore')}
          disabled={saving === 'restore'}
          className="w-full flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-lg transition-all"
          style={{ background: 'rgba(124,109,250,0.06)', border: '1px solid rgba(124,109,250,0.15)', color: 'rgba(255,255,255,0.4)' }}
        >
          <Check size={12} /> Restore to Inbox
        </button>
      )}

      {isPassed && (
        <button
          data-testid="action-reconsider"
          onClick={() => handleAction('status', 'In Review', 'reconsider')}
          disabled={saving === 'reconsider'}
          className="w-full flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-lg transition-all"
          style={{ background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.15)', color: 'rgba(255,255,255,0.4)' }}
        >
          <Check size={12} /> Reconsider — move to In Review
        </button>
      )}

      {onDelete && (
        <button
          data-testid="action-delete-deal"
          onClick={async () => {
            if (!window.confirm('Remove this email from your dashboard? This cannot be undone.')) return;
            await deleteDeal(deal.id);
            onDelete(deal.id);
          }}
          className="w-full flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-lg transition-all mt-2"
          style={{ background: 'rgba(240,82,82,0.05)', border: '1px solid rgba(240,82,82,0.12)', color: 'rgba(240,82,82,0.5)' }}
        >
          <Trash2 size={12} /> Remove from dashboard
        </button>
      )}
    </div>
  );
}

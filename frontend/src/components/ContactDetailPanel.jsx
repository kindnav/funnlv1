import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mail, ExternalLink, Tag, Plus, Check, ChevronRight } from 'lucide-react';
import { updateContact, getContactDeals } from '../lib/api';
import { toast } from '../components/ui/sonner';

const STATUS_STYLES = {
  'In Pipeline': { bg: 'rgba(124,109,250,0.12)', color: '#7c6dfa', border: 'rgba(124,109,250,0.3)' },
  'In Review':   { bg: 'rgba(245,166,35,0.1)',   color: '#f5a623', border: 'rgba(245,166,35,0.3)' },
  'Portfolio':   { bg: 'rgba(61,214,140,0.1)',    color: '#3dd68c', border: 'rgba(61,214,140,0.3)' },
  'Passed':      { bg: 'rgba(255,255,255,0.05)',  color: 'rgba(255,255,255,0.35)', border: 'rgba(255,255,255,0.1)' },
};

const scoreStyle = (s) => {
  if (!s && s !== 0) return { color: 'rgba(255,255,255,0.3)', border: 'rgba(255,255,255,0.08)', bg: 'transparent' };
  if (s >= 70) return { color: '#3dd68c', border: 'rgba(61,214,140,0.3)', bg: 'rgba(61,214,140,0.08)' };
  if (s >= 45) return { color: '#f5a623', border: 'rgba(245,166,35,0.3)', bg: 'rgba(245,166,35,0.08)' };
  return { color: '#f05252', border: 'rgba(240,82,82,0.3)', bg: 'rgba(240,82,82,0.08)' };
};

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return '—'; }
};

const InfoRow = ({ label, value }) => (
  <div className="flex items-start gap-2 py-1.5">
    <span className="text-xs w-28 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
    <span className="text-xs text-white break-words">{value || '—'}</span>
  </div>
);

export default function ContactDetailPanel({ contact, onClose, onUpdated, onNavigateDeals }) {
  const [notes, setNotes] = useState(contact.notes || '');
  const [tags, setTags] = useState(contact.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [status, setStatus] = useState(contact.contact_status || 'In Review');
  const [linkedDeals, setLinkedDeals] = useState([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [saving, setSaving] = useState(null);
  const notesRef = useRef(null);

  // Sync state when contact changes
  useEffect(() => {
    setNotes(contact.notes || '');
    setTags(contact.tags || []);
    setStatus(contact.contact_status || 'In Review');
  }, [contact.id]);

  // Load linked deals
  useEffect(() => {
    if (!contact.id) return;
    setLoadingDeals(true);
    getContactDeals(contact.id)
      .then(deals => setLinkedDeals(deals || []))
      .catch(() => setLinkedDeals([]))
      .finally(() => setLoadingDeals(false));
  }, [contact.id]);

  const patch = useCallback(async (data) => {
    try {
      await updateContact(contact.id, data);
      onUpdated({ id: contact.id, ...data });
    } catch {
      toast.error('Failed to save changes');
    }
  }, [contact.id, onUpdated]);

  const handleNotesBlur = () => {
    if (notes !== contact.notes) patch({ notes });
  };

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    setSaving(newStatus);
    await patch({ contact_status: newStatus });
    toast.success(`Moved to ${newStatus}`);
    setSaving(null);
  };

  const addTag = async () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) { setTagInput(''); return; }
    const next = [...tags, t];
    setTags(next);
    setTagInput('');
    await patch({ tags: next });
  };

  const removeTag = async (t) => {
    const next = tags.filter(x => x !== t);
    setTags(next);
    await patch({ tags: next });
  };

  const ss = scoreStyle(contact.relevance_score);
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES['Passed'];

  return (
    <div
      data-testid="contact-detail-panel"
      className="w-[440px] shrink-0 h-full flex flex-col overflow-hidden border-l"
      style={{ background: '#13131c', borderColor: 'rgba(255,255,255,0.07)', fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b shrink-0 flex items-start justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex-1 min-w-0 pr-3">
          <h2 className="text-lg font-bold text-white leading-tight truncate">{contact.company || '—'}</h2>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {contact.name || '—'}{contact.role ? ` · ${contact.role}` : ''}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}>
              {status}
            </span>
            {contact.relevance_score != null && (
              <span className="inline-flex items-center justify-center h-6 px-2 rounded border font-mono text-xs font-bold" style={{ background: ss.bg, borderColor: ss.border, color: ss.color }}>
                {contact.relevance_score}
              </span>
            )}
            {(contact.deal_count || 0) > 1 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(124,109,250,0.15)', color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.25)' }}>
                Returning · {contact.deal_count}x
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg transition-colors shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <X size={16} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* Score bar */}
        {contact.relevance_score != null && (
          <div className="px-5 pt-4 pb-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Focus Match</p>
            <div className="flex gap-1 mt-1">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="h-1.5 flex-1 rounded-sm" style={{ background: i < Math.round(contact.relevance_score / 10) ? ss.color : 'rgba(255,255,255,0.06)' }} />
              ))}
            </div>
          </div>
        )}

        {/* Contact info */}
        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <p className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Contact Info</p>
          {contact.email && (
            <div className="flex items-center gap-2 py-1.5">
              <span className="text-xs w-28 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>Email</span>
              <a href={`mailto:${contact.email}`} className="text-xs flex items-center gap-1 hover:underline" style={{ color: '#4da6ff' }}>
                <Mail size={11} />{contact.email}
              </a>
            </div>
          )}
          <InfoRow label="Sector" value={contact.sector} />
          <InfoRow label="Stage" value={contact.stage} />
          <InfoRow label="Geography" value={contact.geography} />
          <InfoRow label="Intro Source" value={contact.intro_source} />
          <div className="flex items-center gap-2 py-1.5">
            <span className="text-xs w-28 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>Source</span>
            {contact.warm_or_cold ? (
              <span className="text-xs px-2 py-0.5 rounded" style={{
                background: (contact.warm_or_cold || '').toLowerCase().includes('warm') ? 'rgba(61,214,140,0.1)' : 'rgba(255,255,255,0.05)',
                color: (contact.warm_or_cold || '').toLowerCase().includes('warm') ? '#3dd68c' : 'rgba(255,255,255,0.4)',
                border: `1px solid ${(contact.warm_or_cold || '').toLowerCase().includes('warm') ? 'rgba(61,214,140,0.25)' : 'rgba(255,255,255,0.1)'}`,
              }}>{contact.warm_or_cold}</span>
            ) : <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}
          </div>
          <InfoRow label="First contacted" value={fmtDate(contact.first_contacted)} />
          <InfoRow label="Last contacted" value={fmtDate(contact.last_contacted)} />
          <InfoRow label="Times contacted" value={contact.deal_count != null ? String(contact.deal_count) : '1'} />
        </div>

        {/* Notes */}
        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Notes</p>
          <textarea
            ref={notesRef}
            data-testid="contact-notes-input"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Add notes about this contact…"
            rows={4}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#fff', lineHeight: 1.6 }}
            onFocus={e => (e.target.style.borderColor = 'rgba(124,109,250,0.4)')}
          />
        </div>

        {/* Tags */}
        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <p className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Tags</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map(t => (
              <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(124,109,250,0.1)', color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.25)' }}>
                {t}
                <button onClick={() => removeTag(t)} className="ml-0.5 hover:opacity-70">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              data-testid="contact-tag-input"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              placeholder="Add tag…"
              className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#fff' }}
            />
            <button onClick={addTag} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={{ background: 'rgba(124,109,250,0.12)', color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.25)' }}>
              <Plus size={12} />
            </button>
          </div>
        </div>

        {/* Linked deals */}
        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <p className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Linked Deals</p>
          {loadingDeals ? (
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>Loading…</p>
          ) : linkedDeals.length === 0 ? (
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>No linked deals found</p>
          ) : (
            <div className="space-y-2">
              {linkedDeals.map(deal => (
                <div
                  key={deal.id}
                  data-testid={`linked-deal-${deal.id}`}
                  onClick={() => onNavigateDeals && onNavigateDeals(deal.id)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{deal.subject || '(no subject)'}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {fmtDate(deal.received_date)} · {deal.status || 'New'}
                    </p>
                  </div>
                  {(deal.thesis_match_score ?? deal.relevance_score) != null && (
                    <span className="text-xs font-bold font-mono" style={{ color: (deal.thesis_match_score ?? deal.relevance_score) >= 70 ? '#3dd68c' : '#f5a623' }}>
                      {deal.thesis_match_score ?? deal.relevance_score}
                    </span>
                  )}
                  <ChevronRight size={12} style={{ color: 'rgba(255,255,255,0.2)' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status actions */}
        <div className="px-5 py-4">
          <p className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Move to</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(STATUS_STYLES).map(([s, style]) => (
              <button
                key={s}
                data-testid={`status-${s.toLowerCase().replace(/\s+/g, '-')}`}
                disabled={status === s || saving === s}
                onClick={() => handleStatusChange(s)}
                className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
                style={{ background: status === s ? style.bg : 'rgba(255,255,255,0.03)', color: style.color, border: `1px solid ${status === s ? style.border : 'rgba(255,255,255,0.08)'}` }}
              >
                {saving === s ? '…' : status === s ? <><Check size={11} /> {s}</> : s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

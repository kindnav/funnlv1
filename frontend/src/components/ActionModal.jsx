import { useState, useEffect } from 'react';
import { X, Send, Loader, Check, AlertTriangle, XCircle, MessageSquare, Share2 } from 'lucide-react';
import { generateAction, sendAction } from '../lib/api';

const ACTION_CONFIG = {
  reject: {
    label: 'Send Rejection',
    color: '#f05252',
    borderColor: 'rgba(240,82,82,0.3)',
    bg: 'rgba(240,82,82,0.08)',
    Icon: XCircle,
    desc: 'Personalized, respectful decline',
  },
  request_info: {
    label: 'Request More Info',
    color: '#f5a623',
    borderColor: 'rgba(245,166,35,0.3)',
    bg: 'rgba(245,166,35,0.08)',
    Icon: MessageSquare,
    desc: 'Targeted follow-up questions',
  },
  forward_partner: {
    label: 'Forward to Partner',
    color: '#4da6ff',
    borderColor: 'rgba(77,166,255,0.3)',
    bg: 'rgba(77,166,255,0.08)',
    Icon: Share2,
    desc: 'Internal forwarding note',
  },
};

export default function ActionModal({ deal, actionType, onClose, onSent }) {
  const [step, setStep] = useState('generating'); // generating | review | sending | sent
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);

  const cfg = ACTION_CONFIG[actionType] || ACTION_CONFIG.request_info;
  const { Icon } = cfg;

  useEffect(() => {
    setStep('generating');
    setError(null);
    generateAction(deal.id, actionType)
      .then((d) => { setDraft(d); setStep('review'); })
      .catch((e) => { setError(e.message); setStep('review'); });
  }, [deal.id, actionType]);

  const handleSend = async () => {
    setStep('sending');
    setError(null);
    try {
      await sendAction(deal.id, draft);
      setStep('sent');
      setTimeout(() => { onSent && onSent(actionType); onClose(); }, 1800);
    } catch (e) {
      setError(e.message);
      setStep('review');
    }
  };

  return (
    <div
      data-testid="action-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        data-testid="action-modal"
        className="w-full max-w-lg rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: '#13131c',
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: cfg.bg, border: `1px solid ${cfg.borderColor}` }}
          >
            <Icon size={15} style={{ color: cfg.color }} />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">{cfg.label}</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {deal.company_name || deal.sender_name} · {cfg.desc}
            </p>
          </div>
          <button
            data-testid="action-modal-close"
            onClick={onClose}
            className="ml-auto text-[rgba(255,255,255,0.3)] hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: `${cfg.color} transparent transparent transparent` }}
              />
              <p className="text-[rgba(255,255,255,0.4)] text-sm">Generating draft with Claude AI...</p>
            </div>
          )}

          {step === 'sent' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(61,214,140,0.15)', border: '1px solid rgba(61,214,140,0.3)' }}
              >
                <Check size={20} className="text-[#3dd68c]" />
              </div>
              <p className="text-[#3dd68c] font-medium text-sm">Email sent successfully</p>
            </div>
          )}

          {(step === 'review' || step === 'sending') && draft && (
            <>
              {error && (
                <div
                  className="flex items-start gap-2.5 rounded-lg p-3 text-xs"
                  style={{ background: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.2)' }}
                >
                  <AlertTriangle size={13} className="text-[#f05252] shrink-0 mt-0.5" />
                  <p className="text-[#f05252] leading-relaxed">{error}</p>
                </div>
              )}

              {/* To field */}
              <div>
                <label className="block text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold mb-1.5">
                  To
                </label>
                <input
                  data-testid="action-to-input"
                  type="text"
                  value={draft.to_name ? `${draft.to_name} <${draft.to_email}>` : draft.to_email}
                  onChange={(e) => setDraft({ ...draft, to_email: e.target.value, to_name: '' })}
                  className="w-full bg-[#0c0c12] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[rgba(255,255,255,0.25)] focus:outline-none focus:border-[#7c6dfa] transition-colors"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold mb-1.5">
                  Subject
                </label>
                <input
                  data-testid="action-subject-input"
                  type="text"
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  className="w-full bg-[#0c0c12] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#7c6dfa] transition-colors"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold mb-1.5">
                  Message
                </label>
                <textarea
                  data-testid="action-body-input"
                  rows={9}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  className="w-full bg-[#0c0c12] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 text-sm text-[rgba(255,255,255,0.85)] leading-relaxed resize-none focus:outline-none focus:border-[#7c6dfa] transition-colors font-mono"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {(step === 'review' || step === 'sending') && draft && (
          <div
            className="flex items-center gap-3 px-5 py-4 shrink-0"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-[rgba(255,255,255,0.4)] hover:text-white border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)] transition-all"
            >
              Cancel
            </button>
            <button
              data-testid="action-send-btn"
              onClick={handleSend}
              disabled={step === 'sending' || !draft.body}
              className="ml-auto flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
              style={{
                background: step === 'sending' ? cfg.bg : cfg.color,
                border: `1px solid ${cfg.borderColor}`,
                boxShadow: step === 'sending' ? 'none' : `0 0 16px ${cfg.bg}`,
              }}
            >
              {step === 'sending' ? (
                <><Loader size={13} className="animate-spin" /> Sending...</>
              ) : (
                <><Send size={13} /> Send Email</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

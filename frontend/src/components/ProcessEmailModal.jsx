import { useState } from 'react';
import { X, Loader2, Sparkles } from 'lucide-react';
import { processEmail } from '../lib/api';

export default function ProcessEmailModal({ onClose, onProcessed }) {
  const [form, setForm] = useState({ sender_name: '', sender_email: '', subject: '', body: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.body.trim()) { setError('Email body is required'); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await processEmail(form);
      onProcessed(result);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to process email');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-[#0c0c12] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[rgba(255,255,255,0.25)] focus:outline-none focus:border-[#7c6dfa] transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        data-testid="process-email-modal"
        className="relative w-full max-w-lg bg-[#13131c] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-2xl z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[rgba(255,255,255,0.07)]">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#7c6dfa]" />
            <span className="text-white font-semibold text-sm">Process Email with AI</span>
          </div>
          <button
            onClick={onClose}
            data-testid="close-modal-btn"
            className="text-[rgba(255,255,255,0.4)] hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[rgba(255,255,255,0.5)] text-xs uppercase tracking-wider mb-1.5 font-semibold">
                Sender Name
              </label>
              <input
                data-testid="sender-name-input"
                type="text"
                placeholder="John Smith"
                value={form.sender_name}
                onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[rgba(255,255,255,0.5)] text-xs uppercase tracking-wider mb-1.5 font-semibold">
                Sender Email
              </label>
              <input
                data-testid="sender-email-input"
                type="email"
                placeholder="john@startup.com"
                value={form.sender_email}
                onChange={(e) => setForm({ ...form, sender_email: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-[rgba(255,255,255,0.5)] text-xs uppercase tracking-wider mb-1.5 font-semibold">
              Subject
            </label>
            <input
              data-testid="subject-input"
              type="text"
              placeholder="Series A pitch deck – FinTech startup"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-[rgba(255,255,255,0.5)] text-xs uppercase tracking-wider mb-1.5 font-semibold">
              Email Body <span className="text-[#f05252]">*</span>
            </label>
            <textarea
              data-testid="email-body-input"
              rows={8}
              placeholder="Paste the full email body here..."
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className={`${inputCls} resize-none font-mono text-xs leading-relaxed`}
              required
            />
          </div>

          {error && (
            <div className="bg-[#f05252]/10 border border-[#f05252]/20 rounded-lg px-3 py-2">
              <p className="text-[#f05252] text-xs">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[rgba(255,255,255,0.5)] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="process-email-submit-btn"
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-[#7c6dfa] hover:bg-[#6b5ded] text-white text-sm font-medium px-5 py-2 rounded-lg transition-all duration-200 disabled:opacity-50"
              style={{ boxShadow: loading ? 'none' : '0 0 16px rgba(124,109,250,0.3)' }}
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Process with AI
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

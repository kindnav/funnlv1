import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';

const SECTIONS = [
  { label: 'OBJECTIVE', color: '#7c6dfa' },
  { label: 'KEY QUESTIONS', color: '#4da6ff' },
  { label: 'RED FLAGS TO PROBE', color: '#f05252' },
  { label: 'THE DECIDING FACTOR', color: '#f5a623' },
];

function parseBrief(text) {
  const results = [];
  for (let i = 0; i < SECTIONS.length; i++) {
    const { label, color } = SECTIONS[i];
    const nextLabel = i < SECTIONS.length - 1 ? SECTIONS[i + 1].label : null;
    const pattern = nextLabel
      ? new RegExp(`${label}[:\\s]*([\\s\\S]*?)(?=${nextLabel})`, 'i')
      : new RegExp(`${label}[:\\s]*([\\s\\S]*)`, 'i');
    const m = text.match(pattern);
    if (m) results.push({ label, color, content: m[1].trim() });
  }
  return results.length > 0 ? results : [{ label: 'BRIEF', color: '#7c6dfa', content: text }];
}

export default function CallPrepModal({ deal, brief, loading, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(brief || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const company = deal?.company_name || deal?.sender_name || 'Deal';
  const sections = brief ? parseBrief(brief) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg flex flex-col rounded-2xl"
        style={{
          background: '#13131c',
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          maxHeight: '85vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-[rgba(255,255,255,0.07)]">
          <div>
            <h2 className="text-white font-semibold text-sm">Call Prep</h2>
            <p className="text-[rgba(255,255,255,0.35)] text-xs mt-0.5">{company}</p>
          </div>
          <div className="flex items-center gap-2">
            {brief && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: copied ? '#3dd68c' : 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
            <button onClick={onClose} className="text-[rgba(255,255,255,0.3)] hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-[#7c6dfa] border-t-transparent animate-spin" />
              <p className="text-[rgba(255,255,255,0.4)] text-sm">Preparing your call brief…</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sections.map(({ label, color, content }) => (
                <div key={label}>
                  <p
                    className="text-xs font-bold tracking-widest uppercase mb-2"
                    style={{ color, fontFamily: 'monospace' }}
                  >
                    {label}
                  </p>
                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: 'rgba(255,255,255,0.75)' }}
                  >
                    {content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

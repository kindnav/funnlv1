import { useNavigate } from 'react-router-dom';

export function SyncLogModal({ syncLog, onClose }) {
  const navigate = useNavigate();

  return (
    <div
      data-testid="sync-log-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5"
        style={{ background: '#1a1a26', border: '1px solid rgba(255,255,255,0.09)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-semibold text-sm">Last Sync</p>
          <button
            onClick={onClose}
            className="text-[rgba(255,255,255,0.3)] hover:text-white transition-colors text-xs"
          >
            ✕
          </button>
        </div>
        {syncLog ? (
          <div className="space-y-2.5">
            {[
              { label: 'Last sync time',             value: syncLog.time,            color: 'rgba(255,255,255,0.6)' },
              { label: 'Emails fetched from Gmail',  value: syncLog.fetched ?? '—',  color: 'rgba(255,255,255,0.6)' },
              { label: 'Passed AI gate',             value: syncLog.passed_gate ?? '—', color: '#3dd68c' },
              { label: 'Filtered as non-deal-flow',  value: syncLog.gated_out ?? '—',   color: '#f05252' },
              { label: 'New deals added',            value: syncLog.new_deals ?? '—',   color: '#7c6dfa' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[rgba(255,255,255,0.4)] text-xs">{label}</span>
                <span className="font-mono text-sm font-bold" style={{ color }}>{value}</span>
              </div>
            ))}
            {syncLog.gated_out > 0 && syncLog.fetched > 0 && syncLog.gated_out / syncLog.fetched > 0.5 && (
              <div
                className="rounded-lg px-3 py-2.5 mt-2"
                style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.25)' }}
              >
                <p className="text-[#f5a623] text-xs font-medium">High filter rate detected</p>
                <p className="text-[rgba(255,255,255,0.4)] text-xs mt-0.5 leading-relaxed">
                  More than half of your emails are being filtered. Check Filtered Emails in Settings to
                  make sure no real deals are being missed.
                </p>
              </div>
            )}
            <button
              onClick={() => { onClose(); navigate('/settings'); }}
              className="w-full mt-2 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.4)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              View filtered emails in Settings →
            </button>
          </div>
        ) : (
          <p className="text-[rgba(255,255,255,0.35)] text-sm text-center py-4">
            Sync stats will appear here after your next Gmail sync.
          </p>
        )}
      </div>
    </div>
  );
}

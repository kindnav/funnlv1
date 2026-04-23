import { Check, AlertTriangle, ChevronRight, RefreshCw, Filter, FlaskConical, RotateCcw } from 'lucide-react';

/**
 * AIGateSection — displays Gate Tests + Filtered Emails in Settings.
 * All state lives in Settings; this is a pure presentation + handler-call component.
 */
export function AIGateSection({
  cardCls,
  // Gate tests
  gateTestResults, gateTestRunning, onRunGateTests,
  // Filtered emails
  gatedEmails, gatedLoading, gatedTableMissing, restoringId, onRestore,
}) {
  return (
    <>
      {/* ── Gate Tests ── */}
      <div className={cardCls} data-testid="gate-tests-section">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <FlaskConical size={15} className="text-[#7c6dfa]" />
            <h2 className="text-white font-semibold text-sm">AI Gate Tests</h2>
          </div>
          <button
            data-testid="run-gate-tests-btn"
            onClick={onRunGateTests}
            disabled={gateTestRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
            style={{ background: 'rgba(124,109,250,0.1)', color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.25)' }}
          >
            {gateTestRunning
              ? <RefreshCw size={11} className="animate-spin" />
              : <ChevronRight size={11} />}
            {gateTestRunning ? 'Running...' : 'Run 12 Tests'}
          </button>
        </div>
        <p className="text-[rgba(255,255,255,0.35)] text-xs mb-4 leading-relaxed">
          Validate the AI gate against 12 benchmark emails — 3 that should be filtered, 9 that should pass through.
        </p>
        {gateTestResults && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-sm font-bold font-mono"
                style={{ color: gateTestResults.passed === gateTestResults.total ? '#3dd68c' : '#f5a623' }}
              >
                {gateTestResults.passed}/{gateTestResults.total}
              </span>
              <span className="text-[rgba(255,255,255,0.4)] text-xs">tests passed</span>
            </div>
            <div className="space-y-1.5">
              {gateTestResults.results.map((r) => (
                <div
                  key={r.id}
                  data-testid={`gate-test-${r.id}`}
                  className="flex items-start gap-2.5 rounded-lg px-3 py-2.5"
                  style={{
                    background: r.pass ? 'rgba(61,214,140,0.04)' : 'rgba(240,82,82,0.06)',
                    border: `1px solid ${r.pass ? 'rgba(61,214,140,0.15)' : 'rgba(240,82,82,0.2)'}`,
                  }}
                >
                  <span className="mt-0.5 shrink-0" style={{ color: r.pass ? '#3dd68c' : '#f05252' }}>
                    {r.pass ? <Check size={12} /> : <AlertTriangle size={12} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-xs font-medium truncate">{r.name}</p>
                    <p className="text-[rgba(255,255,255,0.3)] text-xs truncate font-mono">"{r.subject}"</p>
                    <p className="text-[rgba(255,255,255,0.25)] text-xs mt-0.5">
                      Expected:{' '}
                      <span style={{ color: r.expected ? '#3dd68c' : '#f05252' }}>
                        {r.expected ? 'pass through' : 'filter out'}
                      </span>
                      {' · '}
                      Got:{' '}
                      <span style={{ color: r.actual ? '#3dd68c' : '#f05252' }}>
                        {r.actual ? 'passed' : 'filtered'}
                      </span>
                      {' · '}{r.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Filtered Emails ── */}
      <div className={cardCls} data-testid="filtered-emails-section">
        <div className="flex items-center gap-2 mb-1">
          <Filter size={15} className="text-[rgba(255,255,255,0.4)]" />
          <h2 className="text-white font-semibold text-sm">Filtered Emails</h2>
          {gatedEmails.length > 0 && (
            <span
              className="ml-auto px-2 py-0.5 rounded text-xs font-mono"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
            >
              {gatedEmails.length}
            </span>
          )}
        </div>
        <p className="text-[rgba(255,255,255,0.35)] text-xs mb-4 leading-relaxed">
          These emails were filtered by AI because they did not appear to be deal-relevant.
          The bar to filter is very high — only clear internal logistics emails are excluded.
          If a real deal was filtered by mistake, click Restore.
        </p>

        {gatedTableMissing && (
          <div
            className="rounded-lg px-4 py-3 mb-4"
            style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.2)' }}
          >
            <p className="text-[#f5a623] text-xs font-medium mb-1">Setup required</p>
            <p className="text-[rgba(255,255,255,0.4)] text-xs mb-2">
              Run this in your Supabase SQL Editor to enable filtered email tracking:
            </p>
            <code className="text-[#4da6ff] text-xs font-mono block break-all leading-relaxed">
              {`CREATE TABLE IF NOT EXISTS gated_emails (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  sender_email text, sender_name text,
  subject text, received_date timestamptz,
  gate_reason text, body_preview text,
  restored boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);`}
            </code>
          </div>
        )}

        {gatedLoading ? (
          <div className="flex items-center gap-2 py-4">
            <div
              className="w-4 h-4 rounded-full border border-t-transparent animate-spin"
              style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#7c6dfa' }}
            />
            <span className="text-[rgba(255,255,255,0.3)] text-xs">Loading...</span>
          </div>
        ) : gatedEmails.length === 0 ? (
          <p className="text-[rgba(255,255,255,0.25)] text-xs py-2">
            No filtered emails. Everything is passing through to your dashboard.
          </p>
        ) : (
          <div className="space-y-2">
            {gatedEmails.map((e) => (
              <div
                key={e.id}
                data-testid={`gated-email-${e.id}`}
                className="flex items-start gap-3 rounded-lg px-3 py-3"
                style={{ background: '#0c0c12', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-white text-xs font-medium truncate">
                      {e.sender_name || e.sender_email}
                    </p>
                    <p className="text-[rgba(255,255,255,0.25)] text-xs font-mono shrink-0">
                      {e.received_date ? new Date(e.received_date).toLocaleDateString() : ''}
                    </p>
                  </div>
                  <p className="text-[rgba(255,255,255,0.5)] text-xs truncate mb-1">{e.subject}</p>
                  <p className="text-[rgba(255,255,255,0.25)] text-xs italic">{e.gate_reason}</p>
                </div>
                <button
                  data-testid={`restore-btn-${e.id}`}
                  onClick={() => onRestore(e.id)}
                  disabled={restoringId === e.id}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                  style={{ background: 'rgba(124,109,250,0.1)', color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.2)' }}
                >
                  {restoringId === e.id
                    ? <RefreshCw size={10} className="animate-spin" />
                    : <RotateCcw size={10} />}
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

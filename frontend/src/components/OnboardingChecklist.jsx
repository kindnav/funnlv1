import { useState, useEffect } from 'react';
import { Check, Loader, BookOpen, Mail, ArrowRight, RefreshCw } from 'lucide-react';
import { markOnboardingComplete, triggerSync } from '../lib/api';

// ── Single checklist item ─────────────────────────────────────────────────────
function CheckItem({ done, loading: spinning, label, sublabel, action, actionLabel, actionIcon: ActionIcon }) {
  return (
    <div className="flex items-start gap-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all duration-500"
        style={done ? {
          background: 'rgba(61,214,140,0.15)',
          border: '1px solid rgba(61,214,140,0.4)',
        } : {
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        {spinning ? (
          <Loader size={11} className="animate-spin" style={{ color: '#4da6ff' }} />
        ) : done ? (
          <Check size={11} style={{ color: '#3dd68c' }} />
        ) : (
          <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: done ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.85)', textDecoration: done ? 'line-through' : 'none' }}>
          {label}
        </p>
        {sublabel && (
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{sublabel}</p>
        )}
      </div>
      {action && !done && (
        <button
          onClick={action}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0"
          style={{
            background: 'rgba(124,109,250,0.1)',
            border: '1px solid rgba(124,109,250,0.25)',
            color: '#a89cf7',
          }}
        >
          {ActionIcon && <ActionIcon size={11} />}
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OnboardingChecklist({
  user,
  deals,
  fundSettings,
  isSyncing,
  onDismiss,
  onSyncNow,
  onOpenSettings,
  onProcessEmail,
}) {
  const [dismissed, setDismissed] = useState(false);
  const [firstSyncTriggered, setFirstSyncTriggered] = useState(false);

  // Auto-trigger first sync on mount
  useEffect(() => {
    if (!firstSyncTriggered && !isSyncing && user?.gmail_connected) {
      setFirstSyncTriggered(true);
      onSyncNow();
    }
  }, []); // eslint-disable-line

  const gmailConnected = Boolean(user?.gmail_connected);
  const syncComplete = !isSyncing && firstSyncTriggered;
  const thesisAdded = Boolean(fundSettings?.thesis?.trim());
  const dealExists = deals.length > 0;

  const completedCount = [gmailConnected, syncComplete, thesisAdded, dealExists].filter(Boolean).length;
  const totalCount = 4;
  const allDone = completedCount === totalCount;
  const progress = (completedCount / totalCount) * 100;

  const handleDismiss = async () => {
    await markOnboardingComplete().catch(() => {});
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed) return null;

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-8 overflow-auto">
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        data-testid="onboarding-checklist"
        style={{
          background: '#13131c',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
        }}
      >
        {/* Progress bar */}
        <div className="h-1 w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progress}%`,
              background: allDone
                ? 'linear-gradient(90deg, #3dd68c, #2dd4bf)'
                : 'linear-gradient(90deg, #7c6dfa, #4da6ff)',
            }}
          />
        </div>

        <div className="p-7">
          {allDone ? (
            /* ── All done state ── */
            <div className="text-center py-4" data-testid="onboarding-complete">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(61,214,140,0.1)', border: '2px solid rgba(61,214,140,0.3)' }}>
                <Check size={24} style={{ color: '#3dd68c' }} />
              </div>
              <h2 className="text-white text-xl font-bold mb-2">You're all set.</h2>
              <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Your deal flow intelligence is live.
              </p>
              <button
                data-testid="onboarding-go-to-dashboard-btn"
                onClick={handleDismiss}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm mx-auto transition-all"
                style={{
                  background: 'linear-gradient(135deg, #7c6dfa, #5b4de8)',
                  boxShadow: '0 0 24px rgba(124,109,250,0.35)',
                }}
              >
                Go to Dashboard
                <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            /* ── Checklist state ── */
            <>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-white text-lg font-bold">Welcome to Signalflow</h2>
                <span className="text-xs font-medium"
                  style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                  {completedCount}/{totalCount}
                </span>
              </div>
              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Complete these steps to get your deal flow running
              </p>

              <div>
                <CheckItem
                  done={gmailConnected}
                  label="Gmail account connected"
                  sublabel={user?.email ? `Connected as ${user.email}` : 'OAuth complete'}
                />
                <CheckItem
                  done={syncComplete}
                  loading={isSyncing || (firstSyncTriggered && !syncComplete)}
                  label="First sync complete"
                  sublabel={isSyncing || (firstSyncTriggered && !syncComplete) ? 'Syncing your inbox...' : 'Inbox scanned for pitch emails'}
                  action={!isSyncing && !syncComplete ? onSyncNow : null}
                  actionLabel="Sync now"
                  actionIcon={RefreshCw}
                />
                <CheckItem
                  done={thesisAdded}
                  label="Fund thesis added"
                  sublabel="Required for thesis-matched scoring"
                  action={!thesisAdded ? onOpenSettings : null}
                  actionLabel="Add thesis"
                  actionIcon={BookOpen}
                />
                <CheckItem
                  done={dealExists}
                  label="Process your first email"
                  sublabel={dealExists ? `${deals.length} deal${deals.length !== 1 ? 's' : ''} in your pipeline` : 'Paste any pitch email to get started'}
                  action={!dealExists ? onProcessEmail : null}
                  actionLabel="Process email"
                  actionIcon={Mail}
                />
              </div>

              <p className="text-xs text-center mt-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Checklist dismisses automatically when complete
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

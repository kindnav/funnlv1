import { useState } from 'react';
import { Users, Plus, LogIn, Copy, Check, Trash2, LogOut } from 'lucide-react';
import { createFund, joinFund, removeFundMember, leaveFund, deleteFund } from '../lib/api';
import { MemberAvatar } from './MemberAvatar';
import { toast } from './ui/sonner';

const cardCls = 'bg-[#0c0c12] border border-[rgba(255,255,255,0.06)] rounded-xl p-5';
const inputCls = 'w-full bg-[#13131c] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[rgba(255,255,255,0.25)] focus:outline-none focus:border-[#7c6dfa] transition-colors';
const labelCls = 'block text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold mb-1.5';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handle} data-testid="copy-invite-btn"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{
        background: copied ? 'rgba(61,214,140,0.1)' : 'rgba(124,109,250,0.1)',
        border: copied ? '1px solid rgba(61,214,140,0.3)' : '1px solid rgba(124,109,250,0.25)',
        color: copied ? '#3dd68c' : '#7c6dfa',
      }}>
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export function TeamSetup({ fundInfo, onFundChange }) {
  const [fundName, setFundName] = useState('');
  const [inviteInput, setInviteInput] = useState('');
  const [loading, setLoading] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fund = fundInfo?.fund;
  const role = fundInfo?.role;
  const members = fundInfo?.members || [];

  const handleCreate = async () => {
    if (!fundName.trim()) return;
    setLoading('create');
    try {
      const res = await createFund({ name: fundName.trim() });
      if (res?.fund) { toast.success('Fund created!'); onFundChange(); }
    } catch (e) {
      toast.error(e.message || 'Failed to create fund');
    } finally { setLoading(null); }
  };

  const handleJoin = async () => {
    if (!inviteInput.trim()) return;
    setLoading('join');
    try {
      const res = await joinFund({ invite_code: inviteInput.trim().toUpperCase() });
      if (res?.fund) { toast.success(res.message || `Joined ${res.fund.name}!`); onFundChange(); }
    } catch (e) {
      toast.error(e.message || 'Invalid invite code');
    } finally { setLoading(null); }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!window.confirm(`Remove ${memberName} from the fund?`)) return;
    try {
      await removeFundMember(fund.id, memberId);
      toast.success('Member removed');
      onFundChange();
    } catch (e) { toast.error(e.message || 'Failed to remove member'); }
  };

  const handleLeave = async () => {
    if (!window.confirm('Leave this fund? Your deals will stay in the shared view.')) return;
    setLoading('leave');
    try {
      await leaveFund();
      toast.success('You left the fund');
      onFundChange();
    } catch (e) { toast.error(e.message || 'Failed to leave fund'); }
    finally { setLoading(null); }
  };

  const handleDeleteFund = async () => {
    setLoading('delete');
    try {
      await deleteFund(fund.id);
      toast.success('Fund deleted');
      onFundChange();
    } catch (e) { toast.error(e.message || 'Failed to delete fund'); }
    finally { setLoading(null); setConfirmDelete(false); }
  };

  // ── No fund ──────────────────────────────────────────────────────────────────
  if (!fund) {
    return (
      <div data-testid="team-setup-no-fund">
        <div className="flex items-center gap-2 mb-1">
          <Users size={15} className="text-[#7c6dfa]" />
          <h2 className="text-white font-semibold text-sm">Team Collaboration</h2>
        </div>
        <p className="text-[rgba(255,255,255,0.35)] text-xs mb-5 leading-relaxed">
          Create a fund to share your deal flow with teammates, or join an existing fund with an invite code.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Create fund */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(124,109,250,0.15)' }}>
                <Plus size={13} className="text-[#7c6dfa]" />
              </div>
              <h3 className="text-white font-semibold text-sm">Create your fund</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Fund Name</label>
                <input
                  data-testid="create-fund-name-input"
                  type="text"
                  placeholder="Future Frontier Capital"
                  value={fundName}
                  onChange={(e) => setFundName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  className={inputCls}
                />
              </div>
              <button
                data-testid="create-fund-btn"
                onClick={handleCreate}
                disabled={!fundName.trim() || loading === 'create'}
                className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40"
                style={{ background: '#7c6dfa', boxShadow: '0 0 12px rgba(124,109,250,0.3)' }}>
                {loading === 'create' ? 'Creating…' : 'Create Fund'}
              </button>
            </div>
          </div>

          {/* Join fund */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(77,166,255,0.15)' }}>
                <LogIn size={13} className="text-[#4da6ff]" />
              </div>
              <h3 className="text-white font-semibold text-sm">Join a fund</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Invite Code</label>
                <input
                  data-testid="join-fund-code-input"
                  type="text"
                  placeholder="XXX-XXXX"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  maxLength={8}
                  className={`${inputCls} font-mono tracking-widest`}
                />
              </div>
              <button
                data-testid="join-fund-btn"
                onClick={handleJoin}
                disabled={!inviteInput.trim() || loading === 'join'}
                className="w-full py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
                style={{ background: 'rgba(77,166,255,0.1)', border: '1px solid rgba(77,166,255,0.3)', color: '#4da6ff' }}>
                {loading === 'join' ? 'Joining…' : 'Join Fund'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Has fund ─────────────────────────────────────────────────────────────────
  return (
    <div data-testid="team-setup-has-fund">
      <div className="flex items-center gap-3 mb-1">
        <Users size={15} className="text-[#7c6dfa]" />
        <h2 className="text-white font-semibold text-sm">{fund.name}</h2>
        <span className="px-2 py-0.5 rounded text-xs font-medium"
          style={{
            background: role === 'admin' ? 'rgba(124,109,250,0.1)' : 'rgba(255,255,255,0.05)',
            color: role === 'admin' ? '#7c6dfa' : 'rgba(255,255,255,0.4)',
            border: role === 'admin' ? '1px solid rgba(124,109,250,0.25)' : '1px solid rgba(255,255,255,0.08)',
          }}>
          {role === 'admin' ? 'Admin' : 'Member'}
        </span>
      </div>
      <p className="text-[rgba(255,255,255,0.3)] text-xs mb-5 leading-relaxed">
        {members.length} member{members.length !== 1 ? 's' : ''} · Deal flow is shared across the team.
      </p>

      {/* Invite code */}
      <div className="rounded-xl p-4 mb-4"
        style={{ background: 'rgba(124,109,250,0.06)', border: '1px solid rgba(124,109,250,0.2)' }}>
        <label className={labelCls}>Team Invite Code</label>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold font-mono tracking-widest text-white" data-testid="invite-code-display">
            {fund.invite_code}
          </span>
          <CopyButton text={fund.invite_code} />
        </div>
        <p className="text-[rgba(255,255,255,0.3)] text-xs mt-2">
          Share this code with teammates to give them access to your shared deal flow.
        </p>
      </div>

      {/* Members list */}
      <div className="space-y-2 mb-4">
        <label className={labelCls}>Team Members</label>
        {members.map((m) => (
          <div key={m.user_id}
            data-testid="fund-member-row"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5"
            style={{ background: '#0c0c12', border: '1px solid rgba(255,255,255,0.06)' }}>
            <MemberAvatar name={m.display_name} size={28} />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm truncate">{m.display_name}</p>
              <p className="text-[rgba(255,255,255,0.3)] text-xs font-mono truncate">{m.email}</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded shrink-0"
              style={{
                background: m.role === 'admin' ? 'rgba(124,109,250,0.1)' : 'transparent',
                color: m.role === 'admin' ? '#7c6dfa' : 'rgba(255,255,255,0.3)',
              }}>
              {m.role}
            </span>
            {role === 'admin' && m.role !== 'admin' && (
              <button onClick={() => handleRemoveMember(m.user_id, m.display_name)}
                data-testid="remove-member-btn"
                className="text-[rgba(255,255,255,0.2)] hover:text-[#f05252] transition-colors ml-1 shrink-0">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Danger zone */}
      <div className="flex gap-2 flex-wrap">
        {role === 'member' && (
          <button onClick={handleLeave} disabled={loading === 'leave'}
            data-testid="leave-fund-btn"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
            style={{ background: 'rgba(240,82,82,0.06)', border: '1px solid rgba(240,82,82,0.25)', color: '#f05252' }}>
            <LogOut size={13} />
            {loading === 'leave' ? 'Leaving…' : 'Leave Fund'}
          </button>
        )}
        {role === 'admin' && !confirmDelete && (
          <button onClick={() => setConfirmDelete(true)}
            data-testid="delete-fund-btn"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-all"
            style={{ background: 'rgba(240,82,82,0.06)', border: '1px solid rgba(240,82,82,0.25)', color: '#f05252' }}>
            <Trash2 size={13} />
            Delete Fund
          </button>
        )}
        {role === 'admin' && confirmDelete && (
          <div className="flex items-center gap-3 px-4 py-2 rounded-lg w-full"
            style={{ background: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.3)' }}>
            <span className="text-[#f05252] text-xs flex-1">Delete the fund and remove all members?</span>
            <button onClick={handleDeleteFund} disabled={loading === 'delete'}
              className="px-3 py-1 rounded text-xs font-medium text-white disabled:opacity-50"
              style={{ background: '#f05252' }}>
              {loading === 'delete' ? 'Deleting…' : 'Confirm'}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-[rgba(255,255,255,0.4)] hover:text-white text-xs">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

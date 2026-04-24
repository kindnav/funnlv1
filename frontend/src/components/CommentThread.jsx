import { useState, useEffect, useCallback, useRef } from 'react';
import { getDealComments, postComment, editComment, deleteComment } from '../lib/api';
import { MemberAvatar } from './MemberAvatar';
import { MessageSquare } from 'lucide-react';
import { toast } from './ui/sonner';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function highlightMentions(text) {
  const parts = text.split(/(@\w[\w\s]*)(?=\s|$|[^a-zA-Z])/g);
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={`mention-${i}`} className="font-semibold" style={{ color: '#7c6dfa' }}>{part}</span>
      : <span key={`text-${i}`}>{part}</span>
  );
}

function SystemMessage({ comment }) {
  return (
    <div className="py-1.5 text-center" data-testid="system-message">
      <span className="text-[rgba(255,255,255,0.25)] text-xs italic">{comment.body}</span>
      <span className="text-[rgba(255,255,255,0.15)] text-xs ml-1.5">{timeAgo(comment.created_at)}</span>
    </div>
  );
}

function CommentItem({ comment, members, onReply, onEdit, onDelete, isAdmin }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.body);
  const [saving, setSaving] = useState(false);

  const handleSaveEdit = async () => {
    if (!editText.trim() || editText === comment.body) { setEditing(false); return; }
    setSaving(true);
    try {
      await editComment(comment.id, editText.trim());
      onEdit(comment.id, editText.trim());
      setEditing(false);
    } catch { toast.error('Failed to save edit'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this comment?')) return;
    try { await deleteComment(comment.id); onDelete(comment.id); }
    catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="flex gap-2.5" data-testid="comment-item">
      <MemberAvatar name={comment.display_name} size={26} className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-white text-xs font-semibold">{comment.display_name}</span>
          <span className="text-[rgba(255,255,255,0.2)] text-xs">{timeAgo(comment.created_at)}</span>
          {comment.edited && <span className="text-[rgba(255,255,255,0.15)] text-xs italic">(edited)</span>}
        </div>
        {editing ? (
          <div className="space-y-1.5">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={2}
              autoFocus
              className="w-full bg-[#0c0c12] border border-[#7c6dfa]/40 rounded-lg px-2.5 py-2 text-xs text-white resize-none focus:outline-none"
            />
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} disabled={saving}
                className="px-3 py-1 rounded text-xs font-medium text-white disabled:opacity-50"
                style={{ background: '#7c6dfa' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setEditText(comment.body); }}
                className="px-3 py-1 rounded text-xs text-[rgba(255,255,255,0.4)] hover:text-white">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[rgba(255,255,255,0.75)] text-xs leading-relaxed">
            {highlightMentions(comment.body)}
          </p>
        )}
        {!editing && (
          <div className="flex gap-3 mt-1">
            <button onClick={() => onReply(comment)}
              className="text-[rgba(255,255,255,0.25)] hover:text-[#7c6dfa] text-xs transition-colors">
              Reply
            </button>
            {(comment.is_me || isAdmin) && (
              <>
                <button onClick={() => setEditing(true)}
                  className="text-[rgba(255,255,255,0.25)] hover:text-white text-xs transition-colors">
                  Edit
                </button>
                <button onClick={handleDelete}
                  className="text-[rgba(255,255,255,0.25)] hover:text-[#f05252] text-xs transition-colors">
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentThread({ dealId, fundInfo, userId }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [posting, setPosting] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const textareaRef = useRef(null);
  const members = fundInfo?.members || [];
  const isAdmin = fundInfo?.role === 'admin';

  const fetchComments = useCallback(async () => {
    const c = await getDealComments(dealId).catch(() => null);
    if (c) setComments(c);
  }, [dealId]);

  useEffect(() => {
    fetchComments();
    const t = setInterval(fetchComments, 5000);
    return () => clearInterval(t);
  }, [fetchComments]);

  const handleTextChange = (e, setter) => {
    const val = e.target.value;
    setter(val);
    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1 && lastAt === val.length - 1) {
      setMentionQuery('');
      setShowMentions(true);
    } else if (lastAt !== -1 && val.slice(lastAt + 1).match(/^\w+$/)) {
      setMentionQuery(val.slice(lastAt + 1).toLowerCase());
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (member, currentText, setter) => {
    const lastAt = currentText.lastIndexOf('@');
    const before = currentText.slice(0, lastAt);
    setter(`${before}@${member.display_name} `);
    setShowMentions(false);
  };

  const getMentionedIds = (txt) => {
    const matches = [];
    members.forEach((m) => {
      if (txt.includes(`@${m.display_name}`)) matches.push(m.user_id);
    });
    return matches;
  };

  const filteredMembers = members.filter((m) =>
    m.display_name.toLowerCase().includes(mentionQuery)
  );

  const submitComment = async (body, parentId = null, setter = setText) => {
    if (!body.trim() || posting) return;
    setPosting(true);
    try {
      const mentions = getMentionedIds(body);
      const saved = await postComment(dealId, { body: body.trim(), parent_id: parentId, mentions });
      if (saved) {
        setter('');
        setReplyTo(null);
        setReplyText('');
        await fetchComments();
      }
    } catch { toast.error('Failed to post comment'); }
    finally { setPosting(false); }
  };

  const handleKeyDown = (e, body, parentId = null, setter = setText) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submitComment(body, parentId, setter);
    }
  };

  // Group: top-level + replies
  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesFor = (id) => comments.filter((c) => c.parent_id === id);

  return (
    <div className="px-5 py-4" data-testid="comment-thread">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare size={13} className="text-[rgba(255,255,255,0.3)]" />
        <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold flex-1">
          Discussion
        </p>
        {comments.filter((c) => c.type === 'comment').length > 0 && (
          <span className="text-[rgba(255,255,255,0.25)] text-xs">
            {comments.filter((c) => c.type === 'comment').length} comment{comments.filter((c) => c.type === 'comment').length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Comment list */}
      <div className="space-y-3 mb-4 max-h-80 overflow-y-auto pr-1">
        {topLevel.map((c) => (
          <div key={c.id}>
            {c.type === 'system' ? (
              <SystemMessage comment={c} />
            ) : (
              <CommentItem
                comment={c}
                members={members}
                isAdmin={isAdmin}
                onReply={(cmt) => { setReplyTo(cmt); setReplyText(''); }}
                onEdit={(id, newBody) => setComments((prev) => prev.map((x) => x.id === id ? { ...x, body: newBody, edited: true } : x))}
                onDelete={(id) => setComments((prev) => prev.filter((x) => x.id !== id))}
              />
            )}
            {/* Replies */}
            {repliesFor(c.id).length > 0 && (
              <div className="ml-8 mt-2 space-y-2 pl-3" style={{ borderLeft: '2px solid rgba(124,109,250,0.25)' }}>
                {repliesFor(c.id).map((r) => (
                  r.type === 'system' ? <SystemMessage key={r.id} comment={r} /> : (
                    <CommentItem
                      key={r.id}
                      comment={r}
                      members={members}
                      isAdmin={isAdmin}
                      onReply={() => { setReplyTo(c); setReplyText(''); }}
                      onEdit={(id, newBody) => setComments((prev) => prev.map((x) => x.id === id ? { ...x, body: newBody, edited: true } : x))}
                      onDelete={(id) => setComments((prev) => prev.filter((x) => x.id !== id))}
                    />
                  )
                ))}
              </div>
            )}
            {/* Inline reply input */}
            {replyTo?.id === c.id && (
              <div className="ml-8 mt-2 pl-3" style={{ borderLeft: '2px solid rgba(124,109,250,0.4)' }}>
                <div className="relative">
                  <textarea
                    autoFocus
                    rows={2}
                    value={replyText}
                    onChange={(e) => handleTextChange(e, setReplyText)}
                    onKeyDown={(e) => handleKeyDown(e, replyText, c.id, setReplyText)}
                    placeholder={`Reply to ${c.display_name}…`}
                    className="w-full bg-[#0c0c12] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-xs text-[rgba(255,255,255,0.8)] placeholder-[rgba(255,255,255,0.2)] focus:outline-none focus:border-[#7c6dfa] resize-none"
                  />
                  {showMentions && filteredMembers.length > 0 && (
                    <MentionDropdown members={filteredMembers} onSelect={(m) => insertMention(m, replyText, setReplyText)} />
                  )}
                </div>
                <div className="flex gap-2 mt-1.5">
                  <button disabled={posting || !replyText.trim()}
                    onClick={() => submitComment(replyText, c.id, setReplyText)}
                    className="px-3 py-1 rounded text-xs font-medium text-white disabled:opacity-40"
                    style={{ background: '#7c6dfa' }}>
                    {posting ? 'Posting…' : 'Reply'}
                  </button>
                  <button onClick={() => { setReplyTo(null); setReplyText(''); }}
                    className="px-3 py-1 rounded text-xs text-[rgba(255,255,255,0.4)] hover:text-white">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-[rgba(255,255,255,0.2)] text-xs">No comments yet. Start the discussion.</p>
        )}
      </div>

      {/* New comment input */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          rows={2}
          value={text}
          onChange={(e) => handleTextChange(e, setText)}
          onKeyDown={(e) => handleKeyDown(e, text)}
          placeholder="Add a comment… Use @ to mention a teammate. Cmd+Enter to post."
          data-testid="comment-input"
          className="w-full bg-[#0c0c12] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 text-xs text-[rgba(255,255,255,0.8)] placeholder-[rgba(255,255,255,0.2)] focus:outline-none focus:border-[#7c6dfa] transition-colors resize-none pr-16"
        />
        {showMentions && filteredMembers.length > 0 && (
          <MentionDropdown members={filteredMembers} onSelect={(m) => insertMention(m, text, setText)} />
        )}
        <button
          data-testid="post-comment-btn"
          disabled={posting || !text.trim()}
          onClick={() => submitComment(text)}
          className="absolute right-2 bottom-2 px-2.5 py-1 rounded text-xs font-medium text-white disabled:opacity-40 transition-all"
          style={{ background: '#7c6dfa' }}
        >
          {posting ? '…' : 'Post'}
        </button>
      </div>
    </div>
  );
}

function MentionDropdown({ members, onSelect }) {
  return (
    <div className="absolute bottom-full left-0 mb-1 w-48 rounded-lg overflow-hidden z-50"
      style={{ background: '#1a1a26', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
      {members.map((m) => (
        <button key={m.user_id} onClick={() => onSelect(m)}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left transition-colors">
          <MemberAvatar name={m.display_name} size={20} />
          <span className="text-white text-xs truncate">{m.display_name}</span>
        </button>
      ))}
    </div>
  );
}

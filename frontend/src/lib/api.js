const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fetchJson = async (url, options = {}) => {
  // httpOnly cookie is the primary auth mechanism for browser sessions.
  // Legacy localStorage token is sent as a Bearer fallback so existing sessions
  // keep working after the cookie migration. Once a user re-authenticates via
  // Google OAuth, the httpOnly cookie takes over and the localStorage token is cleared.
  const legacyToken = localStorage.getItem('vc_token');
  const authHeader = legacyToken ? { Authorization: `Bearer ${legacyToken}` } : {};

  const resp = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...authHeader, ...options.headers },
  });
  if (resp.status === 401) {
    localStorage.removeItem('vc_token'); // clear stale token on auth failure
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    }
    return null;
  }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return resp.json();
};

export const getMe = () => fetchJson(`${API}/auth/me`);
export const logout = () => fetchJson(`${API}/auth/logout`, { method: 'POST' });
export const disconnectGmail = () => fetchJson(`${API}/auth/disconnect`, { method: 'POST' });
export const getGoogleAuthUrl = () => `${API}/auth/google`;

export const getDeals = () => fetchJson(`${API}/deals`);
export const getStats = () => fetchJson(`${API}/stats`);
export const processEmail = (data) =>
  fetchJson(`${API}/deals/process`, { method: 'POST', body: JSON.stringify(data) });
export const updateDeal = (id, data) =>
  fetchJson(`${API}/deals/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const triggerSync = () => fetchJson(`${API}/sync`, { method: 'POST' });
export const getSyncStatus = () => fetchJson(`${API}/sync/status`);
export const getSettings = () => fetchJson(`${API}/settings`);
export const getFundSettings = () => fetchJson(`${API}/fund-settings`);
export const saveFundSettings = (data) =>
  fetchJson(`${API}/fund-settings`, { method: 'POST', body: JSON.stringify(data) });
export const getDbStatus = () =>
  fetch(`${API}/status/db`).then((r) => r.json()).catch(() => ({ tables_ready: false }));

export const markOnboardingComplete = () =>
  fetchJson(`${API}/onboarding-complete`, { method: 'POST' });

export const generateAction = (dealId, actionType) =>
  fetchJson(`${API}/deals/${dealId}/generate-action`, {
    method: 'POST',
    body: JSON.stringify({ action_type: actionType }),
  });

export const sendAction = (dealId, data) =>
  fetchJson(`${API}/deals/${dealId}/send-action`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const upsertContact = (deal, contactStatus) =>
  fetchJson(`${API}/contacts/upsert`, {
    method: 'POST',
    body: JSON.stringify({ deal, contact_status: contactStatus }),
  });

export const getContacts = () => fetchJson(`${API}/contacts`);

export const updateContact = (id, data) =>
  fetchJson(`${API}/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const getContactDeals = (id) => fetchJson(`${API}/contacts/${id}/deals`);

// ── Team / Fund ─────────────────────────────────────────────────────────────────
export const getMyFund = () => fetchJson(`${API}/funds/me`);
export const createFund = (data) => fetchJson(`${API}/funds`, { method: 'POST', body: JSON.stringify(data) });
export const joinFund = (data) => fetchJson(`${API}/funds/join`, { method: 'POST', body: JSON.stringify(data) });
export const removeFundMember = (fundId, memberId) => fetchJson(`${API}/funds/${fundId}/members/${memberId}`, { method: 'DELETE' });
export const leaveFund = () => fetchJson(`${API}/funds/leave`, { method: 'POST' });
export const deleteFund = (fundId) => fetchJson(`${API}/funds/${fundId}`, { method: 'DELETE' });

// ── Fund dashboard ──────────────────────────────────────────────────────────────
export const getFundDeals = () => fetchJson(`${API}/deals/fund`);

// ── Deal collaboration ──────────────────────────────────────────────────────────
export const updateDealStage = (dealId, stage, extra = {}) =>
  fetchJson(`${API}/deals/${dealId}/stage`, { method: 'PATCH', body: JSON.stringify({ stage, ...extra }) });
export const deleteDeal = (dealId) =>
  fetchJson(`${API}/deals/${dealId}`, { method: 'DELETE' });
export const getArchivedDeals = () => fetchJson(`${API}/deals/archived`);
export const recoverDeal = (dealId) => fetchJson(`${API}/deals/${dealId}/recover`, { method: 'POST' });
export const assignDeal = (dealId, data) =>
  fetchJson(`${API}/deals/${dealId}/assign`, { method: 'POST', body: JSON.stringify(data) });
export const getDealVotes = (dealId) => fetchJson(`${API}/deals/${dealId}/votes`);
export const castVote = (dealId, vote) =>
  fetchJson(`${API}/deals/${dealId}/vote`, { method: 'POST', body: JSON.stringify({ vote }) });
export const getDealComments = (dealId) => fetchJson(`${API}/deals/${dealId}/comments`);
export const postComment = (dealId, data) =>
  fetchJson(`${API}/deals/${dealId}/comments`, { method: 'POST', body: JSON.stringify(data) });
export const editComment = (commentId, body) =>
  fetchJson(`${API}/deal-comments/${commentId}`, { method: 'PATCH', body: JSON.stringify({ body }) });
export const deleteComment = (commentId) =>
  fetchJson(`${API}/deal-comments/${commentId}`, { method: 'DELETE' });

// ── Notifications ───────────────────────────────────────────────────────────────
export const getNotifications = () => fetchJson(`${API}/notifications`);
export const markAllRead = () => fetchJson(`${API}/notifications/read-all`, { method: 'PATCH' });
export const markNotifRead = (id) => fetchJson(`${API}/notifications/${id}/read`, { method: 'PATCH' });

export const syncContactPipeline = () =>
  fetchJson(`${API}/contacts/sync-pipeline`, { method: 'POST' });

export const rebuildContacts = () =>
  fetchJson(`${API}/contacts/rebuild`, { method: 'POST' });

// ── AI Gate ─────────────────────────────────────────────────────────────────────
export const getGatedEmails = () => fetchJson(`${API}/gated-emails`);
export const restoreGatedEmail = (id) => fetchJson(`${API}/gated-emails/${id}/restore`, { method: 'POST' });

// ── Billing ──────────────────────────────────────────────────────────────────────
export const getBillingStatus = () => fetchJson(`${API}/billing/status`);
export const createCheckoutSession = async () => {
  const data = await fetchJson(`${API}/billing/create-checkout`, { method: 'POST' });
  if (data?.url) window.location.href = data.url;
};
export const openBillingPortal = async () => {
  const data = await fetchJson(`${API}/billing/portal`, { method: 'POST' });
  if (data?.url) window.location.href = data.url;
};

// ── Call Prep ────────────────────────────────────────────────────────────────────
export const generateCallPrep = (dealId) =>
  fetchJson(`${API}/deals/${dealId}/call-prep`, { method: 'POST' });

// ── Weekly digest ────────────────────────────────────────────────────────────────
export const toggleWeeklyDigest = (enabled) =>
  fetchJson(`${API}/digest/toggle`, { method: 'POST', body: JSON.stringify({ enabled }) });

// ── Contact activities ────────────────────────────────────────────────────────────
export const getContactActivities = (contactId) =>
  fetchJson(`${API}/contacts/${contactId}/activities`);

// ── Activity feed ─────────────────────────────────────────────────────────────────
export const getActivityFeed = (scope = 'personal') =>
  fetchJson(`${API}/activity-feed?scope=${scope}`);

// ── Fund contacts ─────────────────────────────────────────────────────────────────
export const getFundContacts = () =>
  fetchJson(`${API}/contacts/fund`);

// ── Admin / data management ───────────────────────────────────────────────────────
export const reprocessExisting = () =>
  fetchJson(`${API}/admin/reprocess-existing`, { method: 'POST' });

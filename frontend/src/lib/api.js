const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('vc_token')}`,
});

const fetchJson = async (url, options = {}) => {
  const resp = await fetch(url, { ...options, headers: { ...getHeaders(), ...options.headers } });
  if (resp.status === 401) {
    localStorage.removeItem('vc_token');
    window.location.href = '/';
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
export const getSettings = () => fetchJson(`${API}/settings`);
export const getFundSettings = () => fetchJson(`${API}/fund-settings`);
export const saveFundSettings = (data) =>
  fetchJson(`${API}/fund-settings`, { method: 'POST', body: JSON.stringify(data) });
export const getDbStatus = () =>
  fetch(`${API}/status/db`).then((r) => r.json()).catch(() => ({ tables_ready: false }));

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

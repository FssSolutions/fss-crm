// Supabase REST API helpers — never call fetch directly in components

const BASE = import.meta.env.VITE_SUPABASE_URL + '/rest/v1';
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

function headers(token) {
  return {
    'Content-Type': 'application/json',
    apikey: ANON,
    Authorization: `Bearer ${token || ANON}`,
    Prefer: 'return=representation',
  };
}

function qs(params = {}) {
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) parts.push(`${k}=${encodeURIComponent(v)}`);
  }
  return parts.length ? '?' + parts.join('&') : '';
}

async function request(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: headers(token),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) return { _expired: true };
  if (res.status === 204 || res.status === 200 && res.headers.get('content-length') === '0') return [];
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || data?.error || 'API error');
  return data;
}

const api = {
  get: (token, table, params = {}) =>
    request('GET', `/${table}${qs(params)}`, token),

  post: (token, table, body) =>
    request('POST', `/${table}`, token, body),

  patch: (token, table, id, body) =>
    request('PATCH', `/${table}?id=eq.${id}`, token, body),

  delete: (token, table, id) =>
    request('DELETE', `/${table}?id=eq.${id}`, token),

  upsert: (token, table, body) => {
    const h = headers(token);
    h['Prefer'] = 'resolution=merge-duplicates,return=representation';
    return fetch(`${BASE}/${table}`, { method: 'POST', headers: h, body: JSON.stringify(body) })
      .then(r => r.json());
  },

  rpc: (token, fn, body = {}) =>
    request('POST', `/rpc/${fn}`, token, body),
};

export default api;

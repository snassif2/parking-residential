/**
 * API Adapter — Phase 2
 * Mirrors the localStorage adapter interface but calls the API Gateway backend.
 * Activate by setting localStorage item 'svg_adapter' = 'api'.
 */

const ENV = () => window.__ENV || {};

// ── Auth token management ──────────────────────────────────────────
const TOKEN_KEY = 'svg_id_token';
export function setToken(idToken) { localStorage.setItem(TOKEN_KEY, idToken); }
export function clearToken()      { localStorage.removeItem(TOKEN_KEY); }
function getToken()               { return localStorage.getItem(TOKEN_KEY) || ''; }

// ── Base fetch ─────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const url     = `${ENV().API_URL}${path}`;
  const headers = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${getToken()}`,
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });
  if (res.status === 204) return null;

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || `HTTP ${res.status}`), { statusCode: res.status });
  return json;
}

const get    = (path)         => apiFetch(path);
const post   = (path, body)   => apiFetch(path, { method: 'POST',   body: JSON.stringify(body) });
const put    = (path, body)   => apiFetch(path, { method: 'PUT',    body: JSON.stringify(body) });
const del    = (path)         => apiFetch(path, { method: 'DELETE' });

// ── Auth ───────────────────────────────────────────────────────────
export async function apiLogin(username, password) {
  const res = await post('/auth/login', { username, password });
  setToken(res.idToken);
  return res;
}

// ── Condominios ────────────────────────────────────────────────────
export const listCondominios  = ()          => get('/condominios');
export const getCondominio    = (id)        => get(`/condominios/${id}`);
export const createCondominio = (data)      => post('/condominios', data);
export const updateCondominio = (id, data)  => put(`/condominios/${id}`, data);
export const deleteCondominio = (id)        => del(`/condominios/${id}`);

// ── Unidades ───────────────────────────────────────────────────────
export const listUnidades   = (condoId)            => get(`/condominios/${condoId}/unidades`);
export const getUnidade     = (condoId, uid)       => get(`/condominios/${condoId}/unidades/${encodeURIComponent(uid)}`);
export const createUnidade  = (condoId, data)      => post(`/condominios/${condoId}/unidades`, data);
export const updateUnidade  = (condoId, uid, data) => put(`/condominios/${condoId}/unidades/${encodeURIComponent(uid)}`, data);
export const deleteUnidade  = (condoId, uid)       => del(`/condominios/${condoId}/unidades/${encodeURIComponent(uid)}`);

// ── Vagas ──────────────────────────────────────────────────────────
export const listVagas   = (condoId)            => get(`/condominios/${condoId}/vagas`);
export const getVaga     = (condoId, vid)       => get(`/condominios/${condoId}/vagas/${vid}`);
export const createVaga  = (condoId, data)      => post(`/condominios/${condoId}/vagas`, data);
export const updateVaga  = (condoId, vid, data) => put(`/condominios/${condoId}/vagas/${vid}`, data);
export const deleteVaga  = (condoId, vid)       => del(`/condominios/${condoId}/vagas/${vid}`);

// ── Preferenciais ──────────────────────────────────────────────────
export const listPreferenciais    = (condoId)            => get(`/condominios/${condoId}/preferenciais`);
export const getPreferencial      = (condoId, pid)       => get(`/condominios/${condoId}/preferenciais/${pid}`);
export const createPreferencial   = (condoId, data)      => post(`/condominios/${condoId}/preferenciais`, data);
export const updatePreferencial   = (condoId, pid, data) => put(`/condominios/${condoId}/preferenciais/${pid}`, data);
export const revokePreferencial   = (condoId, pid, justificativa) => del(`/condominios/${condoId}/preferenciais/${pid}`, { body: JSON.stringify({ justificativa }) });

// ── Sorteio ────────────────────────────────────────────────────────
export const getSorteioPreview   = (condoId)            => get(`/condominios/${condoId}/sorteio/preview`);
export const runSorteioTeste     = (condoId)            => post(`/condominios/${condoId}/sorteio/teste`, {});
export const runSorteioOficial   = (condoId)            => post(`/condominios/${condoId}/sorteio/oficial`, {});
export const listSorteios        = (condoId)            => get(`/condominios/${condoId}/resultados`);
export const getSorteio          = (condoId, sid)       => get(`/condominios/${condoId}/resultados/${sid}`);
export const getSorteioPdfUrl    = (condoId, sid)       => get(`/condominios/${condoId}/resultados/${sid}/pdf`);
export const getLastSorteioOficial = async (condoId)    => {
  const all = await listSorteios(condoId);
  return [...all].filter(s => s.modo === 'OFICIAL').sort((a,b) => b.timestamp.localeCompare(a.timestamp))[0] || null;
};

// ── Export / Import ────────────────────────────────────────────────
export const exportCondo = (condoId) => get(`/condominios/${condoId}/export`);
export const importCondo = (condoId, data) => post(`/condominios/${condoId}/import`, data);

// ── Stub: users managed via Cognito console / admin CLI ───────────
export const listUsers   = () => Promise.resolve([]);
export const getUser     = () => Promise.resolve(null);
export const createUser  = () => Promise.reject(new Error('User management via Cognito — use AWS Console or admin CLI'));
export const updateUser  = () => Promise.reject(new Error('User management via Cognito'));
export const deleteUser  = () => Promise.reject(new Error('User management via Cognito'));

// ── Stubs not needed in Phase 2 ───────────────────────────────────
export const seedIfEmpty          = () => {};
export const listHistoricoPreferenciais = (condoId) => get(`/condominios/${condoId}/preferenciais`).then(items => items.filter(i => i.SK?.includes('HIST')));
export const bulkCreateUnidades   = (condoId, items) => Promise.all(items.map(u => createUnidade(condoId, u)));
export const bulkCreateVagas      = (condoId, items) => Promise.all(items.map(v => createVaga(condoId, v)));
export const saveSorteio          = () => Promise.resolve(null); // handled server-side
export const exportAll            = () => Promise.resolve(null);
export const importAll            = () => Promise.resolve(null);

import { getUserByLogin, listCondominios, getCondominio } from '../adapters/local-storage-adapter.js';

const SESSION_KEY = 'svg_session';

export function login(loginStr, senha) {
  const user = getUserByLogin(loginStr);
  if (!user || user.senha !== senha) throw new Error('Usuário ou senha inválidos');
  if (user.status !== 'ATIVO') throw new Error('Usuário inativo');

  const session = {
    userId:  user.id,
    login:   user.login,
    nome:    user.nome,
    perfil:  user.perfil,   // 'admin' | 'sindico' | 'morador'
    condoId: user.condoId || null,          // morador: fixed condo
    condoIds: user.condoIds || [],          // sindico: multiple condos
    unidadeId: user.unidadeId || null,      // morador: fixed unit
    activeCondoId: null,                    // set after condo selection
  };

  // Admin: no condo selection needed (can switch freely)
  if (user.perfil === 'admin') {
    session.activeCondoId = null;
  }
  // Morador: auto-select their condo
  if (user.perfil === 'morador') {
    session.activeCondoId = user.condoId || null;
  }
  // Síndico: needs to pick a condo (handled by login page)

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}

export function isLoggedIn() { return !!getSession(); }

export function setActiveCondoId(condoId) {
  const s = getSession();
  if (!s) return;
  s.activeCondoId = condoId;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function getActiveCondo() {
  const s = getSession();
  if (!s || !s.activeCondoId) return null;
  return getCondominio(s.activeCondoId);
}

export function canAccessCondo(condoId) {
  const s = getSession();
  if (!s) return false;
  if (s.perfil === 'admin') return true;
  if (s.perfil === 'sindico') return s.condoIds.includes(condoId);
  if (s.perfil === 'morador') return s.condoId === condoId;
  return false;
}

export function requireAuth() {
  if (!isLoggedIn()) { window.location.hash = '#/login'; return false; }
  return true;
}

export function requireCondo() {
  const s = getSession();
  if (!s) return false;
  if (!s.activeCondoId && s.perfil !== 'admin') { window.location.hash = '#/select-condo'; return false; }
  return true;
}

/**
 * localStorage Adapter — Phase 1
 * All data is stored per-condo under keys prefixed by condoId.
 * Global keys: svg_condominios, svg_users
 */

const PREFIX = 'svg_';

// ── helpers ────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function key(name) { return PREFIX + name; }
function condoKey(condoId, name) { return `${PREFIX}${condoId}_${name}`; }

function load(k) {
  try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; }
}
function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

// ── condominios ────────────────────────────────────────────────────
export function listCondominios() { return load(key('condominios')) || []; }
export function getCondominio(id) { return listCondominios().find(c => c.id === id) || null; }
export function createCondominio(data) {
  const list = listCondominios();
  const item = { ...data, id: uid(), criadoEm: new Date().toISOString() };
  list.push(item);
  save(key('condominios'), list);
  return item;
}
export function updateCondominio(id, data) {
  const list = listCondominios().map(c => c.id === id ? { ...c, ...data } : c);
  save(key('condominios'), list);
  return list.find(c => c.id === id);
}
export function deleteCondominio(id) {
  save(key('condominios'), listCondominios().filter(c => c.id !== id));
}

// ── users ──────────────────────────────────────────────────────────
export function listUsers() { return load(key('users')) || []; }
export function getUser(id) { return listUsers().find(u => u.id === id) || null; }
export function getUserByLogin(login) { return listUsers().find(u => u.login === login) || null; }
export function createUser(data) {
  const list = listUsers();
  if (list.find(u => u.login === data.login)) throw new Error('Login já existe');
  const item = { ...data, id: uid(), criadoEm: new Date().toISOString() };
  list.push(item);
  save(key('users'), list);
  return item;
}
export function updateUser(id, data) {
  const list = listUsers().map(u => u.id === id ? { ...u, ...data } : u);
  save(key('users'), list);
  return list.find(u => u.id === id);
}
export function deleteUser(id) { save(key('users'), listUsers().filter(u => u.id !== id)); }

// ── unidades (per condo) ───────────────────────────────────────────
export function listUnidades(condoId) { return load(condoKey(condoId, 'unidades')) || []; }
export function getUnidade(condoId, unidadeId) { return listUnidades(condoId).find(u => u.unidadeId === unidadeId) || null; }
export function createUnidade(condoId, data) {
  const list = listUnidades(condoId);
  const item = { ...data, condoId };
  if (list.find(u => u.unidadeId === item.unidadeId)) throw new Error('Unidade já existe neste condomínio');
  list.push(item);
  save(condoKey(condoId, 'unidades'), list);
  return item;
}
export function updateUnidade(condoId, unidadeId, data) {
  const list = listUnidades(condoId).map(u => u.unidadeId === unidadeId ? { ...u, ...data } : u);
  save(condoKey(condoId, 'unidades'), list);
  return list.find(u => u.unidadeId === unidadeId);
}
export function deleteUnidade(condoId, unidadeId) {
  save(condoKey(condoId, 'unidades'), listUnidades(condoId).filter(u => u.unidadeId !== unidadeId));
}
export function bulkCreateUnidades(condoId, items) {
  const list = listUnidades(condoId);
  const existing = new Set(list.map(u => u.unidadeId));
  const added = [];
  for (const data of items) {
    if (!existing.has(data.unidadeId)) {
      const item = { ...data, condoId };
      list.push(item);
      added.push(item);
      existing.add(data.unidadeId);
    }
  }
  save(condoKey(condoId, 'unidades'), list);
  return added;
}

// ── vagas (per condo) ──────────────────────────────────────────────
export function listVagas(condoId) { return load(condoKey(condoId, 'vagas')) || []; }
export function getVaga(condoId, vagaId) { return listVagas(condoId).find(v => v.id === vagaId) || null; }
export function createVaga(condoId, data) {
  const list = listVagas(condoId);
  const item = { ...data, id: uid(), condoId };
  list.push(item);
  save(condoKey(condoId, 'vagas'), list);
  return item;
}
export function updateVaga(condoId, vagaId, data) {
  const list = listVagas(condoId).map(v => v.id === vagaId ? { ...v, ...data } : v);
  save(condoKey(condoId, 'vagas'), list);
  return list.find(v => v.id === vagaId);
}
export function deleteVaga(condoId, vagaId) {
  save(condoKey(condoId, 'vagas'), listVagas(condoId).filter(v => v.id !== vagaId));
}
export function bulkCreateVagas(condoId, items) {
  const list = listVagas(condoId);
  const added = [];
  for (const data of items) {
    const item = { ...data, id: uid(), condoId };
    list.push(item);
    added.push(item);
  }
  save(condoKey(condoId, 'vagas'), list);
  return added;
}

// ── preferenciais (per condo) ──────────────────────────────────────
export function listPreferenciais(condoId) { return load(condoKey(condoId, 'preferenciais')) || []; }
export function getPreferencial(condoId, unidadeId) { return listPreferenciais(condoId).find(p => p.unidadeId === unidadeId && p.ativa) || null; }
export function listHistoricoPreferenciais(condoId) { return load(condoKey(condoId, 'pref_historico')) || []; }

export function createPreferencial(condoId, data) {
  const list = listPreferenciais(condoId);
  if (list.find(p => p.unidadeId === data.unidadeId && p.ativa)) {
    throw new Error('Esta unidade já possui uma atribuição preferencial ativa');
  }
  const item = { ...data, id: uid(), condoId, ativa: true, criadoEm: new Date().toISOString() };
  list.push(item);
  save(condoKey(condoId, 'preferenciais'), list);
  return item;
}
export function updatePreferencial(condoId, prefId, data) {
  const list = listPreferenciais(condoId).map(p => p.id === prefId ? { ...p, ...data } : p);
  save(condoKey(condoId, 'preferenciais'), list);
  return list.find(p => p.id === prefId);
}
export function revokePreferencial(condoId, prefId, justificativa, responsavel) {
  const list = listPreferenciais(condoId).map(p =>
    p.id === prefId ? { ...p, ativa: false, revokedEm: new Date().toISOString(), justificativa, responsavel } : p
  );
  save(condoKey(condoId, 'preferenciais'), list);
  // audit trail
  const hist = listHistoricoPreferenciais(condoId);
  const pref = list.find(p => p.id === prefId);
  hist.push({ ...pref, tipo: 'REVOGACAO', ts: new Date().toISOString(), justificativa, responsavel });
  save(condoKey(condoId, 'pref_historico'), hist);
}

// ── sorteios (per condo) ───────────────────────────────────────────
export function listSorteios(condoId) { return load(condoKey(condoId, 'sorteios')) || []; }
export function getSorteio(condoId, sorteioId) { return listSorteios(condoId).find(s => s.id === sorteioId) || null; }
export function getLastSorteioOficial(condoId) {
  return [...listSorteios(condoId)]
    .filter(s => s.modo === 'OFICIAL')
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] || null;
}
export function saveSorteio(condoId, data) {
  const list = listSorteios(condoId);
  const item = { ...data, id: uid(), condoId };
  list.push(item);
  save(condoKey(condoId, 'sorteios'), list);
  return item;
}

// ── export / import ────────────────────────────────────────────────
export function exportAll() {
  const condos = listCondominios();
  const result = { version: 1, exportedAt: new Date().toISOString(), condominios: [], users: listUsers() };
  for (const c of condos) {
    result.condominios.push({
      ...c,
      unidades:      listUnidades(c.id),
      vagas:         listVagas(c.id),
      preferenciais: listPreferenciais(c.id),
      pref_historico:listHistoricoPreferenciais(c.id),
      sorteios:      listSorteios(c.id),
    });
  }
  return result;
}
export function importAll(data) {
  if (!data.version) throw new Error('Arquivo inválido');
  save(key('condominios'), data.condominios.map(({ unidades, vagas, preferenciais, pref_historico, sorteios, ...c }) => c));
  save(key('users'), data.users || []);
  for (const c of data.condominios) {
    save(condoKey(c.id, 'unidades'),       c.unidades || []);
    save(condoKey(c.id, 'vagas'),          c.vagas || []);
    save(condoKey(c.id, 'preferenciais'),  c.preferenciais || []);
    save(condoKey(c.id, 'pref_historico'), c.pref_historico || []);
    save(condoKey(c.id, 'sorteios'),       c.sorteios || []);
  }
}

// ── seed initial data ──────────────────────────────────────────────
export function seedIfEmpty() {
  if (listUsers().length > 0) return; // already seeded

  // admin master
  createUser({ login: 'admin', senha: 'admin123', nome: 'Administrador Master', perfil: 'admin', status: 'ATIVO', condoIds: [] });

  // demo condo
  const condo = createCondominio({
    nome: 'Residencial Demo',
    cnpj: '12.345.678/0001-90',
    endereco: 'Rua das Flores, 100 — São Paulo, SP',
    sindico: 'Maria Silva',
    contato: 'maria@demo.com',
    status: 'ATIVO',
    percMinPreferenciais: 2,
    torres: ['Torre 1', 'Torre 2'],
  });

  // síndico
  createUser({ login: 'sindico', senha: 'sindico123', nome: 'Maria Silva', perfil: 'sindico', status: 'ATIVO', condoIds: [condo.id] });

  // morador
  createUser({ login: 'morador', senha: 'morador123', nome: 'João Santos', perfil: 'morador', status: 'ATIVO', condoId: condo.id, unidadeId: 'T1#11' });

  // seed a few units for Torre 1
  const unidades = [];
  for (let andar = 1; andar <= 5; andar++) {
    for (let apt = 1; apt <= 6; apt++) {
      const numero = `${andar}${apt}`;
      unidades.push({
        unidadeId: `T1#${numero}`,
        torre: 'Torre 1',
        numero,
        andar,
        direitoVagas: apt <= 2 ? 2 : 1,
        elegivel: true,
        obsInelegibilidade: null,
        vagaFixa: false,
        preferencial: false,
      });
    }
  }
  bulkCreateUnidades(condo.id, unidades);

  // seed a few spots
  const vagas = [];
  for (let i = 1; i <= 40; i++) {
    vagas.push({
      numero: i,
      andar: i <= 20 ? '1SS' : '2SS',
      parVaga: i % 2 === 1 ? i + 1 : i - 1,
      tipo: 'COMUM',
      status: 'LIVRE',
      localizacao: i <= 4 ? 'próxima ao elevador' : '',
      unidadeId: null,
      torre: 'Torre 1',
    });
  }
  bulkCreateVagas(condo.id, vagas);
}

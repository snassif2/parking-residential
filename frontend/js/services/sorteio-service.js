import { listUnidades, listVagas, listPreferenciais } from '../adapters/local-storage-adapter.js';

// ── Fisher-Yates with seeded PRNG ──────────────────────────────────
function splitmix32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x9e3779b9 | 0;
    let t = seed ^ (seed >>> 16);
    t = Math.imul(t, 0x21f0aaad) | 0;
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97) | 0;
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

export function fisherYatesShuffle(array, seed) {
  const result = [...array];
  const rng    = splitmix32(seed);
  const steps  = [];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    steps.push({ i, j });
    [result[i], result[j]] = [result[j], result[i]];
  }
  return { result, seed, steps };
}

// ── Build preview (dry-run counts) ────────────────────────────────
export function buildPreview(condoId) {
  const unidades = listUnidades(condoId);
  const vagas    = listVagas(condoId);
  const prefs    = listPreferenciais(condoId).filter(p => p.ativa);
  const prefUnids = new Set(prefs.map(p => p.unidadeId));

  const fixas      = unidades.filter(u => u.vagaFixa);
  const prefList   = unidades.filter(u => prefUnids.has(u.unidadeId));
  const elegiveis  = unidades.filter(u => u.elegivel && !u.vagaFixa && !prefUnids.has(u.unidadeId));
  const inelegiveis= unidades.filter(u => !u.elegivel && !u.vagaFixa);

  const vagasFixas    = vagas.filter(v => v.tipo === 'FIXA' || v.status === 'FIXA');
  const vagasReserv   = vagas.filter(v => v.status === 'RESERVADA');
  const vagasPrefAtrib= prefs.flatMap(p => p.vagasAtribuidas || []);
  const vagasPool     = vagas.filter(v =>
    v.tipo !== 'FIXA' &&
    v.status !== 'FIXA' &&
    v.status !== 'RESERVADA' &&
    !vagasPrefAtrib.includes(v.numero)
  );

  const warnings = [];
  if (elegiveis.length === 0) warnings.push('⚠ Nenhuma unidade elegível para o sorteio.');
  if (vagasPool.length === 0) warnings.push('⚠ Nenhuma vaga disponível para o sorteio.');
  const totalDireito = elegiveis.reduce((sum, u) => sum + u.direitoVagas, 0);
  if (vagasPool.length < totalDireito) {
    warnings.push(`⚠ Vagas disponíveis (${vagasPool.length}) são insuficientes para todas as unidades elegíveis (precisam de ${totalDireito}).`);
  }

  return {
    totalElegiveis:   elegiveis.length,
    totalPreferenciais: prefList.length,
    totalInelegiveis: inelegiveis.length,
    totalFixas:       fixas.length,
    vagasParaSorteio: vagasPool.length,
    vagasReservadas:  vagasReserv.length,
    warnings,
  };
}

// ── Run sorteio ────────────────────────────────────────────────────
export function runSorteio(condoId, session, modo = 'OFICIAL') {
  const unidades = listUnidades(condoId);
  const vagas    = listVagas(condoId);
  const prefs    = listPreferenciais(condoId).filter(p => p.ativa);
  const prefMap  = Object.fromEntries(prefs.map(p => [p.unidadeId, p]));

  const timestamp = new Date().toISOString();
  const seed = (Date.now() ^ condoId.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) >>> 0;

  const atribuicoes = {};

  // 1. Fixed spots
  unidades.filter(u => u.vagaFixa).forEach(u => {
    const fixedVagas = vagas.filter(v => v.unidadeId === u.unidadeId || v.status === 'FIXA');
    atribuicoes[u.unidadeId] = { vagas: fixedVagas.map(v => v.numero), tipo: 'FIXA' };
  });

  // 2. Preferential spots
  prefs.forEach(p => {
    atribuicoes[p.unidadeId] = { vagas: p.vagasAtribuidas, tipo: 'PREFERENCIAL', tipoPref: p.tipoPref };
  });

  // 3. Build pool for lottery
  const usedNums = new Set([
    ...prefs.flatMap(p => p.vagasAtribuidas || []),
    ...vagas.filter(v => v.tipo === 'FIXA' || v.status === 'FIXA').map(v => v.numero),
    ...vagas.filter(v => v.status === 'RESERVADA').map(v => v.numero),
  ]);

  const pool = vagas.filter(v => !usedNums.has(v.numero) && v.tipo !== 'FIXA' && v.status !== 'FIXA' && v.status !== 'RESERVADA');

  // Separate pairs and singles
  const pairs   = [];
  const singles = [];
  const seenPairs = new Set();

  for (const v of pool) {
    if (v.parVaga && pool.find(p => p.numero === v.parVaga) && !seenPairs.has(v.numero)) {
      const partner = pool.find(p => p.numero === v.parVaga);
      pairs.push([v.numero, partner.numero]);
      seenPairs.add(v.numero);
      seenPairs.add(partner.numero);
    } else if (!v.parVaga || !pool.find(p => p.numero === v.parVaga)) {
      if (!seenPairs.has(v.numero)) singles.push(v.numero);
    }
  }

  // Shuffle
  const { result: shuffledPairs } = fisherYatesShuffle(pairs,   seed);
  const { result: shuffledSingles, steps } = fisherYatesShuffle(singles, seed + 1);

  // Eligible units (not fixed, not preferential)
  const eligible = unidades.filter(u => u.elegivel && !u.vagaFixa && !prefMap[u.unidadeId]);
  const units2   = eligible.filter(u => u.direitoVagas >= 2);
  const units1   = eligible.filter(u => u.direitoVagas === 1);

  let pi = 0, si = 0;
  const vagasRestantes = [];

  // Assign pairs to 2-vaga units
  const { result: shuffledUnits2 } = fisherYatesShuffle(units2, seed + 2);
  for (const u of shuffledUnits2) {
    if (pi < shuffledPairs.length) {
      atribuicoes[u.unidadeId] = { vagas: shuffledPairs[pi++], tipo: 'SORTEIO' };
    } else if (si + 1 < shuffledSingles.length) {
      atribuicoes[u.unidadeId] = { vagas: [shuffledSingles[si++], shuffledSingles[si++]], tipo: 'SORTEIO' };
    } else {
      atribuicoes[u.unidadeId] = { vagas: [], tipo: 'SEM_VAGA' };
    }
  }

  // Assign singles to 1-vaga units
  const { result: shuffledUnits1 } = fisherYatesShuffle(units1, seed + 3);
  for (const u of shuffledUnits1) {
    // Use remaining from pairs first (split pair)
    if (pi < shuffledPairs.length) {
      const pair = shuffledPairs[pi++];
      atribuicoes[u.unidadeId] = { vagas: [pair[0]], tipo: 'SORTEIO' };
      vagasRestantes.push(pair[1]);
    } else if (si < shuffledSingles.length) {
      atribuicoes[u.unidadeId] = { vagas: [shuffledSingles[si++]], tipo: 'SORTEIO' };
    } else {
      atribuicoes[u.unidadeId] = { vagas: [], tipo: 'SEM_VAGA' };
    }
  }

  // Remaining unused vagas
  while (pi < shuffledPairs.length) { vagasRestantes.push(...shuffledPairs[pi++]); }
  while (si < shuffledSingles.length) { vagasRestantes.push(shuffledSingles[si++]); }

  const naoElegiveis = unidades.filter(u => !u.elegivel && !u.vagaFixa && !prefMap[u.unidadeId]).map(u => u.unidadeId);

  return {
    condoId,
    timestamp,
    executor: session.login,
    perfil:   session.perfil,
    modo,
    semente:  seed,
    passosFisherYates: steps,
    atribuicoes,
    naoElegiveis,
    vagasRestantes,
  };
}

import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE }       from '../shared/db/client';
import { keys }            from '../shared/db/keys';
import { verifyClaims, requireRole, requireCondoAccess } from '../shared/auth/verify-claims';
import { ok, errorResponse, badRequest } from '../shared/utils/response';
import type { Unidade, Vaga, Preferencial, Sorteio, SorteioAtribuicao } from '../shared/models/types';
import { randomUUID }      from 'crypto';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const claims  = verifyClaims(event);
  const method  = event.requestContext.http.method;
  const path    = event.rawPath;
  const condoId = path.match(/\/condominios\/([^/]+)/)?.[1];

  if (!condoId) return errorResponse({ statusCode: 400, message: 'condoId missing' });

  try {
    requireCondoAccess(claims, condoId);

    if (method === 'GET'  && /\/sorteio\/preview$/.test(path)) return await preview(condoId);
    if (method === 'POST' && /\/sorteio\/teste$/.test(path))   { requireRole(claims, 'admin', 'sindico'); return await executeSorteio(condoId, claims, 'TESTE'); }
    if (method === 'POST' && /\/sorteio\/oficial$/.test(path)) { requireRole(claims, 'admin', 'sindico'); return await executeSorteio(condoId, claims, 'OFICIAL'); }

    if (method === 'GET' && /\/resultados$/.test(path)) return await listResultados(condoId);
    const rm = path.match(/\/resultados\/([^/]+)$/);
    if (rm) {
      const sorteioId = rm[1];
      if (method === 'GET') return await getResultado(condoId, sorteioId);
    }

    return errorResponse({ statusCode: 404, message: 'Not found' });
  } catch (err) {
    return errorResponse(err);
  }
};

// ── Fisher-Yates ───────────────────────────────────────────────────
function splitmix32(seed: number) {
  return function() {
    seed = (seed + 0x9e3779b9) | 0;
    let t = seed ^ (seed >>> 16);
    t = Math.imul(t, 0x21f0aaad) | 0;
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97) | 0;
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], seed: number): { result: T[]; steps: Array<{i:number;j:number}> } {
  const result = [...arr];
  const rng    = splitmix32(seed);
  const steps: Array<{i:number;j:number}> = [];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    steps.push({ i, j });
    [result[i], result[j]] = [result[j], result[i]];
  }
  return { result, steps };
}

// ── Load condo data ────────────────────────────────────────────────
async function loadCondoData(condoId: string) {
  const [uRes, vRes, pRes] = await Promise.all([
    db.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)', ExpressionAttributeValues: { ':pk': `COND#${condoId}`, ':prefix': 'UNID#' } })),
    db.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)', ExpressionAttributeValues: { ':pk': `COND#${condoId}`, ':prefix': 'VAGA#' } })),
    db.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)', ExpressionAttributeValues: { ':pk': `COND#${condoId}`, ':prefix': 'PREF#' } })),
  ]);
  const unidades     = (uRes.Items || []) as unknown as Unidade[];
  const vagas        = (vRes.Items || []) as unknown as Vaga[];
  const preferenciais= (pRes.Items || []).filter(i => !i.SK.includes('HIST') && i.ativa) as unknown as Preferencial[];
  return { unidades, vagas, preferenciais };
}

async function preview(condoId: string) {
  const { unidades, vagas, preferenciais } = await loadCondoData(condoId);
  const prefUnids = new Set(preferenciais.map(p => p.unidadeId));
  const prefNums  = new Set(preferenciais.flatMap(p => p.vagasAtribuidas));

  const elegiveis   = unidades.filter(u => u.elegivel && !u.vagaFixa && !prefUnids.has(u.unidadeId));
  const fixas       = unidades.filter(u => u.vagaFixa);
  const prefList    = unidades.filter(u => prefUnids.has(u.unidadeId));
  const inelegiveis = unidades.filter(u => !u.elegivel && !u.vagaFixa);
  const vagasPool   = vagas.filter(v => v.tipo !== 'FIXA' && v.status !== 'FIXA' && v.status !== 'RESERVADA' && !prefNums.has(v.numero));
  const reservadas  = vagas.filter(v => v.status === 'RESERVADA');

  const warnings: string[] = [];
  if (elegiveis.length === 0) warnings.push('Nenhuma unidade elegível para o sorteio.');
  if (vagasPool.length === 0) warnings.push('Nenhuma vaga disponível para o sorteio.');
  const totalDireito = elegiveis.reduce((s, u) => s + u.direitoVagas, 0);
  if (vagasPool.length < totalDireito) warnings.push(`Vagas insuficientes: ${vagasPool.length} disponíveis, ${totalDireito} necessárias.`);

  return ok({ totalElegiveis: elegiveis.length, totalPreferenciais: prefList.length, totalInelegiveis: inelegiveis.length, totalFixas: fixas.length, vagasParaSorteio: vagasPool.length, vagasReservadas: reservadas.length, warnings });
}

async function executeSorteio(condoId: string, claims: ReturnType<typeof verifyClaims>, modo: 'TESTE' | 'OFICIAL') {
  const { unidades, vagas, preferenciais } = await loadCondoData(condoId);
  const prefMap  = Object.fromEntries(preferenciais.map(p => [p.unidadeId, p]));

  const timestamp = new Date().toISOString();
  const seed = (Date.now() ^ condoId.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) >>> 0;

  const atribuicoes: Record<string, SorteioAtribuicao> = {};

  // 1. Fixed spots
  unidades.filter(u => u.vagaFixa).forEach(u => {
    const fixedVagas = vagas.filter(v => v.unidadeId === u.unidadeId);
    atribuicoes[u.unidadeId] = { vagas: fixedVagas.map(v => v.numero), tipo: 'FIXA' };
  });

  // 2. Preferential
  preferenciais.forEach(p => {
    atribuicoes[p.unidadeId] = { vagas: p.vagasAtribuidas, tipo: 'PREFERENCIAL', tipoPref: p.tipoPref };
  });

  // 3. Build pool
  const usedNums = new Set([...preferenciais.flatMap(p => p.vagasAtribuidas), ...vagas.filter(v => v.tipo === 'FIXA' || v.status === 'FIXA').map(v => v.numero), ...vagas.filter(v => v.status === 'RESERVADA').map(v => v.numero)]);
  const pool = vagas.filter(v => !usedNums.has(v.numero) && v.tipo !== 'FIXA' && v.status !== 'FIXA' && v.status !== 'RESERVADA');

  // Separate pairs and singles
  const pairs: [number, number][] = [];
  const singles: number[] = [];
  const seenPairs = new Set<number>();
  for (const v of pool) {
    if (v.parVaga && pool.find(p => p.numero === v.parVaga) && !seenPairs.has(v.numero)) {
      pairs.push([v.numero, v.parVaga!]);
      seenPairs.add(v.numero); seenPairs.add(v.parVaga!);
    } else if (!seenPairs.has(v.numero) && (!v.parVaga || !pool.find(p => p.numero === v.parVaga))) {
      singles.push(v.numero);
    }
  }

  const { result: shuffledPairs }                  = shuffle(pairs,   seed);
  const { result: shuffledSingles, steps }         = shuffle(singles, seed + 1);
  const { result: eligible2 }                      = shuffle(unidades.filter(u => u.elegivel && !u.vagaFixa && !prefMap[u.unidadeId] && u.direitoVagas >= 2), seed + 2);
  const { result: eligible1 }                      = shuffle(unidades.filter(u => u.elegivel && !u.vagaFixa && !prefMap[u.unidadeId] && u.direitoVagas === 1), seed + 3);

  let pi = 0, si = 0;
  const vagasRestantes: number[] = [];

  for (const u of eligible2) {
    if (pi < shuffledPairs.length)      atribuicoes[u.unidadeId] = { vagas: shuffledPairs[pi++],      tipo: 'SORTEIO' };
    else if (si + 1 < shuffledSingles.length) atribuicoes[u.unidadeId] = { vagas: [shuffledSingles[si++], shuffledSingles[si++]], tipo: 'SORTEIO' };
    else atribuicoes[u.unidadeId] = { vagas: [], tipo: 'SEM_VAGA' };
  }
  for (const u of eligible1) {
    if (pi < shuffledPairs.length) { const pair = shuffledPairs[pi++]; atribuicoes[u.unidadeId] = { vagas: [pair[0]], tipo: 'SORTEIO' }; vagasRestantes.push(pair[1]); }
    else if (si < shuffledSingles.length) atribuicoes[u.unidadeId] = { vagas: [shuffledSingles[si++]], tipo: 'SORTEIO' };
    else atribuicoes[u.unidadeId] = { vagas: [], tipo: 'SEM_VAGA' };
  }
  while (pi < shuffledPairs.length) vagasRestantes.push(...shuffledPairs[pi++]);
  while (si < shuffledSingles.length) vagasRestantes.push(shuffledSingles[si++]);

  const naoElegiveis = unidades.filter(u => !u.elegivel && !u.vagaFixa && !prefMap[u.unidadeId]).map(u => u.unidadeId);
  const id = randomUUID();
  const result: Sorteio & Record<string, unknown> = {
    ...keys.sorteio(condoId, timestamp),
    id, condoId, timestamp, modo,
    executor:          claims.login,
    perfil:            claims.role,
    semente:           seed,
    passosFisherYates: steps,
    atribuicoes, naoElegiveis, vagasRestantes,
    // TTL: 7 days for test records
    expiresAt: modo === 'TESTE' ? Math.floor(Date.now() / 1000) + 7 * 86400 : undefined,
  };

  await db.send(new PutCommand({ TableName: TABLE, Item: result }));
  return ok(result);
}

async function listResultados(condoId: string) {
  const res = await db.send(new QueryCommand({
    TableName:                TABLE,
    KeyConditionExpression:   'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':pk': `COND#${condoId}`, ':prefix': 'SORTEIO#' },
    ScanIndexForward: false,   // descending (newest first)
  }));
  return ok(res.Items || []);
}

async function getResultado(condoId: string, sorteioId: string) {
  // sorteioId may be the UUID — scan to find matching record
  const res = await db.send(new QueryCommand({
    TableName:                TABLE,
    KeyConditionExpression:   'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':pk': `COND#${condoId}`, ':prefix': 'SORTEIO#' },
  }));
  const item = (res.Items || []).find(i => i.id === sorteioId);
  if (!item) return errorResponse({ statusCode: 404, message: 'Resultado não encontrado' });
  return ok(item);
}

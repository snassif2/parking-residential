import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { GetCommand, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE }        from '../shared/db/client';
import { keys }             from '../shared/db/keys';
import { verifyClaims, requireRole, requireCondoAccess } from '../shared/auth/verify-claims';
import { ok, created, noContent, notFound, badRequest, errorResponse } from '../shared/utils/response';
import type { Preferencial } from '../shared/models/types';
import { randomUUID }        from 'crypto';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const claims  = verifyClaims(event);
  const method  = event.requestContext.http.method;
  const path    = event.rawPath;
  const condoId = path.match(/\/condominios\/([^/]+)/)?.[1];

  if (!condoId) return errorResponse({ statusCode: 400, message: 'condoId missing' });

  try {
    requireCondoAccess(claims, condoId);

    if (method === 'GET'  && /\/preferenciais$/.test(path)) return await listPreferenciais(condoId);
    if (method === 'POST' && /\/preferenciais$/.test(path)) {
      requireRole(claims, 'admin', 'sindico');
      return await createPreferencial(condoId, event, claims);
    }

    const m = path.match(/\/preferenciais\/([^/]+)$/);
    if (m) {
      const prefId = m[1];
      requireRole(claims, 'admin', 'sindico');
      if (method === 'GET')    return await getPreferencial(condoId, prefId);
      if (method === 'PUT')    return await updatePreferencial(condoId, prefId, event);
      if (method === 'DELETE') return await revokePreferencial(condoId, prefId, event, claims);
    }

    return errorResponse({ statusCode: 404, message: 'Not found' });
  } catch (err) {
    return errorResponse(err);
  }
};

async function listPreferenciais(condoId: string) {
  const res = await db.send(new QueryCommand({
    TableName:                TABLE,
    KeyConditionExpression:   'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':pk': `COND#${condoId}`, ':prefix': 'PREF#' },
  }));
  // Separate active records from history
  const items  = (res.Items || []).filter(i => !i.SK.includes('HIST'));
  return ok(items);
}

async function getPreferencial(condoId: string, prefId: string) {
  // prefId may be unidadeId or a UUID — scan to find
  const res = await db.send(new QueryCommand({
    TableName:                TABLE,
    KeyConditionExpression:   'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':pk': `COND#${condoId}`, ':prefix': 'PREF#' },
  }));
  const item = (res.Items || []).find(i => i.id === prefId && !i.SK.includes('HIST'));
  if (!item) return notFound();
  return ok(item);
}

async function createPreferencial(condoId: string, event: APIGatewayProxyEventV2WithJWTAuthorizer, claims: ReturnType<typeof verifyClaims>) {
  const body = JSON.parse(event.body || '{}');
  if (!body.unidadeId || !body.tipoPref || !body.vagasAtribuidas) return badRequest('unidadeId, tipoPref, vagasAtribuidas required');

  // Check for existing active preferencial on this unit
  const existing = await db.send(new GetCommand({ TableName: TABLE, Key: keys.preferencial(condoId, body.unidadeId) }));
  if (existing.Item?.ativa) return errorResponse({ statusCode: 409, message: 'Unidade já possui atribuição preferencial ativa' });

  const id  = randomUUID();
  const [torre, numero] = body.unidadeId.split('#');
  const item: Preferencial & Record<string, unknown> = {
    ...keys.preferencial(condoId, body.unidadeId),
    id,
    condoId,
    unidadeId:      body.unidadeId,
    torre,
    numero,
    tipoPref:       body.tipoPref,
    documento:      body.documento  || null,
    vagasAtribuidas:body.vagasAtribuidas,
    dataInicio:     body.dataInicio || new Date().toISOString().slice(0, 10),
    dataValidade:   body.dataValidade || null,
    responsavel:    claims.login,
    obs:            body.obs || null,
    ativa:          true,
    criadoEm:       new Date().toISOString(),
  };

  await db.send(new PutCommand({ TableName: TABLE, Item: item }));
  return created(item);
}

async function updatePreferencial(condoId: string, prefId: string, event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const body = JSON.parse(event.body || '{}');
  // Find by id
  const res  = await db.send(new QueryCommand({
    TableName:                TABLE,
    KeyConditionExpression:   'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':pk': `COND#${condoId}`, ':prefix': 'PREF#' },
  }));
  const current = (res.Items || []).find(i => i.id === prefId && !i.SK.includes('HIST'));
  if (!current) return notFound();

  const updated = { ...current, ...body, id: prefId, condoId };
  await db.send(new PutCommand({ TableName: TABLE, Item: updated }));
  return ok(updated);
}

async function revokePreferencial(condoId: string, prefId: string, event: APIGatewayProxyEventV2WithJWTAuthorizer, claims: ReturnType<typeof verifyClaims>) {
  const body = JSON.parse(event.body || '{}');
  if (!body.justificativa) return badRequest('justificativa is required');

  const res = await db.send(new QueryCommand({
    TableName:                TABLE,
    KeyConditionExpression:   'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':pk': `COND#${condoId}`, ':prefix': 'PREF#' },
  }));
  const current = (res.Items || []).find(i => i.id === prefId && !i.SK.includes('HIST'));
  if (!current) return notFound();

  const ts      = new Date().toISOString();
  const revoked = { ...current, ativa: false, revokedEm: ts, justificativa: body.justificativa, responsavel: claims.login };
  await db.send(new PutCommand({ TableName: TABLE, Item: revoked }));

  // Write audit trail
  await db.send(new PutCommand({
    TableName: TABLE,
    Item: { ...keys.prefHist(condoId, ts), ...revoked, tipo: 'REVOGACAO' },
  }));

  return ok(revoked);
}

import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { GetCommand, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE }      from '../shared/db/client';
import { keys, gsi }      from '../shared/db/keys';
import { verifyClaims, requireRole, requireCondoAccess } from '../shared/auth/verify-claims';
import { ok, created, noContent, notFound, badRequest, errorResponse } from '../shared/utils/response';
import type { Vaga }      from '../shared/models/types';
import { randomUUID }     from 'crypto';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const claims  = verifyClaims(event);
  const method  = event.requestContext.http.method;
  const path    = event.rawPath;
  const condoId = path.match(/\/condominios\/([^/]+)/)?.[1];

  if (!condoId) return errorResponse({ statusCode: 400, message: 'condoId missing' });

  try {
    requireCondoAccess(claims, condoId);

    if (method === 'GET' && /\/vagas$/.test(path))  return await listVagas(condoId);
    if (method === 'POST' && /\/vagas$/.test(path)) {
      requireRole(claims, 'admin', 'sindico');
      return await createVaga(condoId, event);
    }

    const m = path.match(/\/vagas\/([^/]+)$/);
    if (m) {
      const vagaId = m[1];
      if (method === 'GET')    return await getVaga(condoId, vagaId);
      if (method === 'PUT')    { requireRole(claims, 'admin', 'sindico'); return await updateVaga(condoId, vagaId, event); }
      if (method === 'DELETE') { requireRole(claims, 'admin', 'sindico'); return await deleteVaga(condoId, vagaId); }
    }

    return errorResponse({ statusCode: 404, message: 'Not found' });
  } catch (err) {
    return errorResponse(err);
  }
};

async function listVagas(condoId: string) {
  const res = await db.send(new QueryCommand({
    TableName:                TABLE,
    KeyConditionExpression:   'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':pk': `COND#${condoId}`, ':prefix': 'VAGA#' },
  }));
  return ok(res.Items || []);
}

async function getVaga(condoId: string, vagaId: string) {
  const res = await db.send(new GetCommand({ TableName: TABLE, Key: keys.vaga(condoId, vagaId) }));
  if (!res.Item) return notFound();
  return ok(res.Item);
}

async function createVaga(condoId: string, event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const body = JSON.parse(event.body || '{}');
  if (!body.numero || !body.andar) return badRequest('numero and andar required');

  const id   = randomUUID();
  const item: Vaga & Record<string, unknown> = {
    ...keys.vaga(condoId, id),
    id,
    condoId,
    numero:     body.numero,
    andar:      body.andar,
    parVaga:    body.parVaga || null,
    torre:      body.torre  || null,
    tipo:       body.tipo   || 'COMUM',
    status:     body.status || 'LIVRE',
    localizacao:body.localizacao || null,
    unidadeId:  body.unidadeId  || null,
    // GSI3
    ...gsi.vagaStatus(condoId, body.status || 'LIVRE', id),
  };

  await db.send(new PutCommand({ TableName: TABLE, Item: item }));
  return created(item);
}

async function updateVaga(condoId: string, vagaId: string, event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const body = JSON.parse(event.body || '{}');
  const res  = await db.send(new GetCommand({ TableName: TABLE, Key: keys.vaga(condoId, vagaId) }));
  if (!res.Item) return notFound();

  const updated = {
    ...res.Item,
    ...body,
    id: vagaId,
    condoId,
    // Refresh GSI3 if status changed
    ...gsi.vagaStatus(condoId, body.status || res.Item.status, vagaId),
  };
  await db.send(new PutCommand({ TableName: TABLE, Item: updated }));
  return ok(updated);
}

async function deleteVaga(condoId: string, vagaId: string) {
  const res = await db.send(new GetCommand({ TableName: TABLE, Key: keys.vaga(condoId, vagaId) }));
  if (!res.Item) return notFound();
  await db.send(new DeleteCommand({ TableName: TABLE, Key: keys.vaga(condoId, vagaId) }));
  return noContent();
}

import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { GetCommand, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE }      from '../shared/db/client';
import { keys, gsi }      from '../shared/db/keys';
import { verifyClaims, requireRole, requireCondoAccess } from '../shared/auth/verify-claims';
import { ok, created, noContent, notFound, badRequest, errorResponse } from '../shared/utils/response';
import type { Unidade }   from '../shared/models/types';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const claims  = verifyClaims(event);
  const method  = event.requestContext.http.method;
  const path    = event.rawPath;
  const condoId = path.match(/\/condominios\/([^/]+)/)?.[1];

  if (!condoId) return errorResponse({ statusCode: 400, message: 'condoId missing' });

  try {
    requireCondoAccess(claims, condoId);

    // GET /condominios/{id}/unidades
    if (method === 'GET' && /\/unidades$/.test(path)) return await listUnidades(condoId);

    // POST /condominios/{id}/unidades
    if (method === 'POST' && /\/unidades$/.test(path)) {
      requireRole(claims, 'admin', 'sindico');
      return await createUnidade(condoId, event);
    }

    // GET|PUT|DELETE /condominios/{id}/unidades/{uid}
    const m = path.match(/\/unidades\/([^/]+)$/);
    if (m) {
      const unidadeId = decodeURIComponent(m[1]);
      if (method === 'GET')    return await getUnidade(condoId, unidadeId);
      if (method === 'PUT')    { requireRole(claims, 'admin', 'sindico'); return await updateUnidade(condoId, unidadeId, event); }
      if (method === 'DELETE') { requireRole(claims, 'admin', 'sindico'); return await deleteUnidade(condoId, unidadeId); }
    }

    return errorResponse({ statusCode: 404, message: 'Not found' });
  } catch (err) {
    return errorResponse(err);
  }
};

async function listUnidades(condoId: string) {
  const res = await db.send(new QueryCommand({
    TableName:                TABLE,
    KeyConditionExpression:   'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':pk': `COND#${condoId}`, ':prefix': 'UNID#' },
  }));
  return ok(res.Items || []);
}

async function getUnidade(condoId: string, unidadeId: string) {
  const res = await db.send(new GetCommand({ TableName: TABLE, Key: keys.unidade(condoId, unidadeId) }));
  if (!res.Item) return notFound();
  return ok(res.Item);
}

async function createUnidade(condoId: string, event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const body = JSON.parse(event.body || '{}');
  if (!body.torre || !body.numero) return badRequest('torre and numero required');

  const unidadeId = `${body.torre}#${body.numero}`;
  const existing  = await db.send(new GetCommand({ TableName: TABLE, Key: keys.unidade(condoId, unidadeId) }));
  if (existing.Item) return errorResponse({ statusCode: 409, message: 'Unidade já existe' });

  const item: Unidade & Record<string, unknown> = {
    ...keys.unidade(condoId, unidadeId),
    unidadeId,
    torre:              body.torre,
    numero:             body.numero,
    andar:              body.andar,
    condoId,
    direitoVagas:       body.direitoVagas || 1,
    elegivel:           body.elegivel ?? true,
    obsInelegibilidade: body.obsInelegibilidade || null,
    vagaFixa:           body.vagaFixa ?? false,
    preferencial:       body.preferencial ?? false,
    // GSI1
    ...gsi.userInCondo(condoId, unidadeId),
  };

  await db.send(new PutCommand({ TableName: TABLE, Item: item }));
  return created(item);
}

async function updateUnidade(condoId: string, unidadeId: string, event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const body = JSON.parse(event.body || '{}');
  const res  = await db.send(new GetCommand({ TableName: TABLE, Key: keys.unidade(condoId, unidadeId) }));
  if (!res.Item) return notFound();

  const updated = { ...res.Item, ...body, unidadeId, condoId };
  await db.send(new PutCommand({ TableName: TABLE, Item: updated }));
  return ok(updated);
}

async function deleteUnidade(condoId: string, unidadeId: string) {
  const res = await db.send(new GetCommand({ TableName: TABLE, Key: keys.unidade(condoId, unidadeId) }));
  if (!res.Item) return notFound();
  await db.send(new DeleteCommand({ TableName: TABLE, Key: keys.unidade(condoId, unidadeId) }));
  return noContent();
}

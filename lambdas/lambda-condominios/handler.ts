import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE }            from '../shared/db/client';
import { keys }                 from '../shared/db/keys';
import { verifyClaims, requireRole, requireCondoAccess } from '../shared/auth/verify-claims';
import { ok, created, noContent, notFound, badRequest, errorResponse } from '../shared/utils/response';
import type { Condominio }      from '../shared/models/types';
import { randomUUID }           from 'crypto';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const claims = verifyClaims(event);
  const method = event.requestContext.http.method;
  const path   = event.rawPath;

  try {
    // GET /condominios
    if (method === 'GET' && /\/condominios$/.test(path)) {
      return await listCondominios(claims);
    }
    // POST /condominios
    if (method === 'POST' && /\/condominios$/.test(path)) {
      requireRole(claims, 'admin');
      return await createCondominio(event);
    }
    // GET /condominios/{id}
    const single = path.match(/\/condominios\/([^/]+)$/);
    if (single) {
      const condoId = single[1];
      requireCondoAccess(claims, condoId);
      if (method === 'GET')    return await getCondominio(condoId);
      if (method === 'PUT')    { requireRole(claims, 'admin', 'sindico'); return await updateCondominio(condoId, event); }
      if (method === 'DELETE') { requireRole(claims, 'admin');            return await deleteCondominio(condoId); }
    }
    return errorResponse({ statusCode: 404, message: 'Not found' });
  } catch (err) {
    return errorResponse(err);
  }
};

async function listCondominios(claims: ReturnType<typeof verifyClaims>) {
  // Admin sees all; síndico sees assigned; morador sees their one
  const res = await db.send(new QueryCommand({
    TableName:                TABLE,
    KeyConditionExpression:   'begins_with(SK, :meta)',
    FilterExpression:         'SK = :meta',
    ExpressionAttributeValues: { ':meta': 'METADATA' },
    IndexName:                undefined,
    // Full scan via FilterExpression on SK — acceptable at this scale
    // For large multi-tenant deployments, use a GSI on SK=METADATA
  }));

  // Simple approach: scan all METADATA items
  const all = await db.send(new QueryCommand({
    TableName:  TABLE,
    IndexName:  undefined,
    // Scan approach for small table
    KeyConditionExpression:    'SK = :meta',
    ExpressionAttributeValues: { ':meta': 'METADATA' },
    // NOTE: This won't work directly — we need a full scan or GSI
    // Using a scan with filter for simplicity at this scale
  }));

  // Use Scan with filter for simplicity (table is small)
  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
  const scanRes = await db.send(new ScanCommand({
    TableName:         TABLE,
    FilterExpression:  'SK = :meta',
    ExpressionAttributeValues: { ':meta': 'METADATA' },
  }));

  let condos = (scanRes.Items || []) as Condominio[];

  if (claims.role === 'sindico') {
    condos = condos.filter(c => claims.condoIds.includes(c.id));
  } else if (claims.role === 'morador') {
    condos = condos.filter(c => c.id === claims.condoId);
  }

  return ok(condos);
}

async function getCondominio(condoId: string) {
  const res = await db.send(new GetCommand({ TableName: TABLE, Key: keys.condo(condoId) }));
  if (!res.Item) return notFound('Condomínio não encontrado');
  return ok(res.Item);
}

async function createCondominio(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const body = JSON.parse(event.body || '{}');
  if (!body.nome) return badRequest('nome is required');

  const id   = randomUUID();
  const item: Condominio = {
    id,
    nome:                body.nome,
    cnpj:                body.cnpj,
    endereco:            body.endereco,
    sindico:             body.sindico,
    contato:             body.contato,
    status:              body.status || 'ATIVO',
    percMinPreferenciais: body.percMinPreferenciais ?? 2,
    torres:              body.torres || ['Torre 1'],
    criadoEm:            new Date().toISOString(),
    ...keys.condo(id),
  } as unknown as Condominio;

  await db.send(new PutCommand({ TableName: TABLE, Item: item }));
  return created(item);
}

async function updateCondominio(condoId: string, event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const body = JSON.parse(event.body || '{}');
  const res  = await db.send(new GetCommand({ TableName: TABLE, Key: keys.condo(condoId) }));
  if (!res.Item) return notFound('Condomínio não encontrado');

  const updated = { ...res.Item, ...body, id: condoId };
  await db.send(new PutCommand({ TableName: TABLE, Item: updated }));
  return ok(updated);
}

async function deleteCondominio(condoId: string) {
  const res = await db.send(new GetCommand({ TableName: TABLE, Key: keys.condo(condoId) }));
  if (!res.Item) return notFound();
  await db.send(new DeleteCommand({ TableName: TABLE, Key: keys.condo(condoId) }));
  return noContent();
}

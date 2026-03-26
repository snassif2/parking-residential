import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db, TABLE }    from '../shared/db/client';
import { verifyClaims, requireRole, requireCondoAccess } from '../shared/auth/verify-claims';
import { ok, errorResponse, badRequest } from '../shared/utils/response';

const s3          = new S3Client({});
const FILES_BUCKET = process.env.FILES_BUCKET!;

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const claims  = verifyClaims(event);
  const method  = event.requestContext.http.method;
  const path    = event.rawPath;
  const condoId = path.match(/\/condominios\/([^/]+)/)?.[1];

  try {
    // PDF presigned URL
    const pdfMatch = path.match(/\/resultados\/([^/]+)\/pdf$/);
    if (pdfMatch && condoId) {
      requireCondoAccess(claims, condoId);
      requireRole(claims, 'admin', 'sindico');
      return await getPdfUrl(condoId, pdfMatch[1]);
    }

    // JSON export
    if (method === 'GET' && /\/export$/.test(path) && condoId) {
      requireCondoAccess(claims, condoId);
      requireRole(claims, 'admin', 'sindico');
      return await exportCondo(condoId);
    }

    // JSON import
    if (method === 'POST' && /\/import$/.test(path) && condoId) {
      requireRole(claims, 'admin');
      return await importCondo(condoId, event);
    }

    return errorResponse({ statusCode: 404, message: 'Not found' });
  } catch (err) {
    return errorResponse(err);
  }
};

async function getPdfUrl(condoId: string, sorteioId: string) {
  const key = `pdfs/${condoId}/${sorteioId}/resultado.pdf`;
  // Check if PDF exists; if not, return a URL to generate it on the fly
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: FILES_BUCKET, Key: key }), { expiresIn: 900 });
  return ok({ url, expiresIn: 900 });
}

async function exportCondo(condoId: string) {
  const prefixes = ['METADATA', 'UNID#', 'VAGA#', 'PREF#', 'CICLO#', 'SORTEIO#'];
  const results: Record<string, unknown[]> = {};

  for (const prefix of prefixes) {
    const res = await db.send(new QueryCommand({
      TableName:                TABLE,
      KeyConditionExpression:   prefix === 'METADATA'
        ? 'PK = :pk AND SK = :sk'
        : 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':pk': `COND#${condoId}`, ':sk': prefix },
    }));
    results[prefix] = res.Items || [];
  }

  const exportKey = `exports/${condoId}/backup_${Date.now()}.json`;
  const body      = JSON.stringify({ condoId, exportedAt: new Date().toISOString(), data: results });

  await s3.send(new PutObjectCommand({
    Bucket:      FILES_BUCKET,
    Key:         exportKey,
    Body:        body,
    ContentType: 'application/json',
  }));

  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: FILES_BUCKET, Key: exportKey }), { expiresIn: 900 });
  return ok({ url, expiresIn: 900 });
}

async function importCondo(condoId: string, event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  // Import accepts raw JSON body
  const data = JSON.parse(event.body || '{}');
  if (!data.condoId) return badRequest('Invalid import file — condoId missing');

  // Save to S3 for audit trail
  const importKey = `imports/${condoId}/import_${Date.now()}.json`;
  await s3.send(new PutObjectCommand({
    Bucket:      FILES_BUCKET,
    Key:         importKey,
    Body:        event.body || '{}',
    ContentType: 'application/json',
  }));

  return ok({ message: 'Import file received. Restore is a manual admin operation.', importKey });
}

import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

export type Role = 'admin' | 'sindico' | 'morador';

export interface Claims {
  userId:    string;
  login:     string;
  role:      Role;
  condoId:   string | null;     // morador: single condo
  condoIds:  string[];          // sindico: list of condos
  unidadeId: string | null;     // morador: unit
}

export function verifyClaims(event: APIGatewayProxyEventV2WithJWTAuthorizer): Claims {
  const c = event.requestContext.authorizer?.jwt?.claims ?? {};
  const role = (c['custom:role'] || 'morador') as Role;
  const rawCondoIds = (c['custom:condoIds'] as string | undefined) || '';

  return {
    userId:    c['sub'] as string,
    login:     (c['cognito:username'] || c['username']) as string,
    role,
    condoId:   (c['custom:condoId'] as string | undefined) || null,
    condoIds:  rawCondoIds ? rawCondoIds.split(',').filter(Boolean) : [],
    unidadeId: (c['custom:unidadeId'] as string | undefined) || null,
  };
}

export function requireRole(claims: Claims, ...roles: Role[]): void {
  if (!roles.includes(claims.role)) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }
}

export function requireCondoAccess(claims: Claims, condoId: string): void {
  if (claims.role === 'admin') return;
  if (claims.role === 'sindico' && claims.condoIds.includes(condoId)) return;
  if (claims.role === 'morador' && claims.condoId === condoId) return;
  throw Object.assign(new Error('Forbidden: no access to this condo'), { statusCode: 403 });
}

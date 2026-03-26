export function ok(body: unknown, statusCode = 200) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

export function created(body: unknown) { return ok(body, 201); }

export function noContent() {
  return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
}

export function errorResponse(err: unknown) {
  const e = err as { statusCode?: number; message?: string };
  const status = e.statusCode || 500;
  const message = e.message || 'Internal server error';
  console.error('[ERROR]', status, message, err);
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: message }),
  };
}

export function notFound(msg = 'Not found') {
  return errorResponse({ statusCode: 404, message: msg });
}

export function badRequest(msg: string) {
  return errorResponse({ statusCode: 400, message: msg });
}

export interface Env {
  DB?: unknown;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: JSON_HEADERS });
}

function handleOptions(): Response {
  return new Response(null, { status: 204, headers: JSON_HEADERS });
}

function handleHealth(): Response {
  return json({ ok: true, data: { service: 'fangdi-mobile-api', status: 'ok' } });
}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const method = request.method;

    if (method === 'OPTIONS') {
      return handleOptions();
    }

    if (pathname === '/api/health' && method === 'GET') {
      return handleHealth();
    }

    return json({ error: 'Not found' }, 404);
  },
};

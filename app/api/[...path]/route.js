// Server-side proxy to adbox-server. Every dashboard request flows through here
// so the shared ADMIN_API_KEY stays on the server and is never bundled into
// client JavaScript.
const API_ORIGIN = (process.env.ADBOX_API_ORIGIN || 'http://localhost:8788').replace(/\/$/, '');
const ADMIN_KEY = process.env.ADBOX_ADMIN_API_KEY || '';

// Only the admin surface is proxied. The device endpoints authenticate with
// per-box keys and must never be reachable through the dashboard session.
const ALLOWED_PREFIXES = ['boxes', 'provisioning-codes', 'media', 'campaigns', 'boundaries', 'telemetry'];

function reject(message, status = 400) {
  return Response.json({ message }, { status });
}

async function proxy(request, context) {
  if (!ADMIN_KEY) return reject('ADBOX_ADMIN_API_KEY is not configured on the dashboard server.', 503);

  const { path = [] } = await context.params;
  if (!ALLOWED_PREFIXES.includes(path[0])) return reject(`Endpoint /api/${path.join('/')} is not proxied.`, 404);

  const search = new URL(request.url).search;
  const target = `${API_ORIGIN}/api/${path.map(encodeURIComponent).join('/')}${search}`;

  const headers = { 'x-admin-key': ADMIN_KEY };
  const contentType = request.headers.get('content-type');
  // Multipart uploads must keep their original boundary, so the body streams through as-is.
  if (contentType) headers['content-type'] = contentType;

  const hasBody = !['GET', 'HEAD'].includes(request.method);

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      signal: AbortSignal.timeout(60_000),
      cache: 'no-store'
    });

    return new Response(response.body, {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') || 'application/json' }
    });
  } catch (error) {
    return reject(`Control plane unreachable at ${API_ORIGIN}: ${error.message}`, 502);
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;

export const dynamic = 'force-dynamic';

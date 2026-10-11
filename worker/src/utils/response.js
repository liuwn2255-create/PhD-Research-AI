export function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  })
}

export function corsHeaders(request, env) {
  const origin = request.headers.get('Origin')
  const allowlist = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim().replace(/\/$/, ''))
    .filter(Boolean)
  const headers = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
  if (origin && allowlist.includes(origin.replace(/\/$/, ''))) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

export function errorResponse(request, env, status, code, message) {
  return jsonResponse({ ok: false, error: { code, message } }, status, corsHeaders(request, env))
}

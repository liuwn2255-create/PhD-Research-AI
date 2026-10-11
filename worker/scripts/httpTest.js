import assert from 'node:assert/strict'

const baseUrl = (process.env.WORKER_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '')
const allowedOrigin = 'http://localhost:5173'
const deniedOrigin = 'https://unlisted.example'

async function json(response, label) {
  const contentType = response.headers.get('Content-Type') || ''
  assert.match(contentType, /application\/json/i, `${label} must return JSON`)
  return response.json()
}

const healthResponse = await fetch(`${baseUrl}/api/health`, {
  headers: { Origin: allowedOrigin },
  signal: AbortSignal.timeout(10000),
})
assert.equal(healthResponse.status, 200, 'health endpoint should return HTTP 200')
assert.equal(healthResponse.headers.get('Access-Control-Allow-Origin'), allowedOrigin)
const health = await json(healthResponse, 'health endpoint')
assert.deepEqual(health, { ok: true, service: 'phd-research-ai-worker' })
console.log('PASS HTTP GET /api/health:', JSON.stringify(health))

const deniedCorsResponse = await fetch(`${baseUrl}/api/health`, {
  headers: { Origin: deniedOrigin },
  signal: AbortSignal.timeout(10000),
})
assert.equal(deniedCorsResponse.status, 200)
assert.equal(deniedCorsResponse.headers.get('Access-Control-Allow-Origin'), null)
console.log('PASS HTTP CORS: unlisted Origin receives no Access-Control-Allow-Origin header')

const invalidResponse = await fetch(`${baseUrl}/api/literature/search?q=&limit=5`, {
  headers: { Origin: allowedOrigin },
  signal: AbortSignal.timeout(10000),
})
assert.equal(invalidResponse.status, 400)
const invalidBody = await json(invalidResponse, 'invalid query response')
assert.equal(invalidBody.ok, false)
assert.equal(invalidBody.error.code, 'MISSING_QUERY')
console.log('PASS HTTP invalid query: HTTP 400 MISSING_QUERY')

const searchUrl = new URL('/api/literature/search', baseUrl)
searchUrl.search = new URLSearchParams({
  q: 'artificial intelligence education',
  fromYear: '2021',
  toYear: '2026',
  limit: '5',
})
let searchResponse
try {
  searchResponse = await fetch(searchUrl, {
    headers: { Origin: allowedOrigin },
    signal: AbortSignal.timeout(20000),
  })
} catch (error) {
  console.error(`::error title=Crossref upstream/environment failure::Search request failed: ${error.message}`)
  throw error
}
const searchBody = await json(searchResponse, 'literature search response')
if (!searchResponse.ok) {
  const message = searchBody?.error?.message || `HTTP ${searchResponse.status}`
  const upstreamCodes = new Set(['UPSTREAM_TIMEOUT', 'UPSTREAM_UNAVAILABLE', 'UPSTREAM_ERROR', 'INVALID_UPSTREAM_RESPONSE'])
  const failureKind = upstreamCodes.has(searchBody?.error?.code) ? 'Crossref upstream/environment failure' : 'Worker HTTP failure'
  console.error(`::error title=${failureKind}::${message} (${searchBody?.error?.code || 'UNKNOWN'})`)
  throw new Error(`${failureKind}; this search was not passed: ${message}`)
}

assert.equal(searchBody.ok, true)
assert.equal(searchBody.source, 'crossref')
assert.equal(searchBody.query, 'artificial intelligence education')
assert.ok(Number.isInteger(searchBody.total) && searchBody.total > 0, 'Crossref should report matching works')
assert.ok(Array.isArray(searchBody.items) && searchBody.items.length > 0 && searchBody.items.length <= 5)
for (const item of searchBody.items) {
  assert.equal(item.source, 'crossref')
  assert.equal(item.verified, true)
  assert.ok(Array.isArray(item.authors))
  if (item.year !== null) assert.ok(item.year >= 2021 && item.year <= 2026)
  if (item.doi) assert.equal(item.url, `https://doi.org/${item.doi}`)
}
console.log(`PASS HTTP Crossref search: total=${searchBody.total}, returned=${searchBody.items.length}`)
console.log(JSON.stringify(searchBody.items.slice(0, 3).map(({ title, authors, year, doi, url }) => ({ title, authors, year, doi, url })), null, 2))

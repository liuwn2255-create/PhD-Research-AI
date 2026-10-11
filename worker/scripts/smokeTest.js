import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import worker from '../src/index.js'
import { normalizeCrossrefWork } from '../src/services/literatureNormalizer.js'

const pagesOrigin = 'https://liuwn2255-create.github.io'
const localOrigin = 'http://localhost:5173'
const configText = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8')
const configuredOrigins = configText.match(/^ALLOWED_ORIGINS\s*=\s*"([^"]*)"/m)?.[1]?.split(',') || []
const expectedOrigins = [pagesOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173']
assert.deepEqual(configuredOrigins, expectedOrigins)
const env = {
  ALLOWED_ORIGINS: configuredOrigins.join(','),
  REQUEST_TIMEOUT_MS: configText.match(/^REQUEST_TIMEOUT_MS\s*=\s*"(\d+)"/m)?.[1] || '8000',
}

async function request(path, origin = localOrigin) {
  return worker.fetch(new Request(`http://worker.local${path}`, {
    headers: origin ? { Origin: origin } : {},
  }), env)
}

async function requireSearchSuccess(response, label) {
  const body = await response.json()
  if (!response.ok) {
    const code = body?.error?.code || 'UNKNOWN'
    const message = body?.error?.message || `HTTP ${response.status}`
    const upstreamCodes = new Set(['UPSTREAM_TIMEOUT', 'UPSTREAM_UNAVAILABLE', 'UPSTREAM_ERROR', 'INVALID_UPSTREAM_RESPONSE'])
    const category = upstreamCodes.has(code) ? 'Crossref upstream/environment failure' : 'Worker search failure'
    console.error(`::error title=${category}::${label}: ${message} (${code})`)
    throw new Error(`${category}; ${label} did not pass: ${message}`)
  }
  return body
}

const healthResponse = await request('/api/health')
assert.equal(healthResponse.status, 200)
assert.equal(healthResponse.headers.get('Access-Control-Allow-Origin'), localOrigin)
const health = await healthResponse.json()
assert.deepEqual(health, { ok: true, service: 'phd-research-ai-worker' })
console.log('PASS /api/health:', JSON.stringify(health))

for (const origin of expectedOrigins) {
  const preflight = await worker.fetch(new Request('http://worker.local/api/health', {
    method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' },
  }), env)
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin)
  assert.equal(preflight.headers.get('Access-Control-Allow-Methods'), 'GET, POST, OPTIONS')
}
const unlistedPreflight = await worker.fetch(new Request('http://worker.local/api/health', {
  method: 'OPTIONS', headers: { Origin: 'https://unlisted.example', 'Access-Control-Request-Method': 'GET' },
}), env)
assert.equal(unlistedPreflight.headers.get('Access-Control-Allow-Origin'), null)
console.log('PASS CORS: exact Pages origin and localhost allowed; unlisted origin denied')

const legacyResponse = await worker.fetch(new Request('http://worker.local/api/literature/search', {
  method: 'POST',
  headers: { Origin: localOrigin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'artificial intelligence education', yearFrom: 2021, yearTo: 2026, limit: 1 }),
}), env)
const legacy = await requireSearchSuccess(legacyResponse, 'legacy POST compatibility search')
assert.equal(legacy.ok, true)
assert.ok(legacy.items.length <= 1)
if (legacy.items[0]) {
  assert.equal(typeof legacy.items[0].authors, 'string')
  assert.ok(legacy.items[0].providerSource === 'crossref')
  assert.ok(legacy.items[0].statusLabel)
}
console.log('PASS existing frontend compatibility: legacy POST shape remains supported')

const invalidResponse = await request('/api/literature/search?q=&limit=5')
assert.equal(invalidResponse.status, 400)
assert.equal((await invalidResponse.json()).error.code, 'MISSING_QUERY')
console.log('PASS input validation: empty q rejected')

const malformedBodyResponse = await worker.fetch(new Request('http://worker.local/api/literature/search', {
  method: 'POST', headers: { Origin: localOrigin, 'Content-Type': 'application/json' }, body: '{invalid json',
}), env)
assert.equal(malformedBodyResponse.status, 400)
assert.equal((await malformedBodyResponse.json()).error.code, 'INVALID_REQUEST_BODY')
console.log('PASS POST validation: malformed JSON rejected')

for (const [path, code] of [
  ['/api/literature/search?q=topic&limit=101', 'INVALID_LIMIT'],
  ['/api/literature/search?q=topic&fromYear=1899', 'INVALID_YEAR'],
  ['/api/literature/search?q=topic&fromYear=2026&toYear=2021', 'INVALID_YEAR_RANGE'],
  [`/api/literature/search?q=${'x'.repeat(301)}`, 'QUERY_TOO_LONG'],
]) {
  const response = await request(path)
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error.code, code)
}
console.log('PASS input validation: limit, years, and query length rejected when invalid')

assert.deepEqual(normalizeCrossrefWork({}), {
  id: '', title: '', authors: [], year: null, journal: '', publisher: '', doi: '', url: '',
  abstract: '', type: '', language: null, source: 'crossref', sourceUrl: '', verified: true,
})
const sparseWork = normalizeCrossrefWork({ URL: 'https://api.crossref.org/works/no-doi', created: { 'date-parts': [[2026, 1, 1]] } })
assert.deepEqual(sparseWork.authors, [])
assert.equal(sparseWork.year, null)
assert.equal(sparseWork.doi, '')
assert.equal(sparseWork.url, 'https://api.crossref.org/works/no-doi')
assert.equal(normalizeCrossrefWork({ DOI: 'https://doi.org/10.TEST/Example' }).doi, '10.TEST/Example')
console.log('PASS normalization: missing metadata stays empty/null; DOI URL prefix is removed')

const originalFetch = globalThis.fetch
try {
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  })
  const timeoutEnv = { ...env, REQUEST_TIMEOUT_MS: '1000' }
  const timeoutResponse = await worker.fetch(new Request('http://worker.local/api/literature/search?q=timeout'), timeoutEnv)
  assert.equal(timeoutResponse.status, 504)
  const timeoutBody = await timeoutResponse.json()
  assert.equal(timeoutBody.ok, false)
  assert.equal(timeoutBody.error.code, 'UPSTREAM_TIMEOUT')
  console.log('PASS timeout handling: stalled Crossref request returns 504 JSON')

  globalThis.fetch = async () => { throw new Error('network failure') }
  const networkErrorResponse = await worker.fetch(new Request('http://worker.local/api/literature/search?q=network'), env)
  assert.equal(networkErrorResponse.status, 502)
  assert.equal((await networkErrorResponse.json()).error.code, 'UPSTREAM_UNAVAILABLE')
  console.log('PASS network error handling: failed fetch returns 502 JSON')

  globalThis.fetch = async () => new Response('upstream unavailable', { status: 503 })
  const upstreamErrorResponse = await worker.fetch(new Request('http://worker.local/api/literature/search?q=upstream'), env)
  assert.equal(upstreamErrorResponse.status, 502)
  assert.equal((await upstreamErrorResponse.json()).error.code, 'UPSTREAM_ERROR')
  console.log('PASS upstream status handling: Crossref 503 maps to 502 JSON')

  globalThis.fetch = async () => new Response('not json', { status: 200 })
  const invalidJsonResponse = await worker.fetch(new Request('http://worker.local/api/literature/search?q=bad-json'), env)
  assert.equal(invalidJsonResponse.status, 502)
  assert.equal((await invalidJsonResponse.json()).error.code, 'INVALID_UPSTREAM_RESPONSE')
  console.log('PASS upstream payload handling: invalid JSON returns 502 JSON')

  globalThis.fetch = async () => Response.json({ message: { 'total-results': 1, items: [null] } })
  const invalidItemResponse = await worker.fetch(new Request('http://worker.local/api/literature/search?q=bad-item'), env)
  assert.equal(invalidItemResponse.status, 502)
  assert.equal((await invalidItemResponse.json()).error.code, 'INVALID_UPSTREAM_RESPONSE')
  console.log('PASS upstream payload handling: malformed item returns 502 JSON')
} finally {
  globalThis.fetch = originalFetch
}

const searchResponse = await request('/api/literature/search?q=artificial%20intelligence%20education&fromYear=2021&toYear=2026&limit=5')
const search = await requireSearchSuccess(searchResponse, 'Crossref search')
assert.equal(search.ok, true)
assert.equal(search.source, 'crossref')
assert.ok(search.total > 0, 'Crossref should report at least one result')
assert.ok(search.items.length > 0 && search.items.length <= 5)
assert.equal(search.query, 'artificial intelligence education')

for (const item of search.items) {
  assert.equal(item.source, 'crossref')
  assert.equal(item.verified, true)
  assert.ok(Array.isArray(item.authors))
  for (const author of item.authors) {
    assert.equal(typeof author.given, 'string')
    assert.equal(typeof author.family, 'string')
  }
  if (item.doi) assert.equal(item.url, `https://doi.org/${item.doi}`)
  if (item.year !== null) assert.ok(item.year >= 2021 && item.year <= 2026)
}
console.log(`PASS Crossref search: total=${search.total}, returned=${search.items.length}`)
console.log(JSON.stringify(search.items.slice(0, 3), null, 2))

for (const item of search.items.slice(0, 3).filter(item => item.doi)) {
  let upstreamResponse
  try {
    upstreamResponse = await fetch(`https://api.crossref.org/works/${encodeURIComponent(item.doi)}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'PhD-Research-AI/0.1 smoke-test' },
      signal: AbortSignal.timeout(12000),
    })
  } catch (error) {
    console.error(`::error title=Crossref upstream/environment failure::DOI source verification request failed: ${error.message}`)
    throw error
  }
  if (!upstreamResponse.ok) {
    console.error(`::error title=Crossref upstream/environment failure::DOI verification returned HTTP ${upstreamResponse.status} for ${item.doi}`)
    throw new Error(`Crossref DOI verification failed for ${item.doi}`)
  }
  let upstreamPayload
  try {
    upstreamPayload = await upstreamResponse.json()
  } catch (error) {
    console.error(`::error title=Crossref upstream/environment failure::DOI verification returned invalid JSON: ${error.message}`)
    throw error
  }
  const upstream = upstreamPayload.message
  assert.equal(item.doi.toLowerCase(), String(upstream.DOI || '').toLowerCase())
  assert.equal(item.title, Array.isArray(upstream.title) ? upstream.title[0]?.trim() || '' : '')
  assert.equal(item.publisher, upstream.publisher || '')
  const dateSources = [upstream['published-print'], upstream['published-online'], upstream.issued]
  const expectedYear = dateSources.map(value => value?.['date-parts']?.[0]?.[0]).find(value => Number.isInteger(value) && value >= 1000 && value <= 9999) ?? null
  assert.equal(item.year, expectedYear)
  assert.deepEqual(item.authors, (upstream.author || []).map(author => ({
    given: typeof author.given === 'string' ? author.given.trim() : '',
    family: typeof author.family === 'string' ? author.family.trim() : '',
  })))
  assert.equal(item.journal, Array.isArray(upstream['container-title']) ? upstream['container-title'][0]?.trim() || '' : '')
  assert.equal(item.sourceUrl, upstream.URL || '')
  assert.equal(item.abstract, typeof upstream.abstract === 'string' ? upstream.abstract.trim() : '')
  assert.equal(item.type, upstream.type || '')
  assert.equal(item.language, normalizeCrossrefWork(upstream).language)
  assert.equal(item.url, `https://doi.org/${upstream.DOI}`)
  console.log(`PASS source verification: ${item.doi} matches Crossref work record`)
}

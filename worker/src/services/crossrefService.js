import { normalizeCrossrefWork } from './literatureNormalizer.js'

export class CrossrefError extends Error {
  constructor(code, message, status = 502) {
    super(message)
    this.name = 'CrossrefError'
    this.code = code
    this.status = status
  }
}

export async function searchCrossref({ query, fromYear, toYear, limit, languages = [], languageScript = 'all' }, env) {
  // Crossref's Works endpoint does not offer a dependable language filter.
  // Fetch a bounded candidate window, then filter only on deposited metadata.
  const candidateLimit = languages.length === 0 && languageScript === 'all' ? limit : Math.min(500, limit * 5)
  const url = new URL('https://api.crossref.org/works')
  url.searchParams.set('query', query)
  url.searchParams.set('rows', String(candidateLimit))
  if (fromYear || toYear) {
    const from = fromYear || toYear
    const to = toYear || fromYear
    url.searchParams.set('filter', `from-pub-date:${from}-01-01,until-pub-date:${to}-12-31`)
  }
  const headers = { Accept: 'application/json', 'User-Agent': 'PhD-Research-AI/0.1' }
  if (env.CROSSREF_MAILTO) {
    url.searchParams.set('mailto', env.CROSSREF_MAILTO)
    headers['User-Agent'] = `PhD-Research-AI/0.1 (mailto:${env.CROSSREF_MAILTO})`
  }

  const timeoutMs = Math.min(20000, Math.max(1000, Number(env.REQUEST_TIMEOUT_MS) || 8000))
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort('timeout'), timeoutMs)
  let payload
  try {
    const response = await fetch(url, { headers, signal: controller.signal })
    if (!response.ok) throw new CrossrefError('UPSTREAM_ERROR', `Crossref 回傳錯誤（HTTP ${response.status}）。`, 502)
    try {
      payload = await response.json()
    } catch {
      throw new CrossrefError('INVALID_UPSTREAM_RESPONSE', 'Crossref 回傳了無法讀取的資料。', 502)
    }
  } catch (error) {
    if (error instanceof CrossrefError) throw error
    if (controller.signal.aborted) throw new CrossrefError('UPSTREAM_TIMEOUT', 'Crossref 回應逾時，請稍後再試。', 504)
    throw new CrossrefError('UPSTREAM_UNAVAILABLE', '目前無法連線至 Crossref，請稍後再試。', 502)
  } finally {
    clearTimeout(timeout)
  }

  const message = payload?.message
  if (!message || !Array.isArray(message.items) || message.items.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new CrossrefError('INVALID_UPSTREAM_RESPONSE', 'Crossref 回傳格式不符合預期。', 502)
  }

  return {
    total: Number.isFinite(message['total-results']) ? message['total-results'] : message.items.length,
    items: message.items.map(normalizeCrossrefWork),
    candidateLimit,
  }
}

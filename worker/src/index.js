import { searchCrossref, CrossrefError } from './services/crossrefService.js'
import { filterLiteratureByLanguage, normalizeLanguageFilter } from './services/languageFilter.js'
import { corsHeaders, errorResponse, jsonResponse } from './utils/response.js'

const SERVICE_NAME = 'phd-research-ai-worker'
const MAX_QUERY_LENGTH = 300

function validateSearch(url, legacyBody = null) {
  const rawQuery = url.searchParams.get('q') ?? legacyBody?.query ?? ''
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : ''
  if (!query) return { error: [400, 'MISSING_QUERY', '請提供非空的 q 搜尋字詞。'] }
  if (query.length > MAX_QUERY_LENGTH) return { error: [400, 'QUERY_TOO_LONG', `搜尋字詞不可超過 ${MAX_QUERY_LENGTH} 個字元。`] }

  const currentYear = new Date().getUTCFullYear()
  const rawFromYear = url.searchParams.get('fromYear') ?? legacyBody?.yearFrom
  const rawToYear = url.searchParams.get('toYear') ?? legacyBody?.yearTo
  const fromYear = parseYear(rawFromYear === undefined || rawFromYear === null ? null : String(rawFromYear), 'fromYear', currentYear)
  if (fromYear.error) return { error: fromYear.error }
  const toYear = parseYear(rawToYear === undefined || rawToYear === null ? null : String(rawToYear), 'toYear', currentYear)
  if (toYear.error) return { error: toYear.error }
  if (fromYear.value && toYear.value && fromYear.value > toYear.value) {
    return { error: [400, 'INVALID_YEAR_RANGE', 'fromYear 不可晚於 toYear。'] }
  }

  const rawLimit = url.searchParams.get('limit') ?? (legacyBody?.limit === undefined ? null : String(legacyBody.limit))
  const limit = rawLimit === null ? 20 : Number(rawLimit)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return { error: [400, 'INVALID_LIMIT', 'limit 必須是 1 到 100 之間的整數。'] }
  }
  const language = normalizeLanguageFilter(url.searchParams.get('language') ?? legacyBody?.language)
  if (language === null) return { error: [400, 'INVALID_LANGUAGE', 'language 必須是 all、zh、en、ja 或 other。'] }
  return { value: { query, fromYear: fromYear.value, toYear: toYear.value, limit, language } }
}

function parseYear(raw, name, currentYear) {
  if (raw === null || raw === '') return { value: null }
  const year = Number(raw)
  if (!Number.isInteger(year) || year < 1900 || year > currentYear + 1) {
    return { error: [400, 'INVALID_YEAR', `${name} 必須是 1900 至 ${currentYear + 1} 之間的年份。`] }
  }
  return { value: year }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const headers = corsHeaders(request, env)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'GET' && request.method !== 'POST') return errorResponse(request, env, 405, 'METHOD_NOT_ALLOWED', '此 API 僅接受 GET 或相容前端的 POST 請求。')

    if (url.pathname === '/api/health') {
      if (request.method !== 'GET') return errorResponse(request, env, 405, 'METHOD_NOT_ALLOWED', 'Health API 僅接受 GET 請求。')
      return jsonResponse({ ok: true, service: SERVICE_NAME }, 200, headers)
    }
    if (url.pathname === '/api/literature/search') {
      let legacyBody = null
      if (request.method === 'POST') {
        const declaredLength = Number(request.headers.get('Content-Length') || 0)
        if (declaredLength > 4096) return errorResponse(request, env, 413, 'BODY_TOO_LARGE', '搜尋條件內容過大。')
        try {
          const text = await request.text()
          if (text.length > 4096) return errorResponse(request, env, 413, 'BODY_TOO_LARGE', '搜尋條件內容過大。')
          legacyBody = JSON.parse(text)
          if (!legacyBody || typeof legacyBody !== 'object' || Array.isArray(legacyBody)) throw new Error('invalid body shape')
        } catch {
          return errorResponse(request, env, 400, 'INVALID_REQUEST_BODY', 'POST 請提供有效的 JSON 搜尋條件。')
        }
      }
      const validation = validateSearch(url, legacyBody)
      if (validation.error) {
        const [status, code, message] = validation.error
        return errorResponse(request, env, status, code, message)
      }
      try {
        const result = await searchCrossref(validation.value, env)
        const language = validation.value.language
        const matchedItems = filterLiteratureByLanguage(result.items, language)
        const itemsToReturn = language === 'all' ? result.items : matchedItems.slice(0, validation.value.limit)
        const items = request.method === 'POST'
          ? itemsToReturn.map(item => ({
              ...item,
              authors: item.authors.map(author => [author.given, author.family].filter(Boolean).join(' ')).filter(Boolean).join(', '),
              source: item.journal || item.publisher || 'Crossref',
              providerSource: item.source,
              statusLabel: '來源已驗證',
            }))
          : itemsToReturn
        const languageFilter = language === 'all' ? undefined : {
          language,
          source: 'crossref',
          candidateCount: result.items.length,
          matchedCount: matchedItems.length,
          returnedCount: itemsToReturn.length,
          missingLanguageCount: result.items.filter(item => !item.language).length,
          candidateLimit: result.candidateLimit,
          candidateWindowFull: result.items.length >= result.candidateLimit && result.total > result.items.length,
        }
        const missingLanguageCount = result.items.filter(item => !item.language).length
        return jsonResponse({
          ok: true,
          query: validation.value.query,
          total: result.total,
          source: 'crossref',
          items,
          languageMetadata: {
            source: 'crossref',
            candidateCount: result.items.length,
            missingLanguageCount,
          },
          ...(languageFilter ? { languageFilter } : {}),
        }, 200, headers)
      } catch (error) {
        if (error instanceof CrossrefError) return errorResponse(request, env, error.status, error.code, error.message)
        return errorResponse(request, env, 500, 'INTERNAL_ERROR', '處理搜尋時發生未預期錯誤。')
      }
    }
    return errorResponse(request, env, 404, 'NOT_FOUND', '找不到此 API 路徑。')
  },
}

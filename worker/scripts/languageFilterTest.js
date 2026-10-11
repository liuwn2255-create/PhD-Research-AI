import assert from 'node:assert/strict'
import worker from '../src/index.js'
import { filterLiteratureByLanguage, normalizeLanguageFilter } from '../src/services/languageFilter.js'
import { normalizeCrossrefWork } from '../src/services/literatureNormalizer.js'

const rawWorks = [
  { DOI: '10.example/zh', language: 'ZH', title: ['中文作品'] },
  { DOI: '10.example/en', language: 'eng', title: ['English work'] },
  { DOI: '10.example/ja', language: 'ja-JP', title: ['日本語の作品'] },
  { DOI: '10.example/fr', language: 'fr', title: ['Ouvrage français'] },
  { DOI: '10.example/mul', language: 'mul', title: ['Multiple-language record'] },
  { DOI: '10.example/missing', title: ['No language field'] },
  { DOI: '10.example/unrecognized', language: 'x-unknown', title: ['Unknown code'] },
]
const works = rawWorks.map(normalizeCrossrefWork)

assert.deepEqual(works.map(item => item.language), ['zh', 'en', 'ja', 'fr', 'mul', null, null])
assert.equal(normalizeCrossrefWork({ language: 'und' }).language, null)
assert.equal(normalizeCrossrefWork({ language: 'zxx' }).language, null)

assert.equal(normalizeLanguageFilter(undefined), 'all')
assert.equal(normalizeLanguageFilter(''), 'all')
assert.equal(normalizeLanguageFilter('   '), 'all')
assert.equal(normalizeLanguageFilter('zh'), 'zh')
assert.equal(normalizeLanguageFilter('unsupported'), null)
assert.deepEqual(filterLiteratureByLanguage(works, 'all'), works)
assert.deepEqual(filterLiteratureByLanguage(works, 'zh').map(item => item.language), ['zh'])
assert.deepEqual(filterLiteratureByLanguage(works, 'en').map(item => item.language), ['en'])
assert.deepEqual(filterLiteratureByLanguage(works, 'ja').map(item => item.language), ['ja'])
assert.deepEqual(filterLiteratureByLanguage(works, 'other').map(item => item.language), ['fr', 'mul'])
assert.ok(!filterLiteratureByLanguage(works, 'other').some(item => item.language === null))
console.log('PASS language normalization and filters: all, zh, en, ja, other, missing and unknown')

const originalFetch = globalThis.fetch
let observedUrl
try {
  globalThis.fetch = async url => {
    observedUrl = new URL(url)
    return Response.json({ message: { 'total-results': rawWorks.length, items: rawWorks } })
  }

  async function post(body) {
    return worker.fetch(new Request('http://worker.local/api/literature/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }), { REQUEST_TIMEOUT_MS: '8000' })
  }

  const base = { query: 'language filter test', yearFrom: 2020, yearTo: 2026, limit: 2 }
  const allResponse = await post({ ...base, language: 'all' })
  assert.equal(allResponse.status, 200)
  const all = await allResponse.json()
  assert.equal(all.items.length, rawWorks.length)
  assert.equal(all.languageFilter, undefined)
  assert.equal(all.items[5].language, null)
  assert.equal(observedUrl.searchParams.get('rows'), '2')

  for (const language of ['zh', 'en', 'ja', 'other']) {
    const response = await post({ ...base, language })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.ok(body.items.every(item => item.language !== null))
    if (language !== 'other') assert.ok(body.items.every(item => item.language === language))
    else assert.ok(body.items.every(item => !['zh', 'en', 'ja'].includes(item.language)))
    assert.equal(body.languageFilter.language, language)
    assert.equal(body.languageFilter.candidateCount, rawWorks.length)
    assert.equal(body.languageFilter.matchedCount, language === 'other' ? 2 : 1)
    assert.equal(body.languageFilter.returnedCount, body.items.length)
    assert.equal(body.languageFilter.missingLanguageCount, 2)
    assert.equal(body.languageMetadata.missingLanguageCount, 2)
    assert.equal(observedUrl.searchParams.get('rows'), '10')
  }

  const legacyResponse = await post(base)
  assert.equal(legacyResponse.status, 200)
  const legacy = await legacyResponse.json()
  assert.equal(legacy.items.length, rawWorks.length)
  assert.equal(legacy.languageFilter, undefined)
  assert.equal(observedUrl.searchParams.get('rows'), '2')

  const invalidResponse = await post({ ...base, language: 'xx-invalid' })
  assert.equal(invalidResponse.status, 400)
  assert.equal((await invalidResponse.json()).error.code, 'INVALID_LANGUAGE')
  console.log('PASS Worker POST: language filtering, unknown metadata summary, all and omitted-language compatibility')
} finally {
  globalThis.fetch = originalFetch
}

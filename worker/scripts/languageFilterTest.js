import assert from 'node:assert/strict'
import worker from '../src/index.js'
import { filterLiteratureByLanguage, filterLiteratureByLanguages, filterLiteratureByScript, normalizeLanguageFilter, normalizeLanguagesFilter, normalizeLanguageScriptFilter } from '../src/services/languageFilter.js'
import { normalizeCrossrefWork } from '../src/services/literatureNormalizer.js'

const rawWorks = [
  { DOI: '10.example/zh', language: 'ZH', title: ['中文作品'] },
  { DOI: '10.example/zh-hant', language: 'zh-Hant', title: ['繁體中文來源標記'] },
  { DOI: '10.example/zh-hans', language: 'zh-Hans', title: ['簡體中文來源標記'] },
  { DOI: '10.example/zh-tw', language: 'zh-TW', title: ['地區代碼不可推斷文字腳本'] },
  { DOI: '10.example/en', language: 'eng', title: ['English work'] },
  { DOI: '10.example/ja', language: 'ja-JP', title: ['日本語の作品'] },
  { DOI: '10.example/fr', language: 'fr', title: ['Ouvrage français'] },
  { DOI: '10.example/mul', language: 'mul', title: ['Multiple-language record'] },
  { DOI: '10.example/missing', title: ['No language field'] },
  { DOI: '10.example/unrecognized', language: 'x-unknown', title: ['Unknown code'] },
  { DOI: '10.5803/jsfm.39.87', language: 'en', title: ['解いて学ぶ 食品衛生・食品安全 テキスト&問題集 第2版'] },
  { DOI: '10.example/bilingual', language: 'en', title: ['食の安全 Food Safety ガイド'] },
  { DOI: '10.example/ja-reported', language: 'ja', title: ['日本語の研究'] },
  { DOI: '10.example/ja-unknown', title: ['食品衛生の研究'] },
]
const works = rawWorks.map(normalizeCrossrefWork)

assert.deepEqual(works.map(item => item.language), ['zh', 'zh', 'zh', 'zh', 'en', 'ja', 'fr', 'mul', null, null, null, 'en', 'ja', null])
assert.deepEqual(works.map(item => item.languageScript), [null, 'Hant', 'Hans', null, null, null, null, null, null, null, null, null, null, null])
const mislabelledJapanese = works.find(item => item.doi === '10.5803/jsfm.39.87')
assert.equal(mislabelledJapanese.sourceLanguage, 'en')
assert.equal(mislabelledJapanese.language, null)
assert.equal(mislabelledJapanese.languageStatus, 'needs-review')
assert.ok(mislabelledJapanese.languageReviewReason)
assert.equal(works.find(item => item.id === '10.example/bilingual').languageStatus, 'source-reported')
assert.equal(works.find(item => item.id === '10.example/ja-unknown').languageStatus, 'needs-review')
assert.equal(normalizeCrossrefWork({ language: 'und' }).language, null)
assert.equal(normalizeCrossrefWork({ language: 'zxx' }).language, null)

assert.equal(normalizeLanguageFilter(undefined), 'all')
assert.equal(normalizeLanguageFilter(''), 'all')
assert.equal(normalizeLanguageFilter('   '), 'all')
assert.equal(normalizeLanguageFilter('zh'), 'zh')
assert.equal(normalizeLanguageFilter('unsupported'), null)
assert.deepEqual(normalizeLanguagesFilter(undefined), [])
assert.deepEqual(normalizeLanguagesFilter([]), [])
assert.deepEqual(normalizeLanguagesFilter(['zh']), ['zh'])
assert.deepEqual(normalizeLanguagesFilter(['zh', 'en']), ['zh', 'en'])
assert.deepEqual(normalizeLanguagesFilter(['zh', 'en', 'ja']), ['zh', 'en', 'ja'])
assert.equal(normalizeLanguagesFilter(['xx']), null)
assert.equal(normalizeLanguageScriptFilter(undefined), 'all')
assert.equal(normalizeLanguageScriptFilter('traditional'), null)
assert.deepEqual(filterLiteratureByLanguage(works, 'all'), works)
assert.deepEqual(filterLiteratureByLanguage(works, 'zh').map(item => item.languageScript), [null, 'Hant', 'Hans', null])
assert.deepEqual(filterLiteratureByLanguage(works, 'en').map(item => item.language), ['en', 'en'])
assert.ok(!filterLiteratureByLanguage(works, 'en').some(item => item.doi === '10.5803/jsfm.39.87'))
assert.ok(!filterLiteratureByLanguages(works, ['zh', 'en']).some(item => item.doi === '10.5803/jsfm.39.87'))
assert.deepEqual(filterLiteratureByLanguage(works, 'ja').map(item => item.language), ['ja', 'ja'])
assert.deepEqual(filterLiteratureByLanguage(works, 'other').map(item => item.language), ['fr', 'mul'])
assert.ok(!filterLiteratureByLanguage(works, 'other').some(item => item.language === null))
assert.deepEqual(filterLiteratureByLanguages(works, ['zh', 'en']).map(item => item.language), ['zh', 'zh', 'zh', 'zh', 'en', 'en'])
assert.deepEqual(filterLiteratureByLanguages(works, ['zh', 'en', 'ja']).map(item => item.language), ['zh', 'zh', 'zh', 'zh', 'en', 'ja', 'en', 'ja'])
assert.deepEqual(filterLiteratureByLanguages(works, []).map(item => item.id), works.map(item => item.id))
assert.deepEqual(filterLiteratureByScript(works, 'hant').map(item => item.languageScript), ['Hant'])
assert.deepEqual(filterLiteratureByScript(works, 'hans').map(item => item.languageScript), ['Hans'])
assert.equal(filterLiteratureByScript(works, 'all').length, works.length)
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
  const allResponse = await post({ ...base, languages: [] })
  assert.equal(allResponse.status, 200)
  const all = await allResponse.json()
  assert.equal(all.items.length, rawWorks.length)
  assert.equal(all.languageFilter, undefined)
  assert.equal(all.items.filter(item => item.language === null).length, 4)
  assert.equal(all.items.find(item => item.doi === '10.5803/jsfm.39.87').languageStatus, 'needs-review')
  assert.equal(observedUrl.searchParams.get('rows'), '2')

  for (const language of ['zh', 'en', 'ja', 'other']) {
    const response = await post({ ...base, languages: [language] })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.ok(body.items.every(item => item.language !== null))
    if (language !== 'other') assert.ok(body.items.every(item => item.language === language))
    else assert.ok(body.items.every(item => !['zh', 'en', 'ja'].includes(item.language)))
    assert.equal(body.languageFilter.language, language)
    assert.deepEqual(body.languageFilter.languages, [language])
    assert.equal(body.languageFilter.candidateCount, rawWorks.length)
    assert.equal(body.languageFilter.matchedCount, language === 'zh' ? 4 : language === 'other' ? 2 : 2)
    assert.equal(body.languageFilter.returnedCount, body.items.length)
    assert.equal(body.languageFilter.missingLanguageCount, 2)
    assert.equal(body.languageMetadata.missingLanguageCount, 2)
    assert.equal(body.languageFilter.reviewLanguageCount, 2)
    assert.equal(body.languageMetadata.reviewLanguageCount, 2)
    assert.equal(observedUrl.searchParams.get('rows'), '10')
  }

  for (const languages of [['zh', 'en'], ['zh', 'en', 'ja']]) {
    const response = await post({ ...base, languages })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.deepEqual(body.languageFilter.languages, languages)
    assert.equal(body.languageFilter.language, 'all')
    assert.ok(body.items.every(item => languages.includes(item.language)))
    assert.equal(body.languageFilter.matchedCount, languages.length === 2 ? 6 : 8)
    assert.ok(!body.items.some(item => item.doi === '10.5803/jsfm.39.87'))
    assert.equal(body.languageFilter.returnedCount, 2)
    assert.equal(observedUrl.searchParams.get('rows'), '10')
  }

  const traditionalResponse = await post({ ...base, language: 'zh', languageScript: 'hant' })
  const traditional = await traditionalResponse.json()
  assert.equal(traditionalResponse.status, 200)
  assert.deepEqual(traditional.items.map(item => item.languageScript), ['Hant'])
  assert.equal(traditional.languageFilter.languageScript, 'hant')

  const taiwanCodeResponse = await post({ ...base, language: 'zh', languageScript: 'hant', region: 'tw' })
  assert.equal(taiwanCodeResponse.status, 200)
  assert.deepEqual((await taiwanCodeResponse.json()).items.map(item => item.id), traditional.items.map(item => item.id))

  const legacyResponse = await post(base)
  assert.equal(legacyResponse.status, 200)
  const legacy = await legacyResponse.json()
  assert.equal(legacy.items.length, rawWorks.length)
  assert.equal(legacy.languageFilter, undefined)
  assert.equal(observedUrl.searchParams.get('rows'), '2')

  const oldFrontendResponse = await post({ ...base, language: 'zh' })
  assert.equal(oldFrontendResponse.status, 200)
  assert.deepEqual((await oldFrontendResponse.json()).languageFilter.languages, ['zh'])

  const invalidResponse = await post({ ...base, languages: ['xx-invalid'] })
  assert.equal(invalidResponse.status, 400)
  assert.equal((await invalidResponse.json()).error.code, 'INVALID_LANGUAGES')
  const invalidScriptResponse = await post({ ...base, languageScript: 'traditional' })
  assert.equal(invalidScriptResponse.status, 400)
  assert.equal((await invalidScriptResponse.json()).error.code, 'INVALID_LANGUAGE_SCRIPT')
  console.log('PASS Worker POST: language filtering, source/title conflict review, bilingual title, all and omitted-language compatibility')
} finally {
  globalThis.fetch = originalFetch
}

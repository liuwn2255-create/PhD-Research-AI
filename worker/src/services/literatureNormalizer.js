function cleanText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

// ISO 639-1 language codes. We only normalize explicit provider metadata; text
// content, author names, and publisher geography are never used as signals.
const ISO_639_1_CODES = new Set(`aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu`.split(/\s+/))

// ISO 639-2 aliases with widely used, unambiguous ISO 639-1 equivalents.
const ISO_639_2_TO_1 = new Map(Object.entries({
  eng: 'en', zho: 'zh', chi: 'zh', jpn: 'ja',
  ara: 'ar', ces: 'cs', cze: 'cs', dan: 'da', deu: 'de', ger: 'de',
  ell: 'el', gre: 'el', spa: 'es', fin: 'fi', fra: 'fr', fre: 'fr',
  heb: 'he', hin: 'hi', hrv: 'hr', hun: 'hu', ind: 'id', ita: 'it',
  kor: 'ko', nld: 'nl', dut: 'nl', nor: 'no', pol: 'pl', por: 'pt',
  ron: 'ro', rum: 'ro', rus: 'ru', slk: 'sk', slo: 'sk', srp: 'sr',
  swe: 'sv', tha: 'th', tur: 'tr', ukr: 'uk', urd: 'ur', vie: 'vi',
  yid: 'yi',
}))

export function normalizeLanguage(value) {
  if (typeof value !== 'string') return null
  const raw = value.trim().toLowerCase().replaceAll('_', '-')
  if (!raw || raw === 'und' || raw === 'zxx') return null

  const primary = raw.split('-')[0]
  if (primary === 'mul') return 'mul'
  if (ISO_639_1_CODES.has(primary)) return primary
  return ISO_639_2_TO_1.get(primary) || null
}

// Script is retained only when Crossref explicitly provides a Chinese script
// subtag. A region subtag (for example TW or CN) is not treated as script or origin.
export function normalizeLanguageScript(value) {
  if (typeof value !== 'string') return null
  const subtags = value.trim().replaceAll('_', '-').split('-').slice(1)
  const script = subtags.find(part => /^[a-z]{4}$/i.test(part))?.toLowerCase()
  if (script === 'hant') return 'Hant'
  if (script === 'hans') return 'Hans'
  return null
}

function titleHasJapaneseOnlySignal(title) {
  if (!title) return false
  const hasJapaneseKana = /[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f]/u.test(title)
  const hasLatinLetters = /\p{Script=Latin}/u.test(title)
  // Kana is distinctive to Japanese. If Latin letters are also present, keep
  // the source language because the title may be bilingual or mixed-language.
  return hasJapaneseKana && !hasLatinLetters
}

export function normalizeDoi(value) {
  let doi = cleanText(value)
  if (!doi) return ''
  doi = doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').trim()
  return doi
}

function publicationYear(work) {
  // `created` is Crossref's deposit timestamp, not a publication date; never use it as a year fallback.
  const dateSources = [work['published-print'], work['published-online'], work.issued]
  for (const source of dateSources) {
    const year = source?.['date-parts']?.[0]?.[0]
    if (Number.isInteger(year) && year >= 1000 && year <= 9999) return year
  }
  return null
}

export function normalizeCrossrefWork(work) {
  const doi = normalizeDoi(work?.DOI)
  const sourceUrl = cleanText(work?.URL)
  const title = cleanText(Array.isArray(work?.title) ? work.title[0] : '')
  const sourceLanguage = cleanText(work?.language)
  const reportedLanguage = normalizeLanguage(sourceLanguage)
  const titleLanguageConflict = titleHasJapaneseOnlySignal(title) && reportedLanguage !== 'ja'
  const language = titleLanguageConflict ? null : reportedLanguage
  const authors = Array.isArray(work?.author)
    ? work.author.map(author => ({ given: cleanText(author?.given), family: cleanText(author?.family) }))
    : []

  return {
    id: doi || sourceUrl,
    title,
    authors,
    year: publicationYear(work),
    journal: cleanText(Array.isArray(work?.['container-title']) ? work['container-title'][0] : ''),
    publisher: cleanText(work?.publisher),
    doi,
    url: doi ? `https://doi.org/${doi}` : sourceUrl,
    abstract: cleanText(work?.abstract),
    type: cleanText(work?.type),
    language,
    sourceLanguage,
    languageStatus: titleLanguageConflict ? 'needs-review' : reportedLanguage ? 'source-reported' : 'unknown',
    languageReviewReason: titleLanguageConflict ? 'Crossref 語言欄位與日文假名標題特徵不一致。' : '',
    languageScript: language === 'zh' ? normalizeLanguageScript(sourceLanguage) : null,
    source: 'crossref',
    sourceUrl,
    verified: true,
  }
}

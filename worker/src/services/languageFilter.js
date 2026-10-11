const PRIMARY_LANGUAGES = new Set(['zh', 'en', 'ja'])
const VALID_FILTERS = new Set(['all', 'zh', 'en', 'ja', 'other'])
const VALID_LANGUAGE_CODES = new Set(['zh', 'en', 'ja', 'other'])
const VALID_SCRIPTS = new Set(['all', 'hant', 'hans'])

export function normalizeLanguageFilter(value) {
  if (value === undefined || value === null) return 'all'
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return 'all'
  return VALID_FILTERS.has(normalized) ? normalized : null
}

export function filterLiteratureByLanguage(items, language) {
  return filterLiteratureByLanguages(items, language === 'all' ? [] : [language])
}

export function normalizeLanguagesFilter(value) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) return null
  const languages = value.map(language => typeof language === 'string' ? language.trim().toLowerCase() : null)
  if (languages.some(language => !language || !VALID_LANGUAGE_CODES.has(language))) return null
  return [...new Set(languages)]
}

export function filterLiteratureByLanguages(items, languages) {
  if (!languages.length) return [...items]
  return items.filter(item => {
    if (!item.language) return false
    return languages.some(language => language === 'other'
      ? !PRIMARY_LANGUAGES.has(item.language)
      : item.language === language)
  })
}

export function normalizeLanguageScriptFilter(value) {
  if (value === undefined || value === null) return 'all'
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return normalized === '' || VALID_SCRIPTS.has(normalized) ? normalized || 'all' : null
}

export function filterLiteratureByScript(items, script) {
  if (script === 'all') return [...items]
  return items.filter(item => item.language === 'zh' && item.languageScript?.toLowerCase() === script)
}

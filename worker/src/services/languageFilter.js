const PRIMARY_LANGUAGES = new Set(['zh', 'en', 'ja'])
const VALID_FILTERS = new Set(['all', 'zh', 'en', 'ja', 'other'])

export function normalizeLanguageFilter(value) {
  if (value === undefined || value === null) return 'all'
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return 'all'
  return VALID_FILTERS.has(normalized) ? normalized : null
}

export function filterLiteratureByLanguage(items, language) {
  if (language === 'all') return [...items]
  return items.filter(item => {
    if (!item.language) return false
    if (language === 'other') return !PRIMARY_LANGUAGES.has(item.language)
    return item.language === language
  })
}

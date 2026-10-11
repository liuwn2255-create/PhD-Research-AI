function cleanText(value) {
  return typeof value === 'string' ? value.trim() : ''
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
  const authors = Array.isArray(work?.author)
    ? work.author.map(author => ({ given: cleanText(author?.given), family: cleanText(author?.family) }))
    : []

  return {
    id: doi || sourceUrl,
    title: cleanText(Array.isArray(work?.title) ? work.title[0] : ''),
    authors,
    year: publicationYear(work),
    journal: cleanText(Array.isArray(work?.['container-title']) ? work['container-title'][0] : ''),
    publisher: cleanText(work?.publisher),
    doi,
    url: doi ? `https://doi.org/${doi}` : sourceUrl,
    abstract: cleanText(work?.abstract),
    type: cleanText(work?.type),
    source: 'crossref',
    sourceUrl,
    verified: true,
  }
}

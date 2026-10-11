import { requestJson } from './apiClient.js'

// UI calls this adapter, not a provider directly. Worker can later orchestrate
// Crossref / Semantic Scholar / PubMed and AI analysis without exposing secrets.
export async function searchLiterature(criteria) {
  return requestJson('/literature/search', {
    method: 'POST',
    body: JSON.stringify(criteria),
  })
}

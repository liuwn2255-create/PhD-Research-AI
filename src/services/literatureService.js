import { requestJson } from './apiClient.js'

// UI calls this adapter, not a provider directly. Worker can later orchestrate
// Crossref / Semantic Scholar / PubMed and AI analysis without exposing secrets.
export async function searchLiterature(criteria) {
  if (!import.meta.env.VITE_API_BASE_URL?.trim()) {
    return { status: 'not-configured', items: [], message: '目前尚未連接學術文獻資料來源。設定 Worker API 後即可開始搜尋。' }
  }
  return requestJson('/literature/search', {
    method: 'POST',
    body: JSON.stringify(criteria),
  })
}

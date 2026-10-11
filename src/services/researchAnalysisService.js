import { requestJson } from './apiClient.js'

// Reserved adapter for the future Worker-based analysis pipeline.
export async function analyzeResearchGap(payload) {
  return requestJson('/research/gap', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

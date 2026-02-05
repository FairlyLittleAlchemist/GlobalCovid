// src/api/gleamApi.js
import { API_BASE, joinUrl, readTextSafe } from './http.js'

/**
 * Run simulation job on backend
 * (POST is correct because it triggers computation)
 */
export async function runSimulation(payload) {
  const url = joinUrl(API_BASE, '/simulate')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await readTextSafe(res)
    throw new Error(`POST ${url} → ${res.status}\n${text}`)
  }

  return res.json()
}

/**
 * Fetch a CSV file.
 * If backend returns an absolute S3 URL and CORS is enabled → fetch directly.
 * If backend returns a relative path → fetch via API_BASE.
 */
export async function fetchCsvText(csvUrlOrPath) {
  const isAbsolute = /^https?:\/\//i.test(csvUrlOrPath)
  const url = isAbsolute ? csvUrlOrPath : joinUrl(API_BASE, csvUrlOrPath)

  const res = await fetch(url)
  if (!res.ok) {
    const text = await readTextSafe(res)
    throw new Error(`GET ${url} → ${res.status}\n${text}`)
  }
  return res.text()
}

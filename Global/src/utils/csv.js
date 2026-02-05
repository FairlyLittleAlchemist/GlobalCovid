// src/utils/csv.js
export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []

  const parseLine = (line) => {
    const out = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        out.push(cur)
        cur = ''
      } else {
        cur += ch
      }
    }
    out.push(cur)
    return out.map((s) => s.trim())
  }

  const headers = parseLine(lines[0]).map((h) => h.replace(/^\uFEFF/, ''))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i])
    const obj = {}
    for (let j = 0; j < headers.length; j++) obj[headers[j]] = cols[j] ?? ''
    rows.push(obj)
  }
  return rows
}

export function toNumber(x) {
  const n = Number(String(x ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export async function loadCSV(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`)
  const text = await res.text()
  return parseCSV(text)
}

// src/components/SimulationPlayer.jsx
import { useEffect, useMemo, useRef, useState } from 'react'

function parseCSV(text) {
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

function toNumber(x) {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}

export default function SimulationPlayer({
  url = '/merged_gleam_data.csv',
  fps = 6,
  playing = false,
  onPlayingChange,
  enabled = false, // becomes true when disease selected
  onFrame,
}) {
  const [rows, setRows] = useState([])
  const [days, setDays] = useState([])
  const [t, setT] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const timerRef = useRef(null)

  useEffect(() => {
    let alive = true
    async function run() {
      try {
        setLoading(true)
        setError('')
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`)
        const text = await res.text()
        if (!alive) return

        const raw = parseCSV(text)

        const cleaned = raw.map((r) => {
          const day = toNumber(r.day)
          const population = toNumber(r.population)
          const susceptible = toNumber(r.susceptible)
          const latent = toNumber(r.latent)
          const ia = toNumber(r.infectious_a)
          const it = toNumber(r.infectious_t)
          const intt = toNumber(r.infectious_nt)
          const recovered = toNumber(r.recovered)
          const infectious = ia + it + intt

          return {
            node_id: r.node_id ?? r.node ?? r.id ?? '',
            node_name: r.node_name ?? r.name ?? '',
            day,
            population,
            susceptible,
            latent,
            infectious,
            recovered,
            infected_frac: population > 0 ? infectious / population : 0,
            infectious_a: ia,
            infectious_t: it,
            infectious_nt: intt,

          }
        })

        const uniqueDays = Array.from(new Set(cleaned.map((r) => r.day))).sort((a, b) => a - b)
        setRows(cleaned)
        setDays(uniqueDays)
        setT(uniqueDays[0] ?? 0)
      } catch (e) {
        setError(e?.message || 'Failed to load CSV')
      } finally {
        setLoading(false)
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [url])

  const byDay = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      if (!map.has(r.day)) map.set(r.day, new Map())
      map.get(r.day).set(r.node_id, r)
    }
    return map
  }, [rows])

  // emit frame
  useEffect(() => {
    if (!days.length) return
    const frame = byDay.get(t) || new Map()
    onFrame?.({ day: t, frame })
  }, [t, byDay, days, onFrame])

  // tick playback
  useEffect(() => {
    clearInterval(timerRef.current)
    if (!playing || !enabled || !days.length) return

    const dt = Math.max(60, Math.floor(1000 / fps))
    timerRef.current = setInterval(() => {
      setT((cur) => {
        const idx = days.indexOf(cur)
        const next = days[(idx + 1) % days.length]
        return next
      })
    }, dt)

    return () => clearInterval(timerRef.current)
  }, [playing, enabled, fps, days])

  if (loading) return <div style={{ fontSize: 12, opacity: 0.8 }}>Loading simulation…</div>
  if (error) return <div style={{ fontSize: 12, color: '#ffb4b4' }}>{error}</div>
  if (!days.length) return <div style={{ fontSize: 12, opacity: 0.8 }}>No days found</div>

  const maxDay = days[days.length - 1]
  const disabled = !enabled

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontWeight: 800, letterSpacing: 0.5 }}>Simulation</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Day: <b>{t}</b> / {maxDay}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPlayingChange?.(!playing)}
          style={{
            height: 38,
            width: 120,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.18)',
            background: disabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.10)',
            color: 'white',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontWeight: 800,
            opacity: disabled ? 0.6 : 1,
          }}
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>

        <input
          type="range"
          min={days[0]}
          max={maxDay}
          value={t}
          step={1}
          disabled={disabled}
          onChange={(e) => setT(Number(e.target.value))}
          style={{ flex: 1, opacity: disabled ? 0.5 : 1 }}
        />
      </div>

      {!enabled ? (
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Choose a disease to start simulation.
        </div>
      ) : (
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Nodes + edges update per day. Edge dots show “movement”.
        </div>
      )}
    </div>
  )
}

// src/components/SimulationPlayer.jsx
import { useEffect, useRef, useState } from 'react'
import { runSimulation } from '../api/gleamApi.js'

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

function normalizeDayRow(r) {
  const day = toNumber(r.day)
  const population = toNumber(r.population)
  const susceptible = toNumber(r.susceptible)
  const latent = toNumber(r.latent)
  const infectious_a = toNumber(r.infectious_a)
  const infectious_t = toNumber(r.infectious_t)
  const infectious_nt = toNumber(r.infectious_nt)
  const recovered = toNumber(r.recovered)
  const foi = toNumber(r.foi)
  const exit_rate = toNumber(r.exit_rate)

  const infectious = infectious_a + infectious_t + infectious_nt

  return {
    day,
    node_id: r.node_id ?? '',
    node_name: r.node_name ?? '',
    population,
    susceptible,
    latent,
    infectious_a,
    infectious_t,
    infectious_nt,
    infectious,
    recovered,
    foi,
    exit_rate,
    infected_frac: population > 0 ? infectious / population : 0,
  }
}

export default function SimulationPlayer({
  enabled = false,
  playing = false,
  onPlayingChange,
  onFrame,

  // IMPORTANT: disease is only for UI now (not sent to API)
  selectedDisease = '',

  // simulation parameters
  startingNodeName = 'Helsinki',
  daysToSimulate = 50, // ✅ DEFAULT = 50 days
  fps = 6,

  modelParameters = {
    p_exit_latent: 0.37,
    p_recovery: 0.29,
    p_asymptomatic: 0.2,
    p_travel_allowed: 0.0,
    commuting_return_rate: 3,
    asym_downscaler: 1,
    R0: 1.31,
    starting_date: '2024-01-01',
  },

  seed = 1,
  rngSeed = 42,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [requestInfo, setRequestInfo] = useState(null) // {request_id,cached,csv_urls}
  const [t, setT] = useState(0)

  const dayCacheRef = useRef(new Map()) // dayIndex -> Map(node_id -> row)
  const timerRef = useRef(null)
  const runningRef = useRef(false)

  // reset when "selectedDisease" changes (UI only)
  useEffect(() => {
    setError('')
    setRequestInfo(null)
    setT(0)
    dayCacheRef.current = new Map()
    runningRef.current = false
    onPlayingChange?.(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDisease])

  const csvUrls = requestInfo?.csv_urls || []
  const maxDayIndex = Math.max(0, csvUrls.length - 1)

  async function ensureSimulationStarted() {
    if (runningRef.current) return
    runningRef.current = true

    setLoading(true)
    setError('')

    try {
      // ✅ disease NOT sent (presentation only)
      const payload = {
        starting_node_name: startingNodeName,
        days: daysToSimulate, // ✅ THIS is what controls day_000..day_049
        seed,
        rng_seed: rngSeed,
        model_parameters: modelParameters,
      }

      const res = await runSimulation(payload)
      setRequestInfo(res)
      setT(0)
    } catch (e) {
      runningRef.current = false
      setError(e?.message || 'Simulation failed')
    } finally {
      setLoading(false)
    }
  }

  async function fetchDayFrame(dayIndex) {
    if (!csvUrls.length) return new Map()
    const idx = Math.max(0, Math.min(dayIndex, csvUrls.length - 1))
    if (dayCacheRef.current.has(idx)) return dayCacheRef.current.get(idx)

    const url = csvUrls[idx]
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(
        `Failed to fetch day_${String(idx).padStart(3, '0')}.csv (${res.status})`
      )
    }
    const text = await res.text()
    const raw = parseCSV(text)
    const normalized = raw.map(normalizeDayRow)

    const frame = new Map()
    for (const r of normalized) frame.set(r.node_id, r)

    dayCacheRef.current.set(idx, frame)
    return frame
  }

  // emit current frame
  useEffect(() => {
    let alive = true
    async function run() {
      try {
        if (!requestInfo?.csv_urls?.length) return
        const frame = await fetchDayFrame(t)
        if (!alive) return
        onFrame?.({ day: t, frame })
      } catch (e) {
        if (!alive) return
        setError(e?.message || 'Failed to load day CSV')
      }
    }
    run()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, requestInfo])

  // playback
  useEffect(() => {
    clearInterval(timerRef.current)

    if (!enabled || !playing) return
    if (!requestInfo?.csv_urls?.length) return

    const dt = Math.max(80, Math.floor(1000 / fps))
    timerRef.current = setInterval(() => {
      setT((cur) => {
        const next = cur + 1
        return next > maxDayIndex ? 0 : next
      })
    }, dt)

    return () => clearInterval(timerRef.current)
  }, [enabled, playing, fps, requestInfo, maxDayIndex])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontWeight: 800, letterSpacing: 0.5 }}>Simulation</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Day: <b>{t}</b> / {maxDayIndex}
        </div>
      </div>

      {error ? <div style={{ fontSize: 12, color: '#ffb4b4' }}>{error}</div> : null}

      {!requestInfo ? (
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {enabled ? `Press Play to run ${daysToSimulate} days.` : 'Choose a disease to enable simulation.'}
        </div>
      ) : (
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          request_id: <b>{requestInfo.request_id}</b>
          <br />
          cached: <b>{String(requestInfo.cached)}</b>
          <br />
          days: <b>{daysToSimulate}</b>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          disabled={!enabled}
          onClick={async () => {
            if (!requestInfo) {
              await ensureSimulationStarted()
            }
            onPlayingChange?.(!playing)
          }}
          style={{
            height: 38,
            width: 120,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.18)',
            background: !enabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.10)',
            color: 'white',
            cursor: !enabled ? 'not-allowed' : 'pointer',
            fontWeight: 800,
            opacity: !enabled ? 0.6 : 1,
          }}
        >
          {playing ? '⏸ Pause' : requestInfo ? '▶ Play' : loading ? '… Loading' : '▶ Play'}
        </button>

        <input
          type="range"
          min={0}
          max={maxDayIndex}
          value={t}
          step={1}
          disabled={!enabled || !requestInfo}
          onChange={(e) => setT(Number(e.target.value))}
          style={{ flex: 1, opacity: !enabled || !requestInfo ? 0.5 : 1 }}
        />
      </div>

      {requestInfo?.csv_urls?.length ? (
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Loads day_000.csv, day_001.csv, … from csv_urls.
        </div>
      ) : null}
    </div>
  )
}
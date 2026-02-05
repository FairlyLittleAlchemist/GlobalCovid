// src/pages/DashboardView.jsx
import { useEffect, useMemo, useState } from 'react'
import { loadCSV, toNumber } from '../utils/csv.js'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts'

function Card({ title, subtitle, children }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: 'rgba(0,0,0,0.55)',
        border: '1px solid rgba(255,255,255,0.14)',
        backdropFilter: 'blur(8px)',
        color: 'white',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 950, letterSpacing: 0.6 }}>{title}</div>
        {subtitle ? <div style={{ fontSize: 12, opacity: 0.75 }}>{subtitle}</div> : null}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  )
}

function fmtInt(n) {
  const x = Number(n)
  return Number.isFinite(x) ? x.toLocaleString() : '0'
}
function fmtPct(p) {
  const x = Number(p)
  return Number.isFinite(x) ? `${(x * 100).toFixed(2)}%` : '0%'
}

// robust pick helper
function pick(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] != null && String(obj[k]).trim() !== '') return obj[k]
  }
  return ''
}

// month key from ISO date or any date-ish string
function toMonthKey(dateStr) {
  const s = String(dateStr || '').trim()
  if (!s) return ''
  // if ISO "YYYY-MM-DD" -> "YYYY-MM"
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7)
  // try Date parse
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }
  return ''
}

export default function DashboardView() {
  const [outbreaksRaw, setOutbreaksRaw] = useState([])
  const [simRaw, setSimRaw] = useState([])
  const [err, setErr] = useState('')

  const [day, setDay] = useState(0)

  useEffect(() => {
    let alive = true
    async function run() {
      try {
        setErr('')
        const [o, s] = await Promise.all([
          loadCSV('/llm_outbreaks.csv'),
          loadCSV('/merged_gleam_data.csv'),
        ])
        if (!alive) return
        setOutbreaksRaw(o)
        setSimRaw(s)
      } catch (e) {
        setErr(e?.message || 'Failed to load dashboard CSVs')
      }
    }
    run()
    return () => {
      alive = false
    }
  }, [])

  // =========================
  // OUTBREAKS (llm_outbreaks.csv)
  // =========================
  const outbreaksClean = useMemo(() => {
    return outbreaksRaw.map((r) => {
      // ✅ fixed to your real headers:
      const disease = pick(r, ['disease_name', 'disease', 'Disease', 'pathogen', 'Pathogen', 'name'])
      const country = pick(r, ['primary_country', 'country', 'Country', 'location_country'])
      const pubDate = pick(r, ['publication_date', 'date', 'Date', 'published', 'timestamp'])

      const month = toMonthKey(pubDate)

      return {
        disease: disease || 'Unknown',
        country: country || 'Unknown',
        month: month || '',
      }
    })
  }, [outbreaksRaw])

  const topDiseases = useMemo(() => {
    const agg = new Map()
    for (const r of outbreaksClean) {
      agg.set(r.disease, (agg.get(r.disease) || 0) + 1)
    }
    return Array.from(agg.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)
  }, [outbreaksClean])

  const outbreaksByMonth = useMemo(() => {
    const agg = new Map()
    for (const r of outbreaksClean) {
      if (!r.month) continue
      agg.set(r.month, (agg.get(r.month) || 0) + 1)
    }
    return Array.from(agg.entries())
      .map(([month, value]) => ({ month, value }))
      .sort((a, b) => String(a.month).localeCompare(String(b.month)))
  }, [outbreaksClean])

  // =========================
  // SIM OUTPUT (merged_gleam_data.csv)
  // =========================
  const simClean = useMemo(() => {
    return simRaw.map((r) => {
      const day = toNumber(pick(r, ['day', 'Day']))
      const node_id = String(pick(r, ['node_id', 'node', 'id', 'NodeID', 'Node']) ?? '')
      const node_name = pick(r, ['node_name', 'name', 'NodeName']) || node_id

      const population = toNumber(pick(r, ['population', 'Population']))
      const susceptible = toNumber(pick(r, ['susceptible', 'Susceptible']))
      const latent = toNumber(pick(r, ['latent', 'Latent']))
      const ia = toNumber(pick(r, ['infectious_a', 'infectiousA', 'InfectiousA']))
      const it = toNumber(pick(r, ['infectious_t', 'infectiousT', 'InfectiousT']))
      const intt = toNumber(pick(r, ['infectious_nt', 'infectiousNT', 'InfectiousNT']))
      const recovered = toNumber(pick(r, ['recovered', 'Recovered']))

      const infectious = ia + it + intt
      const infected_frac = population > 0 ? infectious / population : 0

      return {
        day,
        node_id,
        node_name,
        population,
        susceptible,
        latent,
        infectious,
        recovered,
        infected_frac,
      }
    })
  }, [simRaw])

  const days = useMemo(() => {
    const set = new Set(simClean.map((r) => r.day))
    return Array.from(set).sort((a, b) => a - b)
  }, [simClean])

  useEffect(() => {
    if (days.length) setDay(days[0])
  }, [days])

  const nationalTimeline = useMemo(() => {
    const byDay = new Map()
    for (const r of simClean) {
      if (!byDay.has(r.day)) byDay.set(r.day, { day: r.day, pop: 0, infectious: 0 })
      const x = byDay.get(r.day)
      x.pop += r.population
      x.infectious += r.infectious
    }

    return Array.from(byDay.values())
      .map((d) => ({
        day: d.day,
        infected_frac: d.pop > 0 ? d.infectious / d.pop : 0,
      }))
      .sort((a, b) => a.day - b.day)
  }, [simClean])

  const topNodesAtDay = useMemo(() => {
    const rows = simClean.filter((r) => r.day === day)
    return rows
      .slice()
      .sort((a, b) => b.infected_frac - a.infected_frac)
      .slice(0, 12)
      .map((r) => ({
        name: r.node_name || r.node_id,
        infected_frac: r.infected_frac,
        infectious: r.infectious,
        population: r.population,
      }))
  }, [simClean, day])

  const kpis = useMemo(() => {
    const oTotal = outbreaksClean.length
    const sDays = days.length
    const last = nationalTimeline[nationalTimeline.length - 1]?.infected_frac ?? 0
    return { oTotal, sDays, last }
  }, [outbreaksClean.length, days.length, nationalTimeline])

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 18,
        background: 'linear-gradient(180deg, #0b0f14 0%, #0a0d12 100%)',
        color: 'white',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.75, letterSpacing: 0.8, fontWeight: 900 }}>
            DASHBOARD
          </div>
          <div style={{ fontSize: 28, fontWeight: 1000, marginTop: 6 }}>
            Outbreaks + Model Output (only)
          </div>
          <div style={{ marginTop: 6, opacity: 0.8, fontSize: 12 }}>
            Data sources: <b>llm_outbreaks.csv</b> and <b>merged_gleam_data.csv</b>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div
            style={{
              padding: 12,
              borderRadius: 14,
              background: 'rgba(0,0,0,0.55)',
              border: '1px solid rgba(255,255,255,0.14)',
              minWidth: 190,
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.75 }}>Outbreak records</div>
            <div style={{ fontSize: 22, fontWeight: 950 }}>{fmtInt(kpis.oTotal)}</div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 14,
              background: 'rgba(0,0,0,0.55)',
              border: '1px solid rgba(255,255,255,0.14)',
              minWidth: 190,
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.75 }}>Simulation days</div>
            <div style={{ fontSize: 22, fontWeight: 950 }}>{fmtInt(kpis.sDays)}</div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 14,
              background: 'rgba(0,0,0,0.55)',
              border: '1px solid rgba(255,255,255,0.14)',
              minWidth: 240,
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.75 }}>National infected (last day)</div>
            <div style={{ fontSize: 22, fontWeight: 950 }}>{fmtPct(kpis.last)}</div>
          </div>
        </div>
      </div>

      {err ? (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            background: 'rgba(255,80,80,0.12)',
            border: '1px solid rgba(255,80,80,0.28)',
          }}
        >
          {err}
          <div style={{ marginTop: 6, opacity: 0.8, fontSize: 12 }}>
            Put files in <b>public/</b>: <b>llm_outbreaks.csv</b> and <b>merged_gleam_data.csv</b>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card title="Top diseases (from llm_outbreaks.csv)" subtitle="count of records">
          <div style={{ height: 330 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topDiseases} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.75)' }} />
                <YAxis type="category" dataKey="name" width={220} tick={{ fill: 'rgba(255,255,255,0.75)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(0,0,0,0.85)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 12,
                    color: 'white',
                  }}
                  formatter={(v) => fmtInt(v)}
                />
                <Bar dataKey="value" fill="rgba(80,200,255,0.85)" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card
          title="Outbreak records over time"
          subtitle={outbreaksByMonth.length ? 'grouped by month' : 'No valid publication_date found'}
        >
          <div style={{ height: 330 }}>
            {outbreaksByMonth.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={outbreaksByMonth}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.75)' }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.75)' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(0,0,0,0.85)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 12,
                      color: 'white',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="rgba(255,170,80,0.95)"
                    strokeWidth={3}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ opacity: 0.8, fontSize: 12 }}>
                Your file has <b>publication_date</b>, so this should show. If it’s still empty,
                confirm the CSV is really loaded from <b>/public/llm_outbreaks.csv</b>.
              </div>
            )}
          </div>
        </Card>

        <Card
          title="National infection timeline"
          subtitle="merged_gleam_data.csv (sum infectious / sum population)"
        >
          <div style={{ height: 330 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={nationalTimeline}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.75)' }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.75)' }} tickFormatter={(v) => fmtPct(v)} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(0,0,0,0.85)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 12,
                    color: 'white',
                  }}
                  formatter={(v) => fmtPct(v)}
                  labelFormatter={(l) => `Day ${l}`}
                />
                <Line
                  type="monotone"
                  dataKey="infected_frac"
                  stroke="rgba(255,90,90,0.95)"
                  strokeWidth={3}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Top infected nodes (chosen day)" subtitle={days.length ? `Day ${day}` : 'No days'}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.8, minWidth: 90 }}>Day</div>
            <input
              type="range"
              min={days[0] ?? 0}
              max={days[days.length - 1] ?? 0}
              step={1}
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
              style={{ flex: 1 }}
              disabled={!days.length}
            />
            <div style={{ width: 60, textAlign: 'right', fontWeight: 900 }}>{day}</div>
          </div>

          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topNodesAtDay} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.75)' }} tickFormatter={(v) => fmtPct(v)} />
                <YAxis type="category" dataKey="name" width={220} tick={{ fill: 'rgba(255,255,255,0.75)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(0,0,0,0.85)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 12,
                    color: 'white',
                  }}
                  formatter={(v, key) => {
                    if (key === 'infected_frac') return fmtPct(v)
                    return fmtInt(v)
                  }}
                />
                <Bar dataKey="infected_frac" fill="rgba(120,255,160,0.85)" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}

// src/components/dashboard/InfectionCharts.jsx
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts'

function fmtInt(n) {
  const x = Number(n)
  return Number.isFinite(x) ? x.toLocaleString() : '0'
}

function fmtPct(p) {
  const x = Number(p)
  return Number.isFinite(x) ? `${(x * 100).toFixed(2)}%` : '0%'
}

export default function InfectionCharts({ timeline, topRegions }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Timeline chart */}
      <div
        style={{
          padding: 14,
          borderRadius: 16,
          background: 'rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,255,255,0.14)',
          backdropFilter: 'blur(8px)',
          color: 'white',
          height: 320,
        }}
      >
        <div style={{ fontWeight: 900, letterSpacing: 0.8, marginBottom: 10 }}>
          Infection timeline
        </div>

        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
            <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.75)' }} />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.75)' }}
              tickFormatter={(v) => fmtPct(v)}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(0,0,0,0.85)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12,
                color: 'white',
              }}
              formatter={(value) => fmtPct(value)}
              labelFormatter={(label) => `Day ${label}`}
            />
            <Line
              type="monotone"
              dataKey="infected_frac"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top regions chart */}
      <div
        style={{
          padding: 14,
          borderRadius: 16,
          background: 'rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,255,255,0.14)',
          backdropFilter: 'blur(8px)',
          color: 'white',
          height: 360,
        }}
      >
        <div style={{ fontWeight: 900, letterSpacing: 0.8, marginBottom: 10 }}>
          Top infected regions (current day)
        </div>

        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={topRegions} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
            <XAxis
              type="number"
              tick={{ fill: 'rgba(255,255,255,0.75)' }}
              tickFormatter={(v) => fmtPct(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: 'rgba(255,255,255,0.75)' }}
              width={120}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(0,0,0,0.85)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12,
                color: 'white',
              }}
              formatter={(value, key, item) => {
                if (key === 'infected_frac') return fmtPct(value)
                if (key === 'infectious') return fmtInt(value)
                return value
              }}
            />
            <Bar dataKey="infected_frac" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>

        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          Tip: use this for your “dashboard stats” view.
        </div>
      </div>
    </div>
  )
}

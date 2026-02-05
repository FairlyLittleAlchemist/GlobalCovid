export default function MetricCard({ title, value, subtitle }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: 'rgba(0,0,0,0.55)',
        border: '1px solid rgba(255,255,255,0.14)',
        backdropFilter: 'blur(8px)',
        color: 'white',
        minHeight: 88,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.8, letterSpacing: 0.6, fontWeight: 700 }}>
        {title}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{value}</div>
      {subtitle ? (
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>{subtitle}</div>
      ) : null}
    </div>
  )
}

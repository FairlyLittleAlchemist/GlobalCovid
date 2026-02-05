// src/pages/MapView.jsx
import { useEffect, useMemo, useState } from 'react'
import DeckGL from '@deck.gl/react'
import MapGL from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

import { INITIAL_VIEW_STATE, MAP_STYLE, REGIONS } from '../map/constants.js'
import { buildLayers } from '../map/layers.js'
import { useFinlandGeoJson } from '../map/useFinlandGeoJson.js'

import DiseaseDropdown from '../components/DiseaseDropdown.jsx'
import SimulationPlayer from '../components/SimulationPlayer.jsx'

function computeQuantiles(values, qs = [0.5, 0.8, 0.95]) {
  const arr = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (!arr.length) return qs.map(() => 0)
  const at = (q) => {
    const idx = Math.floor(q * (arr.length - 1))
    return arr[idx]
  }
  return qs.map(at)
}

function fmt(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '0'
  return x.toLocaleString()
}

export default function MapView() {
  const [selectedDisease, setSelectedDisease] = useState('')

  const [simDay, setSimDay] = useState(0)
  const [simFrame, setSimFrame] = useState(() => new Map())

  const [playing, setPlaying] = useState(false)
  const [animTime, setAnimTime] = useState(0)

  const [controlsOpen, setControlsOpen] = useState(true)

  // ✅ hover state (for realtime tooltip)
  const [hover, setHover] = useState(null) // { x, y, node_id } or null

  // map controls
  const [radius, setRadius] = useState(1500)
  const [upperPercentile, setUpperPercentile] = useState(59)
  const [coverage, setCoverage] = useState(0.57)
  const [sigmaKm, setSigmaKm] = useState(20)
  const [samplesPerRegion, setSamplesPerRegion] = useState(70)
  const [edgesPerNode, setEdgesPerNode] = useState(2)
  const [showEdges, setShowEdges] = useState(true)

  const finlandGeoJson = useFinlandGeoJson('/finland.geojson')
  const simulationEnabled = !!selectedDisease

  useEffect(() => {
    if (selectedDisease) setPlaying(true)
    else setPlaying(false)
  }, [selectedDisease])

  useEffect(() => {
    let raf = 0
    let start = performance.now()

    function loop(now) {
      const t = (now - start) / 1000
      setAnimTime(simulationEnabled && playing ? t : 0)
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [simulationEnabled, playing])

  const infectedThresholds = useMemo(() => {
    const vals = []
    for (const v of simFrame.values()) vals.push(v.infected_frac ?? 0)
    const [t1, t2, t3] = computeQuantiles(vals, [0.5, 0.8, 0.95])
    return { t1, t2, t3 }
  }, [simFrame])

  const layers = useMemo(
    () =>
      buildLayers({
        finlandGeoJson,
        showEdges,
        edgesPerNode,
        radius,
        upperPercentile,
        coverage,
        sigmaKm,
        samplesPerRegion,
        simFrame,
        simDay,
        animTime,
        simulationEnabled,
        infectedThresholds,
      }),
    [
      finlandGeoJson,
      showEdges,
      edgesPerNode,
      radius,
      upperPercentile,
      coverage,
      sigmaKm,
      samplesPerRegion,
      simFrame,
      simDay,
      animTime,
      simulationEnabled,
      infectedThresholds,
    ]
  )

  // ✅ derive live hovered node data from simFrame (updates every day automatically)
  const hoveredNode = useMemo(() => {
    if (!hover?.node_id) return null
    return simFrame.get(hover.node_id) || null
  }, [hover?.node_id, simFrame])

  // ✅ fallback label for hovered node (REGIONS index mapping)
  const hoveredLabel = useMemo(() => {
    if (!hover?.node_id) return ''
    // try find in simFrame
    const v = simFrame.get(hover.node_id)
    if (v?.node_name) return v.node_name
    // else just show node_id
    return String(hover.node_id)
  }, [hover?.node_id, simFrame])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <DeckGL
        layers={layers}
        initialViewState={INITIAL_VIEW_STATE}
        controller
        // ✅ capture hover and keep it, so tooltip can update without moving mouse
        onHover={(info) => {
          const obj = info?.object
          if (obj && obj.__type === 'node') {
            setHover({ x: info.x, y: info.y, node_id: obj.node_id })
          } else {
            setHover(null)
          }
        }}
      >
        <MapGL reuseMaps mapStyle={MAP_STYLE} />
      </DeckGL>

      {/* ✅ REAL-TIME TOOLTIP (updates when simDay/simFrame changes) */}
      {hover && (
        <div
          style={{
            position: 'absolute',
            left: hover.x + 12,
            top: hover.y + 12,
            zIndex: 10000,
            pointerEvents: 'none',
            background: 'rgba(0,0,0,0.78)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 12,
            padding: '10px 12px',
            width: 260,
            fontSize: 12,
            lineHeight: 1.35,
            backdropFilter: 'blur(8px)',
            whiteSpace: 'pre-line',
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 6 }}>
            {hoveredLabel}
          </div>
          <div style={{ opacity: 0.9 }}>
            Day: <b>{simDay}</b>
          </div>

          {hoveredNode ? (
            <div style={{ marginTop: 8, opacity: 0.95 }}>
              <div>population: {fmt(hoveredNode.population)}</div>
              <div>susceptible: {fmt(hoveredNode.susceptible)}</div>
              <div>latent: {fmt(hoveredNode.latent)}</div>
              <div>infectious_a: {fmt(hoveredNode.infectious_a)}</div>
              <div>infectious_t: {fmt(hoveredNode.infectious_t)}</div>
              <div>infectious_nt: {fmt(hoveredNode.infectious_nt)}</div>
              <div>
                infectious_total: <b>{fmt(hoveredNode.infectious)}</b>
              </div>
              <div>recovered: {fmt(hoveredNode.recovered)}</div>
              <div style={{ marginTop: 6 }}>
                infected_frac:{' '}
                <b>{((hoveredNode.infected_frac ?? 0) * 100).toFixed(2)}%</b>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 8, opacity: 0.8 }}>No data</div>
          )}
        </div>
      )}

      {/* RIGHT PANEL */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          zIndex: 9999,
          width: 340,
          padding: 14,
          borderRadius: 16,
          background: 'rgba(0,0,0,0.72)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: 'white',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontWeight: 900, letterSpacing: 1 }}>SIMULATION</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Day: <b>{simDay}</b>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <DiseaseDropdown
            value={selectedDisease}
            onChange={setSelectedDisease}
            label="Disease"
            placeholder="Select disease…"
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <SimulationPlayer
            url="/merged_gleam_data.csv"
            fps={6}
            enabled={simulationEnabled}
            playing={playing}
            onPlayingChange={setPlaying}
            onFrame={({ day, frame }) => {
              setSimDay(day)
              setSimFrame(frame)
            }}
          />
        </div>
      </div>

      {/* LEFT CONTROLS */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: controlsOpen ? 14 : -260,
          zIndex: 50,
          width: 250,
          padding: 12,
          borderRadius: 12,
          background: 'rgba(0,0,0,0.68)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.18)',
          transition: 'left 180ms ease',
        }}
      >
        <button
          onClick={() => setControlsOpen((v) => !v)}
          style={{
            position: 'absolute',
            top: 10,
            right: -36,
            width: 32,
            height: 32,
            borderRadius: 10,
            background: 'rgba(0,0,0,0.78)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.25)',
            cursor: 'pointer',
          }}
          title={controlsOpen ? 'Collapse' : 'Expand'}
        >
          {controlsOpen ? '◀' : '▶'}
        </button>

        <div style={{ fontWeight: 700, marginBottom: 10 }}>Map Controls</div>

        <div className="row">
          <label>Show edges</label>
          <input type="checkbox" checked={showEdges} onChange={(e) => setShowEdges(e.target.checked)} />
        </div>

        <div className="row">
          <label>Edges/node</label>
          <input type="range" min="1" max="8" value={edgesPerNode} onChange={(e) => setEdgesPerNode(+e.target.value)} />
          <span>{edgesPerNode}</span>
        </div>

        <div className="row">
          <label>Hex radius (m)</label>
          <input type="range" min="500" max="5000" value={radius} onChange={(e) => setRadius(+e.target.value)} />
          <span>{radius}</span>
        </div>

        <div className="row">
          <label>Upper %</label>
          <input type="range" min="50" max="100" value={upperPercentile} onChange={(e) => setUpperPercentile(+e.target.value)} />
          <span>{upperPercentile}</span>
        </div>

        <div className="row">
          <label>Coverage</label>
          <input type="range" min="0.5" max="1" step="0.01" value={coverage} onChange={(e) => setCoverage(+e.target.value)} />
          <span>{coverage.toFixed(2)}</span>
        </div>

        <div className="row">
          <label>Sigma (km)</label>
          <input type="range" min="20" max="150" value={sigmaKm} onChange={(e) => setSigmaKm(+e.target.value)} />
          <span>{sigmaKm}</span>
        </div>

        <div className="row">
          <label>Samples/region</label>
          <input type="range" min="20" max="300" step="10" value={samplesPerRegion} onChange={(e) => setSamplesPerRegion(+e.target.value)} />
          <span>{samplesPerRegion}</span>
        </div>

        <div className="row" style={{ opacity: 0.8, fontSize: 12 }}>
          Regions loaded: {REGIONS.length}
        </div>
      </div>
    </div>
  )
}

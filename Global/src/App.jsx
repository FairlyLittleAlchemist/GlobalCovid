import { useEffect, useMemo, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { AmbientLight, PointLight, LightingEffect } from '@deck.gl/core'
import { HexagonLayer } from '@deck.gl/aggregation-layers'
import { ScatterplotLayer, ArcLayer, GeoJsonLayer, TextLayer } from '@deck.gl/layers'
import { Map } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'

const REGIONS = [
  { region: 'Lapland', lat: 66.5031, lng: 25.7269 },
  { region: 'North Ostrobothnia', lat: 65.0124, lng: 25.4682 },
  { region: 'Kainuu', lat: 64.2251, lng: 27.7315 },
  { region: 'North Karelia', lat: 62.6, lng: 29.76 },
  { region: 'North Savo', lat: 62.8924, lng: 27.677 },
  { region: 'South Savo', lat: 61.691, lng: 27.2723 },
  { region: 'South Karelia', lat: 61.0587, lng: 28.1887 },
  { region: 'Central Finland', lat: 62.2415, lng: 25.7209 },
  { region: 'South Ostrobothnia', lat: 62.7945, lng: 22.8282 },
  { region: 'Ostrobothnia', lat: 63.096, lng: 21.6158 },
  { region: 'Central Ostrobothnia', lat: 63.8459, lng: 23.1422 },
  { region: 'Pirkanmaa', lat: 61.4991, lng: 23.7871 },
  { region: 'Satakunta', lat: 61.4807, lng: 21.7852 },
  { region: 'Päijät-Häme', lat: 60.9827, lng: 25.6615 },
  { region: 'Kanta-Häme', lat: 60.9959, lng: 24.4643 },
  { region: 'Kymenlaakso', lat: 60.4723, lng: 26.9396 },
  { region: 'Uusimaa', lat: 60.1695, lng: 24.9355 },
  { region: 'Southwest Finland', lat: 60.4515, lng: 22.2687 },
  { region: 'Åland', lat: 60.097, lng: 19.934 },
]

const INITIAL_VIEW_STATE = {
  longitude: 25.5,
  latitude: 64,
  zoom: 4.3,
  minZoom: 3.5,
  maxZoom: 10,
  pitch: 40,
  bearing: 0,
}

const MAP_STYLE =
  'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json'

const colorRange = [
  [1, 152, 189],
  [73, 227, 206],
  [216, 254, 181],
  [254, 237, 177],
  [254, 173, 84],
  [209, 55, 78],
]

// ---- Lighting
const ambientLight = new AmbientLight({
  color: [255, 255, 255],
  intensity: 1.0,
})

const pointLight1 = new PointLight({
  color: [255, 255, 255],
  intensity: 0.8,
  position: [-0.144528, 49.739968, 80000],
})

const pointLight2 = new PointLight({
  color: [255, 255, 255],
  intensity: 0.8,
  position: [-3.807751, 54.104682, 8000],
})

const lightingEffect = new LightingEffect({ ambientLight, pointLight1, pointLight2 })

// ---- Tooltip
function getTooltip({ object, layer }) {
  if (!object) return null

  if (layer?.id === 'region-nodes') {
    return `${object.region}\nlat: ${object.lat.toFixed(4)}\nlng: ${object.lng.toFixed(4)}`
  }

  if (layer?.id === 'region-edges') {
    return `${object.source} → ${object.target}\nweight: ${object.weight.toFixed(3)}`
  }

  // Hex tooltip fallback
  const [lng, lat] = object.position
  const count = object.count
  const weightSum = object.points?.reduce((sum, p) => sum + (p.weight || 1), 0) ?? count
  return `lat: ${lat.toFixed(4)}\nlng: ${lng.toFixed(4)}\ncount: ${count}\nweight sum: ${weightSum.toFixed(2)}`
}

// ---- Deterministic RNG
function seededRandom(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return (x - Math.floor(x)) + 1e-9
}

function seededGaussian(seed, mean = 0, std = 1) {
  const u = seededRandom(seed)
  const v = seededRandom(seed + 1)
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

// ---- Heatmap demo data
function makeGaussianCloud(regions, samplesPerRegion, sigmaKm) {
  const kmPerDegLat = 111
  const points = []
  regions.forEach((r, rIdx) => {
    const sigmaLatDeg = sigmaKm / kmPerDegLat
    const cosLat = Math.cos((r.lat * Math.PI) / 180)
    const sigmaLonDeg = sigmaLatDeg / Math.max(cosLat, 0.3)
    for (let i = 0; i < samplesPerRegion; i++) {
      const seed = rIdx * samplesPerRegion * 2 + i * 2 + 1
      const dLat = seededGaussian(seed, 0, sigmaLatDeg)
      const dLon = seededGaussian(seed + 100000, 0, sigmaLonDeg)
      const lat = r.lat + dLat
      const lng = r.lng + dLon
      const radialKm = Math.sqrt((dLat * kmPerDegLat) ** 2 + (dLon * kmPerDegLat * cosLat) ** 2)
      const weight = Math.exp(-(radialKm ** 2) / (2 * sigmaKm ** 2))
      points.push({ position: [lng, lat], weight })
    }
  })
  return points
}

// ---- Region-to-region edges (deterministic demo)
function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2

  return 2 * R * Math.asin(Math.sqrt(h))
}

function makeEdges(regions, maxEdgesPerNode = 3) {
  const edges = []
  regions.forEach((src, i) => {
    const nearest = regions
      .map((tgt, j) => {
        if (i === j) return null
        const d = haversineKm(src, tgt)
        return { src, tgt, d }
      })
      .filter(Boolean)
      .sort((a, b) => a.d - b.d)
      .slice(0, maxEdgesPerNode)

    nearest.forEach((x, k) => {
      const noise = seededRandom(i * 999 + k * 77)
      const w = Math.exp(-(x.d ** 2) / (2 * 350 ** 2)) * (0.6 + 0.4 * noise)
      edges.push({
        source: x.src.region,
        target: x.tgt.region,
        sourceLat: x.src.lat,
        sourceLng: x.src.lng,
        targetLat: x.tgt.lat,
        targetLng: x.tgt.lng,
        weight: w,
      })
    })
  })
  return edges
}

function App() {
  const [radius, setRadius] = useState(18000)
  const [upperPercentile, setUpperPercentile] = useState(98)
  const [coverage, setCoverage] = useState(0.9)
  const [dataVersion, setDataVersion] = useState(0)
  const [sigmaKm, setSigmaKm] = useState(70)
  const [samplesPerRegion, setSamplesPerRegion] = useState(140)

  const [showEdges, setShowEdges] = useState(true)
  const [edgesPerNode, setEdgesPerNode] = useState(3)

  // Finland outline GeoJSON loaded from /public
  const [finlandGeoJson, setFinlandGeoJson] = useState(null)

  useEffect(() => {
    fetch('/finland.geojson')
      .then((r) => r.json())
      .then(setFinlandGeoJson)
      .catch(() => setFinlandGeoJson(null))
  }, [])

  const data = useMemo(
    () => makeGaussianCloud(REGIONS, samplesPerRegion, sigmaKm),
    [dataVersion, samplesPerRegion, sigmaKm]
  )

  const edges = useMemo(() => makeEdges(REGIONS, edgesPerNode), [edgesPerNode])

  const layers = useMemo(() => {
    const baseLayers = []

    // FINLAND label (bold white uppercase)
    baseLayers.push(
      new TextLayer({
        id: 'finland-label',
        data: [{ text: 'FINLAND', position: [26.0, 64.5] }],
        getText: (d) => d.text,
        getPosition: (d) => d.position,
        getSize: 24,
        sizeUnits: 'pixels',
        getColor: [255, 255, 255, 240],
        fontFamily: 'sans-serif',
        fontWeight: 900,
        billboard: true,
        pickable: false,
        background: true,
        getBackgroundColor: [0, 0, 0, 110],
      })
    )

   // Finland fill (Google-like)
if (finlandGeoJson) {
  baseLayers.push(
    new GeoJsonLayer({
      id: 'finland-fill',
      data: finlandGeoJson,
      filled: true,
      stroked: false,
      getFillColor: [240, 180, 90, 120], // warm fill
      pickable: false,
    })
  )
}

// Finland outline (clean blue)
if (finlandGeoJson) {
  baseLayers.push(
    new GeoJsonLayer({
      id: 'finland-outline',
      data: finlandGeoJson,
      filled: false,
      stroked: true,
      getLineColor: [0, 140, 255, 230],
      lineWidthMinPixels: 2,
      pickable: false,
    })
  )
}


    // Optional region edges
    if (showEdges) {
      baseLayers.push(
        new ArcLayer({
          id: 'region-edges',
          data: edges,
          pickable: true,
          getSourcePosition: (d) => [d.sourceLng, d.sourceLat],
          getTargetPosition: (d) => [d.targetLng, d.targetLat],
          getWidth: (d) => 1 + 6 * d.weight,
          widthUnits: 'pixels',
          getSourceColor: [150, 150, 150, 140],
          getTargetColor: [150, 150, 150, 140],
        })
      )
    }

    // Heatmap (existing)
    baseLayers.push(
      new HexagonLayer({
        id: 'heatmap',
        data,
        pickable: true,
        extruded: true,
        colorRange,
        coverage,
        radius,
        upperPercentile,
        elevationRange: [0, 3000],
        elevationScale: data.length ? 120 : 0,
        getPosition: (d) => d.position,
        getElevationWeight: (d) => d.weight ?? 1,
        getColorWeight: (d) => d.weight ?? 1,
        material: {
          ambient: 0.64,
          diffuse: 0.6,
          shininess: 32,
          specularColor: [51, 51, 51],
        },
        transitions: {
          elevationScale: 3000,
        },
      })
    )

    // Region nodes
    baseLayers.push(
      new ScatterplotLayer({
        id: 'region-nodes',
        data: REGIONS,
        pickable: true,
        getPosition: (d) => [d.lng, d.lat],
        getRadius: 18000,
        radiusUnits: 'meters',
        getFillColor: [255, 255, 255, 180],
        getLineColor: [0, 0, 0, 220],
        lineWidthMinPixels: 1,
        stroked: true,
      })
    )

    return baseLayers
  }, [data, coverage, radius, upperPercentile, edges, showEdges, edgesPerNode, finlandGeoJson])

  return (
    <div className="app">
      <DeckGL
        layers={layers}
        effects={[lightingEffect]}
        initialViewState={INITIAL_VIEW_STATE}
        controller
        getTooltip={getTooltip}
      >
        <Map reuseMaps mapStyle={MAP_STYLE} />
      </DeckGL>

      <div className="debug-panel">
        <div className="debug-row">
          <label>Show edges</label>
          <input
            type="checkbox"
            checked={showEdges}
            onChange={(e) => setShowEdges(e.target.checked)}
          />
          <span>{showEdges ? 'On' : 'Off'}</span>
        </div>

        <div className="debug-row">
          <label htmlFor="edgesPerNode">Edges/node</label>
          <input
            id="edgesPerNode"
            type="range"
            min="1"
            max="8"
            step="1"
            value={edgesPerNode}
            onChange={(e) => setEdgesPerNode(Number(e.target.value))}
          />
          <span>{edgesPerNode}</span>
        </div>

        <div className="debug-row">
          <label htmlFor="radius">Hex radius (m)</label>
          <input
            id="radius"
            type="range"
            min="500"
            max="5000"
            step="100"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          />
          <span>{radius.toLocaleString()} m</span>
        </div>

        <div className="debug-row">
          <label htmlFor="upper">Upper %</label>
          <input
            id="upper"
            type="range"
            min="50"
            max="100"
            step="1"
            value={upperPercentile}
            onChange={(e) => setUpperPercentile(Number(e.target.value))}
          />
          <span>{upperPercentile}%</span>
        </div>

        <div className="debug-row">
          <label htmlFor="coverage">Coverage</label>
          <input
            id="coverage"
            type="range"
            min="0.5"
            max="1"
            step="0.01"
            value={coverage}
            onChange={(e) => setCoverage(Number(e.target.value))}
          />
          <span>{coverage.toFixed(2)}</span>
        </div>

        <div className="debug-row">
          <label htmlFor="sigma">Sigma (km)</label>
          <input
            id="sigma"
            type="range"
            min="20"
            max="150"
            step="1"
            value={sigmaKm}
            onChange={(e) => setSigmaKm(Number(e.target.value))}
          />
          <span>{sigmaKm} km</span>
        </div>

        <div className="debug-row">
          <label htmlFor="samples">Samples/region</label>
          <input
            id="samples"
            type="range"
            min="20"
            max="300"
            step="10"
            value={samplesPerRegion}
            onChange={(e) => setSamplesPerRegion(Number(e.target.value))}
          />
          <span>{samplesPerRegion}</span>
        </div>

        <button
          type="button"
          onClick={() => setDataVersion((n) => n + 1)}
          style={{
            padding: '0.45rem 0.75rem',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.08)',
            color: 'inherit',
            cursor: 'pointer',
          }}
        >
          Regenerate weights
        </button>

        <div style={{ marginTop: '0.75rem', opacity: 0.8, fontSize: '0.85rem', lineHeight: 1.35 }}>
          <div>
            <b>Note:</b> Add a file <code>public/finland_outline.geojson</code> to enable the blue outline.
          </div>
          <div>
            If it’s missing, the app still runs — only the outline won’t show.
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

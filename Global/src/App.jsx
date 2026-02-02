import { useEffect, useMemo, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { AmbientLight, PointLight, LightingEffect } from '@deck.gl/core'
import { HexagonLayer } from '@deck.gl/aggregation-layers'
import { Map } from 'react-map-gl/maplibre'
import { load } from '@loaders.gl/core'
import { CSVLoader } from '@loaders.gl/csv'
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
  longitude: 25.5, // Finland center-ish
  latitude: 64,
  zoom: 4.3,
  minZoom: 3.5,
  maxZoom: 10,
  pitch: 40,
  bearing: 0,
}

const MAP_STYLE =
  'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json'

const CITIES_CSV_URL = '/fi.csv'

const colorRange = [
  [1, 152, 189],
  [73, 227, 206],
  [216, 254, 181],
  [254, 237, 177],
  [254, 173, 84],
  [209, 55, 78],
]

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

function getTooltip({ object }) {
  if (!object) return null
  const [lng, lat] = object.position
  const count = object.count
  const weightSum = object.points?.reduce((sum, p) => sum + (p.weight || 1), 0) ?? count
  return `lat: ${lat.toFixed(4)}\nlng: ${lng.toFixed(4)}\ncount: ${count}\nweight sum: ${weightSum.toFixed(
    2
  )}`
}

function seededRandom(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return (x - Math.floor(x)) + 1e-9 // avoid zero
}

function seededGaussian(seed, mean = 0, std = 1) {
  // Box–Muller using deterministic seeds
  const u = seededRandom(seed)
  const v = seededRandom(seed + 1)
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

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

function App() {
  const [radius, setRadius] = useState(18000)
  const [upperPercentile, setUpperPercentile] = useState(98)
  const [coverage, setCoverage] = useState(0.9)
  const [dataVersion, setDataVersion] = useState(0)
  const [sigmaKm, setSigmaKm] = useState(70)
  const [samplesPerRegion, setSamplesPerRegion] = useState(140)
  const [mode, setMode] = useState('regions') // 'regions' | 'cities'
  const [cityData, setCityData] = useState([])

  useEffect(() => {
    load(CITIES_CSV_URL, CSVLoader).then((res) => {
      const rows = res?.data ?? res ?? []
      const pts = rows
        .map((r) => ({
          position: [Number(r.lng), Number(r.lat)],
          weight: Number(r.population) || 1,
          city: r.city,
        }))
        .filter((p) => Number.isFinite(p.position[0]) && Number.isFinite(p.position[1]))
      setCityData(pts)
    })
  }, [])

  const data = useMemo(() => {
    if (mode === 'cities') return cityData
    return makeGaussianCloud(REGIONS, samplesPerRegion, sigmaKm)
  }, [mode, cityData, samplesPerRegion, sigmaKm, dataVersion])

  const layers = useMemo(() => {
    return [
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
      }),
    ]
  }, [data, coverage, radius, upperPercentile])

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
          <label>Dataset</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <label>
              <input
                type="radio"
                name="mode"
                value="regions"
                checked={mode === 'regions'}
                onChange={() => setMode('regions')}
              />{' '}
              Regions
            </label>
            <label>
              <input
                type="radio"
                name="mode"
                value="cities"
                checked={mode === 'cities'}
                onChange={() => setMode('cities')}
              />{' '}
              Cities
            </label>
          </div>
          <span />
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
      </div>
    </div>
  )
}

export default App

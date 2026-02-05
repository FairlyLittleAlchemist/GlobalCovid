// src/map/layers.js
import { HexagonLayer } from '@deck.gl/aggregation-layers'
import { ArcLayer, GeoJsonLayer, TextLayer, ColumnLayer } from '@deck.gl/layers'
import { COLOR_RANGE, REGIONS } from './constants.js'

function seededRandom(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function seededGaussian(seed, mean = 0, std = 1) {
  const u = seededRandom(seed) || 1e-9
  const v = seededRandom(seed + 1)
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function makeGaussianCloud(regions, samples, sigmaKm) {
  const kmPerDeg = 111
  const pts = []
  regions.forEach((r, ri) => {
    const sigmaLat = sigmaKm / kmPerDeg
    const cosLat = Math.cos((r.lat * Math.PI) / 180)
    const sigmaLon = sigmaLat / Math.max(cosLat, 0.3)

    for (let i = 0; i < samples; i++) {
      const dLat = seededGaussian(ri * 1000 + i, 0, sigmaLat)
      const dLon = seededGaussian(ri * 1000 + i + 999, 0, sigmaLon)
      const lat = r.lat + dLat
      const lng = r.lng + dLon

      const distKm = Math.sqrt((dLat * kmPerDeg) ** 2 + (dLon * kmPerDeg * cosLat) ** 2)

      pts.push({
        position: [lng, lat],
        weight: Math.exp(-(distKm ** 2) / (2 * sigmaKm ** 2)),
      })
    }
  })
  return pts
}

function haversineKm(a, b) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lng - a.lng)
  const la1 = toRad(a.lat)
  const la2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function makeEdges(regions, k) {
  const edges = []
  regions.forEach((src, i) => {
    regions
      .map((tgt, j) => (i === j ? null : { src, tgt, d: haversineKm(src, tgt) }))
      .filter(Boolean)
      .sort((a, b) => a.d - b.d)
      .slice(0, k)
      .forEach((x) =>
        edges.push({
          sourceLat: x.src.lat,
          sourceLng: x.src.lng,
          targetLat: x.tgt.lat,
          targetLng: x.tgt.lng,
          weight: Math.exp(-(x.d ** 2) / (2 * 350 ** 2)),
        })
      )
  })
  return edges
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}

// ✅ 4-band colors (green -> yellow -> orange -> red)
const COLOR_GREEN = [171, 214, 126, 240]
const COLOR_YELLOW = [255, 235, 59, 240]
const COLOR_ORANGE = [255, 152, 0, 240]
const COLOR_RED = [244, 67, 54, 240]

function bandColor(infectedFrac, thresholds) {
  const x = Math.max(0, infectedFrac || 0)
  const t1 = thresholds?.t1 ?? 0.002
  const t2 = thresholds?.t2 ?? 0.006
  const t3 = thresholds?.t3 ?? 0.012

  if (x <= t1) return COLOR_GREEN
  if (x <= t2) return COLOR_YELLOW
  if (x <= t3) return COLOR_ORANGE
  return COLOR_RED
}

function buildRegionStats(simFrame) {
  if (!simFrame || typeof simFrame.values !== 'function') return []
  const arr = Array.from(simFrame.values())
  arr.sort((a, b) => String(a.node_id).localeCompare(String(b.node_id)))
  return arr
}

export function buildLayers({
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
  infectedThresholds,
}) {
  const layers = []
  const regionStats = buildRegionStats(simFrame)

  if (finlandGeoJson) {
    layers.push(
      new GeoJsonLayer({
        id: 'finland-fill',
        data: finlandGeoJson,
        filled: true,
        stroked: false,
        getFillColor: [240, 180, 90, 110],
        pickable: false,
      }),
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

  // edges unchanged
  if (showEdges) {
    const edges = makeEdges(REGIONS, edgesPerNode)
    layers.push(
      new ArcLayer({
        id: `region-edges-${edgesPerNode}`,
        data: edges,
        getSourcePosition: (d) => [d.sourceLng, d.sourceLat],
        getTargetPosition: (d) => [d.targetLng, d.targetLat],
        getWidth: (d) => 1 + 5 * d.weight,
        widthUnits: 'pixels',
        getSourceColor: [180, 180, 180, 160],
        getTargetColor: [180, 180, 180, 160],
        pickable: false,
      })
    )
  }

  // background hex heatmap unchanged
  const hexData = makeGaussianCloud(REGIONS, samplesPerRegion, sigmaKm)
  layers.push(
    new HexagonLayer({
      id: `hex-${radius}-${sigmaKm}-${samplesPerRegion}`,
      data: hexData,
      getPosition: (d) => d.position,
      getElevationWeight: (d) => d.weight,
      getColorWeight: (d) => d.weight,
      radius,
      upperPercentile,
      coverage,
      extruded: true,
      elevationScale: 120,
      colorRange: COLOR_RANGE,
      pickable: false,
    })
  )

  // ✅ circular pillars: big scaling
  const SCALE = 20
  const BASE = 2000
  const AMP = 18000 * SCALE

  function heightBoost(frac) {
    const x = clamp01(frac)
    return Math.pow(x, 0.35)
//return Math.sqrt(x) // boosts small values so it looks good when zoomed out
  }

  const nodeData = REGIONS.map((r, idx) => {
    const s = regionStats[idx]
    const infected_frac = s?.infected_frac ?? 0

    return {
      __type: 'node',
      label: r.region,
      lng: r.lng,
      lat: r.lat,

      node_id: s?.node_id ?? '',
      node_name: s?.node_name ?? r.region,
      day: simDay ?? 0,
      population: s?.population ?? 0,
      susceptible: s?.susceptible ?? 0,
      latent: s?.latent ?? 0,
      infectious: s?.infectious ?? 0,
      infectious_a: s?.infectious_a ?? 0,
      infectious_t: s?.infectious_t ?? 0,
      infectious_nt: s?.infectious_nt ?? 0,
      recovered: s?.recovered ?? 0,

      infected_frac,
    }
  })

  layers.push(
    new ColumnLayer({
      id: `nodes-cyl-3d-${simDay ?? 0}`,
      data: nodeData,
      getPosition: (d) => [d.lng, d.lat],

      // ✅ circle
      diskResolution: 32,

      // ✅ base size bigger so looks good zoomed out
      radius: 22000,

      // ✅ height
      getElevation: (d) => BASE + AMP * heightBoost(d.infected_frac),
      elevationScale: 1,

      // ✅ use your 4 colors based on data thresholds
      getFillColor: (d) => bandColor(d.infected_frac, infectedThresholds),

      getLineColor: [255, 255, 255, 60],
      getLineWidth: 1,
      lineWidthUnits: 'pixels',

      extruded: true,
      pickable: true,

      material: {
        ambient: 0.25,
        diffuse: 0.6,
        shininess: 35,
        specularColor: [255, 255, 255],
      },

      updateTriggers: {
        getElevation: simDay,
        getFillColor: simDay,
      },
    })
  )

  layers.push(
    new TextLayer({
      id: 'finland-label',
      data: [{ text: 'FINLAND', pos: [26.0, 64.5] }],
      getText: (d) => d.text,
      getPosition: (d) => d.pos,
      getSize: 28,
      sizeUnits: 'pixels',
      getColor: [255, 255, 255, 230],
      billboard: true,
      depthTest: false,
      pickable: false,
    })
  )

  return layers
}

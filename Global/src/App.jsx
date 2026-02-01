import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import ThreeGlobe from 'three-globe'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import './App.css'

function App() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b1020)

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)
    camera.position.set(0, 0, 240)

    const globe = new ThreeGlobe()
      .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
      .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
      .pointsData([
        { lat: 37.7749, lng: -122.4194, size: 0.35, color: 'orange' },
        { lat: 51.5074, lng: -0.1278, size: 0.35, color: 'cyan' },
      ])
      .pointLat('lat')
      .pointLng('lng')
      .pointColor('color')
      .pointAltitude(0.02)
      .pointRadius('size')
    scene.add(globe)

    const ambient = new THREE.AmbientLight(0xffffff, 0.8)
    const directional = new THREE.DirectionalLight(0xffffff, 0.7)
    directional.position.set(-100, 50, 200)
    scene.add(ambient, directional)

    const resize = () => {
      const width = canvas.clientWidth || window.innerWidth
      const height = canvas.clientHeight || window.innerHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }

    resize()
    window.addEventListener('resize', resize)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.minDistance = 140
    controls.maxDistance = 420

    let frameId = 0
    const animate = () => {
      controls.update()
      renderer.render(scene, camera)
      frameId = window.requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.removeEventListener('resize', resize)
      window.cancelAnimationFrame(frameId)
      controls.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <div className="app">
      <canvas ref={canvasRef} className="globe" />
    </div>
  )
}

export default App

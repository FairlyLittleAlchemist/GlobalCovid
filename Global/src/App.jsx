import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import MapPage from './pages/MapPage.jsx'
import DashboardPage from './pages/DashboardView.jsx'

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <div className="app-content">
        <Routes>
          <Route path="/" element={<Navigate to="/map" replace />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="*" element={<div style={{ padding: 24 }}>Not found</div>} />
        </Routes>
      </div>
    </div>
  )
}

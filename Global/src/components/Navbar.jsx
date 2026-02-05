// src/components/Navbar.jsx
import { NavLink } from 'react-router-dom'

const linkStyle = ({ isActive }) => ({
  padding: '10px 14px',
  borderRadius: 12,
  textDecoration: 'none',
  fontWeight: 800,
  letterSpacing: 0.4,
  color: 'white',
  background: isActive ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.14)',
})

export default function Navbar() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        left: 14,
        zIndex: 20000,
        display: 'flex',
        gap: 10,
        padding: 10,
        borderRadius: 16,
        background: 'rgba(0,0,0,0.55)',
        border: '1px solid rgba(255,255,255,0.14)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <NavLink to="/map" style={linkStyle}>
        MAP
      </NavLink>
      <NavLink to="/dashboard" style={linkStyle}>
        DASHBOARD
      </NavLink>
    </div>
  )
}

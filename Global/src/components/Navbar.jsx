import { NavLink } from 'react-router-dom'

export default function Navbar() {
  return (
    <div className="navbar">
      <div className="navbar__brand">GLOBALCOVID</div>

      <div className="navbar__links">
        <NavLink to="/map" className={({ isActive }) => (isActive ? 'navlink active' : 'navlink')}>
          Map
        </NavLink>
        <NavLink
          to="/dashboard"
          className={({ isActive }) => (isActive ? 'navlink active' : 'navlink')}
        >
          Dashboard
        </NavLink>
      </div>
    </div>
  )
}

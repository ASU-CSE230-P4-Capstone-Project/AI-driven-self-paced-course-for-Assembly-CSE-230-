import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LAB_COUNT } from './labConfig'

export default function Sidebar() {
  const navigate = useNavigate()
  const [isInstructor, setIsInstructor] = useState(false)
  const [showDocumentation, setShowDocumentation] = useState(false)
  const [documentationTitle, setDocumentationTitle] = useState('')
  const [documentationBody, setDocumentationBody] = useState('')

  useEffect(() => {
  const syncSidebarState = () => {
  setIsInstructor(localStorage.getItem('userRole') === 'admin')
  setShowDocumentation(localStorage.getItem('showLabDocumentation') === 'true')
  setDocumentationTitle(localStorage.getItem('labDocumentationTitle') || '')
  setDocumentationBody(localStorage.getItem('labDocumentationBody') || '')
    }

  syncSidebarState()
  window.addEventListener('lab-doc-toggle', syncSidebarState)
  window.addEventListener('storage', syncSidebarState)
  return () => {
  window.removeEventListener('lab-doc-toggle', syncSidebarState)
  window.removeEventListener('storage', syncSidebarState)
    }
  }, [])

return (
  <nav className={showDocumentation ? 'nav-sidebar nav-sidebar--documentation' : 'nav-sidebar'}>
    {showDocumentation ? (
      <>
        <div className="nav-doc-title">{documentationTitle}</div>
        <div className="nav-doc-body">{documentationBody}</div>
      </>
    ) : (
      <>
        <div className="nav-brand">
          <div className="nav-brand-asu">ASU</div>
          <div className="nav-brand-sub">x86 Emulator</div>
        </div>

        <div className="nav-section-label">LABS</div>

        <ul className="nav-list">
          {Array.from({ length: LAB_COUNT }, (_, i) => i + 1).map((n) => (
            <li key={n}>
              <NavLink
                to={`/lab${n}`}
                className={({ isActive }) =>
                  `nav-link${isActive ? ' nav-link--active' : ''}`
                }
              >
                <span className="nav-link-badge">{n}</span>
                <span className="nav-link-text">Lab {n}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        {isInstructor && (
          <>
            <div className="nav-section-label">Instructor</div>
            <ul className="nav-list" style={{ flex: '0 0 auto', paddingBottom: 8 }}>
              <li>
                <NavLink
                  to="/submissions"
                  className={({ isActive }) =>
                    `nav-link${isActive ? ' nav-link--active' : ''}`
                  }
                >
                  <span className="nav-link-text">Submissions</span>
                </NavLink>
              </li>
            </ul>
          </>
        )}

        <div style={{ flex: 1 }} />

        <div className="nav-mode-switch">
          <button className="nav-mode-btn" onClick={() => navigate('/emulator')}>
            Emulator View
          </button>
        </div>

        <div className="nav-footer">
          <span>x86-32 Subset</span>
        </div>
      </>
    )}
  </nav>
  )
}

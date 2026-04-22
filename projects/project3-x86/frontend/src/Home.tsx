import { useNavigate } from 'react-router-dom'
import './App.css'

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand">ASU</div>
        <div className="title">Online Assembly x86 Emulator</div>
      </header>

      <main style={{ display: 'grid', placeItems: 'center', minHeight: 'calc(100vh - 60px)', padding: '2rem' }}>
        <div style={{ display: 'grid', gap: '1rem', width: '100%', maxWidth: '520px', padding: '2rem', background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ margin: 0, textAlign: 'center' }}>Instructor Dashboard</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <button onClick={() => navigate('/emulator')} className="primary">
              Emulator View
            </button>
            <button onClick={() => navigate('/lab1')} className="primary">
              Lab View
            </button>
            <button onClick={() => navigate('/submissions')} className="primary">
              Student Submissions
            </button>
            <button type="button" className="primary">
              Roster List
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

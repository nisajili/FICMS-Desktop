import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { PatientsPage } from './pages/Patients';
import { SettingsPage } from './pages/SettingsPage';

function Shell() {
  const { user, logout, mode } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">F</span>
          <div>
            <div className="brand-name">FICMS</div>
            <div className="brand-sub">{mode === 'preview' ? 'browser preview' : `${mode} mode`}</div>
          </div>
        </div>
        <nav>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/patients">Patients</NavLink>
          <NavLink to="/settings">Clinic settings</NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="who">
            <div className="who-name">{user?.fullName}</div>
            <div className="who-roles">{(user?.roles ?? []).join(', ')}</div>
          </div>
          <button className="btn btn-ghost" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="boot">
        <div className="brand-mark large">F</div>
        <p>Starting FICMS…</p>
      </div>
    );
  }

  if (!token) return <LoginPage />;
  return <Shell />;
}

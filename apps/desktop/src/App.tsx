import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { PatientsPage } from './pages/Patients';
import { AppointmentsPage } from './pages/Appointments';
import { ClinicalPage } from './pages/Clinical';
import { CyclesPage } from './pages/Cycles';
import { LaboratoryPage } from './pages/Laboratory';
import { CryobankPage } from './pages/Cryobank';
import { FinancePage } from './pages/Finance';
import { InventoryPage } from './pages/Inventory';
import { DonorsPage } from './pages/Donors';
import { CounselingPage } from './pages/Counseling';
import { HrPage } from './pages/Hr';
import { ImagingPage } from './pages/Imaging';
import { NursingPage } from './pages/Nursing';
import { ReportsPage } from './pages/Reports';
import { SettingsPage } from './pages/SettingsPage';

interface NavGroup {
  title: string;
  links: { to: string; label: string }[];
}

const NAV: NavGroup[] = [
  {
    title: 'Overview',
    links: [
      { to: '/', label: 'Dashboard' },
      { to: '/reports', label: 'Reports' }
    ]
  },
  {
    title: 'Front desk',
    links: [
      { to: '/patients', label: 'Patients' },
      { to: '/appointments', label: 'Appointments' }
    ]
  },
  {
    title: 'Clinical',
    links: [
      { to: '/clinical', label: 'EMR' },
      { to: '/cycles', label: 'ART cycles' },
      { to: '/imaging', label: 'Ultrasound' },
      { to: '/nursing', label: 'Nursing' },
      { to: '/counseling', label: 'Counseling' }
    ]
  },
  {
    title: 'Labs',
    links: [
      { to: '/laboratory', label: 'Laboratory' },
      { to: '/cryobank', label: 'Cryobank' },
      { to: '/donors', label: 'Donors' }
    ]
  },
  {
    title: 'Operations',
    links: [
      { to: '/finance', label: 'Finance' },
      { to: '/inventory', label: 'Inventory' }
    ]
  },
  {
    title: 'Administration',
    links: [
      { to: '/hr', label: 'Human resources' },
      { to: '/settings', label: 'Clinic settings' }
    ]
  }
];

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
          {NAV.map((group) => (
            <div key={group.title}>
              <div className="nav-title">{group.title}</div>
              {group.links.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.to === '/'}>
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))}
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
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/clinical" element={<ClinicalPage />} />
          <Route path="/cycles" element={<CyclesPage />} />
          <Route path="/laboratory" element={<LaboratoryPage />} />
          <Route path="/cryobank" element={<CryobankPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/donors" element={<DonorsPage />} />
          <Route path="/counseling" element={<CounselingPage />} />
          <Route path="/hr" element={<HrPage />} />
          <Route path="/imaging" element={<ImagingPage />} />
          <Route path="/nursing" element={<NursingPage />} />
          <Route path="/reports" element={<ReportsPage />} />
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

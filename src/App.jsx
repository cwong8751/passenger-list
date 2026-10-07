import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from './session.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Home from './pages/Home.jsx';
import Settings from './pages/Settings.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
  const { data, loading, logout } = useSession();
  if (loading) return <p className="center muted">Loading…</p>;
  if (!data) return <AuthPage />;
  const isAdmin = data.user.role === 'admin';
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">🏍 Passenger List</Link>
        <nav>
          <NavLink to="/" end>{isAdmin ? 'Dashboard' : 'Ride'}</NavLink>
          {!isAdmin && <NavLink to="/settings">Settings</NavLink>}
          <button className="link" onClick={logout}>Sign out ({data.user.username})</button>
        </nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={isAdmin ? <Admin /> : <Home />} />
          <Route path="/settings" element={isAdmin ? <Navigate to="/" /> : <Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </>
  );
}

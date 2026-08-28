import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { apiGet } from './api/client';
import { AuthProvider, useAuth } from './context/AuthContext';

// Modern admin panel theme (scoped under .admin-shell, no effect on public pages)
import './pages/admin/admin-theme.css';

// Pages
import MainPage from './pages/client/MainPage';
import AdminLoginPage from './pages/admin/LoginPage';
import Dashboard from './pages/admin/Dashboard';
import MapsPage from './pages/admin/MapsPage';
import CreateMapPage from './pages/admin/MapsPage/crud/createAndEdit';
import NarrativesPage from './pages/admin/NarrativesPage';
import CreateNarrativePage from './pages/admin/NarrativesPage/crud/createAndEdit';
import SettingsPage from './pages/admin/SettingsPage';
import MapGroupsPage from './pages/admin/MapGroupsPage';
import CreateMapGroupPage from './pages/admin/MapGroupsPage/crud/createAndEdit';
import ErasPage from './pages/admin/ErasPage';
import CreateEraPage from './pages/admin/ErasPage/crud/createAndEdit';
import MediaPage from './pages/admin/MediaPage';

// Gates the admin routes behind a real login (see src/context/AuthContext.js)
// instead of the old client-side localStorage flag.
function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/admin" replace />;
  return children;
}

function App() {
  useEffect(() => {
    const fetchProjectTitle = async () => {
      try {
        const data = await apiGet('/api/settings/public');
        document.title = (data && data.projectTitle) || 'Mapping Power';
      } catch (error) {
        console.error('Error fetching project title:', error);
      }
    };

    fetchProjectTitle();
  }, []);

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/admin" element={<AdminLoginPage />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/maps" element={<RequireAuth><MapsPage /></RequireAuth>} />
          <Route path="/new-map" element={<RequireAuth><CreateMapPage /></RequireAuth>} />
          <Route path="/edit-map/:id" element={<RequireAuth><CreateMapPage /></RequireAuth>} />
          <Route path="/map-groups" element={<RequireAuth><MapGroupsPage /></RequireAuth>} />
          <Route path="/new-map-group" element={<RequireAuth><CreateMapGroupPage /></RequireAuth>} />
          <Route path="/edit-map-group/:id" element={<RequireAuth><CreateMapGroupPage /></RequireAuth>} />
          <Route path="/eras" element={<RequireAuth><ErasPage /></RequireAuth>} />
          <Route path="/create-era" element={<RequireAuth><CreateEraPage /></RequireAuth>} />
          <Route path="/edit-era/:id" element={<RequireAuth><CreateEraPage /></RequireAuth>} />
          <Route path="/media" element={<RequireAuth><MediaPage /></RequireAuth>} />
          <Route path="/narratives" element={<RequireAuth><NarrativesPage /></RequireAuth>} />
          <Route path="/create-narrative" element={<RequireAuth><CreateNarrativePage /></RequireAuth>} />
          <Route path="/edit-narrative/:id" element={<RequireAuth><CreateNarrativePage /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

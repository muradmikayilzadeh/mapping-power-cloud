import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore'; // Firestore imports
import { db } from './firebase'; // Adjust the path as per your setup

// Modern admin panel theme (scoped under .admin-shell, no effect on public pages)
import './pages/admin/admin-theme.css';

// Components
import Navbar from './components/Navbar';
import Controller from './components/Controller';
import Basemaps from './components/BaseMaps';

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

// --- Simple page component that prompts for a password and sets a flag ---
function AuthorizePage() {
  const ranRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Guard against double-invocation in React Strict Mode
    if (ranRef.current) return;
    ranRef.current = true;

    const input = window.prompt('Enter authorization password:');
    const ok = input === '2pygafmX64LY';

    if (ok) {
      localStorage.setItem('isAuthorized', 'true');
      alert('✅ Authorized successfully.');
      // Navigate to homepage after clicking OK on alert
      setTimeout(() => {
        navigate('/');
      }, 0);
    } else {
      localStorage.removeItem('isAuthorized');
      alert('❌ Incorrect password.');
      // Navigate to homepage even on failure
      setTimeout(() => {
        navigate('/');
      }, 0);
    }
  }, [navigate]);

  // You can render anything here; the important work happens in useEffect.
  return null;
}

function App() {
  useEffect(() => {
    const fetchProjectTitle = async () => {
      try {
        const docRef = doc(db, 'settings', 'settingsData'); // Firestore document reference
        const docSnap = await getDoc(docRef); // Fetch document

        if (docSnap.exists()) {
          const data = docSnap.data();
          document.title = data.projectTitle || 'Mapping Power'; // Assign projectTitle to document.title
        } else {
          console.error('No such document!');
        }
      } catch (error) {
        console.error('Error fetching project title:', error);
      }
    };

    fetchProjectTitle();
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/admin" element={<AdminLoginPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/maps" element={<MapsPage />} />
          <Route path="/new-map" element={<CreateMapPage />} />
          <Route path="/edit-map/:id" element={<CreateMapPage />} />
          <Route path="/map-groups" element={<MapGroupsPage />} />
          <Route path="/new-map-group" element={<CreateMapGroupPage />} />
          <Route path="/edit-map-group/:id" element={<CreateMapGroupPage />} />
          <Route path="/eras" element={<ErasPage />} />
          <Route path="/create-era" element={<CreateEraPage />} />
          <Route path="/edit-era/:id" element={<CreateEraPage />} />
          <Route path="/media" element={<MediaPage />} />
          <Route path="/narratives" element={<NarrativesPage />} />
          <Route path="/create-narrative" element={<CreateNarrativePage />} />
          <Route path="/edit-narrative/:id" element={<CreateNarrativePage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* New authorize route */}
          <Route path="/authorize" element={<AuthorizePage />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;

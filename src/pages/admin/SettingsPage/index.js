import React, { useState, useEffect } from 'react';
import styles from './style.module.css';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faMap, faBook, faCog, faTimeline, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { apiGet, apiPut, apiUpload, resolveAssetUrl } from '../../../api/client';
import Editor from '../../../components/RichTextEditor';

const SettingsPage = () => {
  const navigate = useNavigate();

  const [settingsData, setSettingsData] = useState({
    logo: '',
    projectTitle: '',
    introduction: '',
    bibliography: '',
    credits: '',
    feedback: '',
    geolocation: [0, 0], // Ensure geolocation is initialized with a default array
    mapZoom: 10, // Default zoom value
    siteLive: true, // Whether the public site is visible to everyone
    previewToken: '' // Lets people with the preview link see the site while hidden
  });

  const [logoFile, setLogoFile] = useState(null);
  const [linkCopyStatus, setLinkCopyStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const fetchedData = await apiGet('/api/settings');
        if (fetchedData) {
          setSettingsData({
            ...settingsData,
            ...fetchedData,
            geolocation: fetchedData.geolocation || [0, 0], // Fallback to default geolocation
            mapZoom: fetchedData.mapZoom || 10 // Fallback to default zoom value
          });
        } else {
          console.log("No such document!");
        }
      } catch (e) {
        console.error("Error getting document:", e);
      }
    };

    fetchSettings();
  }, []);

  const handleLogoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setSettingsData(prevState => ({
          ...prevState,
          logo: reader.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogoAndSaveData = async () => {
    if (logoFile) {
      try {
        const { url } = await apiUpload(logoFile, { category: 'logos' });
        return url;
      } catch (error) {
        console.error("Error uploading logo:", error);
        throw error;
      }
    }
    return null;
  };

  const saveChanges = async (e) => {
    e.preventDefault();

    setIsSubmitting(true);
    try {
      const newLogoURL = await uploadLogoAndSaveData();

      const updatedData = {
        ...settingsData,
        ...(newLogoURL && { logo: newLogoURL })
      };

      await apiPut('/api/settings', updatedData);
      console.log("Document successfully written!");
      alert("Changes saved successfully!");
    } catch (e) {
      console.error("Error writing document: ", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (name, value) => {
    setSettingsData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleGeolocationChange = (index, value) => {
    const updatedGeolocation = [...settingsData.geolocation];
    updatedGeolocation[index] = parseFloat(value) || 0; // Fallback to 0 if the input is invalid
    setSettingsData(prevState => ({
      ...prevState,
      geolocation: updatedGeolocation
    }));
  };

  const generatePreviewToken = () => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID().replace(/-/g, '');
    return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  };

  // Hiding/showing the site takes effect immediately, independent of the
  // "Save Changes" button below, since this is the kind of change people
  // want to trust took effect right away.
  const handleToggleSiteLive = async () => {
    const nextLive = settingsData.siteLive === false;
    const nextToken = (!nextLive && !settingsData.previewToken)
      ? generatePreviewToken()
      : settingsData.previewToken;

    const updated = { ...settingsData, siteLive: nextLive, previewToken: nextToken };
    setSettingsData(updated);

    try {
      await apiPut('/api/settings', updated);
    } catch (e) {
      console.error("Error updating site visibility:", e);
      alert("Failed to update site visibility. Please try again.");
    }
  };

  const handleRegeneratePreviewLink = async () => {
    if (!window.confirm('This invalidates the current preview link — anyone using the old link will lose access. Continue?')) return;
    const updated = { ...settingsData, previewToken: generatePreviewToken() };
    setSettingsData(updated);
    try {
      await apiPut('/api/settings', updated);
    } catch (e) {
      console.error("Error regenerating preview link:", e);
      alert("Failed to generate a new link. Please try again.");
    }
  };

  const previewLink = `${window.location.origin}/?preview=${settingsData.previewToken || ''}`;

  const handleCopyPreviewLink = async () => {
    try {
      await navigator.clipboard.writeText(previewLink);
      setLinkCopyStatus('Copied!');
    } catch (e) {
      setLinkCopyStatus('Copy failed — select and copy manually');
    }
    setTimeout(() => setLinkCopyStatus(''), 2000);
  };

  return (
    <div className={styles.dashboard + " admin-shell"}>
      <div className={styles.sidebar}>
        <ul className={styles.sidebarMenu}>
          <li onClick={() => navigate('/dashboard')}><FontAwesomeIcon icon={faHome} /><span>Home</span></li>
          <li onClick={() => navigate('/eras')} ><FontAwesomeIcon icon={faTimeline} /><span>Eras</span></li>
          <li onClick={() => navigate('/maps')}><FontAwesomeIcon icon={faMap} /><span>Maps</span></li>
          <li onClick={() => navigate('/narratives')}><FontAwesomeIcon icon={faBook} /><span>Narratives</span></li>
          <li onClick={() => navigate('/settings')}><FontAwesomeIcon icon={faCog} /><span>Settings</span></li>
        </ul>
      </div>
      <div className={styles.content}>
        <h1>Settings Page</h1>
        <div className={styles.section}>
          <h2>Site Visibility</h2>
          <p>
            Status:{' '}
            <strong>
              {settingsData.siteLive === false ? 'Hidden (sandbox mode)' : 'Live'}
            </strong>
          </p>
          <p style={{ color: '#666', fontSize: '13px', maxWidth: 520 }}>
            {settingsData.siteLive === false
              ? "The public site is hidden from everyone except people you share the preview link with below. Individual maps, eras, and narratives keep their own visibility settings underneath this."
              : 'The public site is visible to everyone. Hide it while you work on it without affecting the individual visibility settings on maps, eras, and narratives.'}
          </p>
          <button type="button" onClick={handleToggleSiteLive}>
            {settingsData.siteLive === false ? 'Make Site Live' : 'Hide Site'}
          </button>

          {settingsData.siteLive === false && (
            <div style={{ marginTop: '16px' }}>
              <label htmlFor="previewLink">Preview link (share with anyone who should be able to see the hidden site)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                <input
                  id="previewLink"
                  type="text"
                  readOnly
                  value={previewLink}
                  onFocus={(e) => e.target.select()}
                  style={{ minWidth: '320px', flex: '1 1 320px' }}
                />
                <button type="button" onClick={handleCopyPreviewLink}>Copy</button>
                <button type="button" onClick={handleRegeneratePreviewLink}>Generate New Link</button>
                {linkCopyStatus && <span style={{ fontSize: '13px', color: '#2e7d32' }}>{linkCopyStatus}</span>}
              </div>
              <small style={{ display: 'block', marginTop: '4px', color: '#666' }}>
                Anyone who opens this link once will keep access on that device/browser until you generate a new link.
              </small>
            </div>
          )}
        </div>
        <div className={styles.section}>
          <h2>Logo</h2>
          <div className={styles.logoSection}>
            <div className={styles.currentLogo}>
              <h3>Current Logo</h3>
              {settingsData.logo ? (
                <img src={resolveAssetUrl(settingsData.logo)} alt="Current Logo" width={100} />
              ) : (
                <p>No logo uploaded</p>
              )}
            </div>
            <div className={styles.newLogo}>
              <h3>New Logo</h3>
              <input type="file" onChange={handleLogoUpload} />
            </div>
          </div>
        </div>
        <div className={styles.section}>
          <h2>Project Title</h2>
          <input
            type="text"
            name="projectTitle"
            value={settingsData.projectTitle}
            onChange={(e) => handleChange('projectTitle', e.target.value)}
          />
        </div>
        <div className={styles.section}>
          <h2>Geolocation</h2>
          <div>
            <label>Latitude:</label>
            <input
              type="number"
              value={settingsData.geolocation[0] || 0}
              onChange={(e) => handleGeolocationChange(0, e.target.value)}
            />
          </div>
          <div>
            <label>Longitude:</label>
            <input
              type="number"
              value={settingsData.geolocation[1] || 0}
              onChange={(e) => handleGeolocationChange(1, e.target.value)}
            />
          </div>
        </div>
        <div className={styles.section}>
          <h2>Map Zoom</h2>
          <input
            type="number"
            min="1"
            max="20"
            value={settingsData.mapZoom}
            onChange={(e) => handleChange('mapZoom', parseInt(e.target.value, 10) || 10)}
          />
        </div>
        <div className={styles.section}>
          <h2>Introduction</h2>
          <Editor
            value={settingsData.introduction}
            onChange={(e) => handleChange('introduction', e.target.value)}
          />
        </div>
        <div className={styles.section}>
          <h2>Bibliography</h2>
          <Editor
            value={settingsData.bibliography}
            onChange={(e) => handleChange('bibliography', e.target.value)}
          />
        </div>
        <div className={styles.section}>
          <h2>Credits</h2>
          <Editor
            value={settingsData.credits}
            onChange={(e) => handleChange('credits', e.target.value)}
          />
        </div>
        <div className={styles.section}>
          <h2>Feedback</h2>
          <Editor
            value={settingsData.feedback}
            onChange={(e) => handleChange('feedback', e.target.value)}
          />
        </div>
        <div>
          <button onClick={saveChanges} disabled={isSubmitting}>
            {isSubmitting ? (<><FontAwesomeIcon icon={faSpinner} spin /> Saving…</>) : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

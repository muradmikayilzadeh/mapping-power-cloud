import React, { useState, useEffect } from 'react';
import styles from './style.module.css';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faMap, faBook, faCog, faTimeline } from '@fortawesome/free-solid-svg-icons';
import { collection, doc, getDoc, setDoc } from "firebase/firestore";
import { ref, getDownloadURL, getStorage, uploadBytesResumable } from 'firebase/storage';
import { app, db } from '../../../firebase';
import Editor from 'react-simple-wysiwyg';

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
    mapZoom: 10 // Default zoom value
  });

  const [logoFile, setLogoFile] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "settingsData");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const fetchedData = docSnap.data();
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
        const logoPath = `/logos/${logoFile.name}`;
        const storage = getStorage(app);
        const storageRef = ref(storage, logoPath);

        const uploadTask = uploadBytesResumable(storageRef, logoFile);

        await new Promise((resolve, reject) => {
          uploadTask.on('state_changed',
            null,
            (error) => reject(error),
            resolve
          );
        });

        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        return downloadURL;
      } catch (error) {
        console.error("Error uploading logo:", error);
        throw error;
      }
    }
    return null;
  };

  const saveChanges = async (e) => {
    e.preventDefault();

    try {
      const newLogoURL = await uploadLogoAndSaveData();

      const updatedData = {
        ...settingsData,
        ...(newLogoURL && { logo: newLogoURL })
      };

      const docRef = doc(db, "settings", "settingsData");
      await setDoc(docRef, updatedData);
      console.log("Document successfully written!");
      alert("Changes saved successfully!");
    } catch (e) {
      console.error("Error writing document: ", e);
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
          <h2>Logo</h2>
          <div className={styles.logoSection}>
            <div className={styles.currentLogo}>
              <h3>Current Logo</h3>
              {settingsData.logo ? (
                <img src={settingsData.logo} alt="Current Logo" width={100} />
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
          <button onClick={saveChanges}>Save Changes</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

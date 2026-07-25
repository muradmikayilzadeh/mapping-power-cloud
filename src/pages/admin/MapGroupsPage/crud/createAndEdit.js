import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Editor from 'react-simple-wysiwyg';
import { faHome, faMap, faBook, faCog, faTimeline } from '@fortawesome/free-solid-svg-icons';
import { db } from '../../../../firebase';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import styles from '../style.module.css';

const CreateMapGroupPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [html, setHtml] = useState('');
  const [mapEntries, setMapEntries] = useState([]);
  const [title, setTitle] = useState('');
  const [years, setYears] = useState('');
  const [selectedMaps, setSelectedMaps] = useState([]);
  const [mapSearchTerm, setMapSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMapEntries = async () => {
      const querySnapshot = await getDocs(collection(db, 'maps'));
      const maps = querySnapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title,
        description: doc.data().description,
        snippet: doc.data().map_type === 'raster' ? doc.data().raster_image : ''
      }));
      setMapEntries(maps);
    };

    const fetchMapGroupData = async () => {
      if (id) {
        const mapGroupDoc = await getDoc(doc(db, 'map_groups', id));
        if (mapGroupDoc.exists()) {
          const data = mapGroupDoc.data();
          setTitle(data.title);
          setYears(data.years);
          setHtml(data.description);
          setSelectedMaps(data.map_ids);
        }
      }
      setLoading(false);
    };

    fetchMapEntries();
    fetchMapGroupData();
  }, [id]);

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    const mapGroupData = {
      title,
      years,
      description: html,
      map_ids: selectedMaps
    };

    try {
      if (id) {
        await updateDoc(doc(db, 'map_groups', id), mapGroupData);
        alert('Map Group updated successfully!');
      } else {
        await addDoc(collection(db, 'map_groups'), mapGroupData);
        alert('Map Group created successfully!');
      }
      navigate('/map-groups');
    } catch (error) {
      console.error('Error creating/updating map group: ', error);
      alert('Error creating/updating map group. Please try again.');
    }
  };

  const handleAddMap = (mapId) => {
    if (!selectedMaps.includes(mapId)) {
      setSelectedMaps([...selectedMaps, mapId]);
    }
  };

  const handleRemoveMap = (mapId) => {
    if (!window.confirm('Are you sure you want to remove this map from the group?')) return;
    setSelectedMaps(selectedMaps.filter(id => id !== mapId));
  };

  const onChange = (e) => {
    setHtml(e.target.value);
    console.log(e.target.value);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className={styles.dashboard + " admin-shell"}>
      <div className={styles.sidebar}>
        <ul className={styles.sidebarMenu}>
          <li onClick={() => navigate('/dashboard')}><FontAwesomeIcon icon={faHome} /><span>Home</span></li>
          <li onClick={() => navigate('/eras')}><FontAwesomeIcon icon={faTimeline} /><span>Eras</span></li>
          <li onClick={() => navigate('/maps')}><FontAwesomeIcon icon={faMap} /><span>Maps</span></li>
          <li onClick={() => navigate('/narratives')}><FontAwesomeIcon icon={faBook} /><span>Narratives</span></li>
          <li onClick={() => navigate('/settings')}><FontAwesomeIcon icon={faCog} /><span>Settings</span></li>
        </ul>
      </div>
      <div className={styles.content}>
        <div className={styles.headBar}>
          <h1>{id ? 'Edit Map Group' : 'Create Map Group'}</h1>
          <div>
            <button onClick={() => navigate('/map-groups')}>Back</button>
          </div>
        </div>
        <div className={styles.formContainer}>
          <form onSubmit={handleFormSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="title">Title</label>
              <input type="text" name="title" id="title" value={title} onChange={(e) => setTitle(e.target.value)} />

              <br></br>
              <br></br>

              <label htmlFor="years">Years</label>
              <input type="text" name="years" id="years" value={years} onChange={(e) => setYears(e.target.value)} />

              <br></br>
              <br></br>
              
              <label htmlFor="description">Description</label>
              <Editor className={styles.richTextEditor} value={html} onChange={onChange} />

              <br></br>

              {/* Scrollable table for selecting maps */}
              <label htmlFor="maps">Maps</label>
              <input
                type="text"
                placeholder="Search maps..."
                value={mapSearchTerm}
                onChange={(e) => setMapSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
              <div className={styles.scrollableTable}>
                <table className={styles.selectionTable}>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapEntries
                      .filter(entry => 
                        entry.title.toLowerCase().includes(mapSearchTerm.toLowerCase())
                      )
                      .map((entry) => {
                        const isSelected = selectedMaps.includes(entry.id);
                        return (
                          <tr key={entry.id} className={isSelected ? styles.selectedRow : ''}>
                            <td>{entry.title}</td>
                            <td>
                              {isSelected ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMap(entry.id)}
                                  className={styles.removeButton}
                                >
                                  Remove
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAddMap(entry.id)}
                                  className={styles.addButton}
                                >
                                  Add
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <br /><br />

              {/* Section for displaying selected maps */}
              <div className={styles.orderingSection}>
                <h3>Selected Maps</h3>
                {selectedMaps.length === 0 ? (
                  <p className={styles.emptyMessage}>No maps selected. Add maps from the table above.</p>
                ) : (
                  selectedMaps.map((mapId) => (
                    <div key={mapId} className={styles.orderingItem}>
                      <span>{mapEntries.find(entry => entry.id === mapId)?.title || mapId}</span>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveMap(mapId)}
                        className={styles.removeButton}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>

              <br /><br />
              <button type="submit">{id ? 'Update Map Group' : 'Create Map Group'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateMapGroupPage;

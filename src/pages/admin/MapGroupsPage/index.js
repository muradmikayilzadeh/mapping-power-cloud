import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faMap, faBook, faCog, faEdit, faTimes, faTimeline, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { db } from '../../../firebase';
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import CollapsibleDescription from '../../../components/CollapsibleDescription';
import styles from './style.module.css';

const MapGroupsPage = () => {
  const [mapGroups, setMapGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMapGroups = async () => {
      const querySnapshot = await getDocs(collection(db, 'map_groups'));
      const groups = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          description: data.description,
          // default visibility: if field absent -> visible (true)
          public: Object.prototype.hasOwnProperty.call(data, 'public') ? !!data.public : true,
        };
      });
      setMapGroups(groups);
      setFilteredGroups(groups);
    };

    fetchMapGroups();
  }, []);

  useEffect(() => {
    const results = mapGroups.filter(group =>
      group.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredGroups(results);
  }, [searchTerm, mapGroups]);

  const handleTogglePublic = async (id) => {
    const current = mapGroups.find(g => g.id === id);
    if (!current) return;
    const newValue = !current.public;

    // optimistic UI
    setMapGroups(prev => prev.map(g => (g.id === id ? { ...g, public: newValue } : g)));
    setFilteredGroups(prev => prev.map(g => (g.id === id ? { ...g, public: newValue } : g)));

    try {
      await updateDoc(doc(db, 'map_groups', id), { public: newValue });
    } catch (err) {
      console.error('Failed to update visibility:', err);
      // rollback on failure
      setMapGroups(prev => prev.map(g => (g.id === id ? { ...g, public: !newValue } : g)));
      setFilteredGroups(prev => prev.map(g => (g.id === id ? { ...g, public: !newValue } : g)));
      alert('Could not update visibility. Please try again.');
    }
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this map group?');
    if (confirmDelete) {
      try {
        await deleteDoc(doc(db, 'map_groups', id));
        setMapGroups(mapGroups.filter(group => group.id !== id));
        setFilteredGroups(filteredGroups.filter(group => group.id !== id));
      } catch (error) {
        console.error('Error deleting map group: ', error);
      }
    }
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
        <div className={styles.headBar}>
          <h1>Map Groups Page</h1>
          <div>
            <button onClick={() => navigate('/maps')}>Maps</button>
            <button onClick={() => navigate('/new-map-group')}>New Map Group</button>
          </div>
        </div>

        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="Search map group..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className={styles.itemList}>
          {filteredGroups.length > 0 ? (
            filteredGroups.map((group) => (
              <div key={group.id} className={styles.itemEntry}>
                <div className={styles.itemDetails}>
                  <h2>
                    {group.title}{' '}
                    <span
                      title={group.public ? 'Publicly visible' : 'Private (hidden)'}
                      style={{
                        fontSize: 12,
                        padding: '2px 8px',
                        borderRadius: 999,
                        marginLeft: 8,
                        border: '1px solid',
                        borderColor: group.public ? '#1f8b4c' : '#b54747',
                        color: group.public ? '#1f8b4c' : '#b54747',
                        background: group.public ? 'rgba(31,139,76,0.08)' : 'rgba(181,71,71,0.08)',
                      }}
                    >
                      {group.public ? 'Public' : 'Private'}
                    </span>
                  </h2>
                  <CollapsibleDescription html={group.description} />
                </div>
                <div className={styles.itemActions}>
                  <button onClick={() => navigate(`/edit-map-group/${group.id}`)} title="Edit"><FontAwesomeIcon icon={faEdit} /></button>
                  <button onClick={() => handleTogglePublic(group.id)} title={group.public ? 'Make Private' : 'Make Public'}><FontAwesomeIcon icon={group.public ? faEye : faEyeSlash} /></button>
                  <button onClick={() => handleDelete(group.id)} title="Delete"><FontAwesomeIcon icon={faTimes} /></button>
                </div>
              </div>
            ))
          ) : (
            <p>No map group found</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default MapGroupsPage;

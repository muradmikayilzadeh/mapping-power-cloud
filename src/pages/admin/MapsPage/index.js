// src/pages/MapsPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHome,
  faMap,
  faBook,
  faCog,
  faEdit,
  faEye,
  faEyeSlash,
  faTimes,
  faSearch,
  faTimeline
} from '@fortawesome/free-solid-svg-icons';

import { db } from '../../../firebase';
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import CollapsibleDescription from '../../../components/CollapsibleDescription';
import styles from './style.module.css';

const MapsPage = () => {
  const navigate = useNavigate();

  const [mapEntries, setMapEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchMapEntries = async () => {
      const [mapsSnap, erasSnap, groupsSnap] = await Promise.all([
        getDocs(collection(db, 'maps')),
        getDocs(collection(db, 'eras')),
        getDocs(collection(db, 'map_groups')),
      ]);

      const eras = erasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const groups = groupsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // For a given map id, find the eras and map groups it belongs to.
      // A map can be in an era directly, or via a map group that is in an era.
      const membershipsFor = (mapId) => {
        // Map groups store their member map ids under `map_ids`.
        const memberGroups = groups.filter(
          g => Array.isArray(g.map_ids) && g.map_ids.includes(mapId)
        );
        const groupTitles = memberGroups.map(g => g.title || 'Untitled group');
        const groupIds = memberGroups.map(g => g.id);

        const eraTitles = eras
          .filter(e =>
            (Array.isArray(e.maps) && e.maps.includes(mapId)) ||
            (Array.isArray(e.map_groups) && e.map_groups.some(gid => groupIds.includes(gid)))
          )
          .map(e => e.title || 'Untitled era');

        return {
          eras: Array.from(new Set(eraTitles)),
          groups: Array.from(new Set(groupTitles)),
        };
      };

      const maps = mapsSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || '',
          description: data.description || '',
          map_type: data.map_type || '',
          // default URLs to empty string
          snippetUrl:
            data.map_type === 'raster'
              ? data.raster_image || ''
              : data.vector_file || '',
          // default visibility: if field absent -> visible (true)
          public: Object.prototype.hasOwnProperty.call(data, 'public') ? !!data.public : true,
          ...membershipsFor(d.id),
        };
      });
      setMapEntries(maps);
      setFilteredEntries(maps);
    };

    fetchMapEntries();
  }, []);

  useEffect(() => {
    const results = mapEntries.filter(entry =>
      entry.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredEntries(results);
  }, [searchTerm, mapEntries]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this map?')) {
      try {
        await deleteDoc(doc(db, 'maps', id));
        setMapEntries(prev => prev.filter(e => e.id !== id));
        setFilteredEntries(prev => prev.filter(e => e.id !== id));
      } catch (error) {
        console.error('Error deleting map: ', error);
      }
    }
  };

  const handleTogglePublic = async (id) => {
    // find current value
    const current = mapEntries.find(e => e.id === id);
    if (!current) return;
    const newValue = !current.public;

    // optimistic UI
    setMapEntries(prev => prev.map(e => (e.id === id ? { ...e, public: newValue } : e)));
    setFilteredEntries(prev => prev.map(e => (e.id === id ? { ...e, public: newValue } : e)));

    try {
      await updateDoc(doc(db, 'maps', id), { public: newValue });
    } catch (err) {
      console.error('Failed to update visibility:', err);
      // rollback on failure
      setMapEntries(prev => prev.map(e => (e.id === id ? { ...e, public: !newValue } : e)));
      setFilteredEntries(prev => prev.map(e => (e.id === id ? { ...e, public: !newValue } : e)));
      alert('Could not update visibility. Please try again.');
    }
  };

  return (
    <div className={styles.dashboard}>
      <div className={styles.sidebar}>
        <ul className={styles.sidebarMenu}>
          <li onClick={() => navigate('/dashboard')}>
            <FontAwesomeIcon icon={faHome} /><span>Home</span>
          </li>
          <li onClick={() => navigate('/eras')}>
            <FontAwesomeIcon icon={faTimeline} /><span>Eras</span>
          </li>
          <li onClick={() => navigate('/maps')}>
            <FontAwesomeIcon icon={faMap} /><span>Maps</span>
          </li>
          <li onClick={() => navigate('/narratives')}>
            <FontAwesomeIcon icon={faBook} /><span>Narratives</span>
          </li>
          <li onClick={() => navigate('/settings')}>
            <FontAwesomeIcon icon={faCog} /><span>Settings</span>
          </li>
        </ul>
      </div>

      <div className={styles.content}>
        <div className={styles.headBar}>
          <h1>Maps Page</h1>
          <div>
            <button onClick={() => navigate('/new-map')}>New Map</button>
            <button onClick={() => navigate('/map-groups')}>Map Groups</button>
          </div>
        </div>

        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="Search map..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className={styles.itemList}>
          {filteredEntries.length > 0 ? (
            filteredEntries.map(entry => (
              <div key={entry.id} className={styles.itemEntry}>
                <div className={styles.itemDetails}>
                  <h2>
                    {entry.title}{' '}
                    <span
                      title={entry.public ? 'Publicly visible' : 'Private (hidden)'}
                      style={{
                        fontSize: 12,
                        padding: '2px 8px',
                        borderRadius: 999,
                        marginLeft: 8,
                        border: '1px solid',
                        borderColor: entry.public ? '#1f8b4c' : '#b54747',
                        color: entry.public ? '#1f8b4c' : '#b54747',
                        background: entry.public ? 'rgba(31,139,76,0.08)' : 'rgba(181,71,71,0.08)'
                      }}
                    >
                      {entry.public ? 'Public' : 'Private'}
                    </span>
                  </h2>
                  <div className={styles.membership}>
                    {(entry.eras?.length || entry.groups?.length) ? (
                      <>
                        {entry.eras?.length > 0 && (
                          <span><strong>Eras:</strong> {entry.eras.join(', ')}</span>
                        )}
                        {entry.groups?.length > 0 && (
                          <span><strong>Map Groups:</strong> {entry.groups.join(', ')}</span>
                        )}
                      </>
                    ) : (
                      <span className={styles.membershipNone}>
                        Not currently assigned to any Era or Map Group.
                      </span>
                    )}
                  </div>
                  <CollapsibleDescription html={entry.description} />
                </div>

                <div className={styles.itemActions}>
                  <button
                    onClick={() => navigate(`/edit-map/${entry.id}`)}
                    title="Edit"
                  >
                    <FontAwesomeIcon icon={faEdit} />
                  </button>

                  {/* Visibility toggle */}
                  <button
                    onClick={() => handleTogglePublic(entry.id)}
                    title={entry.public ? 'Make Private' : 'Make Public'}
                  >
                    <FontAwesomeIcon icon={entry.public ? faEye : faEyeSlash} />
                  </button>

                  <button onClick={() => handleDelete(entry.id)} title="Delete">
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>

                <div className={styles.itemSnippet}>
                  {entry.map_type === 'raster' ? (
                    entry.snippetUrl ? (
                      <img
                        src={entry.snippetUrl}
                        alt={entry.title}
                      />
                    ) : (
                      <span>No image</span>
                    )
                  ) : entry.snippetUrl ? (
                    <a
                      href={entry.snippetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FontAwesomeIcon icon={faSearch} />
                      <span>View Vector File</span>
                    </a>
                  ) : (
                    <span>No file</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p>No map found</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapsPage;

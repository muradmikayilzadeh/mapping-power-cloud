import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faMap, faBook, faCog, faEdit, faTimes, faTimeline, faArrowUp, faArrowDown, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { db } from '../../../firebase';
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import CollapsibleDescription from '../../../components/CollapsibleDescription';
import styles from './style.module.css';

const ErasPage = () => {
  const [eras, setEras] = useState([]);
  const [filteredEras, setFilteredEras] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEras = async () => {
      const querySnapshot = await getDocs(collection(db, 'eras'));
      const erasData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          public: Object.prototype.hasOwnProperty.call(data, 'public') ? !!data.public : true,
        };
      });
      const sortedEras = erasData.sort((a, b) => a.order - b.order); // Sort by the 'order' field
      setEras(sortedEras);
      setFilteredEras(sortedEras);
    };

    fetchEras();
  }, []);

  useEffect(() => {
    const results = eras.filter(era =>
      era.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredEras(results);
  }, [searchTerm, eras]);

  const handleTogglePublic = async (id) => {
    const current = eras.find((e) => e.id === id);
    if (!current) return;
    const newValue = !current.public;
    setEras((prev) => prev.map((e) => (e.id === id ? { ...e, public: newValue } : e)));
    setFilteredEras((prev) => prev.map((e) => (e.id === id ? { ...e, public: newValue } : e)));
    try {
      await updateDoc(doc(db, 'eras', id), { public: newValue });
    } catch (err) {
      console.error('Failed to update visibility:', err);
      setEras((prev) => prev.map((e) => (e.id === id ? { ...e, public: !newValue } : e)));
      setFilteredEras((prev) => prev.map((e) => (e.id === id ? { ...e, public: !newValue } : e)));
      alert('Could not update visibility. Please try again.');
    }
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this era?');
    if (confirmDelete) {
      try {
        await deleteDoc(doc(db, 'eras', id));
        setEras(eras.filter(era => era.id !== id));
        setFilteredEras(filteredEras.filter(era => era.id !== id));
      } catch (error) {
        console.error('Error deleting era: ', error);
      }
    }
  };

  const handleMove = async (index, direction) => {
    const newEras = [...eras];

    if (direction === 'up') {
      // Move up: rotate first item to the bottom
      const swapIndex = index === 0 ? newEras.length - 1 : index - 1;
      [newEras[index], newEras[swapIndex]] = [newEras[swapIndex], newEras[index]];
    } else if (direction === 'down') {
      // Move down: rotate last item to the top
      const swapIndex = index === newEras.length - 1 ? 0 : index + 1;
      [newEras[index], newEras[swapIndex]] = [newEras[swapIndex], newEras[index]];
    }

    // Dynamically update the UI
    const updatedEras = newEras.map((era, newIndex) => ({
      ...era,
      order: newIndex + 1 // Orders start at 1
    }));

    setEras(updatedEras); // Update the UI immediately
    setFilteredEras(updatedEras); // Reflect the new order in the filtered list

    // Update the order in Firestore
    try {
      const updatePromises = updatedEras.map(era => {
        return updateDoc(doc(db, 'eras', era.id), { order: era.order });
      });
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error updating order: ', error);
    }
  };

  return (
    <div className={styles.dashboard}>
      <div className={styles.sidebar}>
        <ul className={styles.sidebarMenu}>
          <li onClick={() => navigate('/dashboard')}><FontAwesomeIcon icon={faHome} /><span>Home</span></li>
          <li onClick={() => navigate('/eras')} ><FontAwesomeIcon icon={faTimeline} /><span>Eras</span></li>
          <li onClick={() => navigate('/maps')}><FontAwesomeIcon icon={faMap} /><span>Maps</span></li>
          {/* <li onClick={() => navigate('/media')}><FontAwesomeIcon icon={faMap} /><span>Media Library</span></li> */}
          <li onClick={() => navigate('/narratives')}><FontAwesomeIcon icon={faBook} /><span>Narratives</span></li>
          <li onClick={() => navigate('/settings')}><FontAwesomeIcon icon={faCog} /><span>Settings</span></li>
        </ul>
      </div>
      <div className={styles.content}>
        <div className={styles.headBar}>
          <h1>Eras Page</h1>
          <div>
            <button onClick={() => navigate('/create-era')}>New Era</button>
          </div>
        </div>

        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="Search era..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className={styles.itemList}>
          {filteredEras.length > 0 ? (
            filteredEras.map((era, index) => {
              const isFirst = index === 0;
              const isLast = index === filteredEras.length - 1;
              return (
                <div key={era.id} className={styles.itemEntry}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '12px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleMove(index, 'up');
                      }}
                      disabled={isFirst}
                      style={{
                        padding: '6px 10px',
                        fontSize: '12px',
                        border: isFirst ? '1px solid #e0e0e0' : '1px solid #d0d0d0',
                        borderRadius: '4px',
                        backgroundColor: isFirst ? '#f5f5f5' : '#ffffff',
                        color: isFirst ? '#999' : '#333',
                        cursor: isFirst ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '36px',
                        opacity: isFirst ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!isFirst && !e.target.disabled) {
                          e.target.style.backgroundColor = '#f0f0f0';
                          e.target.style.borderColor = '#b0b0b0';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isFirst && !e.target.disabled) {
                          e.target.style.backgroundColor = '#ffffff';
                          e.target.style.borderColor = '#d0d0d0';
                        }
                      }}
                      title={isFirst ? 'Already at top' : 'Move up'}
                    >
                      <FontAwesomeIcon icon={faArrowUp} style={{ fontSize: '11px' }} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleMove(index, 'down');
                      }}
                      disabled={isLast}
                      style={{
                        padding: '6px 10px',
                        fontSize: '12px',
                        border: isLast ? '1px solid #e0e0e0' : '1px solid #d0d0d0',
                        borderRadius: '4px',
                        backgroundColor: isLast ? '#f5f5f5' : '#ffffff',
                        color: isLast ? '#999' : '#333',
                        cursor: isLast ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '36px',
                        opacity: isLast ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!isLast && !e.target.disabled) {
                          e.target.style.backgroundColor = '#f0f0f0';
                          e.target.style.borderColor = '#b0b0b0';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isLast && !e.target.disabled) {
                          e.target.style.backgroundColor = '#ffffff';
                          e.target.style.borderColor = '#d0d0d0';
                        }
                      }}
                      title={isLast ? 'Already at bottom' : 'Move down'}
                    >
                      <FontAwesomeIcon icon={faArrowDown} style={{ fontSize: '11px' }} />
                    </button>
                  </div>
                  <div className={styles.itemDetails}>
                    <h2>
                      {era.title}{' '}
                      <span
                        title={era.public ? 'Publicly visible' : 'Private (hidden)'}
                        style={{
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 999,
                          marginLeft: 8,
                          border: '1px solid',
                          borderColor: era.public ? '#1f8b4c' : '#b54747',
                          color: era.public ? '#1f8b4c' : '#b54747',
                          background: era.public ? 'rgba(31,139,76,0.08)' : 'rgba(181,71,71,0.08)',
                        }}
                      >
                        {era.public ? 'Public' : 'Private'}
                      </span>
                    </h2>
                    <CollapsibleDescription html={era.description} />
                  </div>
                  <div className={styles.itemActions}>
                    <button onClick={() => navigate(`/edit-era/${era.id}`)} title="Edit"><FontAwesomeIcon icon={faEdit} /></button>
                    <button onClick={() => handleTogglePublic(era.id)} title={era.public ? 'Make Private' : 'Make Public'}><FontAwesomeIcon icon={era.public ? faEye : faEyeSlash} /></button>
                    <button onClick={() => handleDelete(era.id)} title="Delete"><FontAwesomeIcon icon={faTimes} /></button>
                  </div>
                </div>
              );
            })
          ) : (
            <p>No era found</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ErasPage;

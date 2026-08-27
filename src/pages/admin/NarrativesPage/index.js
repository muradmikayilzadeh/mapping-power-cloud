import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faMap, faBook, faCog, faEdit, faEye, faEyeSlash, faTimes, faTimeline, faArrowUp, faArrowDown, faGripVertical } from '@fortawesome/free-solid-svg-icons';
import { db } from '../../../firebase';
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import CollapsibleDescription from '../../../components/CollapsibleDescription';
import DraggableList from '../../../components/DraggableList';
import styles from './style.module.css';

const NarrativesPage = () => {
  const [narratives, setNarratives] = useState([]);
  const [filteredNarratives, setFilteredNarratives] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNarratives = async () => {
      const querySnapshot = await getDocs(collection(db, 'narratives'));
      const narrativesData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          description: data.description,
          order: typeof data.order === 'number' ? data.order : 0,
          // default visibility: if field absent -> visible (true)
          public: Object.prototype.hasOwnProperty.call(data, 'public') ? !!data.public : true
        };
      });
      // Sort by order
      narrativesData.sort((a, b) => a.order - b.order);
      setNarratives(narrativesData);
      setFilteredNarratives(narrativesData);
    };

    fetchNarratives();
  }, []);

  useEffect(() => {
    const results = narratives.filter(narrative =>
      narrative.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    // Maintain order when filtering
    results.sort((a, b) => a.order - b.order);
    setFilteredNarratives(results);
  }, [searchTerm, narratives]);

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this narrative?');
    if (confirmDelete) {
      try {
        await deleteDoc(doc(db, 'narratives', id));
        setNarratives(narratives.filter(narrative => narrative.id !== id));
        setFilteredNarratives(filteredNarratives.filter(narrative => narrative.id !== id));
      } catch (error) {
        console.error('Error deleting narrative: ', error);
      }
    }
  };

  const handleTogglePublic = async (id) => {
    // find current value
    const current = narratives.find(n => n.id === id);
    if (!current) return;
    const newValue = !current.public;

    // optimistic UI
    setNarratives(prev => prev.map(n => (n.id === id ? { ...n, public: newValue } : n)));
    setFilteredNarratives(prev => prev.map(n => (n.id === id ? { ...n, public: newValue } : n)));

    try {
      await updateDoc(doc(db, 'narratives', id), { public: newValue });
    } catch (err) {
      console.error('Failed to update visibility:', err);
      // rollback on failure
      setNarratives(prev => prev.map(n => (n.id === id ? { ...n, public: !newValue } : n)));
      setFilteredNarratives(prev => prev.map(n => (n.id === id ? { ...n, public: !newValue } : n)));
      alert('Could not update visibility. Please try again.');
    }
  };

  const handleMoveOrder = async (id, direction) => {
    // Work with sorted narratives array
    const sortedNarratives = [...narratives].sort((a, b) => a.order - b.order);
    const currentIndex = sortedNarratives.findIndex(n => n.id === id);
    
    if (currentIndex === -1) return;
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sortedNarratives.length) return;

    const current = sortedNarratives[currentIndex];
    const target = sortedNarratives[targetIndex];

    // Swap orders - use sequential ordering to avoid conflicts
    const tempOrder = current.order;
    const newCurrentOrder = target.order;
    const newTargetOrder = tempOrder;

    // Optimistic UI update
    const updatedNarratives = sortedNarratives.map(n => {
      if (n.id === id) {
        return { ...n, order: newCurrentOrder };
      }
      if (n.id === target.id) {
        return { ...n, order: newTargetOrder };
      }
      return n;
    });
    
    // Sort by order
    updatedNarratives.sort((a, b) => a.order - b.order);
    
    setNarratives(updatedNarratives);
    
    // Update filtered list maintaining order
    const filtered = updatedNarratives.filter(n => 
      n.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    filtered.sort((a, b) => a.order - b.order);
    setFilteredNarratives(filtered);

    try {
      // Update both narratives in Firestore
      await updateDoc(doc(db, 'narratives', id), { order: newCurrentOrder });
      await updateDoc(doc(db, 'narratives', target.id), { order: newTargetOrder });
    } catch (err) {
      console.error('Failed to update order:', err);
      // Reload on failure - fetch narratives again
      try {
        const querySnapshot = await getDocs(collection(db, 'narratives'));
        const narrativesData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title,
            description: data.description,
            order: typeof data.order === 'number' ? data.order : 0,
            public: Object.prototype.hasOwnProperty.call(data, 'public') ? !!data.public : true
          };
        });
        narrativesData.sort((a, b) => a.order - b.order);
        setNarratives(narrativesData);
        const filteredReload = narrativesData.filter(n => 
          n.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
        filteredReload.sort((a, b) => a.order - b.order);
        setFilteredNarratives(filteredReload);
      } catch (reloadErr) {
        console.error('Failed to reload narratives:', reloadErr);
      }
      alert('Could not update order. Please try again.');
    }
  };

  // Drag-and-drop reordering (only offered when the list isn't filtered by
  // search — with a search term active, dragging the visible subset would
  // scramble the order of the narratives hidden by the filter).
  const handleReorder = async (reorderedNarratives) => {
    const updated = reorderedNarratives.map((n, index) => ({ ...n, order: index }));
    setNarratives(updated);
    setFilteredNarratives(updated);
    try {
      await Promise.all(
        updated.map((n) => updateDoc(doc(db, 'narratives', n.id), { order: n.order }))
      );
    } catch (err) {
      console.error('Failed to update order:', err);
      alert('Could not update order. Please try again.');
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
          <h1>Narrative Page</h1>
          <button onClick={() => navigate('/create-narrative')}>New Narrative</button>
        </div>

        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="Search narrative..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {searchTerm.trim() === '' && filteredNarratives.length > 1 && (
          <p style={{ fontSize: 12, color: '#888', margin: '0 0 8px' }}>
            Drag the <FontAwesomeIcon icon={faGripVertical} /> handle to reorder narratives.
          </p>
        )}
        <div className={styles.itemList}>
          {filteredNarratives.length > 0 ? (
            searchTerm.trim() === '' ? (
              <DraggableList
                droppableId="narratives"
                items={filteredNarratives}
                getId={(n) => n.id}
                onReorder={handleReorder}
                renderItem={(narrative, index, dragHandleProps) => renderNarrativeRow(narrative, dragHandleProps)}
              />
            ) : (
              filteredNarratives.map((narrative) => renderNarrativeRow(narrative, null))
            )
          ) : (
            <p>No narrative found</p>
          )}
        </div>
      </div>
    </div>
  );

  function renderNarrativeRow(narrative, dragHandleProps) {
              // Find position in sorted narratives array
              const sortedNarratives = [...narratives].sort((a, b) => a.order - b.order);
              const actualIndex = sortedNarratives.findIndex(n => n.id === narrative.id);
              const isFirst = actualIndex === 0;
              const isLast = actualIndex === sortedNarratives.length - 1;

              return (
                <div key={narrative.id} className={styles.itemEntry}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '12px', flexShrink: 0 }}>
                    {dragHandleProps && (
                      <span {...dragHandleProps} title="Drag to reorder" style={{ cursor: 'grab', color: '#888', display: 'flex', alignItems: 'center', padding: '0 4px' }}>
                        <FontAwesomeIcon icon={faGripVertical} />
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleMoveOrder(narrative.id, 'up');
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
                        handleMoveOrder(narrative.id, 'down');
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
                      <span
                        className={styles.clickableTitle}
                        onClick={() => navigate(`/edit-narrative/${narrative.id}`)}
                        title="Click to edit"
                      >
                        {narrative.title}
                      </span>{' '}
                      <span
                        title={narrative.public ? 'Publicly visible' : 'Private (hidden)'}
                        style={{
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 999,
                          marginLeft: 8,
                          border: '1px solid',
                          borderColor: narrative.public ? '#1f8b4c' : '#b54747',
                          color: narrative.public ? '#1f8b4c' : '#b54747',
                          background: narrative.public ? 'rgba(31,139,76,0.08)' : 'rgba(181,71,71,0.08)'
                        }}
                      >
                        {narrative.public ? 'Public' : 'Private'}
                      </span>
                    </h2>
                    <CollapsibleDescription html={narrative.description} />
                  </div>
                  <div className={styles.itemActions}>
                    <button onClick={() => navigate(`/edit-narrative/${narrative.id}`)} title="Edit">
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                    <button
                      onClick={() => handleTogglePublic(narrative.id)}
                      title={narrative.public ? 'Make Private' : 'Make Public'}
                    >
                      <FontAwesomeIcon icon={narrative.public ? faEye : faEyeSlash} />
                    </button>
                    <button onClick={() => handleDelete(narrative.id)} title="Delete">
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                </div>
              );
  }
}

export default NarrativesPage;

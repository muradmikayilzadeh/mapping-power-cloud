import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Editor from 'react-simple-wysiwyg';
import { faHome, faMap, faBook, faCog, faTimeline, faArrowUp, faArrowDown, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { db } from '../../../../firebase'; // Ensure this path is correct based on your project structure
import styles from '../style.module.css';

const CreateEraPage = () => {
  const [html, setHtml] = useState('');

  // Helper for React 18 Strict Mode vs react-beautiful-dnd
  const StrictModeDroppable = ({ children, ...props }) => {
    const [enabled, setEnabled] = useState(false);
    useEffect(() => {
      const animation = requestAnimationFrame(() => setEnabled(true));
      return () => {
        cancelAnimationFrame(animation);
        setEnabled(false);
      };
    }, []);
    if (!enabled) {
      return null;
    }
    return <Droppable {...props}>{children}</Droppable>;
  };

  const [mapEntries, setMapEntries] = useState([]);
  const [mapGroupEntries, setMapGroupEntries] = useState([]);
  const [title, setTitle] = useState('');
  const [years, setYears] = useState('');
  const [selectedMaps, setSelectedMaps] = useState([]);
  const [selectedMapGroups, setSelectedMapGroups] = useState([]);
  const [indented, setIndented] = useState([]);
  const [isPublic, setIsPublic] = useState(true);
  const [mapSearchTerm, setMapSearchTerm] = useState('');
  const [mapGroupSearchTerm, setMapGroupSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const mapsSnapshot = await getDocs(collection(db, 'maps'));
      const mapGroupsSnapshot = await getDocs(collection(db, 'map_groups'));

      const maps = mapsSnapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title + " (" + doc.data().years + ")",
        description: doc.data().description
      }));

      const mapGroups = mapGroupsSnapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title + " (" + doc.data().years + ")",
        description: doc.data().description
      }));

      setMapEntries(maps);
      setMapGroupEntries(mapGroups);

      if (id) {
        const eraDoc = await getDoc(doc(db, 'eras', id));
        if (eraDoc.exists()) {
          const data = eraDoc.data();
          setTitle(data.title);
          setYears(data.years);
          setHtml(data.description);
          setSelectedMaps(data.maps || []);
          setSelectedMapGroups(data.map_groups || []);
          setIndented(data.indented || []);
          setIsPublic(Object.prototype.hasOwnProperty.call(data, 'public') ? !!data.public : true);
        }
      }
      setLoading(false);
    };

    fetchData();
  }, [id]);

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    const eraData = {
      title,
      years,
      description: html,
      maps: selectedMaps,
      map_groups: selectedMapGroups,
      indented,
      public: isPublic,
    };

    setIsSubmitting(true);
    try {
      if (id) {
        await updateDoc(doc(db, 'eras', id), eraData);
        alert('Era updated successfully!');
      } else {
        await addDoc(collection(db, 'eras'), eraData);
        alert('Era created successfully!');
      }
      navigate('/eras');
    } catch (error) {
      console.error('Error creating/updating era: ', error);
      alert('Error creating/updating era. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMap = (mapId) => {
    if (!selectedMaps.includes(mapId)) {
      setSelectedMaps([...selectedMaps, mapId]);
    }
  };

  const handleAddMapGroup = (mapGroupId) => {
    if (!selectedMapGroups.includes(mapGroupId)) {
      setSelectedMapGroups([...selectedMapGroups, mapGroupId]);
    }
  };

  const handleRemoveMap = (mapId) => {
    if (!window.confirm('Are you sure you want to remove this map from the era?')) return;
    setSelectedMaps(selectedMaps.filter(id => id !== mapId));
  };

  const handleRemoveMapGroup = (mapGroupId) => {
    if (!window.confirm('Are you sure you want to remove this map group from the era?')) return;
    setSelectedMapGroups(selectedMapGroups.filter(id => id !== mapGroupId));
  };

  const handleHtmlChange = (e) => {
    setHtml(e.target.value);
  };

  const moveItem = (index, direction, type) => {
    let items = type === 'maps' ? [...selectedMaps] : [...selectedMapGroups];
    const newIndex = index + direction;

    // Ensure the new index is within bounds
    if (newIndex < 0 || newIndex >= items.length) return;

    // Swap the items
    const temp = items[index];
    items[index] = items[newIndex];
    items[newIndex] = temp;

    // Update state
    if (type === 'maps') {
      setSelectedMaps(items);
    } else {
      setSelectedMapGroups(items);
    }
  };

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.index === destination.index) return;

    if (source.droppableId === 'maps') {
      const newItems = Array.from(selectedMaps);
      const [reorderedItem] = newItems.splice(source.index, 1);
      newItems.splice(destination.index, 0, reorderedItem);
      setSelectedMaps(newItems);
    } else if (source.droppableId === 'mapGroups') {
      const newItems = Array.from(selectedMapGroups);
      const [reorderedItem] = newItems.splice(source.index, 1);
      newItems.splice(destination.index, 0, reorderedItem);
      setSelectedMapGroups(newItems);
    }
  };

  const toggleIndentation = (id, type) => {
    let updatedIndented = [...indented];
    if (updatedIndented.includes(id)) {
      updatedIndented = updatedIndented.filter(item => item !== id); // Remove if already indented
    } else {
      updatedIndented.push(id); // Add if not indented
    }
    setIndented(updatedIndented);
  };

  const isIndented = (id) => indented.includes(id);

  if (loading) {
    return <div>Loading...</div>;
  }

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
          <h1>{id ? 'Edit Era' : 'Create Era'}</h1>
          <div>
            <button onClick={() => navigate('/eras')}>Back</button>
          </div>
        </div>
        <div className={styles.formContainer}>
          <form onSubmit={handleFormSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="title">Title</label>
              <input type="text" name="title" id="title" value={title} onChange={(e) => setTitle(e.target.value)} />

              <br /><br />

              <label htmlFor="years">Years</label>
              <input type="text" name="years" id="years" value={years} onChange={(e) => setYears(e.target.value)} />

              <br /><br />

              <label htmlFor="description">Description</label>
              <Editor className={styles.richTextEditor} value={html} onChange={handleHtmlChange} />

              <br /><br />

              <div style={{ padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #e9ecef' }}>
                <label htmlFor="isPublic" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="isPublic"
                    id="isPublic"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    style={{ marginRight: '8px', width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>Visible on website</span>
                </label>
                <small style={{ display: 'block', marginLeft: '26px', marginTop: '4px', color: '#666', fontSize: '12px' }}>
                  (uncheck to hide this era from the main map view)
                </small>
              </div>

              <br /><br />

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

              {/* Scrollable table for selecting map groups */}
              <label htmlFor="map_groups">Map Groups</label>
              <input
                type="text"
                placeholder="Search map groups..."
                value={mapGroupSearchTerm}
                onChange={(e) => setMapGroupSearchTerm(e.target.value)}
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
                    {mapGroupEntries
                      .filter(entry => 
                        entry.title.toLowerCase().includes(mapGroupSearchTerm.toLowerCase())
                      )
                      .map((entry) => {
                        const isSelected = selectedMapGroups.includes(entry.id);
                        return (
                          <tr key={entry.id} className={isSelected ? styles.selectedRow : ''}>
                            <td>{entry.title}</td>
                            <td>
                              {isSelected ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMapGroup(entry.id)}
                                  className={styles.removeButton}
                                >
                                  Remove
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAddMapGroup(entry.id)}
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

              {/* Section for displaying and reordering selected maps and map groups */}
              <div className={styles.orderingSection}>
                <DragDropContext onDragEnd={onDragEnd}>
                  <h3>Selected Maps</h3>
                  <StrictModeDroppable droppableId="maps">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef}>
                        {selectedMaps.length === 0 ? (
                          <p className={styles.emptyMessage}>No maps selected. Add maps from the table above.</p>
                        ) : (
                          selectedMaps.map((map, index) => (
                            <Draggable key={String(map)} draggableId={String(map)} index={index}>
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={styles.orderingItem}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '12px', flexShrink: 0 }}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        moveItem(index, -1, 'maps');
                                      }}
                                      disabled={index === 0}
                                      className={styles.miniMoveButton}
                                    >
                                      <FontAwesomeIcon icon={faArrowUp} style={{ fontSize: '11px' }} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        moveItem(index, 1, 'maps');
                                      }}
                                      disabled={index === selectedMaps.length - 1}
                                      className={styles.miniMoveButton}
                                    >
                                      <FontAwesomeIcon icon={faArrowDown} style={{ fontSize: '11px' }} />
                                    </button>
                                  </div>
                                  <span
                                    className={isIndented(map) ? styles.orderingItemTitleIndented : ''}
                                    style={{ flexGrow: 1, marginRight: '10px' }}
                                  >
                                    {mapEntries.find(entry => entry.id === map)?.title || map}
                                  </span>
                                  <div className={styles.orderingButtons}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleIndentation(map, 'maps');
                                      }}
                                      className={isIndented(map) ? styles.indented : ''}
                                      title={isIndented(map) ? 'Click to remove indentation' : 'Click to indent this item'}
                                    >
                                      {isIndented(map) ? 'Un-indent' : 'Indent'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleRemoveMap(map);
                                      }}
                                      className={styles.removeButton}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </StrictModeDroppable>

                  <h3>Selected Map Groups</h3>
                  <StrictModeDroppable droppableId="mapGroups">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef}>
                        {selectedMapGroups.length === 0 ? (
                          <p className={styles.emptyMessage}>No map groups selected. Add map groups from the table above.</p>
                        ) : (
                          selectedMapGroups.map((mapGroup, index) => (
                            <Draggable key={String(mapGroup)} draggableId={String(mapGroup)} index={index}>
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={styles.orderingItem}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '12px', flexShrink: 0 }}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        moveItem(index, -1, 'mapGroups');
                                      }}
                                      disabled={index === 0}
                                      className={styles.miniMoveButton}
                                    >
                                      <FontAwesomeIcon icon={faArrowUp} style={{ fontSize: '11px' }} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        moveItem(index, 1, 'mapGroups');
                                      }}
                                      disabled={index === selectedMapGroups.length - 1}
                                      className={styles.miniMoveButton}
                                    >
                                      <FontAwesomeIcon icon={faArrowDown} style={{ fontSize: '11px' }} />
                                    </button>
                                  </div>
                                  <span
                                    className={isIndented(mapGroup) ? styles.orderingItemTitleIndented : ''}
                                    style={{ flexGrow: 1, marginRight: '10px' }}
                                  >
                                    {mapGroupEntries.find(entry => entry.id === mapGroup)?.title || mapGroup}
                                  </span>
                                  <div className={styles.orderingButtons}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleIndentation(mapGroup, 'mapGroups');
                                      }}
                                      className={isIndented(mapGroup) ? styles.indented : ''}
                                      title={isIndented(mapGroup) ? 'Click to remove indentation' : 'Click to indent this item'}
                                    >
                                      {isIndented(mapGroup) ? 'Un-indent' : 'Indent'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleRemoveMapGroup(mapGroup);
                                      }}
                                      className={styles.removeButton}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </StrictModeDroppable>
                </DragDropContext>
              </div>

              <br /><br />

              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><FontAwesomeIcon icon={faSpinner} spin /> {id ? 'Updating…' : 'Creating…'}</>
                ) : (
                  id ? 'Update Era' : 'Create Era'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateEraPage;

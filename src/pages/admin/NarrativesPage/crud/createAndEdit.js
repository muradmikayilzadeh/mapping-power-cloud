import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faMap, faBook, faCog, faTimeline, faArrowUp, faArrowDown, faGripVertical, faSpinner } from '@fortawesome/free-solid-svg-icons';
import Editor from 'react-simple-wysiwyg';
import RichTextEditor from '../../../../components/RichTextEditor';
import DraggableList from '../../../../components/DraggableList';
import { apiGet, apiPost, apiPut } from '../../../../api/client';
import styles from '../style.module.css';

const CreateNarrativePage = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [chapters, setChapters] = useState([]); // Changed to array to preserve order
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { id } = useParams();

  // Generate a random Chapter ID
  const generateChapterId = () => {
    return `chapter-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36)}`;
  };

  // Load narrative if editing; also backfill the JSON textarea from stored fields
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (id) {
          const data = await apiGet(`/api/narratives/${id}`);
          if (data) {
            setTitle(data.title || '');
            setDescription(data.description || '');
            // Default to true (public) if field doesn't exist
            setIsPublic(Object.prototype.hasOwnProperty.call(data, 'public') ? !!data.public : true);

            const incomingChapters = data.chapters || {};
            const normalized = [];

            // Convert object to array and preserve order
            const chapterEntries = Object.entries(incomingChapters);
            // Sort by order field if it exists, otherwise maintain insertion order
            chapterEntries.sort((a, b) => {
              const orderA = a[1].order !== undefined ? a[1].order : 0;
              const orderB = b[1].order !== undefined ? b[1].order : 0;
              return orderA - orderB;
            });

            chapterEntries.forEach(([key, ch], index) => {
              // Prepare JSON text from existing fields, if present
              const jsonFromExisting = {
                currentMapFocusLocation:
                  Array.isArray(ch.center) && ch.center.length === 2
                    ? ch.center
                    : [0, 0],
                currentZoomLevel:
                  typeof ch.zoom === 'number' ? ch.zoom : 10,
                maps: Array.isArray(ch.maps) ? ch.maps : [],
              };

              // Generate chapter_id if it doesn't exist
              const chapterId = ch.chapter_id || generateChapterId();

              normalized.push({
                key: key,
                chapter_id: chapterId,
                speed: typeof ch.speed === 'number' ? ch.speed : 0.5,
                content: ch.content || '',
                dataJsonText: JSON.stringify(jsonFromExisting, null, 2),
                order: ch.order !== undefined ? ch.order : index, // Assign order if missing
              });
            });

            // Sort by order to ensure correct sequence
            normalized.sort((a, b) => a.order - b.order);
            setChapters(normalized);
          }
        }
      } catch (err) {
        console.error('Error loading narrative:', err);
        alert('Failed to load narrative.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const addChapter = (atIndex = -1) => {
    const newChapterKey = `chapter-${Date.now()}`;
    const newChapterId = generateChapterId();
    const newChapter = {
      key: newChapterKey,
      chapter_id: newChapterId,
      speed: 0.5,
      content: '',
      dataJsonText: JSON.stringify(
        {
          currentMapFocusLocation: [0, 0],
          currentZoomLevel: 10,
          maps: [],
        },
        null,
        2
      ),
      order: 0,
    };

    setChapters((prev) => {
      let newChapters = [...prev].sort((a, b) => (a.order || 0) - (b.order || 0));
      if (atIndex === -1) {
        newChapters.push(newChapter);
      } else {
        newChapters.splice(atIndex, 0, newChapter);
      }
      // Re-index all to maintain order consistency
      return newChapters.map((ch, i) => ({ ...ch, order: i }));
    });
  };

  const removeChapter = (index) => {
    if (!window.confirm('Are you sure you want to remove this chapter?')) return;
    setChapters((prev) => prev.filter((_, i) => i !== index));
  };

  const moveChapter = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === chapters.length - 1) return;

    setChapters((prev) => {
      const newChapters = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      
      // Swap orders
      const tempOrder = newChapters[index].order;
      newChapters[index].order = newChapters[targetIndex].order;
      newChapters[targetIndex].order = tempOrder;
      
      // Swap positions
      [newChapters[index], newChapters[targetIndex]] = [newChapters[targetIndex], newChapters[index]];
      
      return newChapters;
    });
  };

  const sortedChaptersForDisplay = [...chapters].sort((a, b) => (a.order || 0) - (b.order || 0));

  const handleReorderChapters = (reordered) => {
    setChapters(reordered.map((ch, i) => ({ ...ch, order: i })));
  };

  const handleChapterField = (index, field, value) => {
    setChapters((prev) => {
      const newChapters = [...prev];
      newChapters[index] = {
        ...newChapters[index],
        [field]: value,
      };
      return newChapters;
    });
  };

  const handleFormSubmit = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    setIsSubmitting(true);
    try {

    // Transform chapters for storage: parse JSON and attach derived fields
    // Sort by order first to ensure correct sequence
    const sortedChapters = [...chapters].sort((a, b) => (a.order || 0) - (b.order || 0));
    const chaptersForSave = {};

    // Use for...of to allow direct 'return' to stop the update if validation fails
    for (const [index, ch] of sortedChapters.entries()) {
      const key = ch.key || `chapter-${Date.now()}-${index}`;

      // Parse per-chapter Data JSON
      let parsed;
      try {
        parsed = JSON.parse(ch.dataJsonText || '{}');
      } catch (err) {
        alert(`Chapter ${index + 1}: Data JSON is invalid. Please fix it before saving.`);
        return; // HALT COMPLETELY
      }

      // Basic validation
      const hasCenter =
        parsed &&
        Array.isArray(parsed.currentMapFocusLocation) &&
        parsed.currentMapFocusLocation.length === 2 &&
        parsed.currentMapFocusLocation.every((n) => typeof n === 'number');

      const hasZoom = parsed && typeof parsed.currentZoomLevel === 'number';
      const maps = Array.isArray(parsed.maps) ? parsed.maps : [];

      if (!hasCenter || !hasZoom) {
        alert(
          `Chapter ${index + 1}: Data JSON is missing required fields ("currentMapFocusLocation" [lng,lat] and "currentZoomLevel" number).`
        );
        return; // HALT COMPLETELY
      }

      chaptersForSave[key] = {
        chapter_id: ch.chapter_id || '',
        speed: typeof ch.speed === 'number' ? ch.speed : Number(ch.speed) || 0.5,
        content: ch.content || '',
        order: ch.order !== undefined ? ch.order : index, // Preserve order
        // Derived fields stored for the player/Map to use
        center: parsed.currentMapFocusLocation, // [lng, lat]
        zoom: parsed.currentZoomLevel, // number
        maps: maps, // [{ id, opacityVal }, ...]
      };
    }

    // Get the current order if editing, or assign a new order if creating
    let narrativeOrder = 0;
    if (id) {
      // When editing, keep the existing order
      try {
        const existingDoc = await apiGet(`/api/narratives/${id}`);
        if (existingDoc) {
          narrativeOrder = typeof existingDoc.order === 'number' ? existingDoc.order : 0;
        }
      } catch (err) {
        console.error('Error fetching existing order:', err);
      }
    } else {
      // When creating, assign order based on highest existing order + 1
      try {
        const allNarratives = (await apiGet('/api/narratives')) || [];
        const orders = allNarratives.map(n => (typeof n.order === 'number' ? n.order : 0));
        narrativeOrder = orders.length > 0 ? Math.max(...orders) + 1 : 0;
      } catch (err) {
        console.error('Error calculating new order:', err);
      }
    }

    const narrativeData = {
      title,
      description: description || '',
      order: narrativeOrder,
      public: isPublic,
      chapters: chaptersForSave,
    };

    try {
      if (id) {
        await apiPut(`/api/narratives/${id}`, narrativeData);
        alert('Narrative updated successfully!');
      } else {
        await apiPost('/api/narratives', narrativeData);
        alert('Narrative created successfully!');
      }
      navigate('/narratives');
    } catch (error) {
      console.error('Error creating/updating narrative: ', error);
      alert('Error creating/updating narrative. Please try again.');
    }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className={styles.dashboard + " admin-shell"}>
      <div className={styles.sidebar}>
        <ul className={styles.sidebarMenu}>
          <li onClick={() => navigate('/dashboard')}>
            <FontAwesomeIcon icon={faHome} />
            <span>Home</span>
          </li>
          <li onClick={() => navigate('/eras')}>
            <FontAwesomeIcon icon={faTimeline} />
            <span>Eras</span>
          </li>
          <li onClick={() => navigate('/maps')}>
            <FontAwesomeIcon icon={faMap} />
            <span>Maps</span>
          </li>
          <li onClick={() => navigate('/narratives')}>
            <FontAwesomeIcon icon={faBook} />
            <span>Narratives</span>
          </li>
          <li onClick={() => navigate('/settings')}>
            <FontAwesomeIcon icon={faCog} />
            <span>Settings</span>
          </li>
        </ul>
      </div>

      <div className={styles.content} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className={styles.headBar} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>{id ? 'Edit Narrative' : 'Create Narrative'}</h1>
          <button 
            type="button" 
            onClick={() => addChapter(0)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 2px 4px rgba(40, 167, 69, 0.2)'
            }}
          >
            + Add Chapter
          </button>
        </div>

        <div className={styles.formContainer} style={{ flex: 1, overflowY: 'auto' }}>
          <form onSubmit={handleFormSubmit}>
            <div className={styles.formGroup}>
              <div style={{ marginBottom: '24px' }}>
                <label htmlFor="title" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
                  Title
                </label>
                <input
                  type="text"
                  name="title"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label htmlFor="description" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
                  Description
                </label>
                <Editor
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={styles.richTextEditor}
                />
              </div>

              <div style={{ 
                marginBottom: '24px',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                borderRadius: '6px',
                border: '1px solid #e9ecef'
              }}>
                <label htmlFor="isPublic" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="isPublic"
                    id="isPublic"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    style={{ marginRight: '8px', width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>
                    Visible on website
                  </span>
                </label>
                <small style={{ display: 'block', marginLeft: '26px', marginTop: '4px', color: '#666', fontSize: '12px' }}>
                  (uncheck to hide incomplete drafts)
                </small>
              </div>

              <div style={{ marginTop: '32px', marginBottom: '16px' }}>
                <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600' }}>Chapters</h2>
              </div>

              <div className={styles.chapters}>
                {chapters.length === 0 && (
                  <p style={{ marginTop: 12 }}>No chapters yet. Click "Add Chapter".</p>
                )}

                <DraggableList
                  droppableId="narrative-chapters"
                  items={sortedChaptersForDisplay}
                  getId={(ch) => ch.key}
                  onReorder={handleReorderChapters}
                  renderItem={(ch, displayIndex, dragHandleProps) => {
                  // Find the actual index in the original array for move/remove operations
                  const actualIndex = chapters.findIndex(c => c.key === ch.key);
                  return (
                    <React.Fragment key={ch.key || `chapter-${displayIndex}`}>
                      <div className={styles.chapterItem}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '10px',
                          padding: '10px 12px',
                          backgroundColor: '#f9f9f9',
                          borderRadius: '6px',
                          border: '1px solid #e0e0e0'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span
                              {...dragHandleProps}
                              title="Drag to reorder"
                              style={{ cursor: 'grab', color: '#888', display: 'flex', alignItems: 'center' }}
                            >
                              <FontAwesomeIcon icon={faGripVertical} />
                            </span>
                            <strong style={{ fontSize: '16px', color: '#333' }}>Chapter {displayIndex + 1}</strong>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => moveChapter(actualIndex, 'up')}
                              disabled={displayIndex === 0}
                              style={{ 
                                padding: '6px 10px',
                                fontSize: '12px',
                                border: '1px solid #d0d0d0',
                                borderRadius: '4px',
                                backgroundColor: displayIndex === 0 ? '#f5f5f5' : '#ffffff',
                                color: displayIndex === 0 ? '#999' : '#333',
                                cursor: displayIndex === 0 ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              onMouseEnter={(e) => {
                                if (displayIndex !== 0) {
                                  e.target.style.backgroundColor = '#f0f0f0';
                                  e.target.style.borderColor = '#b0b0b0';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (displayIndex !== 0) {
                                  e.target.style.backgroundColor = '#ffffff';
                                  e.target.style.borderColor = '#d0d0d0';
                                }
                              }}
                              title="Move up"
                            >
                              <FontAwesomeIcon icon={faArrowUp} style={{ fontSize: '11px' }} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveChapter(actualIndex, 'down')}
                              disabled={displayIndex === chapters.length - 1}
                              style={{ 
                                padding: '6px 10px',
                                fontSize: '12px',
                                border: '1px solid #d0d0d0',
                                borderRadius: '4px',
                                backgroundColor: displayIndex === chapters.length - 1 ? '#f5f5f5' : '#ffffff',
                                color: displayIndex === chapters.length - 1 ? '#999' : '#333',
                                cursor: displayIndex === chapters.length - 1 ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              onMouseEnter={(e) => {
                                if (displayIndex !== chapters.length - 1) {
                                  e.target.style.backgroundColor = '#f0f0f0';
                                  e.target.style.borderColor = '#b0b0b0';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (displayIndex !== chapters.length - 1) {
                                  e.target.style.backgroundColor = '#ffffff';
                                  e.target.style.borderColor = '#d0d0d0';
                                }
                              }}
                              title="Move down"
                            >
                              <FontAwesomeIcon icon={faArrowDown} style={{ fontSize: '11px' }} />
                            </button>
                            <button 
                              type="button" 
                              onClick={() => removeChapter(actualIndex)} 
                              style={{ 
                                padding: '6px 12px',
                                fontSize: '12px',
                                border: '1px solid #dc3545',
                                borderRadius: '4px',
                                backgroundColor: '#ffffff',
                                color: '#dc3545',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: '500'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#dc3545';
                                e.target.style.color = '#ffffff';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#ffffff';
                                e.target.style.color = '#dc3545';
                              }}
                              title="Remove chapter"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
  
                        <label>Chapter ID (auto-generated):</label>
                        <input
                          type="text"
                          value={ch.chapter_id}
                          disabled
                          style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                          title="Chapter ID is auto-generated and cannot be changed"
                        />
                        <br />
  
                        <label>Speed:</label>
                        <input
                          type="number"
                          step="0.1"
                          value={ch.speed}
                          onChange={(e) =>
                            handleChapterField(
                              actualIndex,
                              'speed',
                              e.target.value === '' ? '' : Number(e.target.value)
                            )
                          }
                        />
                        <br />
  
                        <label>Content:</label>
                        <RichTextEditor
                          value={ch.content}
                          onChange={(e) =>
                            handleChapterField(actualIndex, 'content', e.target.value)
                          }
                          className={styles.richTextEditor}
                        />
                        <br />
  
                        <label>Data JSON (paste from map overlay):</label>
                        <textarea
                          rows={8}
                          value={ch.dataJsonText}
                          onChange={(e) =>
                            handleChapterField(actualIndex, 'dataJsonText', e.target.value)
                          }
                          placeholder={`{\n  "currentMapFocusLocation": [-122.4194, 37.7749],\n  "currentZoomLevel": 12,\n  "maps": [\n    { "id": "abc", "opacityVal": 1 }\n  ]\n}`}
                          className={styles.textarea}
                          style={{ width: '100%', fontFamily: 'monospace' }}
                        />
                      </div>
                      
                      {/* Insertion divider between chapters */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        margin: '20px 0',
                        position: 'relative'
                      }}>
                        <div style={{ position: 'absolute', width: '100%', height: '1px', backgroundColor: '#e9ecef', zIndex: 0 }}></div>
                        <button
                          type="button"
                          onClick={() => addChapter(displayIndex + 1)}
                          style={{
                            position: 'relative',
                            zIndex: 1,
                            backgroundColor: '#fff',
                            border: '1px solid #dee2e6',
                            borderRadius: '20px',
                            padding: '4px 12px',
                            fontSize: '11px',
                            color: '#6c757d',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            transition: 'all 0.2s',
                            fontWeight: '600',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#007bff';
                            e.currentTarget.style.color = '#007bff';
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#dee2e6';
                            e.currentTarget.style.color = '#6c757d';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span> Insert Chapter Here
                        </button>
                      </div>
                    </React.Fragment>
                  );
                  }}
                />
              </div>

              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e9ecef' }}>
                <button 
                  type="button" 
                  onClick={addChapter}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '16px'
                  }}
                >
                  Add Chapter
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className={styles.formFooter}>
          <button type="button" disabled={isSubmitting} onClick={(e) => { e.preventDefault(); handleFormSubmit(e); }}>
            {isSubmitting ? (
              <><FontAwesomeIcon icon={faSpinner} spin /> {id ? 'Updating…' : 'Saving…'}</>
            ) : (
              id ? 'Update' : 'Save'
            )}
          </button>
          <button type="button" onClick={() => navigate('/narratives')}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateNarrativePage;

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Editor from 'react-simple-wysiwyg';
import { faHome, faMap, faBook, faCog, faTimeline, faLocationDot, faImage } from '@fortawesome/free-solid-svg-icons';
import { db, storage } from '../../../../firebase';
import { collection, addDoc, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getMetadata } from 'firebase/storage';
import styles from '../style.module.css';

const formatBytes = (bytes) => {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Pull the original file name out of a Firebase download URL as a fallback
// when storage metadata can't be fetched.
const fileNameFromUrl = (url) => {
  try {
    const path = decodeURIComponent(url.split('/o/')[1].split('?')[0]);
    return path.split('/').pop();
  } catch (e) {
    return 'file';
  }
};

/**
 * Shows the file name, size and upload date for a raster/vector file.
 * `file` may be either a freshly-selected File object (not uploaded yet) or a
 * Firebase Storage download URL (already uploaded), in which case metadata is
 * fetched from Storage.
 */
function FileMeta({ file }) {
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    let active = true;

    if (!file) {
      setMeta(null);
      return;
    }

    if (typeof file === 'string') {
      // Already uploaded — fetch name/size/date from Storage.
      (async () => {
        try {
          const m = await getMetadata(ref(storage, file));
          if (active) {
            setMeta({ name: m.name, size: m.size, uploaded: m.timeCreated });
          }
        } catch (err) {
          if (active) {
            setMeta({ name: fileNameFromUrl(file), size: null, uploaded: null });
          }
        }
      })();
    } else {
      // Newly selected local file, not uploaded yet.
      setMeta({ name: file.name, size: file.size, uploaded: null, pending: true });
    }

    return () => {
      active = false;
    };
  }, [file]);

  if (!file || !meta) return null;

  return (
    <div className={styles.fileMeta}>
      <div><strong>File name:</strong> {meta.name}</div>
      <div><strong>File size:</strong> {formatBytes(meta.size)}</div>
      <div>
        <strong>Uploaded:</strong>{' '}
        {meta.pending
          ? 'Not uploaded yet — save to upload'
          : meta.uploaded
            ? new Date(meta.uploaded).toLocaleString()
            : '—'}
      </div>
    </div>
  );
}

const CreateMapPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [html, setHtml] = useState('');
  const [footnotes, setFootnotes] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [title, setTitle] = useState('');
  const [years, setYears] = useState('');
  const [vectorFile, setVectorFile] = useState(null);
  const [rasterImage, setRasterImage] = useState(null);
  const [coordinates, setCoordinates] = useState({ x1y1: '', x2y2: '', x3y3: '', x4y4: '' });
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [vectorPoints, setVectorPoints] = useState([]);
  // Other maps that already have bounds, offered in the "copy bounds from…" picker.
  const [boundsSources, setBoundsSources] = useState([]);

  useEffect(() => {
    const fetchMapData = async () => {
      if (id) {
        const mapDoc = await getDoc(doc(db, 'maps', id));
        if (mapDoc.exists()) {
          const data = mapDoc.data();
          setTitle(data.title);
          setYears(data.years);
          setHtml(data.description);
          setFootnotes(data.footnotes || '');
          setSelectedOption(data.map_type);
          if (data.map_type === 'vector') {
            setVectorFile(data.vector_file || null);
            setVectorPoints(data.vector_points || []);
            // Optional explicit bounds used to frame the map when centering.
            if (Array.isArray(data.focus_bounds) && data.focus_bounds.length === 4) {
              setCoordinates({
                x1y1: data.focus_bounds[0] || '',
                x2y2: data.focus_bounds[1] || '',
                x3y3: data.focus_bounds[2] || '',
                x4y4: data.focus_bounds[3] || ''
              });
            }
          } else if (data.map_type === 'raster') {
            setRasterImage(data.raster_image);
            setCoordinates({
              x1y1: data.image_bounds_coords?.[0] || '',
              x2y2: data.image_bounds_coords?.[1] || '',
              x3y3: data.image_bounds_coords?.[2] || '',
              x4y4: data.image_bounds_coords?.[3] || ''
            });
          }
        }
      }
      setLoading(false);
    };

    const fetchBoundsSources = async () => {
      try {
        const snap = await getDocs(collection(db, 'maps'));
        const sources = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((m) => m.id !== id)
          .map((m) => {
            // A source can offer either raster image bounds or vector focus bounds.
            const bounds =
              Array.isArray(m.image_bounds_coords) && m.image_bounds_coords.length === 4
                ? m.image_bounds_coords
                : Array.isArray(m.focus_bounds) && m.focus_bounds.length === 4
                  ? m.focus_bounds
                  : null;
            return bounds
              ? { id: m.id, title: m.title || '(untitled map)', map_type: m.map_type, bounds }
              : null;
          })
          .filter(Boolean);
        setBoundsSources(sources);
      } catch (err) {
        console.error('Error loading maps for copy-bounds:', err);
      }
    };

    fetchMapData();
    fetchBoundsSources();
  }, [id]);

  const handleCopyBounds = (sourceId) => {
    const src = boundsSources.find((m) => m.id === sourceId);
    if (!src) return;
    const b = src.bounds;
    setCoordinates({
      x1y1: b[0] || '',
      x2y2: b[1] || '',
      x3y3: b[2] || '',
      x4y4: b[3] || ''
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
  
    let docData = {
      title,
      years,
      description: html,
      footnotes,
      map_type: selectedOption,
      rotation,
    };
  
    try {
      let mapId = id; // Use the existing ID if editing; create a new one later for new maps
  
      if (!id) {
        // Create a new map document and retrieve its ID
        const newDocRef = await addDoc(collection(db, 'maps'), {}); // Temporarily create a blank document
        mapId = newDocRef.id;
      }
  
      // Upload vector file for 'vector' type maps
      if (selectedOption === 'vector' && vectorFile && typeof vectorFile !== 'string') {
        const vectorFileRef = ref(storage, `maps/vector/${mapId}/${vectorFile.name}`);
        await uploadBytes(vectorFileRef, vectorFile);
        const vectorFileURL = await getDownloadURL(vectorFileRef);
        docData.vector_file = vectorFileURL;
      }
  
      // Upload raster image for 'raster' type maps
      if (selectedOption === 'raster' && rasterImage && typeof rasterImage !== 'string') {
        const rasterImageRef = ref(storage, `maps/raster/${mapId}/${rasterImage.name}`);
        await uploadBytes(rasterImageRef, rasterImage);
        const rasterImageURL = await getDownloadURL(rasterImageRef);
        docData.raster_image = rasterImageURL;
        docData.image_bounds_coords = Object.values(coordinates);
      } else if (selectedOption === 'raster') {
        // Only update coordinates if no new raster image is uploaded
        docData.image_bounds_coords = Object.values(coordinates);
      }
  
      // Persist optional focus bounds for vector maps (used to frame the map
      // when the centering button is pressed). Only store if the user set them.
      if (selectedOption === 'vector') {
        const boundsVals = Object.values(coordinates);
        if (boundsVals.some((v) => typeof v === 'string' && v.trim() !== '')) {
          docData.focus_bounds = boundsVals;
        }
      }

      // Handle vector points upload
      if (selectedOption === 'vector') {
        const vectorInfo = await Promise.all(
          vectorPoints.map(async (point, index) => {
            if (point.image && typeof point.image !== 'string') {
              const imageRef = ref(storage, `maps/vector/${mapId}/point_${index + 1}`);
              await uploadBytes(imageRef, point.image);
              const imageUrl = await getDownloadURL(imageRef);
              return { ...point, image: imageUrl };
            }
            return point;
          })
        );
        docData.vector_points = vectorInfo;
      }
  
      // Update the map document in Firestore
      if (id) {
        await updateDoc(doc(db, 'maps', id), docData);
        alert('Map updated successfully!');
      } else {
        await updateDoc(doc(db, 'maps', mapId), docData);
        alert('Map created successfully!');
      }
  
      navigate('/maps');
    } catch (error) {
      console.error('Error creating/updating map: ', error);
      alert('Error creating/updating map. Please try again.');
    }
  };
  
  

  const handleXMLUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(event.target.result, 'text/xml');

        const westBL = xmlDoc.getElementsByTagName('westBL')[0]?.textContent;
        const eastBL = xmlDoc.getElementsByTagName('eastBL')[0]?.textContent;
        const southBL = xmlDoc.getElementsByTagName('southBL')[0]?.textContent;
        const northBL = xmlDoc.getElementsByTagName('northBL')[0]?.textContent;

        setCoordinates({
          x1y1: `${westBL},${northBL}`,
          x2y2: `${eastBL},${northBL}`,
          x3y3: `${eastBL},${southBL}`,
          x4y4: `${westBL},${southBL}`
        });
      };
      reader.readAsText(file);
    }
  };

  const onChange = (e) => {
    setHtml(e.target.value);
  };

  const onFootnotesChange = (e) => {
    setFootnotes(e.target.value);
  };

  const handleCoordinateChange = (e) => {
    const { name, value } = e.target;
    setCoordinates((prevState) => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleVectorPointChange = (index, field, value) => {
    const updatedPoints = [...vectorPoints];
    updatedPoints[index] = {
      ...updatedPoints[index],
      [field]: value,
    };
    setVectorPoints(updatedPoints);
  };

  const rotateCoordinates = (coords, direction) => {
    const { x1y1, x2y2, x3y3, x4y4 } = coords;
    if (direction === 90) {
      return {
        x1y1: x4y4,
        x2y2: x1y1,
        x3y3: x2y2,
        x4y4: x3y3
      };
    } else if (direction === -90) {
      return {
        x1y1: x2y2,
        x2y2: x3y3,
        x3y3: x4y4,
        x4y4: x1y1
      };
    }
  };

  const handleRotation = (direction) => {
    setCoordinates((prevState) => rotateCoordinates(prevState, direction));
    setRotation((prevRotation) => (prevRotation + direction + 360) % 360);
  };

  const handleAddPoint = () => {
    setVectorPoints([...vectorPoints, { coordinates: '', bearing: '', caption: '', image: null, is_directional: false, description: '', footnotes: '' }]);
  };

  const handleRemovePoint = (index) => {
    if (!window.confirm(`Are you sure you want to remove Point ${index + 1}?`)) return;
    const updatedPoints = [...vectorPoints];
    updatedPoints.splice(index, 1);
    setVectorPoints(updatedPoints);
  };

  const handleVectorImageChange = (index, file) => {
    const updatedPoints = [...vectorPoints];
    updatedPoints[index] = {
      ...updatedPoints[index],
      image: file,
    };
    setVectorPoints(updatedPoints);
  };

  const handleDirectionalChange = (index, checked) => {
    const updatedPoints = [...vectorPoints];
    updatedPoints[index] = {
      ...updatedPoints[index],
      is_directional: checked,
    };
    setVectorPoints(updatedPoints);
  };

  const copyBoundsPicker = (
    <div className={styles.copyBounds}>
      <label>Copy bounds from another map</label>
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) handleCopyBounds(e.target.value);
        }}
      >
        <option value="">— Select a map to copy bounds from —</option>
        {boundsSources.map((m) => (
          <option key={m.id} value={m.id}>
            {m.title}{m.map_type ? ` (${m.map_type})` : ''}
          </option>
        ))}
      </select>
      {boundsSources.length === 0 && (
        <span className={styles.copyBoundsHint}>No other maps have bounds to copy yet.</span>
      )}
    </div>
  );

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className={styles.dashboard}>
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
          <h1>{id ? 'Edit Map' : 'Create Map'}</h1>
          <div>
            <button onClick={() => navigate('/maps')}>Back</button>
          </div>
        </div>
        <div className={styles.formContainer}>
          <form onSubmit={handleFormSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="title">Title</label>
              <input type="text" name="title" id="title" value={title} onChange={(e) => setTitle(e.target.value)} />

              <br />
              <br />

              <label htmlFor="years">Years</label>
              <input type="text" name="years" id="years" value={years} onChange={(e) => setYears(e.target.value)} />

              <br />
              <br />
              
              <label htmlFor="description">Description</label>
              <Editor className={styles.richTextEditor} value={html} onChange={onChange} />

              <br />
              
              <div>
              <label htmlFor="footnotes">Footnotes</label>
              <Editor className={styles.richTextEditor} value={footnotes} onChange={onFootnotesChange} />
              </div>

              <br />

              <div className={styles.mapOptionsArea}>
                <div 
                  className={`${styles.option} ${selectedOption === 'vector' ? styles.optionSelected : ''}`}
                  onClick={() => setSelectedOption('vector')}
                >
                  <h1><FontAwesomeIcon icon={faLocationDot} /></h1>
                  <h3>Vector</h3>
                </div>

                <div 
                  className={`${styles.option} ${selectedOption === 'raster' ? styles.optionSelected : ''}`}
                  onClick={() => setSelectedOption('raster')}
                >
                  <h1><FontAwesomeIcon icon={faImage} /></h1>
                  <h3>Raster</h3>
                </div>
              </div>

              <div className={styles.afterMapChoiceFormArea}>
                {selectedOption === 'vector' && (
                  <div className={styles.vectorForm}>
                    <label htmlFor="vectorFile">Vector File (optional)</label>
                    <input type="file" name="vectorFile" id="vectorFile" onChange={(e) => setVectorFile(e.target.files[0])} />
                    <FileMeta file={vectorFile} />
                    {typeof vectorFile === 'string' && (
                      <div>
                        <a href={vectorFile} target="_blank" rel="noopener noreferrer">View current vector file</a>
                      </div>
                    )}

                    <br />
                    <label>Vector Points</label>

                    {vectorPoints.map((point, index) => (
                      <div key={index} className={styles.vectorPoint}>
                        <fieldset style={{ border: "1px solid black", padding: "10px", marginBottom: "10px" }}>
                          <legend>Point {index + 1}</legend>
                          <input type="text" value={point.coordinates} onChange={(e) => handleVectorPointChange(index, 'coordinates', e.target.value)} placeholder='Coordinates (x, y)' style={{ marginBottom: '10px', width: '100%' }} />

                          <label>Bearing</label>
                          <div style={{width:"100%"}}>
                            <input type="number" value={point.bearing} onChange={(e) => handleVectorPointChange(index, 'bearing', e.target.value)} placeholder='Bearing (in degrees 0-360)' style={{ marginBottom: '10px', width: '100%' }} className={`${styles.fullWidth}`} />
                          </div>
                          
                          <label>Description</label>
                          <div style={{width:"100%"}}>
                            <Editor value={point.description} onChange={(e) => handleVectorPointChange(index, 'description', e.target.value)} className={`${styles.richTextEditor} ${styles.fullWidth}`} />
                          </div>
                          
                          <label>Footnotes</label>
                          <div style={{width:"100%"}}>
                            <Editor value={point.footnotes} onChange={(e) => handleVectorPointChange(index, 'footnotes', e.target.value)} className={`${styles.richTextEditor} ${styles.fullWidth}`} />
                          </div>

                          <input type="file" onChange={(e) => handleVectorImageChange(index, e.target.files[0])} style={{ marginBottom: '10px', width: '100%' }} />
                          <FileMeta file={point.image} />
                          {point.image && typeof point.image === 'string' && (
                            <div>
                              <img src={point.image} alt={`Point ${index + 1}`} style={{ width: '100%', height: 'auto', marginTop: '10px' }} />
                            </div>
                          )}
                          <br />

                          <label htmlFor={`isDirectional-${index}`}>
                            <input 
                              type="checkbox" 
                              id={`isDirectional-${index}`} 
                              checked={point.is_directional} 
                              onChange={(e) => handleDirectionalChange(index, e.target.checked)} 
                            />
                            Is Directional
                          </label>
                          <button type="button" onClick={() => handleRemovePoint(index)}>Remove Point</button>
                        </fieldset>
                      </div>
                    ))}

                    <button type="button" onClick={handleAddPoint}>Add Point</button>

                    <br />
                    <br />
                    <div className={styles.vectorBoundsSection}>
                      <label>Map bounds for centering (optional)</label>
                      <p className={styles.copyBoundsHint}>
                        Pin layers usually sit on a parent map. Set bounds here (or copy them
                        from the parent map below) and the centering button will frame the map to
                        these bounds instead of zooming tightly to the pins. Leave blank to
                        auto-fit to the pins.
                      </p>
                      {copyBoundsPicker}
                      <div className={styles.coordinateInputs}>
                        <label htmlFor="v_x1y1">West, North</label>
                        <input type="text" name="x1y1" id="v_x1y1" placeholder='x1,y1' value={coordinates.x1y1} onChange={handleCoordinateChange} />
                        <br />
                        <br />
                        <label htmlFor="v_x2y2">East, North</label>
                        <input type="text" name="x2y2" id="v_x2y2" placeholder='x2,y2' value={coordinates.x2y2} onChange={handleCoordinateChange} />
                        <br />
                        <br />
                        <label htmlFor="v_x3y3">East, South</label>
                        <input type="text" name="x3y3" id="v_x3y3" placeholder='x3,y3' value={coordinates.x3y3} onChange={handleCoordinateChange} />
                        <br />
                        <br />
                        <label htmlFor="v_x4y4">West, South</label>
                        <input type="text" name="x4y4" id="v_x4y4" placeholder='x4,y4' value={coordinates.x4y4} onChange={handleCoordinateChange} />
                      </div>
                    </div>
                  </div>
                )}

                {selectedOption === 'raster' && (
                  <div className={styles.rasterForm}>
                    <label htmlFor="rasterImage">Raster Image</label>
                    <input type="file" name="rasterImage" id="rasterImage" onChange={(e) => setRasterImage(e.target.files[0])} />
                    <FileMeta file={rasterImage} />
                    {typeof rasterImage === 'string' && (
                      <div>
                        <img src={rasterImage} alt="Current Raster" style={{ width: '200px', height: 'auto', transform: `rotate(${rotation}deg)` }} />
                      </div>
                    )}
                    <br />
                    <label htmlFor="xmlFile">Upload XML for Bounds</label>
                    <input type="file" name="xmlFile" id="xmlFile" onChange={handleXMLUpload} />
                    <br />
                    {copyBoundsPicker}
                    <label htmlFor="imageBounds">Image Bounds Coordinates</label>
                    <div className={styles.coordinateInputs}>
                      <label htmlFor="x1y1">West, North</label>
                      <input type="text" name="x1y1" id="x1y1" placeholder='x1,y1' value={coordinates.x1y1} onChange={handleCoordinateChange} />
                      <br />
                      <br />
                      <label htmlFor="x2y2">East, North</label>
                      <input type="text" name="x2y2" id="x2y2" placeholder='x2,y2' value={coordinates.x2y2} onChange={handleCoordinateChange} />
                      <br />
                      <br />
                      <label htmlFor="x3y3">East, South</label>
                      <input type="text" name="x3y3" id="x3y3" placeholder='x3y3' value={coordinates.x3y3} onChange={handleCoordinateChange} />
                      <br />
                      <br /> 
                      <label htmlFor="x4y4">West, South</label>
                      <input type="text" name="x4y4" id="x4y4" placeholder='x4y4' value={coordinates.x4y4} onChange={handleCoordinateChange} />
                    </div>
                    <br />
                    <label>Rotation: {rotation} degrees</label>
                    <br />
                    <button type="button" onClick={() => handleRotation(-90)}>-90°</button>
                    <button type="button" onClick={() => handleRotation(90)}>90°</button>
                  </div>
                )}

                <br />
                <br />

                <button type="submit">{id ? 'Update Map' : 'Create Map'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateMapPage;

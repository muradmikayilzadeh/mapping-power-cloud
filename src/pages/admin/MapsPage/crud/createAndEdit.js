import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Editor from 'react-simple-wysiwyg';
import RichTextEditor from '../../../../components/RichTextEditor';
import { faHome, faMap, faBook, faCog, faTimeline, faLocationDot, faImage, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { apiGet, apiPost, apiPut, apiUpload, resolveAssetUrl } from '../../../../api/client';
import { validateCoordPairs } from '../../../../utils/coordinates';
import { isVideoFile } from '../../../../utils/media';
import styles from '../style.module.css';

// Above this, a file is large enough that it may load slowly or strain
// mobile visitors — not a hard limit, just a heads-up. Videos are naturally
// bigger than images, so they get a much more generous threshold.
const LARGE_RASTER_WARNING_BYTES = 15 * 1024 * 1024;
const LARGE_FILE_WARNING_BYTES = 5 * 1024 * 1024;
const LARGE_VIDEO_WARNING_BYTES = 50 * 1024 * 1024;

const formatBytes = (bytes) => {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Pull the original file name out of an uploaded file's path/URL.
const fileNameFromUrl = (url) => {
  try {
    return decodeURIComponent(url.split('?')[0].split('/').pop());
  } catch (e) {
    return 'file';
  }
};

/**
 * Shows the file name, size and upload date for a raster/vector file.
 * `file` may be either a freshly-selected File object (not uploaded yet) or
 * an already-uploaded file's URL, in which case size/date are read from the
 * static file server's response headers via a HEAD request.
 */
function FileMeta({ file, warnAboveBytes }) {
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    let active = true;

    if (!file) {
      setMeta(null);
      return;
    }

    if (typeof file === 'string') {
      // Already uploaded — read size/date from the static file response headers.
      (async () => {
        try {
          const res = await fetch(resolveAssetUrl(file), { method: 'HEAD' });
          const size = res.headers.get('content-length');
          const lastModified = res.headers.get('last-modified');
          if (active) {
            setMeta({
              name: fileNameFromUrl(file),
              size: size ? Number(size) : null,
              uploaded: lastModified || null,
            });
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

  const effectiveThreshold = isVideoFile(meta.name)
    ? Math.max(warnAboveBytes || 0, LARGE_VIDEO_WARNING_BYTES)
    : warnAboveBytes;
  const isLarge = typeof effectiveThreshold === 'number' && typeof meta.size === 'number' && meta.size > effectiveThreshold;

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
      {isLarge && (
        <div style={{ color: '#a15c00', marginTop: 4 }}>
          ⚠ This file is {formatBytes(meta.size)} — that's large enough that it may load slowly or
          cause problems for some visitors. Consider compressing it if possible.
        </div>
      )}
    </div>
  );
}

function CoordWarnings({ validation }) {
  if (!validation || (validation.errors.length === 0 && validation.warnings.length === 0)) return null;
  return (
    <div style={{ marginTop: 8 }}>
      {validation.errors.map((m, i) => (
        <div key={`e${i}`} style={{ color: '#b71c1c', fontSize: '13px' }}>⚠ {m}</div>
      ))}
      {validation.warnings.map((m, i) => (
        <div key={`w${i}`} style={{ color: '#a15c00', fontSize: '13px' }}>⚠ {m}</div>
      ))}
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
  // The site's configured default location, used as a sanity check for
  // coordinates that are technically valid but suspiciously far away.
  const [homeLocation, setHomeLocation] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchHomeLocation = async () => {
      try {
        const settings = await apiGet('/api/settings/public');
        const { geolocation } = settings || {};
        if (Array.isArray(geolocation) && geolocation.length === 2) {
          setHomeLocation({ lat: geolocation[0], lng: geolocation[1] });
        }
      } catch (err) {
        console.error('Error loading default location for coordinate checks:', err);
      }
    };
    fetchHomeLocation();
  }, []);

  useEffect(() => {
    const fetchMapData = async () => {
      if (id) {
        const data = await apiGet(`/api/maps/${id}`);
        if (data) {
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
        const allMaps = (await apiGet('/api/maps')) || [];
        const sources = allMaps
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

  // Coordinates are stored as "lng,lat" strings; validate against basic
  // range checks plus a distance-from-home-location sanity check so a
  // nonsense pin (or a reversed lat/lng paste from Google Maps) gets
  // flagged instead of silently producing an invisible map.
  const boundsCoordPairs = useMemo(() => ([
    { label: 'West, North corner', value: coordinates.x1y1 },
    { label: 'East, North corner', value: coordinates.x2y2 },
    { label: 'East, South corner', value: coordinates.x3y3 },
    { label: 'West, South corner', value: coordinates.x4y4 },
  ]), [coordinates]);

  const boundsValidation = useMemo(
    () => validateCoordPairs(boundsCoordPairs, homeLocation),
    [boundsCoordPairs, homeLocation]
  );

  const pointCoordPairs = useMemo(
    () => vectorPoints.map((p, i) => ({ label: `Point ${i + 1}`, value: p.coordinates })),
    [vectorPoints]
  );

  const pointsValidation = useMemo(
    () => validateCoordPairs(pointCoordPairs, homeLocation),
    [pointCoordPairs, homeLocation]
  );

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    const coordErrors = [
      ...boundsValidation.errors,
      ...(selectedOption === 'vector' ? pointsValidation.errors : []),
    ];
    if (coordErrors.length > 0) {
      const proceed = window.confirm(
        `These coordinates don't look valid:\n\n${coordErrors.join('\n')}\n\n` +
        `The map or pin may not show up (and "zoom to map" won't work) if you save anyway. Save anyway?`
      );
      if (!proceed) return;
    }

    let docData = {
      title,
      years,
      description: html,
      footnotes,
      map_type: selectedOption,
      rotation,
    };

    setIsSubmitting(true);
    try {
      let mapId = id; // Use the existing ID if editing; create a new one later for new maps

      if (!id) {
        // Create a blank map document first to reserve an id for upload paths
        const created = await apiPost('/api/maps', {});
        mapId = created.id;
      }

      // Upload vector file for 'vector' type maps
      if (selectedOption === 'vector' && vectorFile && typeof vectorFile !== 'string') {
        const { url } = await apiUpload(vectorFile, { category: 'maps', dir: `vector/${mapId}` });
        docData.vector_file = url;
      }

      // Upload raster image for 'raster' type maps
      if (selectedOption === 'raster' && rasterImage && typeof rasterImage !== 'string') {
        const { url } = await apiUpload(rasterImage, { category: 'maps', dir: `raster/${mapId}` });
        docData.raster_image = url;
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
              // Keep the original file name (and its extension) in the upload
              // path — without it, there's no way to tell a video upload from
              // an image afterward, so it always rendered (and failed) as an <img>.
              const { url } = await apiUpload(point.image, {
                category: 'maps',
                dir: `vector/${mapId}`,
                filenamePrefix: `point_${index + 1}_`,
              });
              return { ...point, image: url };
            }
            return point;
          })
        );
        docData.vector_points = vectorInfo;
      }

      // Save the map document
      if (id) {
        await apiPut(`/api/maps/${id}`, docData);
        alert('Map updated successfully!');
      } else {
        await apiPut(`/api/maps/${mapId}`, docData);
        alert('Map created successfully!');
      }

      navigate('/maps');
    } catch (error) {
      console.error('Error creating/updating map: ', error);
      alert('Error creating/updating map. Please try again.');
    } finally {
      setIsSubmitting(false);
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
              <RichTextEditor className={styles.richTextEditor} value={html} onChange={onChange} />

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
                    <FileMeta file={vectorFile} warnAboveBytes={LARGE_FILE_WARNING_BYTES} />
                    {typeof vectorFile === 'string' && (
                      <div>
                        <a href={resolveAssetUrl(vectorFile)} target="_blank" rel="noopener noreferrer">View current vector file</a>
                      </div>
                    )}

                    <br />
                    <label>Vector Points</label>

                    {vectorPoints.map((point, index) => (
                      <div key={index} className={styles.vectorPoint}>
                        <fieldset style={{ border: "1px solid black", padding: "10px", marginBottom: "10px" }}>
                          <legend>Point {index + 1}</legend>
                          <input type="text" value={point.coordinates} onChange={(e) => handleVectorPointChange(index, 'coordinates', e.target.value)} placeholder='Coordinates (longitude,latitude)' style={{ marginBottom: '4px', width: '100%' }} />
                          {pointCoordPairs[index] && (() => {
                            const result = validateCoordPairs([pointCoordPairs[index]], homeLocation);
                            const messages = [...result.errors, ...result.warnings];
                            if (messages.length === 0) return null;
                            return (
                              <div style={{ color: result.errors.length ? '#b71c1c' : '#a15c00', fontSize: '12px', marginBottom: '10px' }}>
                                {messages.map((m, i) => <div key={i}>⚠ {m}</div>)}
                              </div>
                            );
                          })()}

                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px' }}>
                            <label htmlFor={`isDirectional-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                              <input
                                type="checkbox"
                                id={`isDirectional-${index}`}
                                checked={point.is_directional}
                                onChange={(e) => handleDirectionalChange(index, e.target.checked)}
                              />
                              Is Directional
                            </label>
                            {point.is_directional && (
                              <label htmlFor={`bearing-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, flex: 1 }}>
                                Bearing
                                <input
                                  type="number"
                                  id={`bearing-${index}`}
                                  value={point.bearing}
                                  onChange={(e) => handleVectorPointChange(index, 'bearing', e.target.value)}
                                  placeholder="0-360°"
                                  style={{ width: '120px' }}
                                />
                              </label>
                            )}
                          </div>

                          <label>Description</label>
                          <div style={{width:"100%"}}>
                            <Editor value={point.description} onChange={(e) => handleVectorPointChange(index, 'description', e.target.value)} className={`${styles.richTextEditor} ${styles.fullWidth}`} />
                          </div>
                          
                          <label>Footnotes</label>
                          <div style={{width:"100%"}}>
                            <Editor value={point.footnotes} onChange={(e) => handleVectorPointChange(index, 'footnotes', e.target.value)} className={`${styles.richTextEditor} ${styles.fullWidth}`} />
                          </div>

                          <label>Image or video (optional)</label>
                          <input type="file" accept="image/*,video/*" onChange={(e) => handleVectorImageChange(index, e.target.files[0])} style={{ marginBottom: '4px', width: '100%' }} />
                          <p style={{ fontSize: '12px', color: '#777', margin: '0 0 10px' }}>
                            For video, .mp4 (H.264) plays reliably in every browser — some .mov files use a codec that only Safari can play.
                          </p>
                          <FileMeta file={point.image} warnAboveBytes={LARGE_FILE_WARNING_BYTES} />
                          {point.image && typeof point.image === 'string' && (
                            <div>
                              {isVideoFile(point.image) ? (
                                <video src={resolveAssetUrl(point.image)} controls style={{ width: '100%', height: 'auto', marginTop: '10px' }} />
                              ) : (
                                <img src={resolveAssetUrl(point.image)} alt={`Point ${index + 1}`} style={{ width: '100%', height: 'auto', marginTop: '10px' }} />
                              )}
                            </div>
                          )}
                          <br />

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
                      <CoordWarnings validation={boundsValidation} />
                    </div>
                  </div>
                )}

                {selectedOption === 'raster' && (
                  <div className={styles.rasterForm}>
                    <label htmlFor="rasterImage">Raster Image</label>
                    <input type="file" name="rasterImage" id="rasterImage" onChange={(e) => setRasterImage(e.target.files[0])} />
                    <FileMeta file={rasterImage} warnAboveBytes={LARGE_RASTER_WARNING_BYTES} />
                    {typeof rasterImage === 'string' && (
                      <div>
                        <img src={resolveAssetUrl(rasterImage)} alt="Current Raster" style={{ width: '200px', height: 'auto', transform: `rotate(${rotation}deg)` }} />
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
                    <CoordWarnings validation={boundsValidation} />
                    <br />
                    <label>Rotation: {rotation} degrees</label>
                    <br />
                    <button type="button" onClick={() => handleRotation(-90)}>-90°</button>
                    <button type="button" onClick={() => handleRotation(90)}>90°</button>
                  </div>
                )}

                <br />
                <br />

                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><FontAwesomeIcon icon={faSpinner} spin /> {id ? 'Updating…' : 'Creating…'}</>
                  ) : (
                    id ? 'Update Map' : 'Create Map'
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateMapPage;

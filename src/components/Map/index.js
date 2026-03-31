import React, { useRef, useEffect, useState } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import styles from './style.module.css';
import pinDirectional from './pin-directional.png';
import pin from './pin.png';

const fetchSettingsData = async () => {
  try {
    const docRef = doc(db, 'settings', 'settingsData');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error('Error fetching settings data:', error);
    return null;
  }
};

const fetchMapData = async (mapId) => {
  try {
    const docRef = doc(db, 'maps', mapId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching map ${mapId}:`, error);
    return null;
  }
};

export default function Map({
  selectedMaps,
  mapStyle,
  selectedNarrative,
  activeChapter,
  onUpdateOpacity,
  onFlyToLocation,
  onMapViewChange,
  isMapLoading,
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);

  const [location, setLocation] = useState({ lng: -122.4194, lat: 37.7749 });
  const [zoom, setZoom] = useState(12);

  const [liveCenter, setLiveCenter] = useState({ lng: -122.4194, lat: 37.7749 });
  const [liveZoom, setLiveZoom] = useState(12);

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  // Keep a ref of what we think is on the map (ids)
  const mountedIdsRef = useRef(new Set());
  // Cache for fetched maps (ID -> FullMapObject)
  const mapCacheRef = useRef({});

  maptilersdk.config.apiKey = 'llr35dKpffrGaP9ECLL8';

  const updateOpacity = (mapId, opacity) => {
    if (!map.current) return;

    const rasterLayerId = `overlay-${mapId}`;
    if (map.current.getLayer(rasterLayerId)) {
      map.current.setPaintProperty(rasterLayerId, 'raster-opacity', opacity);
    }

    const vectorLayerId = `vector-layer-${mapId}`;
    if (map.current.getLayer(vectorLayerId)) {
      map.current.setPaintProperty(vectorLayerId, 'icon-opacity', opacity);
    }
  };

  useEffect(() => {
    if (onUpdateOpacity) onUpdateOpacity(() => updateOpacity);
  }, [onUpdateOpacity]);

  /**
   * Programmatically adjust the main map view.
   *
   * Usage patterns:
   * - flyToLocation([lng, lat], zoomLevel:number) -> simple flyTo
   * - flyToLocation([lng, lat], { bounds: [[swLng, swLat], [neLng, neLat]], padding }) -> fit map to bounds
   */
  const flyToLocation = (target, zoomOrOptions) => {
    if (!map.current || !target) return;

    // Bounds-based zoom (preferred for "zoom to map" behavior)
    if (zoomOrOptions && typeof zoomOrOptions === 'object' && zoomOrOptions.bounds) {
      const { bounds, padding } = zoomOrOptions;

      try {
        map.current.fitBounds(bounds, {
          // Give extra padding on the left to visually center the map
          // to the right of the screen where the left sidebar sits.
          padding:
            padding || {
              top: 40,
              bottom: 40,
              left: 260,
              right: 40,
            },
          essential: true,
        });
        return;
      } catch (e) {
        console.error('Error fitting bounds, falling back to flyTo:', e);
      }
    }

    // Simple center/zoom behavior
    if (Array.isArray(target) && target.length === 2) {
      const [lng, lat] = target;
      const zoomLevel =
        typeof zoomOrOptions === 'number' && !Number.isNaN(zoomOrOptions)
          ? zoomOrOptions
          : 14;

      map.current.flyTo({ center: [lng, lat], zoom: zoomLevel, essential: true });
    }
  };
  useEffect(() => {
    if (onFlyToLocation) onFlyToLocation(() => flyToLocation);
  }, [onFlyToLocation]);

  useEffect(() => {
    const readAuth = () => {
      setIsAuthorized(localStorage.getItem('isAuthorized') === 'true');
    };
    readAuth();
    const onStorage = (e) => {
      if (e.key === 'isAuthorized') readAuth();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const fetchInitialSettings = async () => {
      const settings = await fetchSettingsData();
      if (settings) {
        const { geolocation, mapZoom } = settings;
        if (geolocation && geolocation.length === 2) {
          setLocation({ lng: geolocation[1], lat: geolocation[0] });
          setLiveCenter({ lng: geolocation[1], lat: geolocation[0] });
        }
        if (mapZoom !== undefined) {
          setZoom(mapZoom);
          setLiveZoom(mapZoom);
        }
      }
    };
    fetchInitialSettings();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maptilersdk.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [location.lng, location.lat],
      zoom,
    });

    const updateLiveState = () => {
      const c = map.current.getCenter();
      const newCenter = { lng: Number(c.lng.toFixed(6)), lat: Number(c.lat.toFixed(6)) };
      const newZoom = Number(map.current.getZoom().toFixed(2));
      setLiveCenter(newCenter);
      setLiveZoom(newZoom);
      // Notify parent component of view changes
      if (onMapViewChange) {
        onMapViewChange({ center: newCenter, zoom: newZoom });
      }
    };

    map.current.on('load', () => {
      if (!map.current.hasImage('arrow-icon')) {
        const img = new Image();
        img.src = pin;
        img.onload = () => {
          if (!map.current.hasImage('arrow-icon')) {
            map.current.addImage('arrow-icon', img);
          }
        };
      }
      if (!map.current.hasImage('arrow-icon-directional')) {
        const imgDirectional = new Image();
        imgDirectional.src = pinDirectional;
        imgDirectional.onload = () => {
          if (!map.current.hasImage('arrow-icon-directional')) {
            map.current.addImage('arrow-icon-directional', imgDirectional);
          }
        };
      }

      if (selectedMaps.length) {
        renderMaps(selectedMaps);
      }
      updateLiveState();
      // Also update on initial load
      if (onMapViewChange) {
        const c = map.current.getCenter();
        onMapViewChange({
          center: { lng: Number(c.lng.toFixed(6)), lat: Number(c.lat.toFixed(6)) },
          zoom: Number(map.current.getZoom().toFixed(2))
        });
      }
    });

    map.current.on('moveend', updateLiveState);
    map.current.on('zoomend', updateLiveState);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        mountedIdsRef.current = new Set();
      }
    };
  }, [mapContainer]);

  // Handle mapStyle changes separately to preserve current view
  useEffect(() => {
    if (!map.current) return;
    
    // Check if style actually changed (robust check for both string URIs and JSON objects)
    const currentStyle = map.current.getStyle();
    const isNewStyleObject = typeof mapStyle === 'object' && mapStyle !== null;
    const isCurrentStyleBlank = currentStyle && currentStyle.name === 'Blank';

    if (isNewStyleObject && isCurrentStyleBlank) return;
    if (!isNewStyleObject && currentStyle && currentStyle.name === mapStyle) return;

    if (map.current) {
      // If null, we just use a white matte; don't reload style
      if (mapStyle === null) {
        if (map.current.getLayer('whiteout-layer')) {
          map.current.setLayoutProperty('whiteout-layer', 'visibility', 'visible');
        }
        return;
      }

      // If switching to a real style, hide matte and set style
      if (map.current.getLayer('whiteout-layer')) {
        map.current.setLayoutProperty('whiteout-layer', 'visibility', 'none');
      }
      
      map.current.setStyle(mapStyle);

      const onStyleLoad = () => {
        if (!map.current) return;
        renderMaps(selectedMaps);
      };

      map.current.on('style.load', onStyleLoad);
      return () => {
        if (map.current) {
          map.current.off('style.load', onStyleLoad);
        }
      };
    }
  }, [mapStyle]);

  // Only update/add/remove as needed (no full re-add)
  useEffect(() => {
    if (!map.current) return;
    
    // If in narrative mode, don't allow sidebar maps to overwrite
    if (selectedNarrative && activeChapter) return;

    if (map.current.isStyleLoaded()) {
      renderMaps(selectedMaps);
    } else {
      const onStyleLoad = () => {
        if (!map.current) return;
        renderMaps(selectedMaps);
        map.current.off('style.load', onStyleLoad);
      };
      map.current.on('style.load', onStyleLoad);
    }
  }, [selectedMaps]);

  useEffect(() => {
    if (!map.current || !selectedNarrative || !activeChapter) return;
    const chapters = selectedNarrative.chapters || {};
    const chapter = chapters[activeChapter];
    if (!chapter) return;

    // Clear any existing popups when moving to a new chapter
    const popups = document.getElementsByClassName('maplibregl-popup');
    while (popups[0]) {
      popups[0].remove();
    }

    // Hydrate chapter maps (turn IDs into full objects)
    const hydrateMaps = async () => {
      if (!chapter.maps) return;

      const hydrated = await Promise.all(
        chapter.maps.map(async (m) => {
          // If already full object, return
          if (m.image_bounds_coords || m.vector_points) return m;

          const id = typeof m === 'string' ? m : m.id;
          const opacity = (m.opacityVal !== undefined ? m.opacityVal : (m.opacity !== undefined ? m.opacity : 1));

          // Check cache
          if (mapCacheRef.current[id]) {
            return { ...mapCacheRef.current[id], opacity };
          }

          // Fetch if missing
          const fullData = await fetchMapData(id);
          if (fullData) {
            mapCacheRef.current[id] = fullData;
            return { ...fullData, opacity };
          }
          return null;
        })
      );

      const validMaps = hydrated.filter((m) => m !== null);
      renderMaps(validMaps);
    };

    hydrateMaps();

    const { center, zoom: chapterZoom } = chapter;

    if (Array.isArray(center) && center.length === 2 && typeof chapterZoom === 'number') {
      map.current.flyTo({ center, zoom: chapterZoom, essential: true });
    } else if (Array.isArray(center) && center.length === 2) {
      map.current.flyTo({ center, essential: true });
    } else if (typeof chapterZoom === 'number') {
      map.current.flyTo({ zoom: chapterZoom, essential: true });
    }
  }, [activeChapter, selectedNarrative]);

  const renderMaps = (maps) => {
    if (!map.current) return;

    // Ensure whiteout layer exists and is always at the bottom of our custom layers
    if (!map.current.getSource('whiteout-source')) {
      map.current.addSource('whiteout-source', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]
            ]]
          }
        }
      });
      map.current.addLayer({
        id: 'whiteout-layer',
        type: 'fill',
        source: 'whiteout-source',
        layout: { 
          visibility: mapStyle === null ? 'visible' : 'none' 
        },
        paint: {
          'fill-color': '#ffffff',
          'fill-opacity': 1
        }
      });
    } else {
      // Just ensure it's on bottom (before the first historical or narrative layer if any)
      const layers = map.current.getStyle().layers || [];
      const firstDataLayer = layers.find(l => 
        l.id.startsWith('raster-') || 
        l.id.startsWith('vector-') || 
        l.id.startsWith('narrative-')
      );
      
      if (firstDataLayer) {
        map.current.moveLayer('whiteout-layer', firstDataLayer.id);
      } else {
        map.current.moveLayer('whiteout-layer');
      }
      
      map.current.setLayoutProperty('whiteout-layer', 'visibility', mapStyle === null ? 'visible' : 'none');
    }

    const desiredIds = new Set((maps || []).map((m) => m.id));
    const style = map.current.getStyle();
    const existingSources = style?.sources || {};

    // 1. Remove deselected
    Object.keys(existingSources).forEach((sourceId) => {
      const isAerial = sourceId.startsWith('aerial-source-');
      const isVector = sourceId.startsWith('vector-source-');
      if (!isAerial && !isVector) return;

      const rawId = isAerial
        ? sourceId.substring('aerial-source-'.length)
        : sourceId.substring('vector-source-'.length);

      if (!desiredIds.has(rawId)) {
        const layerId = isAerial ? `overlay-${rawId}` : `vector-layer-${rawId}`;
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
        mountedIdsRef.current.delete(rawId);
      }
    });

    // 2. Separate raster and vector maps for layered stacking (all vectors above all rasters)
    const rasterMaps = [];
    const vectorMaps = [];

    (maps || []).forEach((m) => {
      if (m.image_bounds_coords && Array.isArray(m.image_bounds_coords)) {
        rasterMaps.push(m);
      }
      if (m.vector_points && Array.isArray(m.vector_points)) {
        vectorMaps.push(m);
      }
    });

    // 3. Add or update Raster maps first (bottom layers)
    // We iterate in order, and move/add to top, so later items in the array end up on top.
    rasterMaps.forEach((mapDetails) => {
      const { id, opacity = 1, image_bounds_coords, raster_image } = mapDetails;
      const sourceId = `aerial-source-${id}`;
      const layerId = `overlay-${id}`;

      if (!map.current.getSource(sourceId)) {
        const coordinates = image_bounds_coords.map((coord) => coord.split(',').map(Number));
        map.current.addSource(sourceId, {
          type: 'image',
          url: raster_image,
          coordinates,
        });
        map.current.addLayer({
          id: layerId,
          source: sourceId,
          type: 'raster',
          paint: { 'raster-opacity': opacity },
        });
        mountedIdsRef.current.add(id);
      } else {
        // Update opacity
        if (map.current.getLayer(layerId)) {
          map.current.setPaintProperty(layerId, 'raster-opacity', opacity);
          // Move to top of current stack to maintain order relative to other rasters
          map.current.moveLayer(layerId);
        }
      }
    });

    // 4. Add or update Vector maps next (top layers)
    vectorMaps.forEach((mapDetails) => {
      const { id, opacity = 1, vector_points } = mapDetails;
      const sourceId = `vector-source-${id}`;
      const layerId = `vector-layer-${id}`;

      if (!map.current.getSource(sourceId)) {
        const geojson = {
          type: 'FeatureCollection',
          features: vector_points.map((point) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: point.coordinates.split(',').map(Number),
            },
            properties: {
              bearing: Number(point.bearing),
              image: point.image,
              caption: point.description,
              is_directional: point.is_directional,
            },
          })),
        };

        map.current.addSource(sourceId, { type: 'geojson', data: geojson });
        map.current.addLayer({
          id: layerId,
          type: 'symbol',
          source: sourceId,
          layout: {
            'icon-image': [
              'case',
              ['==', ['get', 'is_directional'], true],
              'arrow-icon-directional',
              'arrow-icon',
            ],
            'icon-size': 0.3,
            'icon-rotate': ['get', 'bearing'],
            'icon-allow-overlap': true,
            'icon-anchor': 'center',
          },
          paint: { 'icon-opacity': opacity },
        });

        // Attach popup once per layer
        map.current.on('click', layerId, (e) => {
          const { image, caption } = e.features[0].properties;
          const coords = e.features[0].geometry.coordinates;
          new maptilersdk.Popup({ maxWidth: '400px', closeButton: true })
            .setLngLat(coords)
            .setHTML(`
              <div style="text-align:center; width:100%;">
                <img
                  src="${image}"
                  alt="Marker"
                  style="width:100%; height:auto; border-radius:5px;"
                />
                <p style="margin-top:10px; font-size:14px; color:#333;">${caption}</p>
              </div>
            `)
            .addTo(map.current);
        });

        mountedIdsRef.current.add(id);
      } else {
        // Update opacity and move to top
        if (map.current.getLayer(layerId)) {
          map.current.setPaintProperty(layerId, 'icon-opacity', opacity);
          map.current.moveLayer(layerId);
        }
      }
    });
  };

  const jsonOverlay = JSON.stringify(
    {
      currentMapFocusLocation: [
        Number(liveCenter.lng.toFixed(6)),
        Number(liveCenter.lat.toFixed(6)),
      ],
      currentZoomLevel: Number(liveZoom.toFixed(2)),
      maps: (selectedMaps || []).map((m) => ({
        id: m.id,
        opacityVal: typeof m.opacity === 'number' ? Number(m.opacity.toFixed(2)) : 1,
      })),
    },
    null,
    2
  );

  const handleUnauthorize = () => {
    localStorage.removeItem('isAuthorized');
    window.location.reload();
  };

  const handleCopyJson = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(jsonOverlay);
      } else {
        const ta = document.createElement('textarea');
        ta.value = jsonOverlay;
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.left = '-1000px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus(''), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
      setCopyStatus('Copy failed');
      setTimeout(() => setCopyStatus(''), 1500);
    }
  };

  return (
    <div className={styles.mapWrap} style={{ position: 'relative' }}>
      {isAuthorized && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            maxWidth: 380,
            zIndex: 10,
            background: 'rgba(255,255,255,0.92)',
            border: '1px solid rgba(0,0,0,0.15)',
            borderRadius: 8,
            padding: '10px 12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 12,
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflow: 'auto',
            maxHeight: 260,
            cursor: 'text',
            userSelect: 'text',
          }}
          title="Click and copy"
        >
          {jsonOverlay}

          <div
            style={{
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={handleCopyJson}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                margin: 0,
                textDecoration: 'underline',
                color: '#1d4ed8',
                cursor: 'pointer',
                fontSize: 12,
              }}
              aria-label="Copy JSON to clipboard"
              title="Copy JSON to clipboard"
            >
              copy json
            </button>

            <button
              type="button"
              onClick={handleUnauthorize}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                margin: 0,
                textDecoration: 'underline',
                color: '#b91c1c',
                cursor: 'pointer',
                fontSize: 12,
              }}
              aria-label="Unauthorize this session"
              title="Remove authorization flag and refresh"
            >
              unauthorize
            </button>

            {copyStatus && (
              <span style={{ fontSize: 12, color: '#16a34a' }}>{copyStatus}</span>
            )}
          </div>
        </div>
      )}

      <div ref={mapContainer} className={styles.map} />
      
      {/* Loading Spinner Overlay - only for maps/plans selection, not narratives */}
      {isMapLoading && !selectedNarrative && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinnerContainer}>
            <div className={styles.spinner}></div>
            <div className={styles.loadingText}>Loading maps...</div>
          </div>
        </div>
      )}
    </div>
  );
}

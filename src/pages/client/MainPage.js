import * as maptilersdk from '@maptiler/sdk';
import React, { useEffect, useState, useRef } from 'react';
import { apiGet, resolveAssetUrl } from '../../api/client';
import Navbar from '../../components/Navbar';
import Controller from '../../components/Controller';
import Basemaps from '../../components/BaseMaps';
import Map from '../../components/Map';
import Modal from '../../components/Modal';
import styles from './style.module.css';

const PREVIEW_TOKEN_STORAGE_KEY = 'sitePreviewToken';

const MainPage = () => {
  const [siteAccess, setSiteAccess] = useState({ loading: true, allowed: true, preview: false });
  const [modalData, setModalData] = useState({ isOpen: false, title: '', content: '' });
  const [selectedMaps, setSelectedMaps] = useState([]);
  const [mapStyle, setMapStyle] = useState(maptilersdk.MapStyle.BASIC.LIGHT);
  const [selectedNarrative, setSelectedNarrative] = useState(null);
  const [activeChapter, setActiveChapter] = useState(null);
  const [isMapLoading, setIsMapLoading] = useState(false);

  // Function to update opacity (provided by <Map />)
  const [updateOpacityFn, setUpdateOpacityFn] = useState(() => () => {});
  // Function to fly to location (provided by <Map />)
  const [flyToLocationFn, setFlyToLocationFn] = useState(null);
  // Current map view state for minimap
  const [mapView, setMapView] = useState({ center: { lng: -122.4194, lat: 37.7749 }, zoom: 12 });
  // Track previous narrative to detect exit
  const prevNarrativeRef = useRef(null);
  const skipResetRef = useRef(false);

  // Gate the public site behind the "Make Site Live / Hide Site" sandbox
  // toggle in Settings. While hidden, only people who open the preview link
  // (or already unlocked it on this device) can see the site.
  useEffect(() => {
    const checkSiteAccess = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const previewParam = params.get('preview') || '';
        const storedToken = localStorage.getItem(PREVIEW_TOKEN_STORAGE_KEY) || '';
        const query = new URLSearchParams();
        if (previewParam) query.set('previewParam', previewParam);
        if (storedToken) query.set('storedToken', storedToken);
        const qs = query.toString();

        const data = await apiGet(`/api/settings/public${qs ? `?${qs}` : ''}`);
        const access = (data && data.access) || { allowed: true, preview: false };

        if (access.allowed && (previewParam || storedToken)) {
          localStorage.setItem(PREVIEW_TOKEN_STORAGE_KEY, previewParam || storedToken);
        }

        setSiteAccess({ loading: false, allowed: access.allowed, preview: access.preview });
      } catch (e) {
        console.error('Error checking site visibility:', e);
        // Fail open so a transient API hiccup doesn't take the live site down.
        setSiteAccess({ loading: false, allowed: true, preview: false });
      }
    };

    checkSiteAccess();
  }, []);

  const fetchContent = async (field) => {
    try {
      const data = await apiGet('/api/settings/public');
      if (data) {
        setModalData({
          isOpen: true,
          title: field.charAt(0).toUpperCase() + field.slice(1),
          content: data[field],
        });
      } else {
        console.log('No such document!');
      }
    } catch (e) {
      console.error('Error getting document:', e);
    }
  };

  const handleMapSelect = React.useCallback((maps) => {
    setSelectedMaps(maps || []);
  }, []);

  const handleOpacityChange = React.useCallback((mapId, opacity) => {
    if (updateOpacityFn) updateOpacityFn(mapId, opacity);
  }, [updateOpacityFn]);

  const handleNarrativeSelect = React.useCallback((narrative, options = {}) => {
    if (options.preserveState) {
      skipResetRef.current = true;
    }
    setSelectedNarrative(narrative);
  }, []);

  const handleActiveChapterChange = React.useCallback((chapterName) => {
    setActiveChapter(chapterName);
  }, []);

  const handleLinkClick = (field) => {
    if (field === 'share') {
      setModalData({
        isOpen: true,
        title: 'Share current view',
        content: `
          <p>Copy this link to share: <br />
          <input type="text" style="width: 100%;" value="${window.location.href}" readonly /></p>
          <p>Or share on social media:</p>
          <p>
          <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
            window.location.href
          )}" target="_blank">Facebook</a> | 
          <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(
            window.location.href
          )}" target="_blank">Twitter</a>
          </p>
        `,
      });
    } else {
      fetchContent(field);
    }
  };

  const handleInfoClick = (description, footnotes) => {
    setModalData({ isOpen: true, title: 'Map Information', content: description, footnotes: footnotes || '' });
  };

  const closeModal = () => {
    setModalData({ isOpen: false, title: '', content: '', footnotes: '' });
  };

  // When exiting a narrative, reset map to default location from settings
  useEffect(() => {
    // Only reset if we had a narrative before and now we don't (exiting narrative)
    const hadNarrative = prevNarrativeRef.current !== null;
    const hasNarrative = selectedNarrative !== null;
    
    if (hadNarrative && !hasNarrative && flyToLocationFn) {
      if (skipResetRef.current) {
        skipResetRef.current = false;
      } else {
        const resetToDefaultLocation = async () => {
        try {
          const data = await apiGet('/api/settings/public');
          if (data) {
            const { geolocation, mapZoom } = data;

            if (geolocation && Array.isArray(geolocation) && geolocation.length === 2) {
              const [lat, lng] = geolocation;
              const zoom = typeof mapZoom === 'number' ? mapZoom : 10;
              flyToLocationFn([lng, lat], zoom);
            }
          }
        } catch (e) {
          console.error('Error fetching settings for default location:', e);
        }
      };

        resetToDefaultLocation();
        setSelectedMaps([]);
        setActiveChapter(null);
      }
    } else if (hadNarrative && hasNarrative && prevNarrativeRef.current?.id !== selectedNarrative.id) {
      // Switching between narratives: clear state so first chapter initialization triggers
      setSelectedMaps([]);
      setActiveChapter(null);
    }
    
    // Update ref for next render
    prevNarrativeRef.current = selectedNarrative;
  }, [selectedNarrative, flyToLocationFn]);

  // Preload all images and map data for narrative chapters
  useEffect(() => {
    if (!selectedNarrative || !selectedNarrative.chapters) return;

    const preloadNarrativeContent = async () => {
      const chapters = selectedNarrative.chapters;
      const imageUrls = new Set();
      
      const decodeHtml = (str) => {
        if (!str) return '';
        return String(str)
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&');
      };

      Object.values(chapters).forEach(chapter => {
        const content = decodeHtml(chapter.content);
        const imgMatches = content.match(/<img[^>]+src="([^">]+)"/g);
        if (imgMatches) {
          imgMatches.forEach(match => {
            const src = match.match(/src="([^">]+)"/)[1];
            if (src) imageUrls.add(src);
          });
        }
        if (chapter.maps) {
          chapter.maps.forEach(map => {
            if (map.raster_image) imageUrls.add(map.raster_image);
          });
        }
      });

      imageUrls.forEach(url => {
        const img = new Image();
        img.src = url;
      });
    };

    preloadNarrativeContent();
  }, [selectedNarrative]);

  if (siteAccess.loading) {
    return <div className={styles.App} />;
  }

  if (!siteAccess.allowed) {
    return (
      <div
        className={styles.App}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          textAlign: 'center',
          padding: '24px',
        }}
      >
        <div>
          <h1>This site isn't available yet</h1>
          <p>Please check back later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.App}>
      {siteAccess.preview && (
        <div
          style={{
            background: '#b91c1c',
            color: '#fff',
            textAlign: 'center',
            padding: '6px 12px',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          Preview mode — this site is hidden from the public
        </div>
      )}
      <div className={styles.header}>
        <Navbar onLinkClick={handleLinkClick} />
      </div>

      <div className={styles.content}>
        <div className={styles.mapView}>
          <Map
            selectedMaps={selectedMaps}
            mapStyle={mapStyle}
            selectedNarrative={selectedNarrative}
            activeChapter={activeChapter}
            onUpdateOpacity={setUpdateOpacityFn}
            onFlyToLocation={setFlyToLocationFn}
            onMapViewChange={setMapView}
            isMapLoading={isMapLoading}
          />
        </div>
        
        <div className={styles.mapController}>
          <Controller
            onMapSelect={handleMapSelect}
            onNarrativeSelect={handleNarrativeSelect}
            onInfoClick={handleInfoClick}
            onActiveChapterChange={handleActiveChapterChange}
            activeChapter={activeChapter}
            onUpdateOpacity={handleOpacityChange}
            flyToLocation={flyToLocationFn}
            mapView={mapView}
            mapStyle={mapStyle}
          />
        </div>
      </div>

      <div className={styles.basemaps}>
        <Basemaps onStyleChange={setMapStyle} selectedNarrative={selectedNarrative} />
      </div>

      <Modal
        isOpen={modalData.isOpen}
        onClose={closeModal}
        title={modalData.title}
        content={modalData.content}
        footnotes={modalData.footnotes}
        type={modalData.title === 'Share current view' ? 'share' : 'default'}
      />
    </div>
  );
};

export default MainPage;

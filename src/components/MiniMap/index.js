import React, { useRef, useEffect } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import styles from './style.module.css';

maptilersdk.config.apiKey = 'llr35dKpffrGaP9ECLL8';

export default function MiniMap({ center, mapStyle, fixedZoom = 9 }) {
  const mapContainer = useRef(null);
  const map = useRef(null);

  // 1. Initialize Map once
  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maptilersdk.Map({
      container: mapContainer.current,
      style: mapStyle || maptilersdk.MapStyle.BASIC.LIGHT,
      center: center ? [center.lng, center.lat] : [-122.4194, 37.7749],
      zoom: fixedZoom,
      interactive: false,
      attributionControl: false,
      navigationControl: false,
    });

    // High-contrast silhouette styling (Maximum Contrast: White Land / Gray Sea)
    map.current.on('style.load', () => {
      const layers = map.current.getStyle().layers;
      if (layers) {
        layers.forEach((layer) => {
          const isWater = layer.id.includes('water') || layer.source === 'water' || (layer.type === 'fill' && layer.id.includes('water'));
          
          if (isWater) {
            // Unified Water (Deeper Gray)
            if (layer.type === 'fill') {
              map.current.setPaintProperty(layer.id, 'fill-color', '#888888');
            }
            map.current.setLayoutProperty(layer.id, 'visibility', 'visible');
          } else if (layer.type === 'fill' || layer.type === 'background' || layer.id === 'background') {
            // Unified Land (Pure White)
            if (layer.type === 'fill') {
              map.current.setPaintProperty(layer.id, 'fill-color', '#ffffff');
            } else if (layer.type === 'background' || layer.id === 'background') {
              map.current.setPaintProperty(layer.id, 'background-color', '#888888'); // Background acts as the base sea
            }
            map.current.setLayoutProperty(layer.id, 'visibility', 'visible');
          } else {
            // Hide labels, icons, symbols, roads, etc.
            map.current.setLayoutProperty(layer.id, 'visibility', 'none');
          }
        });
      }

      // Hide all maplibregl controls for a cleaner look
      const container = map.current.getContainer();
      const controls = container.querySelectorAll('.maplibregl-ctrl');
      controls.forEach(ctrl => {
        ctrl.style.display = 'none';
      });
    });

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapStyle]); // Re-init only if mapStyle changes fundamentally

  // 3. Update center smoothly
  useEffect(() => {
    if (!map.current || !center) return;
    
    if (map.current.isStyleLoaded()) {
      map.current.setCenter([center.lng, center.lat]);
      map.current.setZoom(fixedZoom);
    } else {
      map.current.once('style.load', () => {
        map.current.setCenter([center.lng, center.lat]);
        map.current.setZoom(fixedZoom);
      });
    }
  }, [center, fixedZoom]);

  return <div ref={mapContainer} className={styles.miniMap} />;
}

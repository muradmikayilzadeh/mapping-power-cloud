import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, doc, getDocs, getDoc } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfo, faMap } from '@fortawesome/free-solid-svg-icons';
import { db } from '../../firebase';
import styles from './style.module.css';
import MiniMap from '../MiniMap';
import * as maptilersdk from '@maptiler/sdk';

function Controller({
  onMapSelect,
  onInfoClick,
  onNarrativeSelect,
  flyToLocation,
  onActiveChapterChange,
  activeChapter,
  onUpdateOpacity,
  mapView,
  mapStyle,
}) {
  const [chapters, setChapters] = useState([]);
  const [checkedMaps, setCheckedMaps] = useState({});
  const [selectedMapsOrder, setSelectedMapsOrder] = useState([]); // Track selection order
  const [sliderValues, setSliderValues] = useState({});
  const [view, setView] = useState('maps');
  const [narratives, setNarratives] = useState([]);
  const [selectedNarrative, setSelectedNarrative] = useState(null);
  const checkboxModifierStateRef = useRef({}); // Track modifier key state per checkbox

  // Footnote modal state
  const [footnoteOpen, setFootnoteOpen] = useState(false);
  const [footnoteHtml, setFootnoteHtml] = useState('');
  const footnoteStoreRef = useRef({});     // { fn-id: modalHTML }
  const footnoteCounterRef = useRef(0);    // global counter for unique ids per narrative render

  const narrativeRef = useRef(null);

  // Memoized lookup for all available maps (id -> MapObject)
  const allMapsLookup = useMemo(() => {
    const lookup = {};
    chapters.forEach(chapter => {
      (chapter.maps || []).forEach(m => {
        if (m && m.id) lookup[m.id] = m;
      });
    });
    return lookup;
  }, [chapters]);

  // Sync narrative maps to sidebar selections when switching to 'maps' view
  const syncNarrativeToMaps = () => {
    if (selectedNarrative && activeChapter) {
      const chapter = (selectedNarrative.chapters || {})[activeChapter];
      if (chapter && chapter.maps) {
        const newCheckedMaps = {};
        const newSliderValues = {};
        const newSelectedOrder = [];
        const newSelectedMaps = [];

        chapter.maps.forEach(m => {
          const id = typeof m === 'string' ? m : m.id;
          const fullMap = allMapsLookup[id];
          if (fullMap) {
            newCheckedMaps[id] = true;
            newSliderValues[id] = (m.opacityVal !== undefined ? m.opacityVal : (m.opacity !== undefined ? m.opacity : 1));
            newSelectedOrder.push(id);
            newSelectedMaps.push({ ...fullMap, opacity: newSliderValues[id] });
          }
        });

        // Batch update state
        setCheckedMaps(newCheckedMaps);
        setSliderValues(newSliderValues);
        setSelectedMapsOrder(newSelectedOrder);
        onMapSelect(newSelectedMaps);
      }
    }
  };

  // Continuous sync: Mirror narrative state to sidebar whenever chapter changes
  useEffect(() => {
    if (selectedNarrative && activeChapter !== null) {
      syncNarrativeToMaps();
    }
  }, [activeChapter, selectedNarrative, allMapsLookup]);

  const handleFlyToLocation = (mapDetails) => {
    if (!flyToLocation || !mapDetails) return;

    // Prefer using the full image bounds so the zoom level always matches
    // the extents shown in the entry preview.
    if (
      mapDetails.image_bounds_coords &&
      Array.isArray(mapDetails.image_bounds_coords) &&
      mapDetails.image_bounds_coords.length === 4
    ) {
      const numericBounds = mapDetails.image_bounds_coords.map((coord) =>
        coord.split(',').map(Number)
      );

      // Compute overall bounding box (sw / ne) from the four corner points.
      const lngs = numericBounds.map(([lng]) => lng);
      const lats = numericBounds.map(([, lat]) => lat);

      const sw = [Math.min(...lngs), Math.min(...lats)];
      const ne = [Math.max(...lngs), Math.max(...lats)];

      // Use the geometric center as the nominal center; Map component
      // will apply asymmetric padding so the visible center is shifted
      // slightly to the right of the frame (to account for the left bar).
      const center = [
        (sw[0] + ne[0]) / 2,
        (sw[1] + ne[1]) / 2,
      ];

      flyToLocation(center, {
        bounds: [sw, ne],
      });
      return;
    }

    // Vector maps with explicit focus bounds (e.g. copied from a parent map):
    // frame to those bounds rather than tightly fitting the pins.
    if (
      mapDetails.focus_bounds &&
      Array.isArray(mapDetails.focus_bounds) &&
      mapDetails.focus_bounds.length === 4
    ) {
      const numericBounds = mapDetails.focus_bounds.map((coord) =>
        coord.split(',').map(Number)
      );
      const lngs = numericBounds.map(([lng]) => lng);
      const lats = numericBounds.map(([, lat]) => lat);

      if (lngs.every((n) => !Number.isNaN(n)) && lats.every((n) => !Number.isNaN(n))) {
        const sw = [Math.min(...lngs), Math.min(...lats)];
        const ne = [Math.max(...lngs), Math.max(...lats)];
        const center = [(sw[0] + ne[0]) / 2, (sw[1] + ne[1]) / 2];
        flyToLocation(center, { bounds: [sw, ne] });
        return;
      }
    }

    // Vector maps: derive bounds/center from the point coordinates so the
    // marker button behaves the same as it does for raster maps.
    if (
      mapDetails.vector_points &&
      Array.isArray(mapDetails.vector_points) &&
      mapDetails.vector_points.length > 0
    ) {
      const points = mapDetails.vector_points
        .map((p) => (p && typeof p.coordinates === 'string'
          ? p.coordinates.split(',').map(Number)
          : null))
        .filter((c) => c && c.length === 2 && !Number.isNaN(c[0]) && !Number.isNaN(c[1]));

      if (points.length === 1) {
        // Single point: just center on it at a close zoom.
        flyToLocation(points[0], 16);
        return;
      }

      if (points.length > 1) {
        const lngs = points.map(([lng]) => lng);
        const lats = points.map(([, lat]) => lat);

        const sw = [Math.min(...lngs), Math.min(...lats)];
        const ne = [Math.max(...lngs), Math.max(...lats)];

        // Degenerate bounds (all points identical) -> treat as a single point.
        if (sw[0] === ne[0] && sw[1] === ne[1]) {
          flyToLocation(sw, 16);
          return;
        }

        const center = [(sw[0] + ne[0]) / 2, (sw[1] + ne[1]) / 2];
        flyToLocation(center, { bounds: [sw, ne] });
        return;
      }
    }

    // Fallback: use explicit center if we have one.
    if (mapDetails.center && Array.isArray(mapDetails.center) && mapDetails.center.length === 2) {
      flyToLocation(mapDetails.center);
      return;
    }

    console.error("No 'center' property or bounding coords found for this map. Cannot fly.");
  };

  useEffect(() => {
    const fetchChaptersAndNarratives = async () => {
      try {
        const erasSnap = await getDocs(collection(db, 'eras'));
        const allEras = erasSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.order - b.order);
        const eras = allEras.filter((e) =>
          Object.prototype.hasOwnProperty.call(e, 'public') ? !!e.public : true
        );

        const mapsCol = collection(db, 'maps');
        const groupsCol = collection(db, 'map_groups');

        const fetchDetails = async (id, colRef) => {
          const snap = await getDoc(doc(colRef, id));
          return snap.exists() ? { id: snap.id, ...snap.data() } : null;
        };

        const isPublic = (m) =>
          Object.prototype.hasOwnProperty.call(m, 'public') ? !!m.public : true;

        const chaptersData = await Promise.all(
          eras.map(async (era) => {
            const maps = await Promise.all((era.maps || []).map((mid) => fetchDetails(mid, mapsCol)));
            const mapGroups = await Promise.all(
              (era.map_groups || []).map((gid) => fetchDetails(gid, groupsCol))
            );
            return {
              title: era.title,
              date: era.years,
              description: era.description,
              // include only maps that are public (default true if field missing)
              maps: maps.filter(Boolean).filter(isPublic),
              mapGroups: mapGroups.filter(Boolean).filter(isPublic),
              indented: era.indented || [],
            };
          })
        );
        setChapters(chaptersData);

        const narrativeSnap = await getDocs(collection(db, 'narratives'));
        const narrativesData = narrativeSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Filter to only show public narratives (default to true if field missing)
        const publicNarratives = narrativesData.filter((n) =>
          Object.prototype.hasOwnProperty.call(n, 'public') ? !!n.public : true
        );
        // Sort by order field (default to 0 if not set), then by title
        publicNarratives.sort((a, b) => {
          const orderA = typeof a.order === 'number' ? a.order : 0;
          const orderB = typeof b.order === 'number' ? b.order : 0;
          if (orderA !== orderB) return orderA - orderB;
          return (a.title || '').localeCompare(b.title || '');
        });
        setNarratives(publicNarratives);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };
    fetchChaptersAndNarratives();
  }, []);

/*
  // Reset selection when switching to narratives view or when narrative is selected
  useEffect(() => {
    if (view === 'narratives' && selectedNarrative) {
      // When viewing a narrative, maps are managed by the narrative chapters
      // Clear manual selections to avoid confusion
      setCheckedMaps({});
      setSelectedMapsOrder([]);
    }
  }, [view, selectedNarrative]);
*/

  const handleCheckboxChange = async (mapId, checked) => {
    try {
      const snap = await getDoc(doc(db, 'maps', mapId));
      if (!snap.exists()) {
        console.log(`No map document found with ID: ${mapId}`);
        return;
      }
      const mapDetails = { id: mapId, ...snap.data() };

      // Check if modifier key was pressed during the click (Command on Mac, Control on PC)
      const isModifierPressed = checkboxModifierStateRef.current[mapId] || false;
      // Clear the stored state after use
      delete checkboxModifierStateRef.current[mapId];
      
      setCheckedMaps((prev) => {
        let next = { ...prev };
        let newOrder = [...selectedMapsOrder];

        if (checked) {
          // Adding a map
          if (isModifierPressed) {
            // Modifier pressed: single selection mode - clear all others
            next = { [mapId]: mapDetails };
            newOrder = [mapId];
          } else {
            // No modifier: multi-select mode - add to selection
            next[mapId] = mapDetails;
            // Only add to order if not already in the list
            if (!newOrder.includes(mapId)) {
              newOrder.push(mapId);
            }
          }
        } else {
          // Removing a map
          next[mapId] = null;
          newOrder = newOrder.filter(id => id !== mapId);
        }

        // Build selected array in order
        const selected = newOrder
          .map(id => next[id])
          .filter(Boolean)
          .map((m) => ({ ...m, opacity: (sliderValues[m.id] ?? 100) / 100 }));
        
        setSelectedMapsOrder(newOrder);
        onMapSelect(selected);
        return next;
      });
    } catch (err) {
      console.error('Error fetching map details:', err);
    }
  };

  // Bulk select/deselect helpers (used by "Select all / Deselect all" controls).
  const applySelection = (nextChecked, nextOrder) => {
    const selected = nextOrder
      .map((id) => nextChecked[id])
      .filter(Boolean)
      .map((m) => ({ ...m, opacity: (sliderValues[m.id] ?? 100) / 100 }));

    setCheckedMaps(nextChecked);
    setSelectedMapsOrder(nextOrder);
    onMapSelect(selected);
  };

  const selectMaps = (maps) => {
    const next = { ...checkedMaps };
    const order = [...selectedMapsOrder];
    (maps || []).forEach((m) => {
      if (!m || !m.id) return;
      next[m.id] = m;
      if (!order.includes(m.id)) order.push(m.id);
    });
    applySelection(next, order);
  };

  const deselectMaps = (maps) => {
    const ids = new Set((maps || []).filter(Boolean).map((m) => m.id));
    const next = { ...checkedMaps };
    ids.forEach((id) => {
      next[id] = null;
    });
    const order = selectedMapsOrder.filter((id) => !ids.has(id));
    applySelection(next, order);
  };

  const allMaps = useMemo(
    () => chapters.flatMap((c) => c.maps || []),
    [chapters]
  );

  const areAllSelected = (maps) =>
    (maps || []).length > 0 && (maps || []).every((m) => !!checkedMaps[m.id]);

  const toggleSelectAll = (maps) => {
    if (areAllSelected(maps)) {
      deselectMaps(maps);
    } else {
      selectMaps(maps);
    }
  };

  const handleSliderChange = (mapId, value) => {
    const pct = value / 100;
    setSliderValues((prev) => ({ ...prev, [mapId]: value }));

    setCheckedMaps((prev) => {
      const next = { ...prev };
      if (next[mapId]) next[mapId].opacity = pct;

      if (onUpdateOpacity) onUpdateOpacity(mapId, pct);

      // Build selected array in order
      const selected = selectedMapsOrder
        .map(id => next[id])
        .filter(Boolean)
        .map((m) => {
          const sliderPct = m.id === mapId ? pct : (sliderValues[m.id] ?? 100) / 100;
          return { ...m, opacity: typeof m.opacity === 'number' ? m.opacity : sliderPct };
        });

      onMapSelect(selected);
      return next;
    });
  };

  const handleInfoClick = (desc) => onInfoClick(desc);
  const handleNarrativeSelect = (narr) => {
    console.log('=== NARRATIVE SELECTED ===');
    console.log('Full Narrative JSON:', JSON.stringify(narr, null, 2));
    console.log('Narrative Object:', narr);
    setSelectedNarrative(narr);
    onNarrativeSelect(narr);
  };

  // ---------- Footnote helpers (handle escaped or literal HTML) ----------
  const decodeHtml = (str) =>
    String(str)
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

  const escapeHtml = (str) =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  /**
   * Transform <footnote><text>..</text><content>..</content></footnote>
   * into a clickable span and stash the modal HTML.
   * Works even if the chapter string is HTML-escaped.
   *
   * IMPORTANT: This function DOES NOT mutate refs. The caller (useMemo) resets
   * footnoteStoreRef and counter and then invokes this per chapter so the store
   * is always in-sync with the rendered HTML.
   */
  const transformFootnotes = (html, chapterId, allocateId) => {
    if (!html) return '';

    // 1) decode once so tags become real if they were escaped
    const dec = decodeHtml(html);

    // 2) replace footnotes
    const footnoteRe = /<footnote\b[^>]*>([\s\S]*?)<\/footnote\s*>/gi;

    return dec.replace(footnoteRe, (_full, inner) => {
      const textMatch = /<text\b[^>]*>([\s\S]*?)<\/text\s*>/i.exec(inner);
      const contentMatch = /<content\b[^>]*>([\s\S]*?)<\/content\s*>/i.exec(inner);

      const displayTextRaw = textMatch ? textMatch[1] : '';
      const displayText = escapeHtml(displayTextRaw.replace(/<[^>]*>/g, '')); // text-only

      const modalHtml = contentMatch ? contentMatch[1] : '';

      const id = allocateId(chapterId); // get a stable id for this span
      // caller will store modalHtml into footnoteStoreRef.current[id]

      return `<span class="footnote-inline" data-fn="${id}" role="button" tabindex="0" style="cursor:pointer;text-decoration:underline;">${displayText}</span>`;
    });
  };

  // Build processed chapters AND the footnote store together so IDs always match
  const processedChapters = useMemo(() => {
    if (!selectedNarrative || !selectedNarrative.chapters) return [];

    // reset store + counter each time we rebuild processed HTML
    const store = {};
    footnoteStoreRef.current = store;
    footnoteCounterRef.current = 0;

    const allocateId = (chapterId) => {
      const id = `fn-${chapterId}-${footnoteCounterRef.current++}`;
      return id;
    };

    // Convert to array and sort by order field to maintain sequence
    const chaptersEntries = Object.entries(selectedNarrative.chapters);
    chaptersEntries.sort((a, b) => {
      const orderA = a[1].order !== undefined ? a[1].order : 0;
      const orderB = b[1].order !== undefined ? b[1].order : 0;
      return orderA - orderB;
    });

    // We need a second pass to collect modal HTMLs in same order we replace.
    const chaptersArr = chaptersEntries.map(([cid, chap]) => {
      // We'll use a temporary array to capture modal htmls in order of appearance
      const modalHtmls = [];

      // A wrapper around transformFootnotes that also pushes modal content to modalHtmls + store
      const replaced = transformFootnotes(chap?.content || '', cid, (chapterId) => {
        const id = allocateId(chapterId);
        // push a placeholder; we don't have modalHtml here yet (need to parse inner each time)
        modalHtmls.push({ id });
        return id;
      });

      // Now, walk through the original (decoded) content again to extract <content> in order
      // so we can assign to the IDs we generated above.
      const dec = decodeHtml(chap?.content || '');
      const iterator = dec.matchAll(/<footnote\b[^>]*>([\s\S]*?)<\/footnote\s*>/gi);
      let idx = 0;
      for (const m of iterator) {
        const inner = m[1] || '';
        const contentMatch = /<content\b[^>]*>([\s\S]*?)<\/content\s*>/i.exec(inner);
        const html = contentMatch ? contentMatch[1] : '';
        if (modalHtmls[idx]) {
          store[modalHtmls[idx].id] = html;
        }
        idx++;
      }

      return { cid, html: replaced };
    });

    return chaptersArr;
  }, [selectedNarrative]);

  // Reset modal when switching narratives
  useEffect(() => {
    setFootnoteOpen(false);
    setFootnoteHtml('');
  }, [selectedNarrative]);

  // Active chapter tracking via IntersectionObserver
  useEffect(() => {
    if (!selectedNarrative || !narrativeRef.current) return;
    
    const sections = narrativeRef.current.querySelectorAll('section');
    if (sections.length === 0) return;

    // Local variable to track what we've already notified the parent about
    let currentActiveId = activeChapter;

    const obs = new IntersectionObserver(
      (entries) => {
        // To handle chapters taller than the viewport, we look for the one
        // that occupies the most vertical space in the visible area.
        let bestEntry = null;
        let maxVisibleHeight = 0;

        // The observer trigger might give us multiple entries; we check all
        // observed sections to see which is most prominent.
        sections.forEach((sec) => {
          // Note: entries only contains things that changed, but for safety
          // we can rely on the entries provided or a more global check.
          // However, IntersectionObserverEntry has intersectionRect which is perfect.
        });

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const visibleHeight = entry.intersectionRect.height;
            if (visibleHeight > maxVisibleHeight) {
              maxVisibleHeight = visibleHeight;
              bestEntry = entry;
            }
          }
        });

        // Only switch if the "best" entry is sufficiently visible or dominant
        if (bestEntry) {
          const chapterId = bestEntry.target.id;
          if (chapterId !== currentActiveId) {
            currentActiveId = chapterId;
            console.log(`=== CHAPTER ACTIVATED (DOMINANT AREA) === ${chapterId}`);
            onActiveChapterChange(chapterId);
          }
        }
      },
      { 
        root: narrativeRef.current, 
        // Monitor many points to ensure we catch transitions accurately
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
        rootMargin: '-10% 0px -10% 0px' // Focus on the middle 80% of the viewport
      }
    );

    sections.forEach((sec) => obs.observe(sec));

    return () => {
      obs.disconnect();
    };
  }, [selectedNarrative, onActiveChapterChange, activeChapter]);

  // Footnote click + keyboard (event delegation)
  const onNarrativeClick = (e) => {
    const el = e.target.closest && e.target.closest('.footnote-inline');
    if (!el) return;
    if (narrativeRef.current && !narrativeRef.current.contains(el)) return;

    const id = el.getAttribute('data-fn');
    const html = (id && footnoteStoreRef.current[id]) || '';
    setFootnoteHtml(html);
    setFootnoteOpen(true);
  };

  const onNarrativeKeyDown = (e) => {
    const el = e.target.closest && e.target.closest('.footnote-inline');
    if (!el) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const id = el.getAttribute('data-fn');
      const html = (id && footnoteStoreRef.current[id]) || '';
      setFootnoteHtml(html);
      setFootnoteOpen(true);
    }
  };

  return (
    <div className={styles.controller}>
      <div className={styles.headings}>
        <div 
          className={view === 'maps' ? styles.active : ''} 
          onClick={() => {
            if (view !== 'maps') {
              syncNarrativeToMaps();
              setView('maps');
              // Tell main experience to exit narrative mode but preserve the current synced state (maps and extent)
              if (selectedNarrative) {
                onNarrativeSelect(null, { preserveState: true });
              }
            }
          }}
        >
          <span>maps and plans</span>
        </div>
        <div
          className={view === 'narratives' ? styles.active : ''}
          onClick={() => {
            setView('narratives');
            // Returning to ToC by clearing selected narrative
            setSelectedNarrative(null);
            onNarrativeSelect(null);
          }}
        >
          <span>narratives</span>
        </div>
      </div>

      <div className={styles.sectionInfo}>
        <div className={styles.textArea}>
          {view === 'maps' ? (
            <p>
              Historical maps and plans are organized chronologically. Use the slider bars to
              compare different plans. Many maps are accompanied by pin layers that contain
              ground-level views of how the city looked, or might have looked.
            </p>
          ) : !selectedNarrative ? (
            <p>
              The narratives explore various historical facets of San Francisco. Select a title 
              below to read more.
            </p>
          ) : (
            <p>
              Reading: <strong>{selectedNarrative.title}</strong>
            </p>
          )}
        </div>
        <div className={styles.miniMap}>
          {mapView ? (
            <MiniMap
              center={mapView.center}
              mapStyle={maptilersdk.MapStyle.BASIC.LIGHT}
              fixedZoom={9}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#999' }}>Loading position...</span>
            </div>
          )}
        </div>
      </div>

      {view === 'maps' && (
        <div className={styles.sectionContent}>
          {allMaps.length > 0 && (
            <div className={styles.selectAllBar}>
              <span className={styles.selectAllBarLabel}>All maps</span>
              <button
                type="button"
                className={styles.selectAllBtn}
                onClick={() => toggleSelectAll(allMaps)}
              >
                {areAllSelected(allMaps) ? 'Deselect all' : 'Select all'}
              </button>
            </div>
          )}
          <div className={styles.chapterList}>
            {chapters.map((chapter, ci) => (
              <div className={styles.chapter} key={ci}>
                <div className={styles.chapterDetails}>
                  <div className={`${styles.chapterDate} ${styles.grayText}`}>{chapter.date}</div>
                  <div className={styles.chapterTitleRow}>
                    <div className={`${styles.chapterTitle} ${styles.leftPaddingMD}`}>
                      {chapter.title}
                    </div>
                    {(chapter.maps || []).length > 0 && (
                      <button
                        type="button"
                        className={styles.selectAllBtn}
                        onClick={() => toggleSelectAll(chapter.maps)}
                      >
                        {areAllSelected(chapter.maps) ? 'Deselect all' : 'Select all'}
                      </button>
                    )}
                  </div>
                  <div
                    className={`${styles.chapterDescription} ${styles.grayTextItalic}`}
                    dangerouslySetInnerHTML={{ __html: chapter.description }}
                  />
                </div>
                <div className={styles.chapterMaps}>
                  <div className={styles.mapList}>
                    {(chapter.maps || []).map((map, mi) => {
                      const checked = !!checkedMaps[map.id];
                      const fillPct = sliderValues[map.id] ?? 100;

                      return (
                        <div className={styles.map} key={mi}>
                          <div className={styles.mapDetails}>
                            <input
                              type="checkbox"
                              className={`
                                ${styles.checkBox}
                                ${chapter.indented?.includes(map.id) ? styles.indentedText : ''}
                                ${checked ? styles.redCheckBox : ''}
                              `}
                              onClick={(e) => {
                                // Store modifier key state for this checkbox
                                checkboxModifierStateRef.current[map.id] = e.metaKey || e.ctrlKey;
                              }}
                              onChange={(e) => handleCheckboxChange(map.id, e.target.checked)}
                              checked={checked}
                            />
                            <span
                              className={`${styles.leftPaddingMD} ${
                                checked ? styles.redText : styles.grayText
                              }`}
                            >
                              {map.date}
                            </span>
                            <span
                              className={`${styles.mapDetailTitle} ${styles.leftPaddingMD} ${
                                checked ? styles.redText : ''
                              }`}
                            >
                              {map.title}
                            </span>
                          </div>

                          <div className={styles.mapControls}>
                            {map.map_type !== 'vector' && (
                              <input
                                type="range"
                                id={`slider-${map.id}`}
                                className={styles.slider}
                                min="0"
                                max="100"
                                value={fillPct}
                                onChange={(e) =>
                                  handleSliderChange(map.id, parseInt(e.target.value, 10))
                                }
                                disabled={!checked}
                                style={{ '--fill': `${fillPct}%` }}
                              />
                            )}
                            <i
                              className={styles.mapInfo}
                              onClick={() => handleInfoClick(map.description)}
                            >
                              <FontAwesomeIcon icon={faInfo} />
                            </i>
                            <i className={styles.mapMarker} onClick={() => handleFlyToLocation(map)}>
                              <FontAwesomeIcon icon={faMap} />
                            </i>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'narratives' && !selectedNarrative && (
        <div className={`${styles.sectionContent} ${styles.narrativeContent}`}>
          <div className={styles.tocContainer}>
            <h2 className={styles.tocHeading}>Table of Contents</h2>
            <ul className={styles.narrativeList}>
              {narratives.map((narr) => (
                <li
                  key={narr.id}
                  className={styles.narrativeItem}
                  onClick={() => handleNarrativeSelect(narr)}
                >
                  <div className={styles.narrativeTitle}>{narr.title}</div>
                  <div
                    className={styles.narrativeDescription}
                    dangerouslySetInnerHTML={{ __html: narr.description }}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {view === 'narratives' && selectedNarrative && (
        <div
          className={`${styles.sectionContent} ${styles.narrativeContent}`}
          ref={narrativeRef}
          onClick={onNarrativeClick}
          onKeyDown={onNarrativeKeyDown}
        >
          {selectedNarrative.chapters ? (
            processedChapters.map(({ cid, html }) => (
              <section key={cid} id={cid} className={styles.chapterSection}>
                <p dangerouslySetInnerHTML={{ __html: html }} />
              </section>
            ))
          ) : (
            <p>No chapters available for this narrative.</p>
          )}
        </div>
      )}

      {/* Footnote Modal */}
      {footnoteOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setFootnoteOpen(false)}
        >
          <div
            style={{
              background: '#fff',
              padding: '16px 20px',
              maxWidth: 720,
              width: '90%',
              borderRadius: 8,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div dangerouslySetInnerHTML={{ __html: footnoteHtml }} style={{ lineHeight: 1.6 }} />
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button onClick={() => setFootnoteOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Controller;

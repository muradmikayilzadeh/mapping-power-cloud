// Validates "lng,lat" coordinate strings used throughout the map/pin forms.
// Catches the two mistakes that silently produce an invisible map or a pin
// that can't be found: values outside valid ranges, and latitude/longitude
// pasted in the wrong order (e.g. copied straight out of Google Maps, which
// shows "lat, lng" while this app expects "lng, lat").

const EARTH_RADIUS_KM = 6371;

export function parseCoordPair(str) {
  if (typeof str !== 'string' || str.trim() === '') {
    return { ok: false, reason: 'empty' };
  }
  const parts = str.split(',').map((p) => p.trim());
  if (parts.length !== 2) {
    return { ok: false, reason: 'format', message: 'Expected "longitude,latitude"' };
  }
  const [lng, lat] = parts.map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return { ok: false, reason: 'format', message: 'Coordinates must be numbers' };
  }

  const lngOutOfRange = Math.abs(lng) > 180;
  const latOutOfRange = Math.abs(lat) > 90;

  if (lngOutOfRange || latOutOfRange) {
    // Longitude can validly exceed 90° in magnitude but latitude never can,
    // so a latitude-range violation paired with an in-range "longitude" is
    // the signature of a lat/lng swap (e.g. pasting Google Maps' "lat, lng").
    if (latOutOfRange && Math.abs(lng) <= 90) {
      return {
        ok: false,
        reason: 'swapped',
        message: `These look reversed — try "${lat},${lng}" instead (this field expects longitude,latitude, but Google Maps shows latitude,longitude).`,
      };
    }
    return {
      ok: false,
      reason: 'range',
      message: 'Longitude must be between -180 and 180, and latitude between -90 and 90.',
    };
  }

  return { ok: true, lng, lat };
}

function haversineDistanceKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Validates a list of "lng,lat" strings (e.g. the 4 image bounds corners, or
// a set of pin coordinates). `homeLocation`, if given as { lng, lat }, is
// used as a soft sanity check — coordinates valid but very far from it get a
// gentler warning rather than a hard error.
export function validateCoordPairs(pairs, homeLocation) {
  const errors = [];
  const warnings = [];

  pairs.forEach(({ label, value }) => {
    if (!value || !value.trim()) return; // blank is fine — just not filled in yet
    const result = parseCoordPair(value);
    if (!result.ok) {
      errors.push(`${label}: ${result.message || 'not valid coordinates'}`);
      return;
    }
    if (homeLocation && Number.isFinite(homeLocation.lng) && Number.isFinite(homeLocation.lat)) {
      const distanceKm = haversineDistanceKm(homeLocation, result);
      if (distanceKm > 1000) {
        warnings.push(
          `${label}: this point is about ${Math.round(distanceKm).toLocaleString()} km from your site's default location — double check it's correct.`
        );
      }
    }
  });

  return { errors, warnings, hasIssues: errors.length > 0 || warnings.length > 0 };
}

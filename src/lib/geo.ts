/**
 * Local tangent-plane projection.
 *
 * Twin scenes span tens to a few hundred metres, so a full map projection is
 * unnecessary. An equirectangular approximation around the site origin is
 * accurate to well under a centimetre at these distances and costs two
 * multiplications, which matters when it runs per sensor per frame.
 */

/** WGS-84 mean radius, metres. */
const EARTH_RADIUS_M = 6_371_008.8;

const DEG_TO_RAD = Math.PI / 180;

export interface GeoPoint {
  lat: number;
  lon: number;
  alt?: number;
}

/** Offsets in metres from the origin: +east, +north. */
export interface LocalOffset {
  east: number;
  north: number;
}

export function geoToLocalMeters(origin: GeoPoint, point: GeoPoint): LocalOffset {
  const latRad = origin.lat * DEG_TO_RAD;
  const dLat = (point.lat - origin.lat) * DEG_TO_RAD;
  const dLon = (point.lon - origin.lon) * DEG_TO_RAD;

  return {
    // A degree of longitude shrinks with the cosine of latitude; ignoring that
    // would stretch a site near the poles east-west.
    east: dLon * Math.cos(latRad) * EARTH_RADIUS_M,
    north: dLat * EARTH_RADIUS_M,
  };
}

/**
 * Project a geographic point into scene coordinates.
 *
 * Three.js is Y-up and right-handed, and the twin meshes are authored with +X
 * east and +Z south. North therefore maps to −Z.
 *
 * `headingDeg` rotates the scene so the mesh's own axes line up with true
 * north, which is what lets a photogrammetry scan captured at any orientation
 * still place sensors correctly.
 */
export function geoToScene(
  origin: GeoPoint,
  point: GeoPoint,
  headingDeg = 0
): [number, number, number] {
  const { east, north } = geoToLocalMeters(origin, point);

  const heading = headingDeg * DEG_TO_RAD;
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);

  const x = east * cos - north * sin;
  const z = east * sin + north * cos;

  return [x, (point.alt ?? 0) - (origin.alt ?? 0), -z];
}

/** Great-circle distance in metres. Used for "nearest balise" readouts. */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const { east, north } = geoToLocalMeters(a, b);
  return Math.hypot(east, north);
}

/**
 * Deterministic pseudo-random in [0, 1) from integer coordinates.
 *
 * Used for procedural terrain so a resort without an uploaded twin still gets
 * a stable landscape — the same site renders identically on every device and
 * on every reload, which a `Math.random()` mesh would not.
 */
export function hashNoise(x: number, y: number, seed = 1): number {
  let h = Math.imul(x | 0, 374_761_393) ^ Math.imul(y | 0, 668_265_263) ^ Math.imul(seed, 1_274_126_177);
  h = Math.imul(h ^ (h >>> 13), 1_274_126_177);
  return ((h ^ (h >>> 16)) >>> 0) / 4_294_967_296;
}

/** Smooth value noise built from `hashNoise`, with cosine interpolation. */
export function valueNoise2d(x: number, y: number, seed = 1): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const smooth = (t: number) => (1 - Math.cos(t * Math.PI)) / 2;
  const sx = smooth(xf);
  const sy = smooth(yf);

  const n00 = hashNoise(xi, yi, seed);
  const n10 = hashNoise(xi + 1, yi, seed);
  const n01 = hashNoise(xi, yi + 1, seed);
  const n11 = hashNoise(xi + 1, yi + 1, seed);

  const top = n00 + (n10 - n00) * sx;
  const bottom = n01 + (n11 - n01) * sx;
  return top + (bottom - top) * sy;
}

/** Layered noise. Three octaves is enough to read as terrain rather than blobs. */
export function fractalNoise2d(
  x: number,
  y: number,
  octaves = 3,
  seed = 1
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let normalisation = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    value += valueNoise2d(x * frequency, y * frequency, seed + octave) * amplitude;
    normalisation += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return normalisation === 0 ? 0 : value / normalisation;
}

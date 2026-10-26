// Cleans up raw GPS fixes: drops inaccurate readings and impossible jumps,
// and smooths small jitter so markers don't hop around.

export type Fix = { lat: number; lng: number; accuracy: number | null; at: number };

const GOOD_ACCURACY = 50; // meters
const OK_ACCURACY = 80; // used only if nothing better has come in for a while
const MAX_SPEED = 12; // m/s, faster than anyone runs
const STALE_MS = 20000;

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function createLocationFilter() {
  let last: Fix | null = null;

  return function accept(raw: Fix): Fix | null {
    const acc = raw.accuracy ?? OK_ACCURACY;
    const stale = !last || raw.at - last.at > STALE_MS;
    if (last && raw.at <= last.at) return null;
    if (acc > (stale ? OK_ACCURACY : GOOD_ACCURACY) && !(stale && !last)) return null;

    if (last && !stale) {
      const dist = distanceM(last, raw);
      const secs = Math.max(1, (raw.at - last.at) / 1000);
      // a jump bigger than running speed allows (plus the GPS error) is a glitch
      if (dist > MAX_SPEED * secs + acc + (last.accuracy ?? 0)) return null;
      // smooth: trust the new fix more when it's accurate
      const k = Math.min(1, Math.max(0.35, 12 / acc));
      last = {
        lat: last.lat + (raw.lat - last.lat) * k,
        lng: last.lng + (raw.lng - last.lng) * k,
        accuracy: acc,
        at: raw.at,
      };
      return last;
    }
    last = { ...raw, accuracy: acc };
    return last;
  };
}

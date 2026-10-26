// The map runs inside a WebView using MapLibre GL with free OpenStreetMap
// vector tiles from OpenFreeMap (no API key), styled our own way:
// black streets with a white center line, green parks, gray buildings.

export const MAPLIBRE_VERSION = '4.7.1';

export const mapStyle = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  layers: [
    { id: 'land', type: 'background', paint: { 'background-color': '#ECE9E1' } },
    {
      id: 'landuse-soft',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood', 'commercial', 'retail', 'industrial']]],
      paint: { 'fill-color': '#E3DFD5', 'fill-opacity': 0.7 },
    },
    {
      id: 'parks',
      type: 'fill',
      source: 'omt',
      'source-layer': 'park',
      paint: { 'fill-color': '#5CBF60' },
    },
    {
      id: 'green-landcover',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['grass', 'farmland', 'wetland']]],
      paint: { 'fill-color': '#6CCB6A' },
    },
    {
      id: 'woods',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'wood'],
      paint: { 'fill-color': '#3E9E4D' },
    },
    {
      id: 'green-landuse',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['park', 'pitch', 'playground', 'garden', 'cemetery', 'grass', 'recreation_ground', 'golf_course', 'stadium']]],
      paint: { 'fill-color': '#5CBF60' },
    },
    { id: 'sand', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'sand'], paint: { 'fill-color': '#EBDDB0' } },
    { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': '#5FB4EA' } },
    {
      id: 'waterway',
      type: 'line',
      source: 'omt',
      'source-layer': 'waterway',
      paint: { 'line-color': '#5FB4EA', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 4] },
    },
    {
      id: 'buildings',
      type: 'fill',
      source: 'omt',
      'source-layer': 'building',
      minzoom: 13,
      paint: { 'fill-color': '#9C9C9C', 'fill-outline-color': '#7A7A7A' },
    },
    {
      id: 'paths',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['path', 'track']]],
      minzoom: 14,
      paint: { 'line-color': '#3A3A3A', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1, 18, 3], 'line-dasharray': [2, 1.5] },
    },
    {
      id: 'rail',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['==', ['get', 'class'], 'rail'],
      paint: { 'line-color': '#7B7B7B', 'line-width': 2, 'line-dasharray': [3, 2] },
    },
    {
      id: 'roads',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#111111',
        'line-width': [
          'interpolate', ['exponential', 1.6], ['zoom'],
          10, ['match', ['get', 'class'], ['motorway', 'trunk'], 2.5, ['primary', 'secondary'], 1.8, 0.8],
          14, ['match', ['get', 'class'], ['motorway', 'trunk'], 9, ['primary', 'secondary'], 7, 'service', 3, 5],
          18, ['match', ['get', 'class'], ['motorway', 'trunk'], 40, ['primary', 'secondary'], 32, 'service', 14, 24],
        ],
      },
    },
    {
      id: 'road-center-line',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor']]],
      minzoom: 13.5,
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: {
        'line-color': '#FFFFFF',
        'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.8, 18, 2],
        'line-dasharray': [4, 3],
      },
    },
    {
      id: 'road-names',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'transportation_name',
      minzoom: 15,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-font': ['Noto Sans Bold'],
        'text-size': 11,
        'text-offset': [0, 1.2],
      },
      paint: { 'text-color': '#111111', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 },
    },
    {
      id: 'places',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 10, 11, 15, 15] },
      paint: { 'text-color': '#222222', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2 },
    },
  ],
};

// `maplibreSrc` lets tests load MapLibre from disk instead of the CDN.
export function buildMapHtml(maplibreSrc = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl`) {
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="${maplibreSrc}.css" />
<script src="${maplibreSrc}.js"></script>
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #ECE9E1; overflow: hidden; }
  body { -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; font-family: -apple-system, Roboto, sans-serif; }
  #draw { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 5; display: none; touch-action: none; }
  .pin { display: flex; flex-direction: column; align-items: center; pointer-events: none; }
  .pin .bubble { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 21px; border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,.45); }
  .pin.seeker .bubble { border-color: #E53935; }
  .pin.hider .bubble { border-color: #43A047; }
  .pin.ping .bubble { opacity: .75; border-style: dashed; }
  .pin .label { margin-top: 2px; background: rgba(0,0,0,.8); color: #fff; font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 8px; white-space: nowrap; }
  .me { width: 20px; height: 20px; border-radius: 50%; background: #1E88E5; border: 3px solid #fff; box-shadow: 0 0 0 0 rgba(30,136,229,.6); animation: pulse 2s infinite; }
  @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(30,136,229,.6); } 70% { box-shadow: 0 0 0 16px rgba(30,136,229,0); } 100% { box-shadow: 0 0 0 0 rgba(30,136,229,0); } }
  #err { position: absolute; top: 40%; left: 10%; right: 10%; text-align: center; color: #333; display: none; }
</style>
</head><body>
<div id="map"></div>
<canvas id="draw"></canvas>
<div id="err">Couldn't load the map. Check your internet connection.</div>
<script>
(function () {
  var send = function (msg) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg)); else window.__sent = (window.__sent || []).concat([msg]); };
  if (!window.maplibregl) { document.getElementById('err').style.display = 'block'; send({ type: 'error', message: 'maplibre failed to load' }); return; }

  var map = new maplibregl.Map({
    container: 'map',
    style: ${JSON.stringify(mapStyle)},
    center: [-0.1276, 51.5072],
    zoom: 15,
    attributionControl: { compact: true, customAttribution: 'OpenFreeMap © OpenMapTiles © OpenStreetMap' },
    pitchWithRotate: false,
    dragRotate: false,
  });
  map.touchZoomRotate.disableRotation();
  window.__map = map;

  var area = null, markers = {}, meMarker = null, drawing = false, path = [];
  var empty = { type: 'FeatureCollection', features: [] };

  function polygonFeature(ring) {
    var closed = ring.concat([ring[0]]);
    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [closed] } };
  }
  // world with a hole: everything outside the play area gets dimmed
  function maskFeature(ring) {
    var world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [world, ring.concat([ring[0]])] } };
  }

  function renderArea() {
    if (!map.getSource('area')) return;
    map.getSource('area').setData(area ? polygonFeature(area) : empty);
    map.getSource('mask').setData(area && window.__showMask ? maskFeature(area) : empty);
  }

  map.on('load', function () {
    map.addSource('mask', { type: 'geojson', data: empty });
    map.addSource('area', { type: 'geojson', data: empty });
    map.addSource('sketch', { type: 'geojson', data: empty });
    map.addLayer({ id: 'mask', type: 'fill', source: 'mask', paint: { 'fill-color': '#000', 'fill-opacity': 0.35 } });
    map.addLayer({ id: 'area-fill', type: 'fill', source: 'area', paint: { 'fill-color': '#FF3B30', 'fill-opacity': 0.12 } });
    map.addLayer({ id: 'area-line', type: 'line', source: 'area', paint: { 'line-color': '#FF3B30', 'line-width': 4 } });
    map.addLayer({ id: 'sketch', type: 'line', source: 'sketch', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FF3B30', 'line-width': 4, 'line-dasharray': [1, 1] } });
    renderArea();
    send({ type: 'ready' });
  });
  map.on('error', function (e) { send({ type: 'error', message: String(e && e.error && e.error.message || e) }); });

  // ---- freehand drawing of the play area ----
  var canvas = document.getElementById('draw');
  function pointFromEvent(e) {
    var t = e.touches ? e.touches[0] || e.changedTouches[0] : e;
    var r = canvas.getBoundingClientRect();
    return [t.clientX - r.left, t.clientY - r.top];
  }
  function sketch() {
    var coords = path.map(function (p) { var ll = map.unproject(p); return [ll.lng, ll.lat]; });
    map.getSource('sketch').setData(coords.length > 1 ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } : empty);
  }
  function onStart(e) { e.preventDefault(); drawing = true; path = [pointFromEvent(e)]; sketch(); }
  function onMove(e) {
    if (!drawing) return; e.preventDefault();
    var p = pointFromEvent(e), last = path[path.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 5) { path.push(p); sketch(); }
  }
  function onEnd(e) {
    if (!drawing) return; drawing = false;
    map.getSource('sketch').setData(empty);
    if (path.length < 6) { send({ type: 'drawTooSmall' }); return; }
    var ring = path.map(function (p) { var ll = map.unproject(p); return [+ll.lng.toFixed(6), +ll.lat.toFixed(6)]; });
    area = ring; renderArea();
    send({ type: 'area', area: ring });
  }
  canvas.addEventListener('touchstart', onStart, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onEnd);
  canvas.addEventListener('mousedown', onStart);
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);

  function fitArea() {
    if (!area || !area.length) return;
    var b = new maplibregl.LngLatBounds(area[0], area[0]);
    area.forEach(function (p) { b.extend(p); });
    map.fitBounds(b, { padding: 50, duration: 600, maxZoom: 18 });
  }

  function pinEl(p) {
    var el = document.createElement('div');
    el.className = 'pin ' + (p.role || '') + (p.kind === 'ping' ? ' ping' : '');
    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.style.background = p.color || '#3b82f6';
    bubble.textContent = p.emoji || '🙂';
    var label = document.createElement('div');
    label.className = 'label';
    label.textContent = p.label || '';
    el.appendChild(bubble); el.appendChild(label);
    return el;
  }

  var handlers = {
    setDrawMode: function (m) {
      canvas.style.display = m.on ? 'block' : 'none';
      if (m.on) { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; }
    },
    setArea: function (m) { area = m.area && m.area.length >= 3 ? m.area : null; window.__showMask = !!m.mask; renderArea(); if (m.fit) fitArea(); },
    fitArea: fitArea,
    center: function (m) { map.easeTo({ center: [m.lng, m.lat], zoom: m.zoom || map.getZoom(), duration: m.instant ? 0 : 600 }); },
    setMe: function (m) {
      if (!m.lat) { if (meMarker) { meMarker.remove(); meMarker = null; } return; }
      if (!meMarker) { var el = document.createElement('div'); el.className = 'me'; meMarker = new maplibregl.Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(map); }
      else meMarker.setLngLat([m.lng, m.lat]);
    },
    setPlayers: function (m) {
      var seen = {};
      (m.players || []).forEach(function (p) {
        seen[p.id] = true;
        var key = p.id + '|' + p.role + '|' + p.kind + '|' + p.emoji + '|' + p.color + '|' + p.label;
        var existing = markers[p.id];
        if (existing && existing.key === key) { existing.marker.setLngLat([p.lng, p.lat]); return; }
        if (existing) existing.marker.remove();
        markers[p.id] = { key: key, marker: new maplibregl.Marker({ element: pinEl(p), anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map) };
      });
      Object.keys(markers).forEach(function (id) { if (!seen[id]) { markers[id].marker.remove(); delete markers[id]; } });
    },
    setInteractive: function (m) {
      ['dragPan', 'scrollZoom', 'boxZoom', 'doubleClickZoom', 'touchZoomRotate', 'keyboard'].forEach(function (h) { m.on ? map[h].enable() : map[h].disable(); });
      if (m.on) map.touchZoomRotate.disableRotation();
    },
  };

  window.__recv = function (msg) { try { var h = handlers[msg.type]; if (h) h(msg); } catch (err) { send({ type: 'error', message: String(err) }); } };
})();
</script>
</body></html>`;
}

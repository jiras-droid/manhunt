// Core game rules for Manhunt. Pure logic: the socket layer in index.js
// calls into a Room and passes an `out` object used to talk to players.

const crypto = require('crypto');

const DEFAULT_SETTINGS = {
  pingMode: 'interval', // 'live' | 'interval'
  pingIntervalSec: 60, // how often hiders' locations are revealed (interval mode)
  outOfBoundsSec: 30, // how long a player can be outside the area before losing
  gameMode: 'elimination', // 'elimination' | 'infection' | 'swap'
  swapFreezeSec: 60, // swap mode: how long a newly tagged seeker must stand still
  maxGameMin: 30, // max game length in minutes (0 = no limit, not allowed in swap)
  headStartSec: 180, // seekers stand still while hiders hide
};

const MAX_PLAYERS = 50;

function clamp(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function sanitizeSettings(s = {}) {
  const d = DEFAULT_SETTINGS;
  const gameMode = ['elimination', 'infection', 'swap'].includes(s.gameMode) ? s.gameMode : d.gameMode;
  let maxGameMin = clamp(s.maxGameMin, 0, 24 * 60, d.maxGameMin);
  // Swap mode never runs out of hiders, so it needs a timer to end.
  if (gameMode === 'swap' && maxGameMin === 0) maxGameMin = d.maxGameMin;
  return {
    pingMode: s.pingMode === 'live' ? 'live' : 'interval',
    pingIntervalSec: clamp(s.pingIntervalSec, 5, 60 * 60, d.pingIntervalSec),
    outOfBoundsSec: clamp(s.outOfBoundsSec, 0, 60 * 60, d.outOfBoundsSec),
    gameMode,
    swapFreezeSec: clamp(s.swapFreezeSec, 0, 60 * 60, d.swapFreezeSec),
    maxGameMin,
    headStartSec: clamp(s.headStartSec, 0, 60 * 60, d.headStartSec),
  };
}

function sanitizeArea(area) {
  if (!Array.isArray(area)) return null;
  const pts = area
    .filter((p) => Array.isArray(p) && p.length >= 2)
    .map(([lng, lat]) => [Number(lng), Number(lat)])
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)
    .slice(0, 2000);
  return pts.length >= 3 ? pts : null;
}

// Ray casting point-in-polygon. polygon = [[lng, lat], ...]
function pointInPolygon(lng, lat, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const hit = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function sanitizeAvatar(a = {}) {
  return {
    emoji: typeof a.emoji === 'string' ? a.emoji.slice(0, 8) : '🙂',
    color: typeof a.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(a.color) ? a.color : '#3b82f6',
    accessory: typeof a.accessory === 'string' ? a.accessory.slice(0, 8) : '',
  };
}

function sanitizeName(n) {
  const name = String(n || '').trim().slice(0, 20);
  return name || 'Player';
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 20–25% of players become seekers, at least 1, and at least 1 hider stays.
function randomSeekerCount(n) {
  const pct = 0.2 + Math.random() * 0.05;
  return Math.max(1, Math.min(n - 1, Math.round(n * pct)));
}

class Room {
  constructor(code, host, settings, area, out) {
    this.code = code;
    this.hostId = host.id;
    this.settings = sanitizeSettings(settings);
    this.area = sanitizeArea(area);
    this.out = out; // { toPlayer(id, event, data), toRoom(event, data), push(player, title, body, data) }
    this.state = 'lobby'; // lobby | headstart | playing | ended
    this.players = new Map();
    this.banned = new Set(); // players who left and may not rejoin
    this.pendingTags = new Map(); // tagId -> { id, hiderId, seekerId, at }
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.startedAt = null;
    this.headStartEndsAt = null;
    this.endsAt = null;
    this.lastPingAt = null;
    this.pingSnapshot = []; // hider positions at last ping
    this.result = null;
    this.initialHiders = 0;
    this.events = []; // short feed shown in game
    this.addPlayer(host);
  }

  log(text) {
    this.events.push({ at: Date.now(), text });
    if (this.events.length > 30) this.events.shift();
  }

  // ---- players ---------------------------------------------------------

  addPlayer(p) {
    const existing = this.players.get(p.id);
    if (existing) {
      if (existing.secret !== p.secret) return { ok: false, error: 'That player id belongs to someone else.' };
      if (existing.left) return { ok: false, error: "You left this game and can't rejoin." };
      existing.name = sanitizeName(p.name);
      existing.avatar = sanitizeAvatar(p.avatar);
      if (p.pushToken) existing.pushToken = String(p.pushToken);
      return { ok: true, player: existing, resumed: true };
    }
    if (this.banned.has(p.id)) return { ok: false, error: "You left this game and can't rejoin." };
    if (this.state !== 'lobby') return { ok: false, error: 'This game has already started.' };
    if (this.players.size >= MAX_PLAYERS) return { ok: false, error: 'This lobby is full.' };
    const player = {
      id: String(p.id),
      secret: String(p.secret),
      name: sanitizeName(p.name),
      avatar: sanitizeAvatar(p.avatar),
      pushToken: p.pushToken ? String(p.pushToken) : null,
      role: 'none', // none | hider | seeker | out
      connected: false,
      left: false,
      lat: null,
      lng: null,
      accuracy: null,
      locAt: null,
      outOfBoundsSince: null,
      frozenUntil: null,
      tags: 0,
      outReason: null,
    };
    this.players.set(player.id, player);
    this.log(`${player.name} joined`);
    return { ok: true, player, resumed: false };
  }

  activePlayers() {
    return [...this.players.values()].filter((p) => !p.left);
  }

  byRole(role) {
    return this.activePlayers().filter((p) => p.role === role);
  }

  leave(playerId) {
    const p = this.players.get(playerId);
    if (!p || p.left) return;
    p.left = true;
    p.connected = false;
    this.banned.add(playerId);
    if (this.state === 'lobby') {
      this.players.delete(playerId);
    } else {
      p.role = 'out';
      p.outReason = 'left';
    }
    this.log(`${p.name} left the game`);
    for (const [id, t] of this.pendingTags) if (t.hiderId === playerId || t.seekerId === playerId) this.pendingTags.delete(id);
    if (this.hostId === playerId) {
      const next = this.activePlayers()[0];
      if (next) this.hostId = next.id;
    }
    this.checkEnd();
    this.broadcast();
  }

  // ---- lifecycle -------------------------------------------------------

  start(byId, { random = true, seekerIds = [] } = {}) {
    if (byId !== this.hostId) return { ok: false, error: 'Only the host can start the game.' };
    if (this.state !== 'lobby') return { ok: false, error: 'The game already started.' };
    if (!this.area) return { ok: false, error: 'The play area is missing.' };
    const players = this.activePlayers();
    if (players.length < 2) return { ok: false, error: 'You need at least 2 players.' };

    let seekers;
    if (random) {
      seekers = new Set(shuffle(players.map((p) => p.id)).slice(0, randomSeekerCount(players.length)));
    } else {
      seekers = new Set((seekerIds || []).filter((id) => this.players.has(id)));
      if (seekers.size < 1) return { ok: false, error: 'Pick at least 1 seeker.' };
      if (seekers.size >= players.length) return { ok: false, error: 'Leave at least 1 hider.' };
    }
    for (const p of players) p.role = seekers.has(p.id) ? 'seeker' : 'hider';

    const now = Date.now();
    this.initialHiders = players.length - seekers.size;
    this.startedAt = now;
    this.headStartEndsAt = now + this.settings.headStartSec * 1000;
    this.endsAt = this.settings.maxGameMin > 0 ? this.headStartEndsAt + this.settings.maxGameMin * 60000 : null;
    this.state = this.settings.headStartSec > 0 ? 'headstart' : 'playing';
    this.log(`Game started: ${seekers.size} seeker${seekers.size === 1 ? '' : 's'}, ${this.initialHiders} hider${this.initialHiders === 1 ? '' : 's'}`);

    for (const p of players) {
      const mins = Math.round(this.settings.headStartSec / 6) / 10;
      const body =
        p.role === 'seeker'
          ? `You are a SEEKER. Don't move for ${mins} min while the hiders hide.`
          : `You are a HIDER. You have ${mins} min to hide. Go!`;
      this.out.push(p, 'Manhunt started', body, { type: 'start', code: this.code });
    }
    if (this.state === 'playing') this.beginHunt();
    this.broadcast();
    return { ok: true };
  }

  beginHunt() {
    this.state = 'playing';
    this.log('Head start is over. Seekers, go!');
    for (const p of this.byRole('seeker')) this.out.push(p, 'Go go go!', 'Head start is over. Start hunting.', { type: 'hunt', code: this.code });
    this.doPing();
  }

  end(title, winnerIds, reason) {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.result = { title, winnerIds, reason, at: Date.now() };
    this.pendingTags.clear();
    this.log(`Game over: ${title}`);
    for (const p of this.activePlayers()) {
      const won = winnerIds.includes(p.id);
      this.out.push(p, won ? 'You won! 🏆' : 'Game over', `${title}. ${reason}`, { type: 'end', code: this.code });
    }
    this.broadcast();
  }

  checkEnd() {
    if (this.state !== 'headstart' && this.state !== 'playing') return;
    const hiders = this.byRole('hider');
    const seekers = this.byRole('seeker');
    if (seekers.length === 0) {
      return this.end('Hiders win', hiders.map((p) => p.id), 'There are no seekers left.');
    }
    if (hiders.length === 0) {
      return this.end('Seekers win', seekers.map((p) => p.id), 'Every hider was caught.');
    }
    const mode = this.settings.gameMode;
    if ((mode === 'elimination' || mode === 'infection') && this.initialHiders >= 2 && hiders.length === 1) {
      return this.end(`${hiders[0].name} wins`, [hiders[0].id], 'Last hider standing.');
    }
  }

  // ---- location --------------------------------------------------------

  updateLocation(playerId, { lat, lng, accuracy, at }) {
    const p = this.players.get(playerId);
    if (!p || p.left) return;
    lat = Number(lat);
    lng = Number(lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const when = Number(at) || Date.now();
    if (p.locAt && when < p.locAt) return; // older than what we have
    p.lat = lat;
    p.lng = lng;
    p.accuracy = Number(accuracy) || null;
    p.locAt = when;
    this.lastActivity = Date.now();

    if (this.area && (this.state === 'headstart' || this.state === 'playing') && p.role !== 'out') {
      const inside = pointInPolygon(lng, lat, this.area);
      if (!inside && !p.outOfBoundsSince) {
        p.outOfBoundsSince = Date.now();
        this.out.toPlayer(p.id, 'toast', { kind: 'warn', message: `You're out of bounds! Get back within ${this.settings.outOfBoundsSec}s.` });
        this.out.push(p, '⚠️ Out of bounds', `Get back inside the play area within ${this.settings.outOfBoundsSec} seconds or you lose.`, { type: 'oob', code: this.code });
      } else if (inside && p.outOfBoundsSince) {
        p.outOfBoundsSince = null;
        this.out.toPlayer(p.id, 'toast', { kind: 'ok', message: 'Back in bounds.' });
      }
    }
  }

  doPing() {
    this.lastPingAt = Date.now();
    this.pingSnapshot = this.byRole('hider')
      .filter((p) => p.lat != null)
      .map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, at: this.lastPingAt }));
    if (this.settings.pingMode === 'interval') {
      for (const p of this.byRole('hider')) this.out.toPlayer(p.id, 'toast', { kind: 'info', message: '📡 Your location was just pinged to the seekers' });
    }
  }

  // ---- tagging ---------------------------------------------------------

  reportTagged(hiderId, seekerId) {
    if (this.state !== 'playing') return { ok: false, error: this.state === 'headstart' ? 'Tagging starts after the head start.' : 'The game is not running.' };
    const hider = this.players.get(hiderId);
    if (!hider || hider.role !== 'hider') return { ok: false, error: "You're not a hider right now." };

    if (this.settings.gameMode === 'elimination') {
      const seeker = seekerId ? this.players.get(seekerId) : null;
      hider.role = 'out';
      hider.outReason = 'tagged';
      if (seeker) seeker.tags++;
      this.log(`${hider.name} was caught${seeker ? ` by ${seeker.name}` : ''}`);
      this.out.toRoom('toast', { kind: 'info', message: `${hider.name} was caught!` });
      this.checkEnd();
      this.broadcast();
      return { ok: true, done: true };
    }

    const seeker = this.players.get(seekerId);
    if (!seeker || seeker.role !== 'seeker' || seeker.left) return { ok: false, error: 'Pick the seeker who found you.' };
    for (const [id, t] of this.pendingTags) if (t.hiderId === hiderId) this.pendingTags.delete(id);
    const tag = { id: crypto.randomUUID(), hiderId, seekerId, at: Date.now() };
    this.pendingTags.set(tag.id, tag);
    this.sendTagRequest(tag);
    this.broadcast();
    return { ok: true, pending: true, tagId: tag.id };
  }

  sendTagRequest(tag) {
    const hider = this.players.get(tag.hiderId);
    const seeker = this.players.get(tag.seekerId);
    if (!hider || !seeker) return;
    this.out.toPlayer(seeker.id, 'tagRequest', { tagId: tag.id, hiderId: hider.id, hiderName: hider.name, hiderAvatar: hider.avatar });
    this.out.push(seeker, 'Did you tag them?', `${hider.name} says you tagged them. Open Manhunt to confirm.`, { type: 'tagRequest', tagId: tag.id, code: this.code });
  }

  confirmTag(seekerId, tagId, yes) {
    const tag = this.pendingTags.get(tagId);
    if (!tag || tag.seekerId !== seekerId) return { ok: false, error: 'That tag request is no longer active.' };
    this.pendingTags.delete(tagId);
    const hider = this.players.get(tag.hiderId);
    const seeker = this.players.get(tag.seekerId);
    if (!yes) {
      this.out.toPlayer(tag.hiderId, 'tagResult', { tagId, accepted: false, message: `${seeker.name} said they didn't tag you.` });
      this.broadcast();
      return { ok: true };
    }
    if (this.state !== 'playing' || hider.role !== 'hider' || seeker.role !== 'seeker') {
      this.broadcast();
      return { ok: false, error: 'Roles changed before you answered.' };
    }
    seeker.tags++;
    if (this.settings.gameMode === 'infection') {
      hider.role = 'seeker';
      hider.outOfBoundsSince = null;
      this.log(`${seeker.name} infected ${hider.name}`);
      this.out.toRoom('toast', { kind: 'info', message: `🧟 ${hider.name} is now a seeker!` });
    } else {
      // swap: roles flip and the new seeker is frozen for a while
      hider.role = 'seeker';
      seeker.role = 'hider';
      hider.frozenUntil = Date.now() + this.settings.swapFreezeSec * 1000;
      seeker.frozenUntil = null;
      // the new hider's last ping no longer makes sense
      this.pingSnapshot = this.pingSnapshot.filter((s) => s.id !== hider.id);
      this.log(`${seeker.name} tagged ${hider.name}: they swapped roles`);
      this.out.toRoom('toast', { kind: 'info', message: `🔄 ${seeker.name} tagged ${hider.name}. They swapped roles!` });
      this.out.push(seeker, 'You are now a HIDER', `Run! ${hider.name} can't move for ${this.settings.swapFreezeSec}s.`, { type: 'swap', code: this.code });
    }
    this.out.toPlayer(hider.id, 'tagResult', { tagId, accepted: true, message: 'Tag confirmed.' });
    for (const [id, t] of this.pendingTags) {
      const h = this.players.get(t.hiderId);
      const s = this.players.get(t.seekerId);
      if (!h || h.role !== 'hider' || !s || s.role !== 'seeker') this.pendingTags.delete(id);
    }
    this.checkEnd();
    this.broadcast();
    return { ok: true };
  }

  // ---- clock -----------------------------------------------------------

  tick() {
    const now = Date.now();
    if (this.state === 'headstart' && now >= this.headStartEndsAt) this.beginHunt();
    if (this.state !== 'headstart' && this.state !== 'playing') return;

    if (this.state === 'playing' && this.settings.pingMode === 'interval' && (!this.lastPingAt || now - this.lastPingAt >= this.settings.pingIntervalSec * 1000)) {
      this.doPing();
    }

    let changed = false;
    for (const p of this.activePlayers()) {
      if (p.frozenUntil && now >= p.frozenUntil) {
        p.frozenUntil = null;
        changed = true;
        this.out.toPlayer(p.id, 'toast', { kind: 'ok', message: 'You can move again. Go!' });
      }
      if (p.role !== 'out' && p.outOfBoundsSince && now - p.outOfBoundsSince > this.settings.outOfBoundsSec * 1000) {
        p.role = 'out';
        p.outReason = 'out of bounds';
        p.outOfBoundsSince = null;
        changed = true;
        this.log(`${p.name} was out of bounds too long and lost`);
        this.out.toRoom('toast', { kind: 'warn', message: `${p.name} was out of bounds too long and is out!` });
        this.out.push(p, 'You lost', 'You were out of bounds for too long.', { type: 'out', code: this.code });
      }
    }
    if (changed) this.checkEnd();

    if (this.endsAt && now >= this.endsAt && this.state !== 'ended') {
      const hiders = this.byRole('hider');
      this.end(hiders.length === 1 ? `${hiders[0].name} wins` : 'Hiders win', hiders.map((p) => p.id), "Time's up and they were never caught.");
      return;
    }
    if (changed) this.broadcast();
  }

  // ---- what each player is allowed to see ------------------------------

  publicState() {
    return {
      code: this.code,
      hostId: this.hostId,
      settings: this.settings,
      area: this.area,
      state: this.state,
      startedAt: this.startedAt,
      headStartEndsAt: this.headStartEndsAt,
      endsAt: this.endsAt,
      lastPingAt: this.lastPingAt,
      result: this.result,
      events: this.events.slice(-8),
      serverTime: Date.now(),
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        role: p.role,
        connected: p.connected,
        left: p.left,
        frozenUntil: p.frozenUntil,
        outOfBoundsSince: p.outOfBoundsSince,
        tags: p.tags,
        outReason: p.outReason,
      })),
    };
  }

  stateFor(playerId) {
    const s = this.publicState();
    s.pendingTagsForMe = [...this.pendingTags.values()]
      .filter((t) => t.seekerId === playerId)
      .map((t) => {
        const h = this.players.get(t.hiderId);
        return { tagId: t.id, hiderId: t.hiderId, hiderName: h?.name, hiderAvatar: h?.avatar };
      });
    s.myPendingTag = [...this.pendingTags.values()].find((t) => t.hiderId === playerId) || null;
    return s;
  }

  // Positions a given player may see on their map.
  positionsFor(playerId) {
    const me = this.players.get(playerId);
    if (!me) return [];
    const live = (p) => (p.lat == null ? null : { id: p.id, lat: p.lat, lng: p.lng, at: p.locAt, kind: 'live' });
    const all = this.activePlayers().filter((p) => p.id !== playerId);
    if (this.state === 'ended' || me.role === 'out' || me.left) return all.map(live).filter(Boolean);
    if (me.role === 'seeker') {
      const seekers = all.filter((p) => p.role === 'seeker').map(live).filter(Boolean);
      if (this.state !== 'playing') return seekers;
      const hiderIds = new Set(this.byRole('hider').map((p) => p.id));
      const hiders =
        this.settings.pingMode === 'live'
          ? all.filter((p) => p.role === 'hider').map(live).filter(Boolean)
          : this.pingSnapshot.filter((s) => hiderIds.has(s.id)).map((s) => ({ ...s, kind: 'ping' }));
      return [...seekers, ...hiders];
    }
    return []; // hiders only see themselves
  }

  broadcast() {
    for (const p of this.players.values()) {
      if (p.connected) this.out.toPlayer(p.id, 'room', this.stateFor(p.id));
    }
  }

  broadcastPositions() {
    for (const p of this.players.values()) {
      if (!p.connected) continue;
      const players = this.positionsFor(p.id);
      // only send when something changed, to save mobile data
      const sig = JSON.stringify([players, this.lastPingAt]);
      if (sig === p.lastPositionsSig) continue;
      p.lastPositionsSig = sig;
      this.out.toPlayer(p.id, 'positions', { players, lastPingAt: this.lastPingAt, serverTime: Date.now() });
    }
  }
}

module.exports = { Room, DEFAULT_SETTINGS, sanitizeSettings, pointInPolygon, randomSeekerCount };

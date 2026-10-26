// Manhunt game server: lobbies, roles, location pings and tag confirmations.
// Run with `npm start` (listens on PORT, default 3000).

const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const { Room } = require('./game');

const PORT = Number(process.env.PORT) || 3000;
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

const app = express();
app.use(express.json({ limit: '1mb' }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, pingInterval: 10000, pingTimeout: 20000 });

const rooms = new Map(); // code -> Room
const sockets = new Map(); // playerId -> socket

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  for (;;) {
    let code = '';
    for (let i = 0; i < 6; i++) code += alphabet[crypto.randomInt(alphabet.length)];
    if (!rooms.has(code)) return code;
  }
}

async function sendPush(player, title, body, data) {
  if (!player.pushToken || player.left) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: player.pushToken, title, body, data, sound: 'default', priority: 'high', channelId: 'game' }),
    });
  } catch (e) {
    console.warn('push failed', e.message);
  }
}

function outFor(code) {
  return {
    toPlayer(id, event, data) {
      const s = sockets.get(id);
      if (s && s.data.code === code) s.emit(event, data);
    },
    toRoom(event, data) {
      io.to(code).emit(event, data);
    },
    push(player, title, body, data) {
      sendPush(player, title, body, data);
    },
  };
}

function attach(socket, room, player) {
  const prev = sockets.get(player.id);
  if (prev && prev.id !== socket.id) prev.disconnect(true);
  sockets.set(player.id, socket);
  socket.data.code = room.code;
  socket.data.playerId = player.id;
  socket.join(room.code);
  player.connected = true;
  player.lastPositionsSig = null; // make sure the fresh connection gets positions
  room.broadcast();
  room.broadcastPositions();
  // re-send any tag requests this player still has to answer
  for (const t of room.pendingTags.values()) if (t.seekerId === player.id) room.sendTagRequest(t);
}

function current(socket) {
  const room = rooms.get(socket.data.code);
  if (!room) return {};
  return { room, player: room.players.get(socket.data.playerId) };
}

io.on('connection', (socket) => {
  const safe = (fn) => (data, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      fn(data || {}, reply);
    } catch (e) {
      console.error(e);
      reply({ ok: false, error: 'Server error' });
    }
  };

  socket.on('createRoom', safe(({ player, settings, area }, ack) => {
    if (!player?.id || !player?.secret) return ack({ ok: false, error: 'Missing player info.' });
    const code = makeCode();
    const room = new Room(code, player, settings, area, outFor(code));
    if (!room.area) return ack({ ok: false, error: 'Draw a play area on the map first.' });
    rooms.set(code, room);
    attach(socket, room, room.players.get(player.id));
    ack({ ok: true, code, room: room.stateFor(player.id) });
  }));

  socket.on('joinRoom', safe(({ code, player }, ack) => {
    const room = rooms.get(String(code || '').trim().toUpperCase());
    if (!room) return ack({ ok: false, error: 'No lobby with that code.' });
    if (!player?.id || !player?.secret) return ack({ ok: false, error: 'Missing player info.' });
    const res = room.addPlayer(player);
    if (!res.ok) return ack(res);
    attach(socket, room, res.player);
    ack({ ok: true, code: room.code, room: room.stateFor(player.id), resumed: res.resumed });
  }));

  socket.on('startGame', safe((opts, ack) => {
    const { room, player } = current(socket);
    if (!room || !player) return ack({ ok: false, error: 'Not in a lobby.' });
    ack(room.start(player.id, opts));
  }));

  socket.on('location', safe((loc, ack) => {
    const { room, player } = current(socket);
    if (!room || !player) return ack({ ok: false });
    room.updateLocation(player.id, loc);
    ack({ ok: true });
  }));

  socket.on('reportTagged', safe(({ seekerId }, ack) => {
    const { room, player } = current(socket);
    if (!room || !player) return ack({ ok: false, error: 'Not in a game.' });
    ack(room.reportTagged(player.id, seekerId));
  }));

  socket.on('confirmTag', safe(({ tagId, yes }, ack) => {
    const { room, player } = current(socket);
    if (!room || !player) return ack({ ok: false, error: 'Not in a game.' });
    ack(room.confirmTag(player.id, tagId, !!yes));
  }));

  socket.on('leaveRoom', safe((_d, ack) => {
    const { room, player } = current(socket);
    if (room && player) {
      room.leave(player.id);
      socket.leave(room.code);
      sockets.delete(player.id);
    }
    socket.data.code = null;
    ack({ ok: true });
  }));

  socket.on('disconnect', () => {
    const { room, player } = current(socket);
    if (room && player && sockets.get(player.id) === socket) {
      sockets.delete(player.id);
      player.connected = false;
      room.broadcast();
    }
  });
});

// Background location updates come over plain HTTP, because the phone's
// background task can't hold a socket open.
app.post('/api/location', (req, res) => {
  const { code, playerId, secret, lat, lng, accuracy, at } = req.body || {};
  const room = rooms.get(String(code || '').toUpperCase());
  const player = room?.players.get(playerId);
  if (!room || !player || player.secret !== secret) return res.status(404).json({ ok: false });
  room.updateLocation(playerId, { lat, lng, accuracy, at });
  res.json({ ok: true, state: room.state, role: player.role });
});

app.get('/', (_req, res) => res.send(`Manhunt server is running. ${rooms.size} active game(s).`));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

setInterval(() => {
  for (const room of rooms.values()) room.tick();
}, 1000);

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    room.broadcastPositions();
    const anyoneHere = [...room.players.values()].some((p) => p.connected);
    if (!anyoneHere && now - room.lastActivity > ROOM_TTL_MS) rooms.delete(code);
    if (anyoneHere) room.lastActivity = now;
  }
}, 2000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Manhunt server listening on port ${PORT}`);
  const nets = require('os').networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const n of list || []) {
      if (n.family === 'IPv4' && !n.internal) console.log(`  On your Wi-Fi, use: http://${n.address}:${PORT}`);
    }
  }
});

module.exports = { server, rooms };

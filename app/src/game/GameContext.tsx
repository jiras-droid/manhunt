import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

import type { Ack, GameSettings, Position, Profile, RoomState, TagRequest } from '../types';
import { clearSession, loadIdentity, loadServerUrl, loadSession, saveSession, type Identity } from '../storage';
import { startBackgroundTracking, stopBackgroundTracking } from '../location';
import { getPushToken, notifyIfBackground } from '../notifications';

export type Toast = { id: number; kind: 'info' | 'warn' | 'ok'; message: string };
export type MyLocation = { lat: number; lng: number; accuracy: number | null };

type GameApi = {
  room: RoomState | null;
  me: Identity | null;
  positions: Position[];
  myLocation: MyLocation | null;
  connected: boolean;
  serverUrl: string;
  clockOffset: number; // serverTime - Date.now()
  toasts: Toast[];
  tagRequests: TagRequest[];
  resuming: boolean;
  setServerUrl: (url: string) => void;
  createRoom: (settings: GameSettings, area: [number, number][]) => Promise<Ack<{ code: string }>>;
  joinRoom: (code: string) => Promise<Ack<{ code: string }>>;
  startGame: (opts: { random: boolean; seekerIds?: string[] }) => Promise<Ack>;
  reportTagged: (seekerId?: string) => Promise<Ack<{ pending?: boolean }>>;
  confirmTag: (tagId: string, yes: boolean) => Promise<Ack>;
  leaveRoom: () => Promise<void>;
  exitFinishedGame: () => Promise<void>;
  dismissToast: (id: number) => void;
};

const GameContext = createContext<GameApi | null>(null);

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}

export function GameProvider({ profile, serverUrl, onServerUrl, children }: { profile: Profile; serverUrl: string; onServerUrl: (url: string) => void; children: React.ReactNode }) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [me, setMe] = useState<Identity | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [myLocation, setMyLocation] = useState<MyLocation | null>(null);
  const [connected, setConnected] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tagRequests, setTagRequests] = useState<TagRequest[]>([]);
  const [resuming, setResuming] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const codeRef = useRef<string | null>(null);
  const pushTokenRef = useRef<string | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const toast = useCallback((kind: Toast['kind'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const playerPayload = useCallback(
    (id: Identity) => ({ id: id.id, secret: id.secret, name: profileRef.current.name, avatar: profileRef.current.avatar, pushToken: pushTokenRef.current }),
    [],
  );

  const emit = useCallback(<T,>(event: string, data?: unknown): Promise<Ack<T>> => {
    const s = socketRef.current;
    if (!s || !s.connected) return Promise.resolve({ ok: false, error: "Can't reach the game server. Check the server address and your internet." });
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, error: 'The server took too long to answer.' }), 10000);
      s.emit(event, data, (res: Ack<T>) => {
        clearTimeout(timer);
        resolve(res);
      });
    });
  }, []);

  // ---- socket connection ------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await loadIdentity();
      pushTokenRef.current = await getPushToken();
      if (cancelled) return;
      setMe(id);
      const socket = io(serverUrl, { transports: ['websocket'], reconnection: true, reconnectionDelayMax: 5000 });
      socketRef.current = socket;

      socket.on('connect', async () => {
        setConnected(true);
        // rejoin the game we were in (after a reconnect or an app restart)
        const session = await loadSession();
        const code = codeRef.current || (session && session.serverUrl === serverUrl ? session.code : null);
        if (code) {
          socket.emit('joinRoom', { code, player: playerPayload(id) }, (res: Ack<{ room: RoomState }>) => {
            if (res.ok) {
              codeRef.current = code;
              setRoom(res.room);
            } else {
              codeRef.current = null;
              setRoom(null);
              clearSession();
              stopBackgroundTracking();
            }
            setResuming(false);
          });
        } else setResuming(false);
      });
      socket.on('connect_error', () => setResuming(false));
      socket.on('disconnect', () => setConnected(false));
      socket.on('room', (state: RoomState) => {
        setRoom(state);
        setClockOffset(state.serverTime - Date.now());
        setTagRequests(state.pendingTagsForMe || []);
      });
      socket.on('positions', (p: { players: Position[] }) => setPositions(p.players));
      socket.on('toast', (t: { kind: Toast['kind']; message: string }) => {
        toast(t.kind, t.message);
        if (t.kind === 'warn') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      });
      socket.on('tagRequest', (req: TagRequest) => {
        setTagRequests((list) => (list.some((r) => r.tagId === req.tagId) ? list : [...list, req]));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        if (!pushTokenRef.current) notifyIfBackground('Did you tag them?', `${req.hiderName} says you tagged them. Open Manhunt to confirm.`);
      });
      socket.on('tagResult', (r: { accepted: boolean; message: string }) => {
        toast(r.accepted ? 'ok' : 'warn', r.message);
        if (!pushTokenRef.current) notifyIfBackground('Manhunt', r.message);
      });
    })();
    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [serverUrl, playerPayload, toast]);

  // ---- location while in a game ----------------------------------------
  const inGame = room && room.state !== 'ended';
  const live = room?.settings.pingMode === 'live';
  useEffect(() => {
    if (!inGame) return;
    let sub: Location.LocationSubscription | null = null;
    let stopped = false;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted' || stopped) return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: live ? 2000 : 5000, distanceInterval: 2 },
        (loc) => {
          const fix = { lat: loc.coords.latitude, lng: loc.coords.longitude, accuracy: loc.coords.accuracy ?? null };
          setMyLocation(fix);
          socketRef.current?.emit('location', { ...fix, at: loc.timestamp }, () => {});
        },
      );
      if (stopped) sub.remove();
    })();
    return () => {
      stopped = true;
      sub?.remove();
    };
  }, [inGame, live]);

  // Background tracking once the game has started.
  const running = room?.state === 'headstart' || room?.state === 'playing';
  useEffect(() => {
    if (running) startBackgroundTracking(!!live);
    else stopBackgroundTracking();
  }, [running, live]);

  // ---- actions -----------------------------------------------------------
  const enterRoom = useCallback(
    async (code: string, state: RoomState) => {
      if (!me) return;
      codeRef.current = code;
      setRoom(state);
      setTagRequests([]);
      setPositions([]);
      await saveSession({ code, serverUrl, playerId: me.id, secret: me.secret });
    },
    [me, serverUrl],
  );

  const createRoom = useCallback<GameApi['createRoom']>(
    async (settings, area) => {
      if (!me) return { ok: false, error: 'Still starting up, try again.' };
      const res = await emit<{ code: string; room: RoomState }>('createRoom', { player: playerPayload(me), settings, area });
      if (res.ok) await enterRoom(res.code, res.room);
      return res;
    },
    [me, emit, playerPayload, enterRoom],
  );

  const joinRoom = useCallback<GameApi['joinRoom']>(
    async (code) => {
      if (!me) return { ok: false, error: 'Still starting up, try again.' };
      const res = await emit<{ code: string; room: RoomState }>('joinRoom', { code: code.trim().toUpperCase(), player: playerPayload(me) });
      if (res.ok) await enterRoom(res.code, res.room);
      return res;
    },
    [me, emit, playerPayload, enterRoom],
  );

  const startGame = useCallback<GameApi['startGame']>((opts) => emit('startGame', opts), [emit]);
  const reportTagged = useCallback<GameApi['reportTagged']>((seekerId) => emit('reportTagged', { seekerId }), [emit]);
  const confirmTag = useCallback<GameApi['confirmTag']>(
    async (tagId, yes) => {
      setTagRequests((list) => list.filter((r) => r.tagId !== tagId));
      return emit('confirmTag', { tagId, yes });
    },
    [emit],
  );

  const resetLocal = useCallback(async () => {
    codeRef.current = null;
    setRoom(null);
    setPositions([]);
    setTagRequests([]);
    await clearSession();
    await stopBackgroundTracking();
  }, []);

  const leaveRoom = useCallback(async () => {
    await emit('leaveRoom');
    await resetLocal();
  }, [emit, resetLocal]);

  const exitFinishedGame = useCallback(async () => {
    socketRef.current?.emit('leaveRoom', {}, () => {});
    await resetLocal();
  }, [resetLocal]);

  const value = useMemo<GameApi>(
    () => ({
      room,
      me,
      positions,
      myLocation,
      connected,
      serverUrl,
      clockOffset,
      toasts,
      tagRequests,
      resuming,
      setServerUrl: onServerUrl,
      createRoom,
      joinRoom,
      startGame,
      reportTagged,
      confirmTag,
      leaveRoom,
      exitFinishedGame,
      dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    }),
    [room, me, positions, myLocation, connected, serverUrl, clockOffset, toasts, tagRequests, resuming, onServerUrl, createRoom, joinRoom, startGame, reportTagged, confirmTag, leaveRoom, exitFinishedGame],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// Server-synced "now", ticking once a second.
export function useNow() {
  const { clockOffset } = useGame();
  const [now, setNow] = useState(Date.now() + clockOffset);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + clockOffset), 500);
    return () => clearInterval(t);
  }, [clockOffset]);
  return now;
}

export function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`;
}

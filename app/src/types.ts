// photo is a small JPEG data URI; when set it replaces the emoji face
export type Avatar = { emoji: string; color: string; accessory: string; photo?: string };

export type Profile = { name: string; avatar: Avatar };

export type GameMode = 'elimination' | 'infection' | 'swap';

export type GameSettings = {
  pingMode: 'live' | 'interval';
  pingIntervalSec: number;
  outOfBoundsSec: number;
  gameMode: GameMode;
  swapFreezeSec: number;
  maxGameMin: number;
  headStartSec: number;
};

export const DEFAULT_SETTINGS: GameSettings = {
  pingMode: 'interval',
  pingIntervalSec: 60,
  outOfBoundsSec: 30,
  gameMode: 'elimination',
  swapFreezeSec: 60,
  maxGameMin: 30,
  headStartSec: 180,
};

export type Role = 'none' | 'hider' | 'seeker' | 'out';

export type PlayerInfo = {
  id: string;
  name: string;
  avatar: Avatar;
  role: Role;
  connected: boolean;
  left: boolean;
  frozenUntil: number | null;
  outOfBoundsSince: number | null;
  tags: number;
  outReason: string | null;
};

export type TagRequest = { tagId: string; hiderId: string; hiderName: string; hiderAvatar: Avatar };

export type RoomState = {
  code: string;
  hostId: string;
  settings: GameSettings;
  area: [number, number][];
  state: 'lobby' | 'headstart' | 'playing' | 'ended';
  startedAt: number | null;
  headStartEndsAt: number | null;
  endsAt: number | null;
  lastPingAt: number | null;
  result: { title: string; winnerIds: string[]; reason: string } | null;
  events: { at: number; text: string }[];
  serverTime: number;
  players: PlayerInfo[];
  pendingTagsForMe: TagRequest[];
  myPendingTag: { id: string; seekerId: string } | null;
};

export type Position = { id: string; lat: number; lng: number; at: number; kind: 'live' | 'ping' };

export type Ack<T = {}> = ({ ok: true } & T) | { ok: false; error?: string };

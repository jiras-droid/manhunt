import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import type { Profile } from './types';

const KEYS = {
  profile: 'manhunt.profile',
  identity: 'manhunt.identity',
  serverUrl: 'manhunt.serverUrl',
  session: 'manhunt.session',
  permissionsAsked: 'manhunt.permissionsAsked',
};

// Everything the background location task needs to report without the UI running.
export type Session = { code: string; serverUrl: string; playerId: string; secret: string };
export type Identity = { id: string; secret: string };

async function getJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

const setJson = (key: string, value: unknown) => AsyncStorage.setItem(key, JSON.stringify(value));

function randomId(len = 24) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export const loadProfile = () => getJson<Profile>(KEYS.profile);
export const saveProfile = (p: Profile) => setJson(KEYS.profile, p);

export async function loadIdentity(): Promise<Identity> {
  const existing = await getJson<Identity>(KEYS.identity);
  if (existing) return existing;
  const fresh = { id: randomId(16), secret: randomId(32) };
  await setJson(KEYS.identity, fresh);
  return fresh;
}

export async function loadServerUrl(): Promise<string> {
  const saved = await AsyncStorage.getItem(KEYS.serverUrl);
  return saved || (Constants.expoConfig?.extra?.serverUrl as string) || 'http://192.168.1.100:3000';
}
export const saveServerUrl = (url: string) => AsyncStorage.setItem(KEYS.serverUrl, url.trim().replace(/\/+$/, ''));

export const loadSession = () => getJson<Session>(KEYS.session);
export const saveSession = (s: Session) => setJson(KEYS.session, s);
export const clearSession = () => AsyncStorage.removeItem(KEYS.session);

export const permissionsAsked = async () => (await AsyncStorage.getItem(KEYS.permissionsAsked)) === '1';
export const markPermissionsAsked = () => AsyncStorage.setItem(KEYS.permissionsAsked, '1');

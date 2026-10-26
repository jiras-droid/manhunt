import { AppState, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';

type NotificationsModule = typeof import('expo-notifications');

// Expo Go (Android) doesn't ship all of expo-notifications' native modules,
// so importing it there crashes the app. Load it only in real builds.
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient || Constants.appOwnership === 'expo';
let cached: NotificationsModule | null | undefined;

function notifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  if (inExpoGo) return (cached = null);
  try {
    cached = require('expo-notifications') as NotificationsModule;
    cached.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    cached = null;
  }
  return cached;
}

export async function setupNotificationChannel() {
  const N = notifications();
  if (N && Platform.OS === 'android') {
    await N.setNotificationChannelAsync('game', {
      name: 'Game alerts',
      importance: N.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300],
      lightColor: '#FFFFFF',
    });
  }
}

export async function requestNotificationPermission() {
  const N = notifications();
  if (!N) return false;
  await setupNotificationChannel();
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;
  const res = await N.requestPermissionsAsync();
  return res.granted;
}

// Push token so the server can reach this phone when the app is closed.
// Needs a real build with an EAS project id; returns null otherwise.
export async function getPushToken(): Promise<string | null> {
  const N = notifications();
  try {
    if (!N || !Device.isDevice) return null;
    const perm = await N.getPermissionsAsync();
    if (!perm.granted) return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;
    const token = await N.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch {
    return null;
  }
}

// Shows a notification right away, but only if the app isn't on screen.
export async function notifyIfBackground(title: string, body: string) {
  const N = notifications();
  if (!N || AppState.currentState === 'active') return;
  try {
    await N.scheduleNotificationAsync({ content: { title, body, sound: 'default' }, trigger: null });
  } catch {
    // notifications not allowed
  }
}

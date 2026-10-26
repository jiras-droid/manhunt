import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotificationChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('game', {
      name: 'Game alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300],
      lightColor: '#FFFFFF',
    });
  }
}

export async function requestNotificationPermission() {
  await setupNotificationChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

// Push token so the server can reach this phone when the app is closed.
// Needs a development/production build with an EAS project id; returns null otherwise.
export async function getPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch {
    return null;
  }
}

// Shows a notification right away, but only if the app isn't on screen.
export async function notifyIfBackground(title: string, body: string) {
  if (AppState.currentState === 'active') return;
  try {
    await Notifications.scheduleNotificationAsync({ content: { title, body, sound: 'default' }, trigger: null });
  } catch {
    // notifications not allowed
  }
}

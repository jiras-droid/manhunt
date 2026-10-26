import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { loadSession } from './storage';
import { createLocationFilter } from './locationFilter';

export const LOCATION_TASK = 'manhunt-background-location';
const filter = createLocationFilter();

// Runs even when the app is in the background: posts the newest fix to the server.
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  let fix = null;
  for (const loc of locations || []) {
    fix = filter({ lat: loc.coords.latitude, lng: loc.coords.longitude, accuracy: loc.coords.accuracy ?? null, at: loc.timestamp }) ?? fix;
  }
  if (!fix) return;
  const session = await loadSession();
  if (!session) return;
  try {
    const res = await fetch(`${session.serverUrl}/api/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: session.code,
        playerId: session.playerId,
        secret: session.secret,
        lat: fix.lat,
        lng: fix.lng,
        accuracy: fix.accuracy,
        at: fix.at,
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.state === 'ended') await stopBackgroundTracking();
  } catch {
    // offline for a moment; the next fix will try again
  }
});

export async function requestLocationPermissions() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { foreground: false, background: false };
  let background = false;
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    background = bg.status === 'granted';
  } catch {
    background = false;
  }
  return { foreground: true, background };
}

export async function startBackgroundTracking(live: boolean) {
  try {
    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== 'granted') return false;
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: live ? 3000 : 10000,
      distanceInterval: live ? 3 : 10,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Manhunt is running',
        notificationBody: 'Your location is shared with the game until it ends.',
        notificationColor: '#000000',
      },
    });
    return true;
  } catch (e) {
    // Expo Go can't run background location; the foreground watcher still works.
    console.warn('Background location unavailable:', e);
    return false;
  }
}

export async function stopBackgroundTracking() {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    // not running
  }
}

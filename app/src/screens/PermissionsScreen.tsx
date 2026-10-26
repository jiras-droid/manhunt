import React, { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera } from 'expo-camera';

import { BlackButton } from '../components/ui';
import { requestLocationPermissions } from '../location';
import { requestNotificationPermission } from '../notifications';

type Result = { camera: boolean; location: boolean; background: boolean; notifications: boolean };

export function PermissionsScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const askAll = async () => {
    setBusy(true);
    const camera = (await Camera.requestCameraPermissionsAsync()).granted;
    const loc = await requestLocationPermissions();
    const notifications = await requestNotificationPermission();
    setResult({ camera, location: loc.foreground, background: loc.background, notifications });
    setBusy(false);
  };

  const row = (ok: boolean | undefined, title: string, why: string) => (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{ok === undefined ? '•' : ok ? '✅' : '⚠️'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowWhy}>{why}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>Before you play</Text>
      <Text style={styles.sub}>Manhunt needs a few permissions to work properly.</Text>
      <View style={styles.card}>
        {row(result?.camera, 'Camera', 'Shows your camera behind the menu. Optional.')}
        {row(result?.location, 'Location', 'Puts you on the map and checks you stay in the play area.')}
        {row(result?.background, 'Location "Allow all the time"', 'Keeps the game running when your phone is locked or in your pocket.')}
        {row(result?.notifications, 'Notifications', 'Tells you when someone says you tagged them, and when the game starts or ends.')}
      </View>
      {result && (!result.location || !result.background) ? (
        <Text style={styles.warn}>
          Location set to "Allow all the time" is needed so the game keeps tracking you in the background. You can change it in Settings.
        </Text>
      ) : null}
      <View style={{ flex: 1 }} />
      {!result ? (
        <BlackButton title="Allow permissions" loading={busy} onPress={askAll} />
      ) : (
        <>
          {!result.background || !result.location ? <BlackButton title="Open Settings" small onPress={() => Linking.openSettings()} style={{ marginBottom: 12 }} /> : null}
          <BlackButton title="Continue" onPress={onDone} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ADD8E6', paddingHorizontal: 20 },
  title: { fontSize: 30, fontWeight: '900', color: '#000' },
  sub: { fontSize: 16, color: '#222', marginTop: 6, marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, gap: 14 },
  row: { flexDirection: 'row', gap: 12 },
  rowIcon: { fontSize: 20, width: 26, textAlign: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '800', color: '#000' },
  rowWhy: { fontSize: 14, color: '#555', marginTop: 2 },
  warn: { marginTop: 16, color: '#7a1d1d', fontWeight: '600' },
});

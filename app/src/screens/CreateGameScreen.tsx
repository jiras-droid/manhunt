import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { GameMap, type GameMapHandle } from '../map/GameMap';
import { BlackButton, IconButton, NumberField, Section, Segmented } from '../components/ui';
import { useGame } from '../game/GameContext';
import { DEFAULT_SETTINGS, type GameMode, type GameSettings } from '../types';

const MODES: { value: GameMode; title: string; text: string }[] = [
  { value: 'elimination', title: 'Last man standing', text: 'Tagged hiders are out and stop playing. Last hider left wins.' },
  { value: 'infection', title: 'Last man standing (infection)', text: 'Tagged hiders become seekers too. Last hider left wins.' },
  { value: 'swap', title: 'Swap', text: 'When a seeker tags a hider they switch roles. The new seeker is frozen for a moment. Whoever is hiding when time runs out wins.' },
];

export function CreateGameScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { createRoom } = useGame();
  const map = useRef<GameMapHandle>(null);
  const [area, setArea] = useState<[number, number][] | null>(null);
  const [drawMode, setDrawMode] = useState(true);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [s, setS] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [creating, setCreating] = useState(false);
  const set = <K extends keyof GameSettings>(k: K, v: GameSettings[K]) => setS((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const last = await Location.getLastKnownPositionAsync();
      if (last) setMe({ lat: last.coords.latitude, lng: last.coords.longitude });
      const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMe({ lat: cur.coords.latitude, lng: cur.coords.longitude });
    })().catch(() => {});
  }, []);

  const create = async () => {
    if (!area) return Alert.alert('Draw the play area', 'Use your finger to draw around the area you want to play in.');
    setCreating(true);
    const res = await createRoom(s, area);
    setCreating(false);
    if (!res.ok) Alert.alert("Couldn't create the lobby", res.error || 'Try again.');
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.mapWrap}>
        <GameMap
          ref={map}
          area={area}
          drawMode={drawMode}
          me={me}
          initialCenter={me}
          onAreaDrawn={(a) => {
            setArea(a);
            setDrawMode(false);
          }}
          onDrawTooSmall={() => Alert.alert('Too small', 'Draw a bigger loop around the play area.')}
        />
        <View style={[styles.mapTop, { top: insets.top + 10 }]}>
          <IconButton icon="←" label="Back" onPress={onBack} />
          <View style={styles.hint}>
            <Text style={styles.hintText}>{drawMode ? '✏️ Draw around the play area with your finger' : area ? '✅ Area set. Move the map or redraw.' : '🖐️ Move the map, then tap Draw'}</Text>
          </View>
        </View>
        <View style={styles.mapTools}>
          <Pressable style={[styles.tool, drawMode && styles.toolOn]} onPress={() => setDrawMode((d) => !d)}>
            <Text style={[styles.toolText, drawMode && styles.toolTextOn]}>{drawMode ? '🖐️ Move map' : '✏️ Draw'}</Text>
          </Pressable>
          {area ? (
            <Pressable style={styles.tool} onPress={() => setArea(null)}>
              <Text style={styles.toolText}>🗑️ Clear</Text>
            </Pressable>
          ) : null}
          {me ? (
            <Pressable style={styles.tool} onPress={() => map.current?.center(me.lat, me.lng, 16)}>
              <Text style={styles.toolText}>📍 Me</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView style={styles.settings} contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Game settings</Text>

        <Section title="Game mode">
          {MODES.map((m) => (
            <Pressable key={m.value} onPress={() => set('gameMode', m.value)} style={[styles.mode, s.gameMode === m.value && styles.modeOn]}>
              <Text style={[styles.modeTitle, s.gameMode === m.value && styles.modeTextOn]}>{m.title}</Text>
              <Text style={[styles.modeText, s.gameMode === m.value && styles.modeTextOn]}>{m.text}</Text>
            </Pressable>
          ))}
        </Section>

        {s.gameMode === 'swap' ? (
          <Section title="Freeze after being tagged" hint="How long a hider who just became a seeker can't move.">
            <NumberField value={s.swapFreezeSec} onChange={(v) => set('swapFreezeSec', v)} unit="sec" step={10} max={3600} />
          </Section>
        ) : null}

        <Section title="Hider location pings" hint="How often seekers see where the hiders are.">
          <Segmented
            options={[
              { value: 'live', label: 'Live' },
              { value: 'interval', label: 'Custom time' },
            ]}
            value={s.pingMode}
            onChange={(v) => set('pingMode', v)}
          />
          {s.pingMode === 'interval' ? (
            <View style={{ marginTop: 12 }}>
              <NumberField value={s.pingIntervalSec} onChange={(v) => set('pingIntervalSec', v)} unit="sec" min={5} max={3600} step={15} />
              <View style={styles.chips}>
                {[30, 60, 120, 300].map((v) => (
                  <Pressable key={v} onPress={() => set('pingIntervalSec', v)} style={[styles.chip, s.pingIntervalSec === v && styles.chipOn]}>
                    <Text style={[styles.chipText, s.pingIntervalSec === v && styles.chipTextOn]}>{v < 60 ? `${v}s` : `${v / 60} min`}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </Section>

        <Section title="Out of bounds limit" hint="How long someone can be outside the area before they lose.">
          <NumberField value={s.outOfBoundsSec} onChange={(v) => set('outOfBoundsSec', v)} unit="sec" step={5} max={3600} />
        </Section>

        <Section title="Seekers wait (head start)" hint="Seekers must not move while the hiders hide.">
          <NumberField value={Math.round(s.headStartSec / 60)} onChange={(v) => set('headStartSec', Math.round(v * 60))} unit="min" max={60} />
        </Section>

        <Section title="Max game time" hint={s.gameMode === 'swap' ? 'Swap games end when time runs out.' : '0 means no time limit.'}>
          <NumberField value={s.maxGameMin} onChange={(v) => set('maxGameMin', v)} unit="min" min={s.gameMode === 'swap' ? 1 : 0} step={5} max={600} />
        </Section>
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <BlackButton title="Create Lobby" loading={creating} disabled={!area} onPress={create} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F2' },
  mapWrap: { height: '50%', backgroundColor: '#ECE9E1' },
  mapTop: { position: 'absolute', left: 12, right: 64, flexDirection: 'row', alignItems: 'center', gap: 10 },
  hint: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  hintText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  mapTools: { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', gap: 8 },
  tool: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 2, borderColor: '#000', elevation: 4 },
  toolOn: { backgroundColor: '#000' },
  toolText: { fontWeight: '800', color: '#000' },
  toolTextOn: { color: '#fff' },
  settings: { flex: 1 },
  heading: { fontSize: 24, fontWeight: '900', marginBottom: 12, color: '#000' },
  mode: { borderRadius: 14, borderWidth: 2, borderColor: '#DDD', padding: 12, marginBottom: 8 },
  modeOn: { backgroundColor: '#000', borderColor: '#3A3A3A' },
  modeTitle: { fontWeight: '800', fontSize: 16, color: '#000' },
  modeText: { color: '#555', marginTop: 2 },
  modeTextOn: { color: '#fff' },
  chips: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: '#EEE' },
  chipOn: { backgroundColor: '#000' },
  chipText: { fontWeight: '700', color: '#333' },
  chipTextOn: { color: '#fff' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(242,242,242,0.95)' },
});

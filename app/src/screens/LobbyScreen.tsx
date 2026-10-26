import React, { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { AvatarView } from '../components/AvatarView';
import { BlackButton } from '../components/ui';
import { LeaveButton } from '../components/LeaveButton';
import { GameMap } from '../map/GameMap';
import { useGame } from '../game/GameContext';
import type { RoomState } from '../types';

const MODE_NAMES = { elimination: 'Last man standing', infection: 'Infection', swap: 'Swap' } as const;

export function settingsSummary(r: RoomState) {
  const s = r.settings;
  return [
    MODE_NAMES[s.gameMode],
    s.pingMode === 'live' ? 'Live pings' : `Ping every ${s.pingIntervalSec >= 60 && s.pingIntervalSec % 60 === 0 ? `${s.pingIntervalSec / 60} min` : `${s.pingIntervalSec}s`}`,
    `${Math.round(s.headStartSec / 60)} min head start`,
    s.maxGameMin ? `${s.maxGameMin} min max` : 'No time limit',
    `${s.outOfBoundsSec}s out of bounds`,
    ...(s.gameMode === 'swap' ? [`${s.swapFreezeSec}s freeze`] : []),
  ];
}

export function LobbyScreen() {
  const insets = useSafeAreaInsets();
  const { room, me, startGame, leaveRoom, connected } = useGame();
  const [copied, setCopied] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  if (!room || !me) return null;

  const players = room.players.filter((p) => !p.left);
  const isHost = room.hostId === me.id;

  const copy = async () => {
    await Clipboard.setStringAsync(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const start = async (opts: { random: boolean; seekerIds?: string[] }) => {
    setStarting(true);
    const res = await startGame(opts);
    setStarting(false);
    if (!res.ok) Alert.alert("Couldn't start", res.error || 'Try again.');
    else setPickOpen(false);
  };

  const confirmStart = () => {
    if (players.length < 2) return Alert.alert('Not enough players', 'You need at least 2 players to start.');
    Alert.alert('Start the game?', `${players.length} players are in the lobby. Nobody else can join once it starts.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start',
        onPress: () => {
          setPicked(new Set());
          setPickOpen(true);
        },
      },
    ]);
  };

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Lobby</Text>
        <LeaveButton onLeave={leaveRoom} />
      </View>

      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>Lobby code</Text>
        <Text style={styles.code} selectable>
          {room.code}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <BlackButton title={copied ? 'Copied!' : 'Copy code'} small onPress={copy} style={{ flex: 1 }} />
          <BlackButton title="Share" small onPress={() => Share.share({ message: `Join my Manhunt game! Code: ${room.code}` })} style={{ flex: 1 }} />
        </View>
      </View>

      <View style={styles.infoRow}>
        <View style={styles.mapThumb}>
          <GameMap area={room.area} fitToArea interactive={false} showMask />
        </View>
        <View style={styles.chips}>
          {settingsSummary(room).map((t) => (
            <Text key={t} style={styles.chip}>
              {t}
            </Text>
          ))}
        </View>
      </View>

      <Text style={styles.playersTitle}>
        Players ({players.length}) {connected ? '' : '· reconnecting…'}
      </Text>
      <FlatList
        data={players}
        keyExtractor={(p) => p.id}
        numColumns={3}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 120 }}
        renderItem={({ item }) => (
          <View style={styles.player}>
            <AvatarView avatar={item.avatar} size={64} />
            <Text style={styles.playerName} numberOfLines={1}>
              {item.id === room.hostId ? '👑 ' : ''}
              {item.name}
              {item.id === me.id ? ' (you)' : ''}
            </Text>
            {!item.connected ? <Text style={styles.away}>away</Text> : null}
          </View>
        )}
      />

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        {isHost ? <BlackButton title="Start" onPress={confirmStart} /> : <Text style={styles.waiting}>Waiting for the host to start…</Text>}
      </View>

      <Modal visible={pickOpen} animationType="slide" transparent onRequestClose={() => setPickOpen(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.sheetTitle}>Who are the seekers?</Text>
            <BlackButton title="🎲 Random seekers" loading={starting} onPress={() => start({ random: true })} />
            <Text style={styles.sheetHint}>Random picks about 20–25% of players (at least 1).</Text>
            <Text style={[styles.sheetTitle, { fontSize: 17, marginTop: 16 }]}>…or pick them yourself</Text>
            <FlatList
              style={{ maxHeight: 280 }}
              data={players}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <Pressable onPress={() => toggle(item.id)} style={[styles.pickRow, picked.has(item.id) && styles.pickRowOn]}>
                  <AvatarView avatar={item.avatar} size={40} />
                  <Text style={[styles.pickName, picked.has(item.id) && { color: '#fff' }]}>{item.name}</Text>
                  <Text style={styles.pickMark}>{picked.has(item.id) ? '🔴 Seeker' : '🟢 Hider'}</Text>
                </Pressable>
              )}
            />
            <BlackButton
              title={`Start with ${picked.size} seeker${picked.size === 1 ? '' : 's'}`}
              disabled={picked.size < 1 || picked.size >= players.length}
              loading={starting}
              onPress={() => start({ random: false, seekerIds: [...picked] })}
              style={{ marginTop: 12 }}
            />
            <Pressable onPress={() => setPickOpen(false)} style={{ alignItems: 'center', padding: 12 }}>
              <Text style={{ fontWeight: '700', color: '#555' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ADD8E6' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  title: { fontSize: 30, fontWeight: '900', color: '#000' },
  codeCard: { margin: 16, marginBottom: 10, backgroundColor: '#fff', borderRadius: 20, padding: 16, alignItems: 'stretch' },
  codeLabel: { textAlign: 'center', fontWeight: '700', color: '#555' },
  code: { textAlign: 'center', fontSize: 46, fontWeight: '900', letterSpacing: 10, color: '#000', marginVertical: 6 },
  infoRow: { flexDirection: 'row', marginHorizontal: 16, gap: 10, marginBottom: 6 },
  mapThumb: { width: 110, height: 110, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: '#000' },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignContent: 'flex-start' },
  chip: { backgroundColor: '#000', color: '#fff', fontWeight: '700', fontSize: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' },
  playersTitle: { fontSize: 18, fontWeight: '900', marginHorizontal: 16, marginTop: 10, marginBottom: 6, color: '#000' },
  player: { flex: 1 / 3, alignItems: 'center', paddingVertical: 10 },
  playerName: { marginTop: 6, fontWeight: '800', color: '#000', maxWidth: 110 },
  away: { fontSize: 11, color: '#555' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12 },
  waiting: { textAlign: 'center', fontWeight: '800', fontSize: 16, color: '#000', backgroundColor: 'rgba(255,255,255,0.8)', padding: 16, borderRadius: 16, overflow: 'hidden' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  sheetTitle: { fontSize: 22, fontWeight: '900', marginBottom: 12, color: '#000' },
  sheetHint: { color: '#666', marginTop: 8, textAlign: 'center' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 14, marginBottom: 6, backgroundColor: '#F3F3F3' },
  pickRowOn: { backgroundColor: '#000' },
  pickName: { flex: 1, fontWeight: '800', fontSize: 16, color: '#000' },
  pickMark: { fontWeight: '700', color: '#888' },
});

import React, { useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarView } from '../components/AvatarView';
import { BlackButton, IconButton } from '../components/ui';
import { LeaveButton } from '../components/LeaveButton';
import { GameMap, type GameMapHandle, type MapPin } from '../map/GameMap';
import { formatClock, useGame, useNow } from '../game/GameContext';

const ROLE_STYLE = {
  hider: { label: 'HIDER', color: '#2E7D32' },
  seeker: { label: 'SEEKER', color: '#C62828' },
  out: { label: 'OUT', color: '#555' },
  none: { label: '…', color: '#555' },
} as const;

export function GameScreen() {
  const insets = useSafeAreaInsets();
  const { room, me, positions, myLocation, reportTagged, confirmTag, tagRequests, leaveRoom, exitFinishedGame, connected } = useGame();
  const now = useNow();
  const map = useRef<GameMapHandle>(null);
  const [pickSeeker, setPickSeeker] = useState(false);
  const [sending, setSending] = useState(false);

  const players = room?.players ?? [];
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const pins = useMemo<MapPin[]>(
    () =>
      positions
        .map((pos): MapPin | null => {
          const p = byId.get(pos.id);
          if (!p) return null;
          return { id: p.id, lat: pos.lat, lng: pos.lng, emoji: p.avatar.emoji, color: p.avatar.color, photo: p.avatar.photo, role: p.role, kind: pos.kind, label: pos.kind === 'ping' ? `${p.name} 📡` : p.name };
        })
        .filter((x): x is MapPin => !!x),
    [positions, byId],
  );

  if (!room || !me) return null;
  const mine = byId.get(me.id);
  const role = mine?.role ?? 'none';
  const s = room.settings;
  const seekers = players.filter((p) => p.role === 'seeker' && !p.left);
  const hidersLeft = players.filter((p) => p.role === 'hider' && !p.left).length;

  const headStartLeft = room.state === 'headstart' && room.headStartEndsAt ? room.headStartEndsAt - now : 0;
  const timeLeft = room.endsAt ? room.endsAt - now : null;
  const frozenLeft = mine?.frozenUntil ? mine.frozenUntil - now : 0;
  const oobLeft = mine?.outOfBoundsSince ? mine.outOfBoundsSince + s.outOfBoundsSec * 1000 - now : null;
  const nextPing = s.pingMode === 'interval' && room.state === 'playing' && room.lastPingAt ? room.lastPingAt + s.pingIntervalSec * 1000 - now : null;
  const pendingSeeker = room.myPendingTag ? byId.get(room.myPendingTag.seekerId) : null;

  const send = async (seekerId?: string) => {
    setSending(true);
    const res = await reportTagged(seekerId);
    setSending(false);
    setPickSeeker(false);
    if (!res.ok) Alert.alert("Couldn't report the tag", res.error || 'Try again.');
  };

  const onTagged = () => {
    if (room.state !== 'playing') return Alert.alert('Not yet', 'Tagging starts after the head start.');
    Alert.alert('Were you tagged?', s.gameMode === 'elimination' ? "You'll be out of the game." : 'Next, pick the seeker who found you.', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: () => (s.gameMode === 'elimination' ? send() : setPickSeeker(true)) },
    ]);
  };

  const req = tagRequests[0];

  return (
    <View style={styles.root}>
      <GameMap ref={map} area={room.area} showMask fitToArea me={myLocation} pins={pins} />

      {/* top bar */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <View style={[styles.role, { backgroundColor: ROLE_STYLE[role].color }]}>
            <Text style={styles.roleText}>{ROLE_STYLE[role].label}</Text>
          </View>
          <LeaveButton onLeave={leaveRoom} />
          <View style={styles.stats}>
            {timeLeft !== null ? <Text style={styles.stat}>⏱ {formatClock(timeLeft)}</Text> : <Text style={styles.stat}>⏱ no limit</Text>}
            <Text style={styles.stat}>🙈 {hidersLeft} hiding</Text>
          </View>
        </View>
        {s.pingMode === 'live' && room.state === 'playing' ? <Text style={styles.sub}>📡 Hider locations are live</Text> : null}
        {nextPing !== null ? <Text style={styles.sub}>📡 Next ping in {formatClock(nextPing)}</Text> : null}
        {!connected ? <Text style={[styles.sub, { backgroundColor: '#C62828' }]}>Reconnecting to the server…</Text> : null}
      </View>

      {/* banners */}
      <View style={[styles.banners, { top: insets.top + 110 }]} pointerEvents="none">
        {room.state === 'headstart' && role === 'hider' ? <Text style={[styles.banner, { backgroundColor: '#2E7D32' }]}>Go hide! Seekers are released in {formatClock(headStartLeft)}</Text> : null}
        {oobLeft !== null && role !== 'out' ? <Text style={[styles.banner, { backgroundColor: '#C62828' }]}>⚠️ OUT OF BOUNDS. Get back in: {formatClock(oobLeft)}</Text> : null}
        {role === 'out' && room.state !== 'ended' ? <Text style={[styles.banner, { backgroundColor: '#333' }]}>You're out{mine?.outReason ? ` (${mine.outReason})` : ''}. You can watch everyone on the map.</Text> : null}
        {pendingSeeker ? <Text style={[styles.banner, { backgroundColor: '#000' }]}>Waiting for {pendingSeeker.name} to confirm the tag…</Text> : null}
      </View>

      {/* bottom actions */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]} pointerEvents="box-none">
        <View style={styles.mapBtns}>
          {myLocation ? <IconButton icon="📍" label="Center on me" onPress={() => map.current?.center(myLocation.lat, myLocation.lng, 17)} /> : null}
          <IconButton icon="🗺️" label="Show whole area" onPress={() => map.current?.fitArea()} />
        </View>
        {role === 'hider' && room.state !== 'ended' ? (
          <Pressable onPress={onTagged} disabled={!!pendingSeeker} style={({ pressed }) => [styles.tagged, pressed && { opacity: 0.85 }, pendingSeeker && { opacity: 0.5 }]}>
            <Text style={styles.taggedIcon}>✋</Text>
            <Text style={styles.taggedText}>Tagged</Text>
          </Pressable>
        ) : null}
      </View>

      {/* seekers stand still during the head start, tagged swappers while frozen */}
      {room.state === 'headstart' && role === 'seeker' ? (
        <View style={[styles.freeze, { top: insets.top + 64 }]}>
          <Text style={styles.freezeBig}>DON'T MOVE</Text>
          <Text style={styles.freezeText}>The hiders are hiding.</Text>
          <Text style={styles.freezeClock}>{formatClock(headStartLeft)}</Text>
        </View>
      ) : frozenLeft > 0 && room.state === 'playing' ? (
        <View style={[styles.freeze, { top: insets.top + 64 }]}>
          <Text style={styles.freezeBig}>FROZEN</Text>
          <Text style={styles.freezeText}>You're the seeker now. Don't move until the timer ends.</Text>
          <Text style={styles.freezeClock}>{formatClock(frozenLeft)}</Text>
        </View>
      ) : null}

      {/* hider picks who found them */}
      <Modal visible={pickSeeker} transparent animationType="slide" onRequestClose={() => setPickSeeker(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.sheetTitle}>Who found you?</Text>
            <FlatList
              style={{ maxHeight: 340 }}
              data={seekers}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <Pressable disabled={sending} onPress={() => send(item.id)} style={({ pressed }) => [styles.pickRow, pressed && { backgroundColor: '#ddd' }]}>
                  <AvatarView avatar={item.avatar} size={44} ring="#C62828" />
                  <Text style={styles.pickName}>{item.name}</Text>
                </Pressable>
              )}
            />
            <Pressable onPress={() => setPickSeeker(false)} style={{ alignItems: 'center', padding: 14 }}>
              <Text style={{ fontWeight: '700', color: '#555' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* seeker confirms a tag */}
      <Modal visible={!!req && role === 'seeker'} transparent animationType="fade">
        {req ? (
          <View style={styles.modalBg2}>
            <View style={styles.confirm}>
              <AvatarView avatar={req.hiderAvatar} size={90} />
              <Text style={styles.confirmTitle}>Did you tag {req.hiderName}?</Text>
              <Text style={styles.confirmText}>{s.gameMode === 'swap' ? 'If yes, you two switch roles.' : `If yes, ${req.hiderName} becomes a seeker.`}</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 18, alignSelf: 'stretch' }}>
                <BlackButton title="No" onPress={() => confirmTag(req.tagId, false)} style={{ flex: 1, backgroundColor: '#444' }} />
                <BlackButton title="Yes" onPress={() => confirmTag(req.tagId, true)} style={{ flex: 1 }} />
              </View>
            </View>
          </View>
        ) : null}
      </Modal>

      {/* game over */}
      <Modal visible={room.state === 'ended'} transparent animationType="fade">
        <View style={styles.modalBg2}>
          <View style={styles.confirm}>
            <Text style={{ fontSize: 56 }}>{room.result?.winnerIds.includes(me.id) ? '🏆' : '🏁'}</Text>
            <Text style={styles.confirmTitle}>{room.result?.title ?? 'Game over'}</Text>
            <Text style={styles.confirmText}>{room.result?.reason}</Text>
            <View style={styles.winners}>
              {players
                .filter((p) => room.result?.winnerIds.includes(p.id))
                .map((p) => (
                  <View key={p.id} style={{ alignItems: 'center', width: 70 }}>
                    <AvatarView avatar={p.avatar} size={48} />
                    <Text numberOfLines={1} style={{ fontWeight: '700', marginTop: 4 }}>
                      {p.name}
                    </Text>
                  </View>
                ))}
            </View>
            <BlackButton title="Back to menu" onPress={exitFinishedGame} style={{ alignSelf: 'stretch', marginTop: 16 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ECE9E1' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 12, gap: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  role: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(0,0,0,0.3)' },
  roleText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  stats: { backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  stat: { color: '#fff', fontWeight: '800', fontSize: 14 },
  sub: { alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.75)', color: '#fff', fontWeight: '700', fontSize: 13, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, overflow: 'hidden' },
  banners: { position: 'absolute', left: 12, right: 12, gap: 8 },
  banner: { color: '#fff', fontWeight: '800', fontSize: 15, padding: 12, borderRadius: 14, overflow: 'hidden', textAlign: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  mapBtns: { gap: 10 },
  tagged: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#000',
    borderColor: '#3A3A3A',
    borderWidth: 2,
    borderRadius: 40,
    paddingVertical: 18,
    paddingHorizontal: 28,
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  taggedIcon: { fontSize: 26 },
  taggedText: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  freeze: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  freezeBig: { color: '#FF5252', fontSize: 46, fontWeight: '900', letterSpacing: 2 },
  freezeText: { color: '#fff', fontSize: 18, marginTop: 8, textAlign: 'center' },
  freezeClock: { color: '#fff', fontSize: 72, fontWeight: '900', marginTop: 20, fontVariant: ['tabular-nums'] },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBg2: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  sheetTitle: { fontSize: 22, fontWeight: '900', marginBottom: 12, color: '#000' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, marginBottom: 6, backgroundColor: '#F3F3F3' },
  pickName: { flex: 1, fontWeight: '800', fontSize: 17, color: '#000' },
  confirm: { backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center' },
  confirmTitle: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginTop: 12, color: '#000' },
  confirmText: { fontSize: 15, color: '#555', textAlign: 'center', marginTop: 6 },
  winners: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 },
});

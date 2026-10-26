import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { AvatarView } from '../components/AvatarView';
import { BlackButton, IconButton } from '../components/ui';
import { useGame } from '../game/GameContext';
import type { Profile } from '../types';

export function HomeScreen({ profile, onCreateGame, onEditProfile }: { profile: Profile; onCreateGame: () => void; onEditProfile: () => void }) {
  const insets = useSafeAreaInsets();
  const [camPerm] = useCameraPermissions();
  const { joinRoom, connected, serverUrl, setServerUrl } = useGame();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [serverOpen, setServerOpen] = useState(false);
  const [serverDraft, setServerDraft] = useState(serverUrl);

  const join = async () => {
    setJoining(true);
    const res = await joinRoom(code);
    setJoining(false);
    if (!res.ok) Alert.alert("Couldn't join", res.error || 'Try again.');
  };

  return (
    <View style={styles.root}>
      {camPerm?.granted ? <CameraView style={StyleSheet.absoluteFill} facing={facing} /> : null}

      <KeyboardAvoidingView style={[styles.overlay, { paddingTop: insets.top + 24 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.logo}>MANHUNT</Text>
        <BlackButton title="Create Game" onPress={onCreateGame} style={styles.menuBtn} />
        <BlackButton title="Join Lobby" onPress={() => setJoinOpen((o) => !o)} style={styles.menuBtn} />

        {joinOpen ? (
          <View style={styles.joinBox}>
            <Text style={styles.joinLabel}>Enter the lobby code</Text>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="ABC123"
              placeholderTextColor="#777"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              autoFocus
              onSubmitEditing={join}
            />
            <BlackButton title="Join" small loading={joining} disabled={code.length < 6} onPress={join} />
          </View>
        ) : null}

        <View style={{ flex: 1 }} />

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={styles.profile} onPress={onEditProfile}>
            <AvatarView avatar={profile.avatar} size={44} />
            <View>
              <Text style={styles.profileName}>{profile.name}</Text>
              <Text style={styles.profileEdit}>Tap to edit</Text>
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {camPerm?.granted ? <IconButton icon="🔄" label="Flip camera" onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} /> : null}
            <IconButton
              icon="⚙️"
              label="Server settings"
              onPress={() => {
                setServerDraft(serverUrl);
                setServerOpen(true);
              }}
            />
          </View>
        </View>
        <View style={[styles.status, { top: insets.top + 6 }]}>
          <View style={[styles.dot, { backgroundColor: connected ? '#2ECC71' : '#E74C3C' }]} />
          <Text style={styles.statusText}>{connected ? 'Online' : 'Offline'}</Text>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={serverOpen} transparent animationType="fade" onRequestClose={() => setServerOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Game server</Text>
            <Text style={styles.modalHint}>Everyone in a game must use the same server address. The server window on the PC shows it.</Text>
            <TextInput style={styles.serverInput} value={serverDraft} onChangeText={setServerDraft} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="http://192.168.1.20:3000" />
            <Text style={styles.modalHint}>{connected ? '🟢 Connected to the current server' : '🔴 Not connected to the current server'}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <BlackButton title="Cancel" small onPress={() => setServerOpen(false)} style={{ flex: 1, backgroundColor: '#333' }} />
              <BlackButton
                title="Save"
                small
                onPress={() => {
                  setServerUrl(serverDraft.trim().replace(/\/+$/, ''));
                  setServerOpen(false);
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ADD8E6' },
  overlay: { flex: 1, paddingHorizontal: 24 },
  logo: { fontSize: 44, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: 4, marginBottom: 20, textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 3 } },
  menuBtn: { marginBottom: 16 },
  joinBox: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 18, padding: 16, gap: 12 },
  joinLabel: { fontWeight: '800', fontSize: 16, color: '#000' },
  codeInput: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', borderRadius: 12, fontSize: 30, fontWeight: '900', letterSpacing: 8, textAlign: 'center', paddingVertical: 10, color: '#000' },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.75)', paddingVertical: 8, paddingLeft: 8, paddingRight: 16, borderRadius: 30, borderWidth: 2, borderColor: '#3A3A3A' },
  profileName: { color: '#fff', fontWeight: '800', fontSize: 16 },
  profileEdit: { color: '#bbb', fontSize: 12 },
  status: { position: 'absolute', right: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#000' },
  modalHint: { color: '#555', marginTop: 8 },
  serverInput: { borderWidth: 2, borderColor: '#000', borderRadius: 12, padding: 12, fontSize: 16, marginTop: 12, color: '#000' },
});

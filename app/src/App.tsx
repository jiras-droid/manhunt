import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { GameProvider, useGame } from './game/GameContext';
import { Toasts } from './components/Toasts';
import { setupNotificationChannel } from './notifications';
import { loadProfile, loadServerUrl, markPermissionsAsked, permissionsAsked, saveProfile, saveServerUrl, cleanServerUrl } from './storage';
import type { Profile } from './types';
import { ProfileScreen } from './screens/ProfileScreen';
import { PermissionsScreen } from './screens/PermissionsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { CreateGameScreen } from './screens/CreateGameScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [needsPermissions, setNeedsPermissions] = useState(false);
  const [serverUrl, setServerUrl] = useState('');

  useEffect(() => {
    (async () => {
      setupNotificationChannel().catch(() => {});
      const [p, asked, url] = await Promise.all([loadProfile(), permissionsAsked(), loadServerUrl()]);
      setProfile(p);
      setNeedsPermissions(!asked);
      setServerUrl(url);
      setLoaded(true);
    })();
  }, []);

  const changeServer = useCallback((url: string) => {
    saveServerUrl(url);
    setServerUrl(cleanServerUrl(url));
  }, []);

  let content: React.ReactNode;
  if (!loaded) content = <Loading />;
  else if (!profile)
    content = (
      <ProfileScreen
        initial={null}
        onSave={async (p) => {
          await saveProfile(p);
          setProfile(p);
        }}
      />
    );
  else if (needsPermissions)
    content = (
      <PermissionsScreen
        onDone={async () => {
          await markPermissionsAsked();
          setNeedsPermissions(false);
        }}
      />
    );
  else
    content = (
      <GameProvider profile={profile} serverUrl={serverUrl} onServerUrl={changeServer}>
        <Main profile={profile} onProfile={setProfile} />
      </GameProvider>
    );

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {content}
    </SafeAreaProvider>
  );
}

function Main({ profile, onProfile }: { profile: Profile; onProfile: (p: Profile) => void }) {
  const { room, resuming } = useGame();
  const [screen, setScreen] = useState<'home' | 'create' | 'profile'>('home');

  // back to the menu whenever we leave a room
  useEffect(() => {
    if (!room) setScreen('home');
  }, [room]);

  let body: React.ReactNode;
  if (resuming) body = <Loading />;
  else if (room?.state === 'lobby') body = <LobbyScreen />;
  else if (room) body = <GameScreen />;
  else if (screen === 'create') body = <CreateGameScreen onBack={() => setScreen('home')} />;
  else if (screen === 'profile')
    body = (
      <ProfileScreen
        initial={profile}
        onCancel={() => setScreen('home')}
        onSave={async (p) => {
          await saveProfile(p);
          onProfile(p);
          setScreen('home');
        }}
      />
    );
  else body = <HomeScreen profile={profile} onCreateGame={() => setScreen('create')} onEditProfile={() => setScreen('profile')} />;

  return (
    <View style={{ flex: 1 }}>
      {body}
      <Toasts />
    </View>
  );
}

function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#000" />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#ADD8E6', alignItems: 'center', justifyContent: 'center' },
});

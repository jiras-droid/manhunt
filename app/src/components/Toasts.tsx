import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGame } from '../game/GameContext';

const COLORS = { info: '#111', warn: '#C62828', ok: '#2E7D32' } as const;

export function Toasts() {
  const { toasts, dismissToast } = useGame();
  const insets = useSafeAreaInsets();
  if (!toasts.length) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 64 }]}>
      {toasts.map((t) => (
        <Pressable key={t.id} onPress={() => dismissToast(t.id)} style={[styles.toast, { backgroundColor: COLORS[t.kind] }]}>
          <Text style={styles.text}>{t.message}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, gap: 8, zIndex: 50 },
  toast: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, elevation: 10 },
  text: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

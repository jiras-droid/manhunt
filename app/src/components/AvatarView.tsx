import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Avatar } from '../types';

export const AVATAR_EMOJIS = ['😎', '🦊', '🐺', '🐯', '🐸', '🐵', '🐼', '🦁', '🐶', '🐱', '👻', '🤖', '👽', '🥷', '🧟', '🦖', '🐙', '🦄', '😈', '🤠'];
export const AVATAR_COLORS = ['#E53935', '#FB8C00', '#FDD835', '#43A047', '#00ACC1', '#1E88E5', '#5E35B1', '#D81B60', '#6D4C41', '#212121'];
export const AVATAR_ACCESSORIES = ['', '👑', '🎩', '🧢', '🕶️', '🎧', '⭐', '🔥'];

export function randomAvatar(): Avatar {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  return { emoji: pick(AVATAR_EMOJIS), color: pick(AVATAR_COLORS), accessory: '' };
}

export function AvatarView({ avatar, size = 56, ring }: { avatar: Avatar; size?: number; ring?: string }) {
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: avatar.color, borderWidth: ring ? Math.max(2, size / 18) : 2, borderColor: ring || '#ffffff' },
        ]}
      >
        <Text style={{ fontSize: size * 0.52 }}>{avatar.emoji}</Text>
      </View>
      {avatar.accessory ? <Text style={[styles.accessory, { fontSize: size * 0.34, top: -size * 0.12, right: -size * 0.08 }]}>{avatar.accessory}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  accessory: { position: 'absolute' },
});

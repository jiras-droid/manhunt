import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AVATAR_ACCESSORIES, AVATAR_COLORS, AVATAR_EMOJIS, AvatarView, randomAvatar } from '../components/AvatarView';
import { BlackButton } from '../components/ui';
import type { Profile } from '../types';

export function ProfileScreen({ initial, onSave, onCancel }: { initial: Profile | null; onSave: (p: Profile) => void; onCancel?: () => void }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initial?.name ?? '');
  const [avatar, setAvatar] = useState(initial?.avatar ?? randomAvatar());
  const valid = name.trim().length >= 2;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{initial ? 'Edit your player' : 'Create your player'}</Text>
        <View style={styles.preview}>
          <AvatarView avatar={avatar} size={120} />
          <Text style={styles.previewName}>{name.trim() || 'Your name'}</Text>
        </View>

        <Text style={styles.label}>Username</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Pick a username" placeholderTextColor="#888" maxLength={20} autoCorrect={false} />

        <Text style={styles.label}>Face</Text>
        <View style={styles.grid}>
          {AVATAR_EMOJIS.map((e) => (
            <Pressable key={e} onPress={() => setAvatar({ ...avatar, emoji: e })} style={[styles.cell, avatar.emoji === e && styles.cellOn]}>
              <Text style={styles.cellEmoji}>{e}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Color</Text>
        <View style={styles.grid}>
          {AVATAR_COLORS.map((c) => (
            <Pressable key={c} onPress={() => setAvatar({ ...avatar, color: c })} style={[styles.swatch, { backgroundColor: c }, avatar.color === c && styles.swatchOn]} />
          ))}
        </View>

        <Text style={styles.label}>Extra</Text>
        <View style={styles.grid}>
          {AVATAR_ACCESSORIES.map((a) => (
            <Pressable key={a || 'none'} onPress={() => setAvatar({ ...avatar, accessory: a })} style={[styles.cell, avatar.accessory === a && styles.cellOn]}>
              <Text style={a ? styles.cellEmoji : styles.none}>{a || 'None'}</Text>
            </Pressable>
          ))}
        </View>

        <BlackButton title="Save" disabled={!valid} onPress={() => onSave({ name: name.trim(), avatar })} style={{ marginTop: 28 }} />
        {onCancel ? <BlackButton title="Cancel" small onPress={onCancel} style={{ marginTop: 12, backgroundColor: '#222' }} /> : null}
        {!valid ? <Text style={styles.help}>Your username needs at least 2 letters.</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ADD8E6' },
  content: { paddingHorizontal: 20 },
  title: { fontSize: 30, fontWeight: '900', color: '#000', textAlign: 'center' },
  preview: { alignItems: 'center', marginVertical: 20 },
  previewName: { marginTop: 10, fontSize: 22, fontWeight: '800', color: '#000' },
  label: { fontSize: 16, fontWeight: '800', marginTop: 18, marginBottom: 8, color: '#000' },
  input: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 2, borderColor: '#000', paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, fontWeight: '700', color: '#000' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  cellOn: { borderColor: '#000', backgroundColor: '#fff' },
  cellEmoji: { fontSize: 28 },
  none: { fontSize: 12, fontWeight: '700' },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: 'rgba(255,255,255,0.8)' },
  swatchOn: { borderColor: '#000', transform: [{ scale: 1.1 }] },
  help: { textAlign: 'center', marginTop: 10, color: '#333' },
});

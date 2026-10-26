import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

// The black menu button: black fill, lighter black outline and a drop shadow.
export function BlackButton({ title, onPress, disabled, loading, style, small }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>; small?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.black, small && styles.blackSmall, pressed && styles.pressed, (disabled || loading) && styles.disabled, style]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.blackText, small && styles.blackTextSmall]}>{title}</Text>}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, style, label }: { icon: string; onPress: () => void; style?: StyleProp<ViewStyle>; label: string }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} hitSlop={10} style={({ pressed }) => [styles.icon, pressed && styles.pressed, style]}>
      <Text style={styles.iconText}>{icon}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.seg}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segItem, value === o.value && styles.segItemOn]}>
          <Text style={[styles.segText, value === o.value && styles.segTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// Whole-number input with -/+ buttons.
export function NumberField({ value, onChange, unit, min = 0, max = 9999, step = 1 }: { value: number; onChange: (n: number) => void; unit: string; min?: number; max?: number; step?: number }) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, Math.round(n))));
  return (
    <View style={styles.num}>
      <Pressable style={styles.numBtn} onPress={() => set(value - step)}>
        <Text style={styles.numBtnText}>−</Text>
      </Pressable>
      <TextInput
        style={styles.numInput}
        keyboardType="number-pad"
        value={String(value)}
        onChangeText={(t) => set(Number(t.replace(/[^0-9]/g, '')) || 0)}
        selectTextOnFocus
      />
      <Text style={styles.numUnit}>{unit}</Text>
      <Pressable style={styles.numBtn} onPress={() => set(value + step)}>
        <Text style={styles.numBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      <View style={{ marginTop: 8 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  black: {
    backgroundColor: '#000',
    borderColor: '#3A3A3A',
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  blackSmall: { paddingVertical: 12, borderRadius: 12 },
  blackText: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  blackTextSmall: { fontSize: 16 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#000',
    borderColor: '#3A3A3A',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  iconText: { color: '#fff', fontSize: 20 },
  seg: { flexDirection: 'row', backgroundColor: '#EEE', borderRadius: 12, padding: 4 },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segItemOn: { backgroundColor: '#000' },
  segText: { fontWeight: '700', color: '#333' },
  segTextOn: { color: '#fff' },
  num: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  numBtnText: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: -2 },
  numInput: { minWidth: 70, height: 44, borderRadius: 12, borderWidth: 2, borderColor: '#DDD', textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#111', backgroundColor: '#fff' },
  numUnit: { fontSize: 15, color: '#444', fontWeight: '600', minWidth: 30 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#111' },
  sectionHint: { fontSize: 13, color: '#666', marginTop: 2 },
});

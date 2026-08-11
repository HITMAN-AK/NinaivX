import React from 'react';
import {
  Text, TextInput, TouchableOpacity, View, ActivityIndicator, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from './theme';

const c = theme.colors;

export function Screen({ children, style }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function H1({ children, style }) {
  return <Text style={[styles.h1, style]}>{children}</Text>;
}
export function H2({ children, style }) {
  return <Text style={[styles.h2, style]}>{children}</Text>;
}
export function P({ children, style, dim }) {
  return <Text style={[styles.p, dim && { color: c.textDim }, style]}>{children}</Text>;
}
export function Caption({ children, style }) {
  return <Text style={[styles.caption, style]}>{children}</Text>;
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Input({ style, ...props }) {
  return (
    <TextInput
      placeholderTextColor={c.textFaint}
      style={[styles.input, style]}
      {...props}
    />
  );
}

export function Field({ label, ...props }) {
  return (
    <View style={{ marginBottom: theme.space(3.5) }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Input {...props} />
    </View>
  );
}

export function GradientButton({ title, onPress, loading, disabled, colors, style }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[{ borderRadius: theme.radius.md, overflow: 'hidden' }, (disabled || loading) && { opacity: 0.6 }, style]}
    >
      <LinearGradient
        colors={colors || c.gradViolet}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.btn}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>{title}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function GhostButton({ title, onPress, style, textStyle }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.ghost, style]}>
      <Text style={[styles.ghostText, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}

export function Checkbox({ checked, onToggle, children, accent }) {
  const col = accent || c.violet;
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={styles.checkRow}>
      <View style={[styles.checkBox, { borderColor: checked ? col : c.border, backgroundColor: checked ? col : 'transparent' }]}>
        {checked ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <Text style={styles.checkLabel}>{children}</Text>
    </TouchableOpacity>
  );
}

export function Pill({ children, color }) {
  return (
    <View style={[styles.pill, { backgroundColor: (color || c.violet) + '22', borderColor: (color || c.violet) + '55' }]}>
      <Text style={[styles.pillText, { color: color || c.violet }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg, paddingHorizontal: theme.space(5) },
  h1: { color: c.text, fontSize: theme.font.h1, fontWeight: '800', letterSpacing: 0.3 },
  h2: { color: c.text, fontSize: theme.font.h2, fontWeight: '700' },
  p: { color: c.text, fontSize: theme.font.body, lineHeight: 22 },
  caption: { color: c.textFaint, fontSize: theme.font.small },
  label: { color: c.textDim, fontSize: theme.font.small, marginBottom: theme.space(1.5), fontWeight: '600' },
  card: {
    backgroundColor: c.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: theme.space(4.5),
    ...theme.shadow.card,
  },
  input: {
    backgroundColor: c.bgInput,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
    fontSize: theme.font.body,
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3.5),
  },
  btn: { paddingVertical: theme.space(4), alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: theme.font.body, fontWeight: '700', letterSpacing: 0.3 },
  ghost: { paddingVertical: theme.space(3), alignItems: 'center' },
  ghostText: { color: c.textDim, fontSize: theme.font.small, fontWeight: '600' },
  pill: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: theme.radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: theme.font.tiny, fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space(2.5), marginVertical: theme.space(2) },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '900', lineHeight: 16 },
  checkLabel: { flex: 1, color: c.textDim, fontSize: theme.font.small, lineHeight: 19 },
});

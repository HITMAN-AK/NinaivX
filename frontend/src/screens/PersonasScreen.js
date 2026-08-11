import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { Screen, H1, H2, Caption, Pill, GradientButton } from '../ui';

const c = theme.colors;

export default function PersonasScreen({ onOpen, onCreate }) {
  const { token, user, logout } = useAuth();
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.listPersonas(token);
      setPersonas(data);
    } catch (e) {
      Alert.alert('Could not load personas', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function confirmDelete(p) {
    Alert.alert('Delete persona', `Remove ${p.name}? This also deletes your conversation memory.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await api.deletePersona(token, p.id); load(); }
          catch (e) { Alert.alert('Delete failed', e.message); }
        },
      },
    ]);
  }

  const renderItem = ({ item }) => {
    const isLegacy = item.persona_type === 'deceased';
    const accent = isLegacy ? c.legacy : c.companion;
    const grad = isLegacy ? c.gradViolet : c.gradTeal;
    return (
      <View style={styles.personaCard}>
        <TouchableOpacity activeOpacity={0.8} onLongPress={() => confirmDelete(item)} style={styles.cardTop}>
          <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <Text style={styles.avatarLetter}>{(item.name || '?')[0].toUpperCase()}</Text>
          </LinearGradient>
          <View style={{ flex: 1, marginLeft: theme.space(3.5) }}>
            <H2>{item.name}</H2>
            <Caption style={{ marginTop: 2 }}>{item.relationship_with_user}</Caption>
            <View style={{ marginTop: theme.space(2) }}>
              <Pill color={accent}>{isLegacy ? '🕊  Legacy · offline' : '💬  Companion · online'}</Pill>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.actions}>
          <ModeButton label="Chat" icon="💬" onPress={() => onOpen(item, 'text')} />
          <ModeButton label="Voice" icon="🎤" accent onPress={() => onOpen(item, 'voice')} grad={grad} />
        </View>
      </View>
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Caption>Welcome back</Caption>
          <H1>{user?.name || 'You'}</H1>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={c.violet} size="large" /></View>
      ) : (
        <FlatList
          data={personas}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: theme.space(28), paddingTop: theme.space(2) }}
          refreshControl={<RefreshControl tintColor={c.violet} refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 44 }}>🕊️</Text>
              <H2 style={{ marginTop: theme.space(4), textAlign: 'center' }}>No personas yet</H2>
              <Caption style={{ textAlign: 'center', marginTop: 6 }}>
                Create a companion, or a loving recreation of someone you miss.
              </Caption>
            </View>
          }
          ListHeaderComponent={personas.length ? <Caption style={{ marginBottom: theme.space(3) }}>Choose Chat or Voice · long-press a card to delete</Caption> : null}
        />
      )}

      <View style={styles.fabWrap}>
        <GradientButton title="＋  New persona" onPress={onCreate} />
      </View>
    </Screen>
  );
}

function ModeButton({ label, icon, onPress, accent, grad }) {
  if (accent) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{ flex: 1 }}>
        <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modeBtn}>
          <Text style={styles.modeBtnText}>{icon}  {label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[styles.modeBtn, styles.modeBtnGhost, { flex: 1 }]}>
      <Text style={[styles.modeBtnText, { color: c.text }]}>{icon}  {label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: theme.space(14), marginBottom: theme.space(5) },
  logout: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: c.border },
  logoutText: { color: c.textDim, fontSize: theme.font.small, fontWeight: '600' },
  personaCard: {
    backgroundColor: c.bgElevated, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: c.border, padding: theme.space(3.5), marginBottom: theme.space(3.5),
    ...theme.shadow.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontSize: 22, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: theme.space(2.5), marginTop: theme.space(3.5) },
  modeBtn: { paddingVertical: theme.space(3), borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  modeBtnGhost: { backgroundColor: c.bgInput, borderWidth: 1, borderColor: c.border },
  modeBtnText: { color: '#fff', fontSize: theme.font.body, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: theme.space(24) },
  fabWrap: { position: 'absolute', left: theme.space(5), right: theme.space(5), bottom: theme.space(8) },
});

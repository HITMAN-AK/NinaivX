import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { theme } from './theme';
import { useAuth } from './AuthContext';
import { api } from './api';

const c = theme.colors;

// Download a free AI-generated voice sample (male/female) and open the share sheet
// so the user can save it to Files, then upload it to clone — no real-person data.
export default function SyntheticVoiceButtons() {
  const { token } = useAuth();
  const [busy, setBusy] = useState(null); // 'male' | 'female' | null

  async function download(gender) {
    setBusy(gender);
    try {
      const fileUri = `${FileSystem.cacheDirectory}synthetic-${gender}-voice.mp3`;
      const res = await FileSystem.downloadAsync(
        api.syntheticVoiceUrl(gender),
        fileUri,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.status !== 200) throw new Error(`Download failed (${res.status})`);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(res.uri, { mimeType: 'audio/mpeg', dialogTitle: 'Save the synthetic voice' });
      } else {
        Alert.alert('Downloaded', `Saved to:\n${res.uri}`);
      }
    } catch (e) {
      Alert.alert('Could not download', e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ marginTop: theme.space(3) }}>
      <Text style={styles.label}>No recording? Download a free synthetic voice, then upload it above to clone:</Text>
      <View style={styles.row}>
        <Btn label="♂  Male voice" busy={busy === 'male'} onPress={() => download('male')} />
        <Btn label="♀  Female voice" busy={busy === 'female'} onPress={() => download('female')} />
      </View>
    </View>
  );
}

function Btn({ label, busy, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={!!busy} activeOpacity={0.8} style={styles.btn}>
      {busy ? <ActivityIndicator color={c.text} /> : <Text style={styles.btnText}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  label: { color: c.textFaint, fontSize: theme.font.tiny, marginBottom: theme.space(2), lineHeight: 15 },
  row: { flexDirection: 'row', gap: theme.space(2.5) },
  btn: {
    flex: 1, paddingVertical: theme.space(3), borderRadius: theme.radius.md,
    backgroundColor: c.bgInput, borderWidth: 1, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { color: c.text, fontSize: theme.font.small, fontWeight: '700' },
});

import React, { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
import { theme } from './theme';
import { useAuth } from './AuthContext';
import { api } from './api';
import { requestMicPermission, enableRecordingMode } from './audio';

const c = theme.colors;

// A mic button that records speech, transcribes it (in the given language),
// and hands the text back via onResult. The caller shows it in an editable field
// so the user can review, edit, or record again.
export default function VoiceInputButton({ languageCode, onResult, grad, label = 'Record with voice', style }) {
  const { token } = useAuth();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [status, setStatus] = useState('idle'); // idle | recording | transcribing

  async function start() {
    try {
      const ok = await requestMicPermission();
      if (!ok) { Alert.alert('Microphone needed', 'Please allow microphone access to record.'); return; }
      await enableRecordingMode();
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStatus('recording');
    } catch (e) { Alert.alert('Recording failed', e.message); }
  }

  async function stop() {
    setStatus('transcribing');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) { setStatus('idle'); return; }
      const text = await api.stt(token, uri, languageCode);
      if (text && text.trim()) onResult(text.trim());
      else Alert.alert('Nothing heard', 'No speech was detected — try again.');
    } catch (e) {
      Alert.alert('Transcription failed', e.message);
    } finally {
      setStatus('idle');
    }
  }

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={status === 'recording' ? stop : start}
      disabled={status === 'transcribing'}
      style={style}
    >
      <LinearGradient
        colors={status === 'recording' ? [c.danger, '#DC2626'] : (grad || c.gradViolet)}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.btn}
      >
        {status === 'transcribing'
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.txt}>{status === 'recording' ? '■  Stop & transcribe' : `🎤  ${label}`}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { paddingVertical: theme.space(3), borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  txt: { color: '#fff', fontSize: theme.font.small, fontWeight: '700' },
});

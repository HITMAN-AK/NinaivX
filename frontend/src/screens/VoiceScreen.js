import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
import { theme } from '../theme';
import { useAuth } from '../AuthContext';
import { usePersistentMessages } from '../history';
import { api } from '../api';
import { saveBase64Mp3, playUri, stopPlayback, requestMicPermission, enableRecordingMode } from '../audio';

const c = theme.colors;

// A streamlined "phone call": tap to talk → tap to stop → it responds and auto-plays.
// One backend round-trip (STT + agent + TTS). Tapping the mic while it's speaking interrupts (barge-in).
export default function VoiceScreen({ persona, onBack, onSettings }) {
  const { token, user } = useAuth();
  const isLegacy = persona.persona_type === 'deceased';
  const accent = isLegacy ? c.legacy : c.companion;
  const grad = isLegacy ? c.gradViolet : c.gradTeal;

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const disclosure = user?.disclosure || 'This is an AI recreation — not the real person.';
  const [messages, setMessages] = usePersistentMessages(persona.id, () => ({
    id: 'intro', role: 'system', text: `Voice call with an AI recreation of ${persona.name}. ${disclosure}`,
  }));

  // status: idle | recording | processing | speaking
  const [status, setStatus] = useState('idle');
  const [seconds, setSeconds] = useState(0);
  const timer = useRef(null);
  const listRef = useRef(null);

  const scrollEnd = () => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  useEffect(() => { if (messages) scrollEnd(); }, [messages]);

  // Warm the fast voice model when the call screen opens (avoids a cold first turn).
  useEffect(() => { api.warmup(token); }, [token]);
  useEffect(() => () => { stopPlayback(); if (timer.current) clearInterval(timer.current); }, []);

  function startTimer() { setSeconds(0); timer.current = setInterval(() => setSeconds((s) => s + 1), 1000); }
  function stopTimer() { if (timer.current) { clearInterval(timer.current); timer.current = null; } }

  async function startRecording() {
    try {
      const ok = await requestMicPermission();
      if (!ok) { Alert.alert('Microphone needed', 'Please allow microphone access to talk.'); return; }
      stopPlayback(); // barge-in: cut off any playing reply
      await enableRecordingMode();
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStatus('recording');
      startTimer();
    } catch (e) { Alert.alert('Could not start recording', e.message); }
  }

  async function stopAndSend() {
    stopTimer();
    setStatus('processing');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) { setStatus('idle'); return; }
      const res = await api.voiceChat(token, persona.id, uri);
      if (res.transcript) setMessages((m) => [...m, { id: 'u' + Date.now(), role: 'user', text: res.transcript }]);
      setMessages((m) => [...m, { id: 'a' + Date.now(), role: 'assistant', text: res.reply || '(spoken reply)', spoken: true }]);
      if (res.base64) {
        setStatus('speaking');
        const f = await saveBase64Mp3(res.base64);
        await playUri(f, () => setStatus('idle')); // back to idle when playback finishes
      } else {
        setStatus('idle');
      }
    } catch (e) {
      setMessages((m) => [...m, { id: 'e' + Date.now(), role: 'error', text: e.message }]);
      setStatus('idle');
    }
  }

  function onMicPress() {
    if (status === 'recording') stopAndSend();
    else if (status === 'idle' || status === 'speaking') startRecording(); // speaking → barge-in
  }

  const renderItem = ({ item }) => {
    if (item.role === 'system') return <View style={styles.systemWrap}><Text style={styles.systemText}>{item.text}</Text></View>;
    if (item.role === 'error') return <View style={[styles.bubble, styles.errorBubble]}><Text style={styles.errorText}>{item.text}</Text></View>;
    const isUser = item.role === 'user';
    if (isUser) {
      return (
        <View style={[styles.row, { justifyContent: 'flex-end' }]}>
          <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.userBubble]}>
            <Text style={styles.userText}>{item.text}</Text>
          </LinearGradient>
        </View>
      );
    }
    return (
      <View style={[styles.row, { justifyContent: 'flex-start' }]}>
        <View style={[styles.bubble, styles.aiBubble]}>
          {item.spoken ? <Text style={[styles.spokenTag, { color: accent }]}>🔊 spoken</Text> : null}
          <Text style={styles.aiText}>{item.text}</Text>
        </View>
      </View>
    );
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const hint = {
    idle: 'Tap to talk', recording: `Listening…  ${mm}:${ss} · tap to send`,
    processing: `${persona.name} is thinking…`, speaking: `${persona.name} is speaking · tap to interrupt`,
  }[status];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Text style={styles.back}>‹</Text></TouchableOpacity>
        <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headAvatar}>
          <Text style={styles.headAvatarLetter}>{(persona.name || '?')[0].toUpperCase()}</Text>
        </LinearGradient>
        <View style={{ flex: 1, marginLeft: theme.space(3) }}>
          <Text style={styles.headName}>{persona.name}</Text>
          <Text style={[styles.headStatus, { color: accent }]}>{isLegacy ? '🕊  Call · private, from memory' : '💬  Call · knows current events'}</Text>
        </View>
        <TouchableOpacity onPress={onSettings} style={styles.gear}><Text style={styles.gearIcon}>⚙︎</Text></TouchableOpacity>
      </View>

      {!messages ? (
        <View style={styles.center}><ActivityIndicator color={accent} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: theme.space(4) }}
          onContentSizeChange={scrollEnd}
        />
      )}

      <View style={styles.controls}>
        <Text style={styles.hint}>{hint}</Text>
        <TouchableOpacity activeOpacity={0.85} onPress={onMicPress} disabled={status === 'processing'}>
          <LinearGradient
            colors={status === 'recording' ? [c.danger, '#DC2626'] : grad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.micBig}
          >
            {status === 'processing'
              ? <ActivityIndicator color="#fff" size="large" />
              : <Text style={styles.micIcon}>{status === 'recording' ? '■' : status === 'speaking' ? '🔊' : '🎤'}</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: theme.space(14), paddingBottom: theme.space(3.5), paddingHorizontal: theme.space(4),
    borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.bgElevated,
  },
  backBtn: { paddingRight: theme.space(2) },
  back: { color: c.text, fontSize: 34, fontWeight: '300', marginTop: -4 },
  headAvatar: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  headAvatarLetter: { color: '#fff', fontWeight: '800', fontSize: 17 },
  headName: { color: c.text, fontSize: theme.font.h3, fontWeight: '700' },
  headStatus: { fontSize: theme.font.tiny, fontWeight: '600', marginTop: 1 },
  gear: { padding: theme.space(2) },
  gearIcon: { color: c.textDim, fontSize: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', marginBottom: theme.space(3) },
  bubble: { maxWidth: '82%', paddingHorizontal: theme.space(4), paddingVertical: theme.space(3), borderRadius: 20 },
  userBubble: { borderBottomRightRadius: 6 },
  userText: { color: '#fff', fontSize: theme.font.body, lineHeight: 21 },
  aiBubble: { backgroundColor: c.bgElevated, borderWidth: 1, borderColor: c.border, borderBottomLeftRadius: 6 },
  aiText: { color: c.text, fontSize: theme.font.body, lineHeight: 22 },
  spokenTag: { fontSize: theme.font.tiny, fontWeight: '700', marginBottom: 3 },
  systemWrap: { alignItems: 'center', marginBottom: theme.space(4), paddingHorizontal: theme.space(6) },
  systemText: { color: c.textFaint, fontSize: theme.font.tiny, textAlign: 'center', lineHeight: 16 },
  errorBubble: { alignSelf: 'center', backgroundColor: c.danger + '18', borderWidth: 1, borderColor: c.danger + '44' },
  errorText: { color: c.danger, fontSize: theme.font.small, textAlign: 'center' },
  controls: {
    borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bgElevated,
    paddingHorizontal: theme.space(4), paddingTop: theme.space(4), paddingBottom: theme.space(9), alignItems: 'center',
  },
  hint: { color: c.textDim, fontSize: theme.font.small, marginBottom: theme.space(3), fontWeight: '600' },
  micBig: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', ...theme.shadow.card },
  micIcon: { fontSize: 36, color: '#fff' },
});

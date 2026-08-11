import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { useAuth } from '../AuthContext';
import { usePersistentMessages } from '../history';
import { api } from '../api';

const c = theme.colors;

export default function ChatScreen({ persona, onBack, onSettings }) {
  const { token, user } = useAuth();
  const isLegacy = persona.persona_type === 'deceased';
  const accent = isLegacy ? c.legacy : c.companion;
  const grad = isLegacy ? c.gradViolet : c.gradTeal;

  const disclosure = user?.disclosure || 'This is an AI recreation — not the real person.';
  const [messages, setMessages] = usePersistentMessages(persona.id, () => ({
    id: 'intro', role: 'system', text: `You're talking with an AI recreation of ${persona.name}. ${disclosure}`,
  }));
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const scrollEnd = () => { setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80); };
  useEffect(() => { if (messages) scrollEnd(); }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages((m) => [...m, { id: 'u' + Date.now(), role: 'user', text }]);
    setSending(true);
    try {
      const res = await api.chat(token, persona.id, text);
      setMessages((m) => [...m, { id: 'a' + Date.now(), role: 'assistant', text: res.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { id: 'e' + Date.now(), role: 'error', text: e.message }]);
    } finally {
      setSending(false);
    }
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

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Text style={styles.back}>‹</Text></TouchableOpacity>
        <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headAvatar}>
          <Text style={styles.headAvatarLetter}>{(persona.name || '?')[0].toUpperCase()}</Text>
        </LinearGradient>
        <View style={{ flex: 1, marginLeft: theme.space(3) }}>
          <Text style={styles.headName}>{persona.name}</Text>
          <Text style={[styles.headStatus, { color: accent }]}>{isLegacy ? '🕊  Legacy · offline & safe' : '💬  Companion · online'}</Text>
        </View>
        <TouchableOpacity onPress={onSettings} style={styles.gear}><Text style={styles.gearIcon}>⚙︎</Text></TouchableOpacity>
      </View>

      {!messages ? (
        <View style={styles.center}><ActivityIndicator color={accent} /></View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(i) => i.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: theme.space(4) }}
            onContentSizeChange={scrollEnd}
          />
          {sending && (
            <View style={styles.typingWrap}>
              <ActivityIndicator color={accent} size="small" />
              <Text style={styles.typingText}>{persona.name} is thinking…</Text>
            </View>
          )}
          <View style={styles.composer}>
            <TextInput
              style={styles.composerInput}
              placeholder={`Message ${persona.name}…`}
              placeholderTextColor={c.textFaint}
              value={input}
              onChangeText={setInput}
              multiline
            />
            <TouchableOpacity onPress={send} disabled={!input.trim() || sending} activeOpacity={0.85}>
              <LinearGradient colors={input.trim() ? grad : [c.bgInput, c.bgInput]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sendBtn}>
                <Text style={[styles.sendIcon, { color: input.trim() ? '#fff' : c.textFaint }]}>➤</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
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
  typingWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.space(5), paddingBottom: theme.space(2), gap: 8 },
  typingText: { color: c.textDim, fontSize: theme.font.small },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: theme.space(2.5),
    paddingHorizontal: theme.space(4), paddingTop: theme.space(3), paddingBottom: theme.space(8),
    borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bgElevated,
  },
  composerInput: {
    flex: 1, maxHeight: 120, backgroundColor: c.bgInput, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: c.border, color: c.text, fontSize: theme.font.body,
    paddingHorizontal: theme.space(4), paddingTop: theme.space(3), paddingBottom: theme.space(3),
  },
  sendBtn: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { fontSize: 18, fontWeight: '700' },
});

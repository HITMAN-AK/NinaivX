import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../theme';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { LANGUAGES, codeForLanguage } from '../constants';
import VoiceInputButton from '../VoiceInputButton';
import SyntheticVoiceButtons from '../SyntheticVoiceButtons';
import VoicePicker from '../VoicePicker';
import { Screen, H1, H2, P, Caption, Field, GradientButton, GhostButton, Card, Pill, Checkbox } from '../ui';

const c = theme.colors;

export default function PersonaSettingsScreen({ persona, onBack, onDeleted, onSaved }) {
  const { token } = useAuth();
  const isLegacy = persona.persona_type === 'deceased';
  const grad = isLegacy ? c.gradViolet : c.gradTeal;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [relationship, setRelationship] = useState('');
  const [nickname, setNickname] = useState('');
  const [personality, setPersonality] = useState('');
  const [language, setLanguage] = useState('English');
  const [voiceId, setVoiceId] = useState(null);

  // clone state (upload only)
  const [cloning, setCloning] = useState(false);
  const [voiceRightsOk, setVoiceRightsOk] = useState(false); // consent: right to use the recording

  useEffect(() => {
    (async () => {
      try {
        const p = await api.getPersona(token, persona.id);
        setName(p.name || ''); setAge(String(p.age ?? '')); setGender(p.gender || '');
        setRelationship(p.relationship_with_user || ''); setPersonality(p.personality_text || '');
        setNickname(p.user_nickname || '');
        setLanguage(p.language || 'English');
        setVoiceId(p.elevenlabs_voice_id || null);
      } catch (e) { Alert.alert('Could not load persona', e.message); }
      finally { setLoading(false); }
    })();
  }, [token, persona.id]);

  async function save() {
    setSaving(true);
    try {
      await api.updatePersona(token, persona.id, {
        name: name.trim(), age: parseInt(age, 10) || 30, gender: gender.trim(),
        relationship_with_user: relationship.trim(), personality_text: personality.trim(),
        language, user_nickname: nickname.trim() || null,
      });
      onSaved && onSaved();
      Alert.alert('Saved', 'Persona updated.');
    } catch (e) { Alert.alert('Save failed', e.message); }
    finally { setSaving(false); }
  }

  async function assignVoice(v) {
    try {
      await api.selectVoice(token, persona.id, v.voice_id);
      setVoiceId(v.voice_id);
      Alert.alert('Voice set', `${persona.name} will now speak with "${v.name}".`);
    } catch (e) { Alert.alert('Could not set voice', e.message); }
  }

  async function uploadAndClone() {
    if (!voiceRightsOk) {
      Alert.alert('Confirmation needed', 'Please confirm you have the right to use this recording before cloning.');
      return;
    }
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (res.canceled) return;
      const asset = res.assets && res.assets[0];
      if (!asset) return;
      setCloning(true);
      const out = await api.cloneVoice(
        token,
        `${name || persona.name} (cloned)`,
        `Cloned voice for ${persona.name}`,
        { uri: asset.uri, name: asset.name, type: asset.mimeType },
        persona.id,
      );
      setVoiceId(out.voice_id);
      Alert.alert('Voice cloned', `${persona.name} will now speak in the uploaded voice.`);
    } catch (e) {
      Alert.alert('Cloning failed', e.message);
    } finally {
      setCloning(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Delete persona', `Remove ${persona.name}? This also deletes your conversation memory.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.deletePersona(token, persona.id); onDeleted(); }
        catch (e) { Alert.alert('Delete failed', e.message); }
      } },
    ]);
  }

  if (loading) {
    return <Screen><View style={styles.center}><ActivityIndicator color={c.violet} size="large" /></View></Screen>;
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingTop: theme.space(14), paddingBottom: theme.space(20) }} keyboardShouldPersistTaps="handled">
          <View style={styles.top}>
            <TouchableOpacity onPress={onBack}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
          </View>
          <H1>{persona.name}</H1>
          <Pill color={isLegacy ? c.legacy : c.companion}>{isLegacy ? '🕊  Legacy · offline' : '💬  Companion · online'}</Pill>

          {/* Details */}
          <H2 style={{ marginTop: theme.space(6), marginBottom: theme.space(3) }}>Details</H2>
          <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
          <View style={{ flexDirection: 'row', gap: theme.space(3) }}>
            <View style={{ flex: 1 }}><Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" /></View>
            <View style={{ flex: 1.3 }}><Field label="Gender" value={gender} onChangeText={setGender} autoCapitalize="words" /></View>
          </View>
          <Field label="Relationship to you" value={relationship} onChangeText={setRelationship} autoCapitalize="words" />
          <Field label="What should they call you?" value={nickname} onChangeText={setNickname}
            placeholder="e.g. Ashwin, kanna, my boy (blank = your name)" autoCapitalize="words" />

          <Field label="Language they speak" value={language} onChangeText={setLanguage}
            placeholder="Type any language — e.g. Tamil, Telugu, Japanese" autoCapitalize="words" />
          <Text style={styles.quickLabel}>Quick pick</Text>
          <View style={styles.chipRow}>
            {LANGUAGES.map((l) => (
              <Chip key={l.code} label={l.name} active={language === l.name} onPress={() => setLanguage(l.name)} />
            ))}
          </View>

          <View style={{ marginTop: theme.space(4) }}>
            <Field label="Personality & memories" value={personality} onChangeText={setPersonality}
              placeholder={`Speak or type in ${language}…`}
              multiline numberOfLines={4} style={{ minHeight: 96, textAlignVertical: 'top' }} />
          </View>
          <VoiceInputButton
            languageCode={codeForLanguage(language)}
            grad={grad}
            label={`Describe them in ${language} (voice)`}
            onResult={setPersonality}
            style={{ marginBottom: theme.space(2) }}
          />
          <Caption>Record their personality &amp; memories — review, edit, or record again.</Caption>

          <GradientButton title="Save changes" colors={grad} onPress={save} loading={saving} style={{ marginTop: theme.space(4) }} />

          {/* Voice */}
          <H2 style={{ marginTop: theme.space(7), marginBottom: theme.space(2) }}>Voice</H2>
          <Caption>{voiceId ? `Current voice: ${voiceId.slice(0, 10)}…` : 'No voice set — a default is used.'}</Caption>

          <Card style={{ marginTop: theme.space(3) }}>
            <P style={{ fontWeight: '700', marginBottom: theme.space(1) }}>Pick a ready-made voice</P>
            <Caption>No recording needed — choose a voice below and it's set for this persona.</Caption>
            <VoicePicker selectedVoiceId={voiceId} accent={isLegacy ? c.legacy : c.companion} onSelect={assignVoice} />
          </Card>

          <Card style={{ marginTop: theme.space(3) }}>
            <P style={{ fontWeight: '700', marginBottom: theme.space(1) }}>Clone a real voice</P>
            <Caption>Upload an existing recording of the person (a clear 1–2 min clip works best). Their voice will be cloned and used for all replies.</Caption>
            <Checkbox
              checked={voiceRightsOk}
              onToggle={() => setVoiceRightsOk(!voiceRightsOk)}
              accent={isLegacy ? c.legacy : c.companion}
            >
              I confirm this recording is the voice of the intended person, and that I have the
              right to use it to create a cloned voice.
            </Checkbox>
            <GradientButton
              title={cloning ? 'Cloning…' : '⬆  Upload a recording'}
              colors={grad}
              onPress={uploadAndClone}
              loading={cloning}
              style={{ marginTop: theme.space(3) }}
            />
            <SyntheticVoiceButtons />
          </Card>

          {/* Danger */}
          <GhostButton title="Delete persona" textStyle={{ color: c.danger }} onPress={confirmDelete} style={{ marginTop: theme.space(6) }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && { color: c.violet }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { marginBottom: theme.space(2) },
  back: { color: c.textDim, fontSize: theme.font.body, fontWeight: '600' },
  subLabel: { color: c.textDim, fontSize: theme.font.small, marginBottom: theme.space(2), fontWeight: '600' },
  quickLabel: { color: c.textFaint, fontSize: theme.font.tiny, marginBottom: theme.space(1), fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(2), marginTop: theme.space(2) },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgInput },
  chipActive: { borderColor: c.violet, backgroundColor: c.violet + '22' },
  chipText: { color: c.textDim, fontSize: theme.font.small, fontWeight: '600', textTransform: 'capitalize' },
  voiceRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: theme.space(3), paddingHorizontal: theme.space(3),
    borderWidth: 1, borderColor: c.border, borderRadius: theme.radius.md, marginTop: theme.space(2.5),
  },
  voiceName: { color: c.text, fontSize: theme.font.body, fontWeight: '600' },
});

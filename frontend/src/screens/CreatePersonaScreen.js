import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../theme';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { codeForLanguage } from '../constants';
import VoiceInputButton from '../VoiceInputButton';
import SyntheticVoiceButtons from '../SyntheticVoiceButtons';
import VoicePicker from '../VoicePicker';
import { Screen, ScreenHeader, P, Caption, Field, GradientButton, Checkbox } from '../ui';

const c = theme.colors;

export default function CreatePersonaScreen({ onDone, onCancel }) {
  const { token } = useAuth();
  const [type, setType] = useState('companion'); // 'companion' | 'deceased'
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [relationship, setRelationship] = useState('');
  const [nickname, setNickname] = useState('');
  const [personality, setPersonality] = useState('');
  const [yearPassed, setYearPassed] = useState('');
  const [language, setLanguage] = useState('English');
  const [voiceAsset, setVoiceAsset] = useState(null); // uploaded recording to clone
  const [voiceRightsOk, setVoiceRightsOk] = useState(false); // consent: right to use the recording
  const [pickedVoiceId, setPickedVoiceId] = useState(null); // ready-made voice choice
  const [loading, setLoading] = useState(false);

  const isLegacy = type === 'deceased';

  async function pickVoice() {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (res.canceled) return;
      const a = res.assets && res.assets[0];
      if (a) setVoiceAsset({ uri: a.uri, name: a.name, type: a.mimeType });
    } catch (e) { Alert.alert('Could not pick file', e.message); }
  }

  async function submit() {
    // Strict validation — every field must be valid before we create anything.
    const ageNum = parseInt(age, 10);
    const missing = [];
    if (!name.trim()) missing.push('a name');
    if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120) {
      missing.push('a valid age (1–120)');
    } else if (!isLegacy && ageNum < 18) {
      // A companion is a living adult friend — must be 18+. Legacy may be any age.
      missing.push('an age of 18 or above (a companion must be an adult)');
    }
    if (!gender.trim()) missing.push('gender');
    if (!relationship.trim()) missing.push('relationship to you');
    if (personality.trim().length < 10) missing.push('a personality description (at least 10 characters)');
    if (!language.trim()) missing.push('a language');
    if (!pickedVoiceId && !voiceAsset) missing.push('a voice (pick one or upload a recording to clone)');
    if (voiceAsset && !voiceRightsOk) missing.push('confirmation that you have the right to use the uploaded voice');
    const yearNum = yearPassed.trim() ? parseInt(yearPassed, 10) : null;
    if (isLegacy && yearPassed.trim() && (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2100)) {
      missing.push('a valid year they passed (1900–2100), or leave it blank');
    }
    if (missing.length) {
      Alert.alert('Please complete the form', 'Still needed: ' + missing.join(', ') + '.');
      return;
    }

    setLoading(true);
    try {
      // A voice is required to create a persona. If a recording was uploaded, clone it
      // FIRST to get a voice_id; otherwise use the picked ready-made voice.
      let voiceId = pickedVoiceId;
      if (voiceAsset) {
        const cloned = await api.cloneVoice(
          token, `${name.trim()} (cloned)`, `Cloned voice for ${name.trim()}`, voiceAsset
        );
        voiceId = cloned?.voice_id || voiceId;
      }
      if (!voiceId) throw new Error('Please pick a voice or upload a recording to clone.');

      await api.createPersona(token, {
        persona_type: type,
        name: name.trim(),
        age: ageNum,
        gender: gender.trim(),
        relationship_with_user: relationship.trim(),
        personality_text: personality.trim(),
        year_of_passing: isLegacy ? yearNum : null,
        language: language.trim(),
        user_nickname: nickname.trim() || null,
        elevenlabs_voice_id: voiceId,
      });
      const clonedNote = voiceAsset
        ? `${name.trim()}'s voice was cloned successfully, and `
        : '';
      Alert.alert(
        'Persona created',
        `${clonedNote}${name.trim()} is ready. Start a chat or a voice call to hear them.`,
        [{ text: 'OK', onPress: () => onDone() }]
      );
    } catch (e) {
      Alert.alert('Could not create persona', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="New persona" onCancel={onCancel} accent={isLegacy ? c.legacy : c.companion} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingTop: theme.space(4), paddingBottom: theme.space(20) }} keyboardShouldPersistTaps="handled">
          <P dim style={{ marginTop: 4 }}>Choose who you'd like to talk with.</P>

          <View style={styles.typeRow}>
            <TypeCard
              active={!isLegacy} title="Companion" emoji="💬"
              subtitle="A living AI friend to talk to"
              colors={c.gradTeal} onPress={() => setType('companion')}
            />
            <TypeCard
              active={isLegacy} title="Legacy" emoji="🕊️"
              subtitle="A loved one who has passed away"
              colors={c.gradViolet} onPress={() => setType('deceased')}
            />
          </View>

          <View style={{ marginTop: theme.space(6) }}>
            <Caption style={{ marginBottom: theme.space(3) }}>
              <Text style={{ color: c.danger }}>*</Text> Fields marked with an asterisk are required
            </Caption>
            <Field label="Name" required value={name} onChangeText={setName} placeholder={isLegacy ? 'e.g. Brook' : 'e.g. Luffy'} autoCapitalize="words" />
            <View style={{ flexDirection: 'row', gap: theme.space(3) }}>
              <View style={{ flex: 1 }}><Field label={isLegacy ? 'Age' : 'Age (18+)'} required value={age} onChangeText={setAge} placeholder={isLegacy ? 'any age' : '18+'} keyboardType="number-pad" /></View>
              <View style={{ flex: 1.3 }}><Field label="Gender" required value={gender} onChangeText={setGender} placeholder="Male / Female" autoCapitalize="words" /></View>
            </View>
            <Field label="Relationship to you" required value={relationship} onChangeText={setRelationship}
              placeholder={isLegacy ? 'e.g. Grandfather' : 'e.g. Best friend'} autoCapitalize="words" />
            <Field label="What should they call you?" value={nickname} onChangeText={setNickname}
              placeholder="e.g. dear, buddy, sweetheart (leave blank to use your name)" autoCapitalize="words" />

            <Field label="Language they speak" value={language} onChangeText={setLanguage}
              placeholder="Type any language — e.g. Tamil, Telugu, Japanese" autoCapitalize="words" />

            <Field label="Personality & memories" required value={personality} onChangeText={setPersonality}
              placeholder={`Speak or type in ${language}…`}
              multiline numberOfLines={4} style={{ minHeight: 96, textAlignVertical: 'top' }} />
            <VoiceInputButton
              languageCode={codeForLanguage(language)}
              grad={isLegacy ? c.gradViolet : c.gradTeal}
              label={`Describe them in ${language} (voice)`}
              onResult={setPersonality}
              style={{ marginBottom: theme.space(2) }}
            />
            <Caption>Record their personality &amp; memories — you can review, edit, or record again.</Caption>

            {isLegacy && (
              <Field label="Year they passed" value={yearPassed} onChangeText={setYearPassed}
                placeholder="e.g. 2015" keyboardType="number-pad" />
            )}
            {isLegacy && (
              <Caption style={{ marginTop: -theme.space(1), marginBottom: theme.space(2) }}>
                The year helps keep them true to their time — they won't know about events after it.
              </Caption>
            )}

            <Text style={styles.voiceLabel}>Voice (required)</Text>

            <Caption style={{ marginBottom: theme.space(1) }}>Pick a ready-made voice — no recording needed:</Caption>
            <VoicePicker
              selectedVoiceId={pickedVoiceId}
              accent={isLegacy ? c.legacy : c.companion}
              onSelect={(v) => setPickedVoiceId(pickedVoiceId === v.voice_id ? null : v.voice_id)}
            />

            <Caption style={{ marginTop: theme.space(4), marginBottom: theme.space(1) }}>Or clone a real voice by uploading a recording:</Caption>
            <TouchableOpacity onPress={pickVoice} activeOpacity={0.8} style={styles.uploadBtn}>
              <Text style={styles.uploadText}>
                {voiceAsset ? `✓  ${voiceAsset.name}` : '⬆  Upload a recording to clone their voice'}
              </Text>
            </TouchableOpacity>
            <Caption>
              {voiceAsset ? 'It will be cloned when you create the persona (overrides the picked voice above).'
                : 'Upload a clear 1–2 min clip of the real person, or pick a ready-made voice above.'}
            </Caption>
            <Checkbox
              checked={voiceRightsOk}
              onToggle={() => setVoiceRightsOk(!voiceRightsOk)}
              accent={isLegacy ? c.legacy : c.companion}
            >
              I confirm this recording is the voice of the intended person, and that I have the
              right to use it to create a cloned voice.
            </Checkbox>
            <SyntheticVoiceButtons />
          </View>

          <GradientButton
            title="Create persona"
            colors={isLegacy ? c.gradViolet : c.gradTeal}
            onPress={submit} loading={loading}
            style={{ marginTop: theme.space(4) }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function TypeCard({ active, title, subtitle, emoji, colors, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{ flex: 1 }}>
      <LinearGradient
        colors={active ? colors : [c.bgElevated, c.bgElevated]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.typeCard, { borderColor: active ? 'transparent' : c.border }]}
      >
        <Text style={{ fontSize: 26 }}>{emoji}</Text>
        <Text style={[styles.typeTitle, { color: active ? '#fff' : c.text }]}>{title}</Text>
        <Text style={[styles.typeSub, { color: active ? 'rgba(255,255,255,0.85)' : c.textFaint }]}>{subtitle}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  typeRow: { flexDirection: 'row', gap: theme.space(3), marginTop: theme.space(5) },
  typeCard: { borderRadius: theme.radius.lg, borderWidth: 1, padding: theme.space(4), minHeight: 120 },
  typeTitle: { fontSize: theme.font.h3, fontWeight: '800', marginTop: theme.space(2) },
  typeSub: { fontSize: theme.font.small, marginTop: 4, lineHeight: 17 },
  quickLabel: { color: c.textFaint, fontSize: theme.font.tiny, marginBottom: theme.space(1.5), fontWeight: '600' },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(2), marginBottom: theme.space(3.5) },
  voiceLabel: { color: c.textDim, fontSize: theme.font.small, marginTop: theme.space(2), marginBottom: theme.space(2), fontWeight: '600' },
  uploadBtn: { backgroundColor: c.bgInput, borderWidth: 1, borderColor: c.border, borderRadius: theme.radius.md, paddingVertical: theme.space(3.5), paddingHorizontal: theme.space(4), marginBottom: theme.space(2) },
  uploadText: { color: c.text, fontSize: theme.font.small, fontWeight: '600' },
  langChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgInput },
  langChipActive: { borderColor: c.violet, backgroundColor: c.violet + '22' },
  langChipText: { color: c.textDim, fontSize: theme.font.small, fontWeight: '600' },
});

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
const STEP_TITLES = ['Who they are', 'Their story', 'Their voice'];
const TOTAL_STEPS = 3;

export default function CreatePersonaScreen({ onDone, onCancel }) {
  const { token } = useAuth();
  const [step, setStep] = useState(1);
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
  const accent = isLegacy ? c.legacy : c.companion;
  const grad = isLegacy ? c.gradViolet : c.gradTeal;

  async function pickVoice() {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (res.canceled) return;
      const a = res.assets && res.assets[0];
      if (a) setVoiceAsset({ uri: a.uri, name: a.name, type: a.mimeType });
    } catch (e) { Alert.alert('Could not pick file', e.message); }
  }

  // Returns a list of what's still missing/invalid for a given step (empty = valid).
  function validateStep(s) {
    const missing = [];
    if (s === 1) {
      if (!name.trim()) missing.push('a name');
      const ageNum = parseInt(age, 10);
      if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120) missing.push('a valid age (1–120)');
      else if (!isLegacy && ageNum < 18) missing.push('an age of 18 or above (a companion must be an adult)');
      if (!gender.trim()) missing.push('gender');
      if (!relationship.trim()) missing.push('relationship to you');
    }
    if (s === 2) {
      if (personality.trim().length < 10) missing.push('a personality description (at least 10 characters)');
      if (!language.trim()) missing.push('a language');
      const yearNum = yearPassed.trim() ? parseInt(yearPassed, 10) : null;
      if (isLegacy && yearPassed.trim() && (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2100)) {
        missing.push('a valid year they passed (1900–2100), or leave it blank');
      }
    }
    if (s === 3) {
      if (!pickedVoiceId && !voiceAsset) missing.push('a voice (pick one or upload a recording to clone)');
      if (voiceAsset && !voiceRightsOk) missing.push('confirmation that you have the right to use the uploaded voice');
    }
    return missing;
  }

  function next() {
    const missing = validateStep(step);
    if (missing.length) {
      Alert.alert('Please complete this step', 'Still needed: ' + missing.join(', ') + '.');
      return;
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function back() { setStep((s) => Math.max(s - 1, 1)); }

  async function submit() {
    // Final safety net: re-validate every step before creating anything.
    const allMissing = [...validateStep(1), ...validateStep(2), ...validateStep(3)];
    if (allMissing.length) {
      Alert.alert('Please complete the form', 'Still needed: ' + allMissing.join(', ') + '.');
      return;
    }
    const ageNum = parseInt(age, 10);
    const yearNum = yearPassed.trim() ? parseInt(yearPassed, 10) : null;

    setLoading(true);
    try {
      // A voice is required. If a recording was uploaded, clone it FIRST to get a voice_id.
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
      const clonedNote = voiceAsset ? `${name.trim()}'s voice was cloned successfully, and ` : '';
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
      <ScreenHeader title="New persona" onCancel={onCancel} accent={accent} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingTop: theme.space(4), paddingBottom: theme.space(16) }} keyboardShouldPersistTaps="handled">
          {/* Progress */}
          <Text style={styles.stepLabel}>Step {step} of {TOTAL_STEPS} · {STEP_TITLES[step - 1]}</Text>
          <View style={styles.dotsRow}>
            {[1, 2, 3].map((n) => (
              <View key={n} style={[styles.dot, n <= step && { backgroundColor: accent, borderColor: accent }]} />
            ))}
          </View>

          {/* STEP 1 — Who */}
          {step === 1 && (
            <View>
              <P dim style={{ marginTop: theme.space(2) }}>Who would you like to talk with?</P>
              <View style={styles.typeRow}>
                <TypeCard active={!isLegacy} title="Companion" emoji="💬"
                  subtitle="A living AI friend to talk to" colors={c.gradTeal} onPress={() => setType('companion')} />
                <TypeCard active={isLegacy} title="Legacy" emoji="🕊️"
                  subtitle="A loved one who has passed away" colors={c.gradViolet} onPress={() => setType('deceased')} />
              </View>

              <Caption style={{ marginTop: theme.space(5), marginBottom: theme.space(3) }}>
                <Text style={{ color: c.danger }}>*</Text> Fields marked with an asterisk are required
              </Caption>
              <Field label="Name" required value={name} onChangeText={setName}
                placeholder={isLegacy ? 'e.g. Brook' : 'e.g. Luffy'} autoCapitalize="words" />
              <View style={{ flexDirection: 'row', gap: theme.space(3) }}>
                <View style={{ flex: 1 }}>
                  <Field label={isLegacy ? 'Age' : 'Age (18+)'} required value={age} onChangeText={setAge}
                    placeholder={isLegacy ? 'any age' : '18+'} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1.3 }}>
                  <Field label="Gender" required value={gender} onChangeText={setGender}
                    placeholder="Male / Female" autoCapitalize="words" />
                </View>
              </View>
              <Field label="Relationship to you" required value={relationship} onChangeText={setRelationship}
                placeholder={isLegacy ? 'e.g. Grandfather' : 'e.g. Best friend'} autoCapitalize="words" />
            </View>
          )}

          {/* STEP 2 — Their story */}
          {step === 2 && (
            <View>
              <Field label="Language they speak" value={language} onChangeText={setLanguage}
                placeholder="Type any language — e.g. Tamil, Telugu, Japanese" autoCapitalize="words" />

              <Field label="Personality & memories" required value={personality} onChangeText={setPersonality}
                placeholder={`Speak or type in ${language}…`}
                multiline numberOfLines={4} style={{ minHeight: 96, textAlignVertical: 'top' }} />
              <VoiceInputButton
                languageCode={codeForLanguage(language)} grad={grad}
                label={`Describe them in ${language} (voice)`} onResult={setPersonality}
                style={{ marginBottom: theme.space(2) }}
              />
              <Caption>Record their personality &amp; memories — you can review, edit, or record again.</Caption>

              {isLegacy && (
                <View style={{ marginTop: theme.space(4) }}>
                  <Field label="Year they passed" value={yearPassed} onChangeText={setYearPassed}
                    placeholder="e.g. 2015" keyboardType="number-pad" />
                  <Caption style={{ marginTop: -theme.space(1) }}>
                    Keeps them true to their time — they won't know about events after it.
                  </Caption>
                </View>
              )}

              <View style={{ marginTop: theme.space(4) }}>
                <Field label="What should they call you?" value={nickname} onChangeText={setNickname}
                  placeholder="e.g. dear, buddy, sweetheart (leave blank to use your name)" autoCapitalize="words" />
              </View>
            </View>
          )}

          {/* STEP 3 — Their voice */}
          {step === 3 && (
            <View>
              <Text style={styles.voiceLabel}>Choose a voice <Text style={{ color: c.danger }}>*</Text></Text>
              <Caption style={{ marginBottom: theme.space(1) }}>Pick a ready-made voice — no recording needed:</Caption>
              <VoicePicker
                selectedVoiceId={pickedVoiceId} accent={accent}
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
              <Checkbox checked={voiceRightsOk} onToggle={() => setVoiceRightsOk(!voiceRightsOk)} accent={accent}>
                I confirm this recording is the voice of the intended person, and that I have the
                right to use it to create a cloned voice.
              </Checkbox>
              <SyntheticVoiceButtons />
            </View>
          )}

          {/* Navigation */}
          <View style={styles.nav}>
            {step > 1 && (
              <TouchableOpacity onPress={back} activeOpacity={0.8} style={styles.backBtn}>
                <Text style={styles.backText}>‹ Back</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }}>
              {step < TOTAL_STEPS
                ? <GradientButton title="Next" colors={grad} onPress={next} />
                : <GradientButton title="Create persona" colors={grad} onPress={submit} loading={loading} />}
            </View>
          </View>
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
  stepLabel: { color: c.textDim, fontSize: theme.font.small, fontWeight: '700', marginTop: theme.space(1) },
  dotsRow: { flexDirection: 'row', gap: theme.space(2), marginTop: theme.space(2.5), marginBottom: theme.space(3) },
  dot: { flex: 1, height: 5, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgInput },

  typeRow: { flexDirection: 'row', gap: theme.space(3), marginTop: theme.space(3) },
  typeCard: { borderRadius: theme.radius.lg, borderWidth: 1, padding: theme.space(4), minHeight: 120 },
  typeTitle: { fontSize: theme.font.h3, fontWeight: '800', marginTop: theme.space(2) },
  typeSub: { fontSize: theme.font.small, marginTop: 4, lineHeight: 17 },

  voiceLabel: { color: c.textDim, fontSize: theme.font.small, marginBottom: theme.space(2), fontWeight: '600' },
  uploadBtn: { backgroundColor: c.bgInput, borderWidth: 1, borderColor: c.border, borderRadius: theme.radius.md, paddingVertical: theme.space(3.5), paddingHorizontal: theme.space(4), marginBottom: theme.space(2) },
  uploadText: { color: c.text, fontSize: theme.font.small, fontWeight: '600' },

  nav: { flexDirection: 'row', alignItems: 'center', gap: theme.space(3), marginTop: theme.space(6) },
  backBtn: { paddingVertical: theme.space(4), paddingHorizontal: theme.space(5), borderRadius: theme.radius.md, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.bgElevated },
  backText: { color: c.textDim, fontSize: theme.font.body, fontWeight: '700' },
});

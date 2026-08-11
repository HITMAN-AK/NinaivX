import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { theme } from './theme';
import { useAuth } from './AuthContext';
import { api } from './api';
import { LANGUAGES, nameForLanguageCode } from './constants';
import { Caption, GhostButton } from './ui';
import { playUri, stopPlayback } from './audio';

const c = theme.colors;
const GENDERS = ['male', 'female'];
const AGES = ['young', 'middle_aged', 'old'];

// Reusable Voice Library picker: filters by gender/age + a type-to-search language,
// fetches conversational voices, previews them, and calls onSelect(voice) when tapped.
// `selectedVoiceId` highlights the current pick.
export default function VoicePicker({ selectedVoiceId, onSelect, accent = c.violet }) {
  const { token } = useAuth();
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fGender, setFGender] = useState(null);
  const [fAge, setFAge] = useState(null);

  // Language: user types, a dropdown of matches appears, pick sets the ISO code.
  const [fLang, setFLang] = useState(null);            // ISO code sent to the backend
  const [langQuery, setLangQuery] = useState('');      // text in the input box
  const [langOpen, setLangOpen] = useState(false);     // dropdown visible?

  const [previewId, setPreviewId] = useState(null);    // which voice is previewing

  async function load(g = fGender, a = fAge, l = fLang) {
    setLoading(true);
    try {
      const res = await api.listVoices(token, g, a, l);
      setVoices(res.available_voices || []);
    } catch (e) { Alert.alert('Could not load voices', e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []); // auto-load on mount (conversational, all languages)
  useEffect(() => () => stopPlayback(), []); // stop any preview when unmounting

  // Suggestions for the typed language query (up to 8).
  const suggestions = LANGUAGES
    .filter((l) => l.name.toLowerCase().includes(langQuery.trim().toLowerCase()))
    .slice(0, 8);

  function pickLanguage(l) {
    setFLang(l.code);
    setLangQuery(l.name);
    setLangOpen(false);
    load(fGender, fAge, l.code); // apply immediately
  }

  function clearLanguage() {
    setFLang(null);
    setLangQuery('');
    setLangOpen(false);
    load(fGender, fAge, null);
  }

  async function preview(v) {
    if (!v.preview_url) { Alert.alert('No preview', 'This voice has no preview sample.'); return; }
    try {
      if (previewId === v.voice_id) { stopPlayback(); setPreviewId(null); return; }
      setPreviewId(v.voice_id);
      await playUri(v.preview_url, () => setPreviewId(null));
    } catch (e) { setPreviewId(null); Alert.alert('Could not play preview', e.message); }
  }

  return (
    <View>
      {/* Gender */}
      <View style={styles.chipRow}>
        {GENDERS.map((g) => (
          <Chip key={g} label={g} accent={accent} active={fGender === g} onPress={() => setFGender(fGender === g ? null : g)} />
        ))}
      </View>
      {/* Age */}
      <View style={styles.chipRow}>
        {AGES.map((a) => (
          <Chip key={a} label={a.replace('_', ' ')} accent={accent} active={fAge === a} onPress={() => setFAge(fAge === a ? null : a)} />
        ))}
      </View>

      {/* Language: type-to-search with a dropdown */}
      <View style={{ marginTop: theme.space(2.5) }}>
        <Caption>Language</Caption>
        <View style={styles.langInputRow}>
          <TextInput
            value={langQuery}
            onChangeText={(t) => { setLangQuery(t); setLangOpen(true); if (fLang) setFLang(null); }}
            onFocus={() => setLangOpen(true)}
            placeholder="Type a language (e.g. Tamil, Hindi, Spanish)…"
            placeholderTextColor={c.textFaint}
            style={[styles.langInput, fLang && { borderColor: accent }]}
          />
          {(langQuery || fLang) ? (
            <TouchableOpacity onPress={clearLanguage} style={styles.clearBtn}>
              <Text style={{ color: c.textFaint, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {langOpen && suggestions.length > 0 ? (
          <View style={styles.dropdown}>
            {suggestions.map((l) => (
              <TouchableOpacity key={l.code} onPress={() => pickLanguage(l)} style={styles.dropItem}>
                <Text style={styles.dropText}>{l.name}</Text>
                <Text style={styles.dropCode}>{l.code}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: theme.space(2.5) }}>
        <GhostButton title={loading ? 'Loading…' : '↻ Refresh / apply filters'} onPress={() => load()} />
      </View>

      {voices.length === 0 && !loading ? (
        <Caption>No conversational voices found for this filter. Try another language or clear filters.</Caption>
      ) : null}

      {voices.map((v) => {
        const selected = selectedVoiceId === v.voice_id;
        const playing = previewId === v.voice_id;
        return (
          <View key={v.voice_id} style={[styles.voiceRow, selected && { borderColor: accent }]}>
            <TouchableOpacity onPress={() => preview(v)} style={[styles.playBtn, { borderColor: accent }]}>
              <Text style={{ color: accent, fontSize: 15 }}>{playing ? '⏸' : '▶'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onSelect(v)} style={{ flex: 1 }}>
              <Text style={styles.voiceName}>{v.name}</Text>
              <Caption>{[v.gender, v.age, v.accent, nameForLanguageCode(v.language) || v.language].filter(Boolean).join(' · ')}</Caption>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onSelect(v)}>
              <Text style={{ color: selected ? accent : c.textFaint, fontSize: 18, paddingHorizontal: 4 }}>
                {selected ? '✓' : '›'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

function Chip({ label, active, accent, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && { borderColor: accent, backgroundColor: accent + '22' }]}>
      <Text style={[styles.chipText, active && { color: accent }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(2), marginTop: theme.space(2) },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgInput },
  chipText: { color: c.textDim, fontSize: theme.font.small, fontWeight: '600', textTransform: 'capitalize' },

  langInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: theme.space(1.5) },
  langInput: {
    flex: 1, color: c.text, backgroundColor: c.bgInput, borderWidth: 1, borderColor: c.border,
    borderRadius: theme.radius.md, paddingHorizontal: theme.space(3), paddingVertical: theme.space(2.5), fontSize: theme.font.body,
  },
  clearBtn: { paddingHorizontal: theme.space(3), paddingVertical: theme.space(2) },
  dropdown: {
    marginTop: theme.space(1.5), borderWidth: 1, borderColor: c.border, borderRadius: theme.radius.md,
    backgroundColor: c.bgInput, overflow: 'hidden',
  },
  dropItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: theme.space(3), paddingVertical: theme.space(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  dropText: { color: c.text, fontSize: theme.font.body },
  dropCode: { color: c.textFaint, fontSize: theme.font.small },

  voiceRow: {
    flexDirection: 'row', alignItems: 'center', gap: theme.space(2.5),
    paddingVertical: theme.space(3), paddingHorizontal: theme.space(3),
    borderWidth: 1, borderColor: c.border, borderRadius: theme.radius.md, marginTop: theme.space(2.5),
  },
  playBtn: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  voiceName: { color: c.text, fontSize: theme.font.body, fontWeight: '600' },
});

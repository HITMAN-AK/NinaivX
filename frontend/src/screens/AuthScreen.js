import React, { useState } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { useAuth } from '../AuthContext';
import { Screen, H1, P, Card, Field, GradientButton, GhostButton, Caption, Checkbox } from '../ui';

const c = theme.colors;
const MIN_AGE = 18; // adults only — keeps research ethics approval simple (no minors)
const MIN_PASSWORD_LEN = 8; // matches the backend's strict validation

export default function AuthScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('signup'); // 'signup' | 'login'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [language, setLanguage] = useState('English');
  const [agreed, setAgreed] = useState(false); // consent: personas are AI + agree to take part
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

  async function submit() {
    setLoading(true);
    try {
      if (isSignup) {
        if (!email || !password || !name || !age) throw new Error('Please fill in all fields.');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) throw new Error('Please enter a valid email address.');
        if (password.length < MIN_PASSWORD_LEN) throw new Error(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
        const ageNum = parseInt(age, 10);
        if (!ageNum || ageNum < MIN_AGE || ageNum > 120) throw new Error(`You must be between ${MIN_AGE} and 120 to create an account.`);
        if (!agreed) throw new Error('Please confirm you understand and agree before creating an account.');
        await signup(email.trim(), password, name.trim(), ageNum, language.trim() || 'English');
      } else {
        if (!email || !password) throw new Error('Enter your email and password.');
        await login(email.trim(), password);
      }
    } catch (e) {
      Alert.alert(isSignup ? 'Sign up failed' : 'Login failed', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <LinearGradient colors={c.gradViolet} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoDot} />
            <H1 style={{ marginTop: theme.space(4) }}>NinaivX</H1>
            <P dim style={{ textAlign: 'center', marginTop: 6 }}>
              A voice to hold onto — comfort, companionship, and remembrance.
            </P>
          </View>

          <Card style={{ marginTop: theme.space(6) }}>
            <View style={styles.tabs}>
              <Tab label="Sign Up" active={isSignup} onPress={() => setMode('signup')} />
              <Tab label="Log In" active={!isSignup} onPress={() => setMode('login')} />
            </View>

            {isSignup && (
              <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g. Ashwin" autoCapitalize="words" />
            )}
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com"
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
            {isSignup && (
              <View style={{ flexDirection: 'row', gap: theme.space(3) }}>
                <View style={{ flex: 1 }}>
                  <Field label="Age (18+)" value={age} onChangeText={setAge} placeholder="18" keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1.4 }}>
                  <Field label="Language" value={language} onChangeText={setLanguage} placeholder="English" autoCapitalize="words" />
                </View>
              </View>
            )}
            {isSignup && (
              <Caption style={{ marginTop: theme.space(1) }}>
                You must be 18 or older to use NinaivX.
              </Caption>
            )}
            {isSignup && (
              <Checkbox checked={agreed} onToggle={() => setAgreed(!agreed)}>
                I am 18 or older, and I understand that every persona in NinaivX is an
                AI recreation — not a real person. I agree to take part.
              </Checkbox>
            )}

            <GradientButton
              title={isSignup ? 'Create account' : 'Log in'}
              onPress={submit}
              loading={loading}
              style={{ marginTop: theme.space(2) }}
            />
            <GhostButton
              title={isSignup ? 'Already have an account? Log in' : 'New here? Create an account'}
              onPress={() => setMode(isSignup ? 'login' : 'signup')}
            />
          </Card>

          <Caption style={{ textAlign: 'center', marginTop: theme.space(6) }}>
            All personas are AI recreations — never the real person.
          </Caption>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Tab({ label, active, onPress }) {
  return (
    <Text
      onPress={onPress}
      style={[styles.tab, active ? styles.tabActive : styles.tabInactive]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: theme.space(10) },
  logoWrap: { alignItems: 'center' },
  logoDot: { width: 64, height: 64, borderRadius: 20 },
  tabs: { flexDirection: 'row', marginBottom: theme.space(5), gap: theme.space(2) },
  tab: { flex: 1, textAlign: 'center', paddingVertical: theme.space(2.5), borderRadius: theme.radius.md, fontWeight: '700', fontSize: theme.font.body, overflow: 'hidden' },
  tabActive: { backgroundColor: c.violet + '22', color: c.violet },
  tabInactive: { color: c.textFaint },
});

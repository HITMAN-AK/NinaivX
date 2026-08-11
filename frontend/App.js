import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from './src/AuthContext';
import { theme } from './src/theme';
import AuthScreen from './src/screens/AuthScreen';
import PersonasScreen from './src/screens/PersonasScreen';
import CreatePersonaScreen from './src/screens/CreatePersonaScreen';
import ChatScreen from './src/screens/ChatScreen';
import VoiceScreen from './src/screens/VoiceScreen';
import PersonaSettingsScreen from './src/screens/PersonaSettingsScreen';
import SwipeBack from './src/SwipeBack';

function Root() {
  const { token } = useAuth();
  // screen: 'list' | 'create' | 'text' | 'voice' | 'settings'
  const [screen, setScreen] = useState('list');
  const [activePersona, setActivePersona] = useState(null);
  const [lastMode, setLastMode] = useState('text'); // where settings' back returns to
  const [listKey, setListKey] = useState(0);

  if (!token) return <AuthScreen />;

  if (screen === 'create') {
    return (
      <SwipeBack onBack={() => setScreen('list')}>
        <CreatePersonaScreen
          onDone={() => { setListKey((k) => k + 1); setScreen('list'); }}
          onCancel={() => setScreen('list')}
        />
      </SwipeBack>
    );
  }

  if (screen === 'text' && activePersona) {
    return (
      <SwipeBack onBack={() => setScreen('list')}>
        <ChatScreen persona={activePersona} onBack={() => setScreen('list')} onSettings={() => setScreen('settings')} />
      </SwipeBack>
    );
  }

  if (screen === 'voice' && activePersona) {
    return (
      <SwipeBack onBack={() => setScreen('list')}>
        <VoiceScreen persona={activePersona} onBack={() => setScreen('list')} onSettings={() => setScreen('settings')} />
      </SwipeBack>
    );
  }

  if (screen === 'settings' && activePersona) {
    return (
      <SwipeBack onBack={() => setScreen(lastMode)}>
        <PersonaSettingsScreen
          persona={activePersona}
          onBack={() => setScreen(lastMode)}
          onSaved={() => setListKey((k) => k + 1)}
          onDeleted={() => { setListKey((k) => k + 1); setActivePersona(null); setScreen('list'); }}
        />
      </SwipeBack>
    );
  }

  return (
    <PersonasScreen
      key={listKey}
      onCreate={() => setScreen('create')}
      onOpen={(p, mode) => { setActivePersona(p); setLastMode(mode); setScreen(mode); }}
    />
  );
}

export default function App() {
  return (
    <View style={styles.app}>
      <StatusBar style="light" />
      <AuthProvider>
        <Root />
      </AuthProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: theme.colors.bg },
});

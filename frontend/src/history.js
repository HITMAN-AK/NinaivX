import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (personaId) => `ninaivx:chat:${personaId}`;

export async function loadMessages(personaId) {
  try {
    const raw = await AsyncStorage.getItem(key(personaId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function persistMessages(personaId, messages) {
  try { await AsyncStorage.setItem(key(personaId), JSON.stringify(messages)); } catch {}
}

export async function clearMessages(personaId) {
  try { await AsyncStorage.removeItem(key(personaId)); } catch {}
}

// Hook: durable, per-persona message list shared by text & voice modes.
// `makeIntro` builds the first message when there's no saved history.
export function usePersistentMessages(personaId, makeIntro) {
  const [messages, setMessages] = useState(null); // null = still loading
  const loaded = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await loadMessages(personaId);
      if (!alive) return;
      setMessages(stored && stored.length ? stored : [makeIntro()]);
      loaded.current = true;
    })();
    return () => { alive = false; };
  }, [personaId]);

  useEffect(() => {
    if (loaded.current && messages) persistMessages(personaId, messages);
  }, [messages, personaId]);

  return [messages, setMessages];
}

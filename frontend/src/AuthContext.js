import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const SESSION_KEY = 'ninaivx.session'; // stores { access_token, refresh_token, user }

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true); // true while we try to restore a saved session

  // On app start, try to restore a saved session.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);

        // Prefer refreshing (handles expired access tokens cleanly).
        if (saved.refresh_token) {
          try {
            const r = await api.refresh(saved.refresh_token);
            if (r?.access_token) {
              const me = await api.me(r.access_token);
              const newRefresh = r.refresh_token || saved.refresh_token;
              setToken(r.access_token); setRefreshToken(newRefresh); setUser(me);
              await persist(r.access_token, newRefresh, me);
              return;
            }
          } catch {
            // refresh failed (expired/invalid) — fall through to clearing
          }
          await clearSession();
          return;
        }

        // No refresh token stored — try the saved access token directly.
        if (saved.access_token) {
          try {
            const me = await api.me(saved.access_token);
            setToken(saved.access_token); setUser(me);
          } catch { await clearSession(); }
        }
      } catch {
        // corrupt storage — ignore
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

  async function persist(t, rt, u) {
    try {
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: t, refresh_token: rt, user: u }));
    } catch {}
  }

  async function clearSession() {
    try { await AsyncStorage.removeItem(SESSION_KEY); } catch {}
    setToken(null); setRefreshToken(null); setUser(null);
  }

  async function signup(email, password, name, age, language) {
    const res = await api.signup(email, password, name, age, language);
    if (!res.access_token) {
      throw new Error(res.message || 'Signup succeeded but no token was returned (email confirmation may be on).');
    }
    const me = await api.me(res.access_token);
    setToken(res.access_token); setRefreshToken(res.refresh_token || null); setUser(me);
    await persist(res.access_token, res.refresh_token || null, me);
    return me;
  }

  async function login(email, password) {
    const res = await api.login(email, password);
    if (!res.access_token) throw new Error('Login failed.');
    const me = await api.me(res.access_token);
    setToken(res.access_token); setRefreshToken(res.refresh_token || null); setUser(me);
    await persist(res.access_token, res.refresh_token || null, me);
    return me;
  }

  function logout() { clearSession(); }

  return (
    <AuthContext.Provider value={{ token, user, restoring, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

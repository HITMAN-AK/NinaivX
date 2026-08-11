import React, { createContext, useContext, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  async function signup(email, password, name, age, language) {
    const res = await api.signup(email, password, name, age, language);
    if (!res.access_token) {
      throw new Error(res.message || 'Signup succeeded but no token was returned (email confirmation may be on).');
    }
    setToken(res.access_token);
    const me = await api.me(res.access_token);
    setUser(me);
    return me;
  }

  async function login(email, password) {
    const res = await api.login(email, password);
    if (!res.access_token) throw new Error('Login failed.');
    setToken(res.access_token);
    const me = await api.me(res.access_token);
    setUser(me);
    return me;
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

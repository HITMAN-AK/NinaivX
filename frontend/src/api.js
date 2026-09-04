// NinaivX API client — auto-detects the dev machine's LAN IP so a physical
// iPhone running Expo Go can reach the FastAPI backend over WiFi.
import Constants from 'expo-constants';
// Native, reliable multipart file upload (fetch+FormData file uploads are flaky
// under React Native's new architecture in SDK 57, so we use uploadAsync instead).
import * as FileSystem from 'expo-file-system/legacy';

// Resolve the backend base URL.
// 1) PRODUCTION: an explicit URL (set EXPO_PUBLIC_API_URL, or app.json > expo.extra.apiUrl)
//    — this is what published/shared builds use to reach the deployed backend (Render).
// 2) DEV: auto-detect the PC's LAN IP from Metro so a phone on the same WiFi can reach it.
function resolveBaseUrl() {
  const explicit =
    process.env.EXPO_PUBLIC_API_URL ||
    Constants.expoConfig?.extra?.apiUrl ||
    Constants.manifest2?.extra?.expoClient?.extra?.apiUrl ||
    '';
  if (explicit) return explicit.replace(/\/+$/, ''); // strip any trailing slash

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    Constants.manifest?.debuggerHost ||
    '';
  const host = hostUri.split(':')[0];
  if (host) return `http://${host}:8000`;
  // Fallback: hardcode if auto-detection fails (edit to your PC IP).
  return 'http://10.122.207.33:8000';
}

export const API_BASE = resolveBaseUrl();

// ---- Auth bridge (wired from AuthContext) ----
// Lets the client transparently refresh an expired access token on a 401 and retry.
let _refreshToken = null;
let _onRefreshed = null; // (accessToken, refreshToken) => void
let _onAuthLost = null;  // () => void  (refresh failed → force logout)
let _refreshing = null;  // in-flight refresh promise (dedupe concurrent 401s)

export function configureAuth({ refreshToken, onRefreshed, onAuthLost } = {}) {
  if (refreshToken !== undefined) _refreshToken = refreshToken;
  if (onRefreshed !== undefined) _onRefreshed = onRefreshed;
  if (onAuthLost !== undefined) _onAuthLost = onAuthLost;
}

async function tryRefresh() {
  if (!_refreshToken) return null;
  if (!_refreshing) {
    _refreshing = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: _refreshToken }),
        });
        if (!res.ok) throw new Error('refresh failed');
        const data = await res.json();
        if (!data.access_token) throw new Error('no token');
        _refreshToken = data.refresh_token || _refreshToken;
        _onRefreshed && _onRefreshed(data.access_token, _refreshToken);
        return data.access_token;
      } catch {
        _onAuthLost && _onAuthLost();
        return null;
      }
    })();
  }
  const token = await _refreshing;
  _refreshing = null;
  return token;
}

// Low-level fetch that, for authed requests, refreshes the token once on a 401 and retries.
async function fetchWithRefresh(url, init = {}, isAuthed = false) {
  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new Error(`Cannot reach the server at ${API_BASE}. Is the backend running (host 0.0.0.0) and on the same WiFi?`);
  }
  if (res.status === 401 && isAuthed && _refreshToken) {
    const newToken = await tryRefresh();
    if (newToken) {
      const headers = { ...(init.headers || {}), Authorization: `Bearer ${newToken}` };
      try {
        res = await fetch(url, { ...init, headers });
      } catch (e) {
        throw new Error(`Cannot reach the server at ${API_BASE}.`);
      }
    }
  }
  return res;
}

// Reliable multipart file upload via expo-file-system (not fetch+FormData).
// Refreshes the token once on a 401 and retries. Returns { status, body }.
async function uploadFileWithRefresh(path, fileUri, { token, fieldName = 'file', parameters = {}, mimeType } = {}) {
  const doUpload = (authToken) =>
    FileSystem.uploadAsync(`${API_BASE}${path}`, fileUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName,
      ...(mimeType ? { mimeType } : {}),
      parameters,
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });

  let res;
  try {
    res = await doUpload(token);
  } catch (e) {
    throw new Error(`Cannot reach the server at ${API_BASE}. Is the backend running?`);
  }
  if (res.status === 401 && token && _refreshToken) {
    const newToken = await tryRefresh();
    if (newToken) {
      try { res = await doUpload(newToken); }
      catch (e) { throw new Error(`Cannot reach the server at ${API_BASE}.`); }
    }
  }
  return res; // { status, body, headers }
}

async function request(path, { method = 'GET', body, token, isForm } = {}) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let payload;
  if (isForm) {
    payload = body; // FormData
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetchWithRefresh(`${API_BASE}${path}`, { method, headers, body: payload }, !!token);

  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!res.ok) {
    const detail = data.detail || data.message || `Request failed (${res.status})`;
    if (typeof detail === 'string') throw new Error(detail);
    // FastAPI/Pydantic validation errors come as an array of {loc, msg, ...}.
    if (Array.isArray(detail)) {
      const msg = detail.map((e) => e?.msg || '').filter(Boolean).join('\n');
      throw new Error(msg || `Request failed (${res.status})`);
    }
    throw new Error(JSON.stringify(detail));
  }
  return data;
}

export const api = {
  base: API_BASE,

  // URL for a free synthetic voice sample (male/female) — used with FileSystem.downloadAsync.
  syntheticVoiceUrl: (gender) => `${API_BASE}/api/synthetic-voice?gender=${gender}`,

  signup: (email, password, name, age, language) =>
    request('/api/auth/signup', { method: 'POST', body: { email, password, name, age, language } }),

  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: { email, password } }),

  // Exchange a refresh token for a fresh access token (keeps the user logged in).
  refresh: (refresh_token) =>
    request('/api/auth/refresh', { method: 'POST', body: { refresh_token } }),

  me: (token) => request('/api/me', { token }),

  disclosure: () => request('/api/disclosure'),

  // Pre-warm the fast voice model so the first call turn isn't a cold start.
  warmup: (token) => request('/api/warmup', { method: 'POST', token }).catch(() => ({ warm: false })),

  listPersonas: (token) => request('/api/personas', { token }),

  getPersona: (token, id) => request(`/api/personas/${id}`, { token }),

  createPersona: (token, persona) =>
    request('/api/personas', { method: 'POST', token, body: persona }),

  deletePersona: (token, id) =>
    request(`/api/personas/${id}`, { method: 'DELETE', token }),

  updatePersona: (token, id, patch) =>
    request(`/api/personas/${id}`, { method: 'PATCH', token, body: patch }),

  chat: (token, persona_id, user_message) =>
    request('/api/chat', { method: 'POST', token, body: { persona_id, user_message } }),

  listVoices: (token, gender, age, language) => {
    const q = new URLSearchParams();
    if (gender) q.append('gender', gender);
    if (age) q.append('age', age);
    if (language) q.append('language', language);
    const qs = q.toString();
    return request(`/api/voices${qs ? '?' + qs : ''}`, { token });
  },

  selectVoice: (token, id, voice_id) =>
    request(`/api/personas/${id}/select-voice`, { method: 'POST', token, body: { voice_id } }),

  // Play a short sample in a given voice (cloned or ready-made) -> base64 mp3.
  previewVoice: (token, voice_id, language) => {
    const q = new URLSearchParams({ voice_id });
    if (language) q.append('language', language);
    return request(`/api/preview-voice?${q.toString()}`, { token }).then((d) => d.audio_base64 || null);
  },

  // --- Speech-to-text only: audio -> { transcript } (for review before sending) ---
  stt: async (token, audioUri, languageCode) => {
    const res = await uploadFileWithRefresh('/api/stt', audioUri, {
      token, fieldName: 'file', mimeType: 'audio/m4a',
      parameters: languageCode ? { language_code: languageCode } : {},
    });
    let data = {}; try { data = JSON.parse(res.body); } catch {}
    if (res.status < 200 || res.status >= 300) throw new Error(data.detail || `Transcription failed (${res.status})`);
    return data.transcript || '';
  },

  // --- Send confirmed text, receive { reply, base64 } spoken audio ---
  chatVoice: (token, persona_id, user_message) =>
    request('/api/chat-voice', { method: 'POST', token, body: { persona_id, user_message } })
      .then((d) => ({ reply: d.reply || '', base64: d.audio_base64 || null })),

  // --- Voice: send a recording, receive { transcript, reply, base64 } ---
  voiceChat: async (token, persona_id, audioUri) => {
    const res = await uploadFileWithRefresh('/api/voice-chat', audioUri, {
      token, fieldName: 'file', mimeType: 'audio/m4a',
      parameters: { persona_id: String(persona_id) },
    });
    let data = {}; try { data = JSON.parse(res.body); } catch {}
    if (res.status < 200 || res.status >= 300) throw new Error(data.detail || `Voice chat failed (${res.status})`);
    return { transcript: data.transcript || '', reply: data.reply || '', base64: data.audio_base64 || null };
  },

  // --- Clone a voice from an uploaded audio file, linked to a persona ---
  // `file` = { uri, name, type } from the document picker.
  cloneVoice: async (token, name, description, file, persona_id) => {
    // Consent is gated in the UI; confirm it to the server too (enforced server-side).
    const parameters = { name, description, rights_confirmed: 'true' };
    if (persona_id) parameters.persona_id = String(persona_id);
    const res = await uploadFileWithRefresh('/api/clone-voice', file.uri, {
      token, fieldName: 'file', mimeType: file.type || 'audio/mpeg', parameters,
    });
    let data = {}; try { data = JSON.parse(res.body); } catch {}
    if (res.status < 200 || res.status >= 300) throw new Error(data.detail || `Voice cloning failed (${res.status})`);
    return data;
  },
};

# NinaivX — Mobile App (Frontend)

A **React Native (Expo)** app for NinaivX — a premium, dark-themed mobile client that lets a
user hold **text and voice** conversations with AI personas: a **Companion** (a living friend)
or a **Legacy** persona (a recreation of a loved one who has passed).

It talks to the NinaivX **backend** (FastAPI) — see `../backend`.

---

## 1. Tech stack

| Piece | Choice |
|-------|--------|
| Framework | Expo **SDK 54** (`expo` 54.0.36) |
| Runtime | React Native 0.81.5 · React 19.1.0 |
| Audio | `expo-audio` (record + play) |
| File / audio storage | `expo-file-system` (save reply audio) |
| Upload picker | `expo-document-picker` (upload a recording to clone) |
| Local persistence | `@react-native-async-storage/async-storage` (chat history) |
| UI accents | `expo-linear-gradient` |
| Network host detection | `expo-constants` |

> **Why SDK 54?** It must match the SDK your **Expo Go** app supports. Newer SDKs (56/57) exist on
> npm but their iOS Expo Go builds may not be released yet. If Expo Go says *"project is incompatible"*,
> the project SDK is ahead of your Expo Go — align them (see Troubleshooting).

---

## 2. Prerequisites

- **Node.js** 18+ and npm
- The **Expo Go** app on your phone (iOS/Android), on the **same Wi-Fi** as your computer
- The **backend running** and reachable on your LAN (see below)

---

## 3. Run it

```bash
cd frontend
npm install          # first time only
npx expo start -c    # -c clears the Metro cache (use after any SDK/dep change)
```

Then **scan the QR** shown in the terminal with your phone's Camera (iOS) or the Expo Go app (Android).

The backend **must** be started so your phone can reach it over Wi-Fi:

```bash
cd ../backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

> `--host 0.0.0.0` is essential — `127.0.0.1`/`localhost` would only be reachable from the PC itself,
> not from your phone.

---

## 4. How it finds the backend (no config needed)

`src/api.js` auto-detects your PC's LAN IP from Expo's Metro host and targets port **8000**:

```
Metro host  10.122.207.33:8081   →   API base  http://10.122.207.33:8000
```

So switching Wi-Fi networks "just works". If auto-detection ever fails, edit the fallback IP at the
bottom of `resolveBaseUrl()` in `src/api.js`.

---

## 5. Project structure

```
frontend/
├── App.js                      # Root + simple screen router (state-based navigation)
├── app.json                    # Expo config (dark UI, mic permission, plugins)
└── src/
    ├── api.js                  # API client + LAN-IP auto-detection (all backend calls)
    ├── theme.js                # Premium dark-theme tokens (colors, spacing, radius)
    ├── ui.js                   # Reusable UI (Screen, Card, Field, GradientButton, Pill…)
    ├── constants.js            # LANGUAGES list + name→ISO-code helper
    ├── AuthContext.js          # Auth state (token + user), signup/login/logout
    ├── history.js              # Per-persona chat persistence (AsyncStorage) + hook
    ├── audio.js                # Record/play helpers (save base64 mp3, playback, mic perms)
    ├── VoiceInputButton.js     # Mic button: record → transcribe → return text
    └── screens/
        ├── AuthScreen.js           # Sign up / log in
        ├── PersonasScreen.js       # Persona list; each card has Chat & Voice buttons
        ├── CreatePersonaScreen.js  # Create a persona (+ language, + upload voice to clone)
        ├── ChatScreen.js           # Text chat (persisted)
        ├── VoiceScreen.js          # Voice: record → review/edit/re-record → send → hear reply
        └── PersonaSettingsScreen.js# Edit details/language, pick or upload/clone a voice, delete
```

---

## 6. Screens & flow

```
AuthScreen ──(signup/login)──► PersonasScreen
                                  │   each persona card:
                                  ├── 💬 Chat  ─► ChatScreen   (text, persisted)
                                  ├── 🎤 Voice ─► VoiceScreen  (talk & listen, persisted)
                                  ├── ＋ New    ─► CreatePersonaScreen
                                  └── ⚙︎ (in chat) ─► PersonaSettingsScreen
```

- **Auth** — one-step sign-up (email, password, name, age, language) creates the account **and**
  profile; or log in. The token is held in memory for the session.
- **Personas** — lists your personas; **long-press** a card to delete.
- **Create** — pick type (Companion/Legacy), fill details, set **what they should call you** (a
  name or nickname like "kanna"), choose the **language they speak** (type any language or quick-pick),
  **pick a ready-made voice** from the **ElevenLabs Voice Library** (many languages), optionally
  **record the personality by voice** (transcribed into the
  chosen language), and optionally **upload a recording to clone their voice**.
- **Chat (text)** — classic chat; history is **saved on the device** and reloads after the app closes.
- **Voice** — a centred mic: tap to record → it transcribes → **review, edit, or re-record** → send →
  the reply text appears and the **spoken audio plays**. Shares history with Chat mode.
- **Settings** — edit details/language, **pick a Voice Library voice** (filter by gender/age and a
  **type-to-search language**; **▶ preview** each before choosing), **upload a recording to clone** a
  voice, or delete the persona.

> **Voice picker** now searches the **ElevenLabs Voice Library** (`/v1/shared-voices`) — thousands of
> voices in many languages (Tamil, Hindi, Arabic, Japanese…), not just the account's English premade
> voices. Gender/age are quick chips; **language is a type-to-search dropdown**; results default to the
> **`conversational`** use-case (best for a talking persona). Library voices work directly for TTS — no
> voice slot is consumed.

---

## 7. Notes & limitations

- **Voice cloning is upload-only** — you pick an existing audio file (e.g. an old recording of the
  deceased). No live recording for cloning. Each clone uses one ElevenLabs voice slot on the backend.
- **Download a synthetic voice to demo cloning** — Create and Settings both offer **♂ Male / ♀ Female**
  buttons that download a **free AI-generated** voice sample (save to Files, then upload it to clone).
  This shows the cloning pipeline with **no real-person data** — no ethics approval or copyright needed.
- **Native accent, made easy.** The model *speaks* any language, but the accent comes from the voice.
  The voice picker now searches the **Voice Library**, so you can pick a genuinely native voice
  (e.g. a real Tamil speaker) for an authentic accent — no clone needed. Uploading/cloning a
  native-speaker recording is still an option for a specific person's voice.
- **No live-while-speaking transcription.** Text appears the moment you stop recording (review-then-send).
  True real-time transcription needs a native speech module, which requires a custom **dev build**
  (not available in Expo Go).
- **Chat history** is stored locally per persona (AsyncStorage). The backend keeps its own rolling
  **summary** memory, so the persona still "remembers" even if local history is cleared.
- **AI transparency** — every conversation shows a notice that the persona is an AI recreation.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| *"Project is incompatible with this version of Expo Go"* | The project SDK is newer than your Expo Go. Check Expo Go → Settings for its supported SDK, then align: `npm install expo@<that-sdk>` and `npx expo install --fix`. |
| *"Port 8081 is being used… Skipping dev server"* | A zombie Metro is running; close it (or press `y` for another port) so your phone scans the new QR, not the old one. |
| Login/chat fails with a network error | Backend not reachable — ensure it runs with `--host 0.0.0.0`, phone is on the same Wi-Fi, and **Windows Firewall** allows Python on Private networks (port 8000). |
| Voice endpoints error / no sound | The backend needs `ELEVENLABS_API_KEY` set; check the mic permission was allowed on the phone. |
| Old code keeps showing | `npx expo start -c` to clear the Metro cache, and reload the app (shake → Reload). |

---

Built by **Ashwin Kumar Ramesh Kumar** — MSc AI, University of Sheffield.

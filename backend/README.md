# NinaivX — Backend

> The Operating System for Legacy & Human Connection.
> A privacy-first, multi-persona **voice AI** backend. It lets a user hold a real,
> spoken conversation with two kinds of AI persona:
>
> - **Deceased** — the preserved voice & personality of a loved one who has passed (a memorial/legacy persona). **Air-gapped** from the internet for safety.
> - **Companion** — a living, supportive friend/partner. **Web-connected** so it can talk about current events.

---

## 1. What this backend is

A **FastAPI** server that ties together four things:

| Layer | Technology | Role |
|-------|-----------|------|
| **API** | FastAPI | The doors the mobile app talks to (HTTP). |
| **Brain (agent)** | LangGraph + AWS Bedrock (Claude Sonnet 4.6) | Decides how to respond, routes by persona, uses tools. |
| **Voice** | ElevenLabs | Speech-to-Text (Scribe), Text-to-Speech, voice cloning. |
| **Data** | Supabase (Postgres) via SQLAlchemy | Users, personas, and conversation memory. |

The mobile app (React Native) **never** talks to the brain or the database directly.
It only ever calls the **API**. Everything else happens behind the API.

```
                    ┌─────────────────────────────────────────────┐
  React Native ───► │  FastAPI  (app/api/routes.py, prefix /api)   │
   (mobile app)     │  - verifies Supabase token (auth)           │
                    │  - checks the persona belongs to the user   │
                    └───────────────┬─────────────────────────────┘
                                    │ run_agent()
                                    ▼
                    ┌─────────────────────────────────────────────┐
                    │  LangGraph agent  (app/agents/graph.py)     │
                    │                                             │
                    │   START ──(supervisor routes by type)──┐    │
                    │     │                                  │    │
                    │  deceased_agent                companion_agent
                    │  (air-gapped)                  (web-connected)│
                    │     │                                  │    │
                    │    END               needs live info? ─┴─► web_search tool
                    └───────┬──────────────────────────┬──────────┘
                            │                          │
                  ┌─────────▼────────┐      ┌──────────▼─────────┐
                  │  AWS Bedrock     │      │  ElevenLabs        │
                  │  (Claude)        │      │  (STT / TTS / clone)│
                  └──────────────────┘      └────────────────────┘
                            │
                  ┌─────────▼────────┐
                  │  Supabase / PG   │  (memory summary per conversation)
                  └──────────────────┘
```

---

## 2. Project structure

```
backend/
├── app/
│   ├── main.py                  # Creates the FastAPI app, mounts the /api router
│   ├── core/
│   │   ├── config.py            # Settings loaded from .env (Pydantic)
│   │   └── auth.py              # Supabase JWT verification + Swagger Authorize (HTTPBearer)
│   ├── api/
│   │   └── routes.py            # All endpoints (auth proxy + authenticated API, prefix /api)
│   ├── agents/
│   │   ├── graph.py             # The compiled LangGraph + run_agent() entry point
│   │   ├── supervisor.py        # Routing logic (deceased vs companion)
│   │   ├── deceased.py          # Deceased persona node (air-gapped, no tools)
│   │   ├── companion.py         # Companion persona node (web-connected)
│   │   ├── tools.py             # web_search tool (DuckDuckGo via httpx)
│   │   ├── prompts.py           # System prompts for each persona (TTS-tuned)
│   │   └── state.py             # AgentState (the data passed between nodes)
│   ├── services/
│   │   ├── llm_service.py       # Bedrock/Claude connection + memory summariser
│   │   └── voice_service.py     # ElevenLabs wrappers (TTS/STT/clone/voice list + filter)
│   └── db/
│       ├── database.py          # SQLAlchemy engine + session
│       └── models/
│           ├── user.py          # User table
│           ├── persona.py       # Persona table (+ PersonaType enum)
│           └── conversation.py  # Conversation table (rolling memory summary)
├── requirements.txt
└── .env                         # Secrets (NOT committed)
```

---

## 3. How it actually works (request lifecycle)

### Getting a token
The client signs up / logs in with **Supabase Auth** (directly via the SDK, or through the
`/api/auth/signup` and `/api/auth/login` proxies) and receives an `access_token`. That token is
sent on every subsequent request. The backend only ever **verifies** it — it never stores passwords.

### Text chat (`POST /api/chat`)
1. The app sends `{ persona_id, user_message }` with a `Bearer <supabase_jwt>` header.
2. **Auth** (`get_current_user`) verifies the token with Supabase and loads the user's profile.
3. The route checks the persona **belongs to that user** (prevents accessing someone else's persona).
4. `run_agent()` builds the agent state and invokes the **LangGraph graph**:
   - The **supervisor** reads `persona_type` and routes to the right node.
   - **Deceased** node → answers from personality + memory only (no internet).
   - **Companion** node → may call the `web_search` tool, loop back, then answer.
5. The reply text is returned to the app **immediately**.
6. The **memory summary** is updated in a **background task** (after the response is sent), so the user never waits for it.

### Voice "phone call" (`POST /api/voice-chat`)
```
user's recorded audio
   → ElevenLabs Scribe (speech-to-text)
   → LangGraph agent (same brain as text chat)
   → ElevenLabs TTS (spoken in the persona's own cloned voice)
   → audio (MP3) streamed back to the app
```
The response is JSON — `{ transcript, reply, audio_base64 }` — so the full text (any
language, any length) is returned alongside the spoken audio. The app can also do a
**review-before-send** flow: `POST /api/stt` transcribes the recording, the user checks/edits
or re-records, then `POST /api/chat-voice` sends the confirmed text and returns the spoken reply.

---

## 4. The two persona modes (the core idea)

| | **Deceased** | **Companion** |
|---|---|---|
| Purpose | Comfort, closure, remembrance | Cure for loneliness, daily companion |
| Internet access | ❌ **Air-gapped** (no tools bound) | ✅ **Web-connected** (`web_search`) |
| Why | A deceased loved one must never "hallucinate" fake news | A living friend should know what's happening now |
| Enforced by | Code, not just a prompt — the deceased node literally has no tools | The companion node has the search tool bound |

This privacy guardrail is a **code-level guarantee**: even if the model "wanted" to
search the web as the deceased persona, it physically cannot, because that node is
never given the tool.

### Content safety (by mode)
- **Legacy (deceased)** — a legacy persona may represent a person of **any age, including a child**, so its prompt enforces an **absolute, non-negotiable safety rule**: it will **never** produce sexual, romantic or adult/explicit content, and firmly declines and redirects any attempt to steer it there. Its only purpose is comfort, remembrance and closure.
  - **Temporal grounding:** an optional **`year_of_passing`** constrains the persona's knowledge to their lifetime. The air-gap blocks *live* internet, but the model's built-in training knowledge still spans up to its cutoff (~2024–2025); without a death year the persona could wrongly reference **post-death** events (e.g. a 2020 event for someone who died in 2015). With the year set, the prompt tells it *"your knowledge stops at {year}; if asked about anything after, say you weren't around for it — never guess."*
- **Companion** — a companion is always an **adult (18+)** talking with an adult user, so it may engage **maturely with 18+ themes** when the user leads, while still refusing anything illegal, involving minors, or promoting serious harm.

### Memory
We do **not** store every message. Instead each conversation keeps a single rolling
**summary** (`conversations.current_summary`). After each turn, Claude rewrites the
summary to fold in what was just said. The next turn injects that summary into the
prompt, so the persona "remembers" without a huge message history.

---

## 5. Data model

```
User (1) ───< (many) Persona (1) ─── (1) Conversation

User
  id            = Supabase Auth UID (string, primary key)
  name, age, language

Persona
  id, user_id (FK -> User.id)
  persona_type            = "deceased" | "companion"   (enum)
  name, age, gender, relationship_with_user
  personality_text        = who they are (used to build the prompt)
  cause_of_death          = deceased only
  year_of_passing         = deceased only — grounds the persona to their lifetime (no post-death knowledge)
  language                = this persona's conversation language (falls back to the user's)
  user_nickname           = what the persona calls the user (e.g. "beta"; falls back to the user's name)
  elevenlabs_voice_id     = the cloned/selected voice for TTS

Conversation               (one per persona)
  persona_id (FK, unique)
  current_summary         = the rolling memory "checkpoint"
  langgraph_thread_id
```

---

## 6. Setup & run

### Prerequisites
- Python 3.11
- A Supabase project (Postgres + Auth)
- AWS Bedrock access (Claude)
- An ElevenLabs API key (for voice)

### 1) Create `.env` in `backend/`
```ini
# Project
PROJECT_NAME=NinaivX API
VERSION=1.0.0

# Database & Auth (Supabase)
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/postgres
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_KEY=sb_publishable_xxx          # anon / publishable key

# AWS Bedrock (the brain)
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=eu-north-1
BEDROCK_MODEL_ID=eu.anthropic.claude-sonnet-4-6

# ElevenLabs (the voice)
ELEVENLABS_API_KEY=xxx
```

### 2) Install dependencies
```bash
pip install -r requirements.txt
```

### 3) Run the server
```bash
uvicorn app.main:app --reload
```
- Interactive docs: <http://localhost:8000/docs>
- Health check: <http://localhost:8000/health>

On startup the app creates any missing tables in your Supabase database automatically.

> **Note:** Free Supabase projects auto-pause after ~1 week of inactivity. If you
> get a `tenant/user ... not found` connection error, resume the project from the
> Supabase dashboard.

---

## 7. API reference (all under `/api`, all require auth)

Every request must include the Supabase access token:
```
Authorization: Bearer <supabase_access_token>
```

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/signup` | `email, password, name, age, language` | **Public.** Creates the account **and** the profile in one step; returns an `access_token` (if email confirmation is off). **Strictly validated:** valid email, password ≥ 8 chars, non-blank name/language, and **adults only — `age` must be 18–120** (so the project involves no minors). Invalid input is rejected with `422`. |
| POST | `/api/auth/login` | `email, password` | **Public.** Log in and receive a Supabase `access_token` |
| GET | `/api/me` | — | Get the current user's profile |
| POST | `/api/personas` | persona fields (incl. `language`, `user_nickname`, **required** `elevenlabs_voice_id`) | Create a deceased/companion persona. **Strictly validated:** `name`, `gender`, `relationship_with_user` and a **voice** (`elevenlabs_voice_id`) are required; `personality_text` ≥ 10 chars; `cause_of_death` is allowed **only** for a legacy persona. **Age rule by type:** a **companion must be an adult (18–120)**; a **legacy (deceased) persona may be any age 1–120** (e.g. a lost child). Invalid input is rejected with `422`. |
| GET | `/api/personas` | — | List the user's personas |
| GET | `/api/personas/{id}` | — | Get one persona (full details) |
| PATCH | `/api/personas/{id}` | any persona fields (partial) | Update a persona (only the fields you send) |
| DELETE | `/api/personas/{id}` | — | Delete a persona and its memory |
| POST | `/api/personas/{id}/select-voice` | `voice_id` | Assign a ready-made voice (from `/api/voices`) to a persona |
| POST | `/api/chat` | `persona_id, user_message` | Text chat → `{ reply }` |
| POST | `/api/stt` | form: audio `file`, optional `language_code` | Transcribe audio → `{ transcript }` (for review before sending in Voice mode) |
| POST | `/api/chat-voice` | `persona_id, user_message` | Text in → `{ reply, audio_base64 }` (spoken reply for a reviewed transcript) |
| POST | `/api/voice-chat` | form: `persona_id` + audio `file` | **Full voice loop**: audio in → `{ transcript, reply, audio_base64 }` |
| POST | `/api/clone-voice` | form: `name, description, file`, **required** `rights_confirmed=true`, optional `persona_id` | Clone a voice from an uploaded recording; if `persona_id` given, save it to that persona. **Consent gate:** the caller must confirm they have the right to use the recording (`rights_confirmed=true`) or it's rejected with `400` — enforced server-side, so it can't be bypassed via the API. |
| GET | `/api/voices` | query: `gender`, `age`, `language`, `use_case`, `limit` | Search the ElevenLabs **Voice Library** (`/v1/shared-voices`, many languages), filtered by preference. `use_case` defaults to `conversational`; `limit` defaults to 5. Each result includes a `preview_url`. |
| GET | `/api/synthetic-voice` | query: `gender` (male/female) | Free AI-generated voice sample (MP3) — upload it to demo cloning with **no real-person data** |
| GET | `/api/disclosure` | — | **Public.** AI-transparency notice for the app to show at onboarding + as an in-app indicator |

> **`persona_type` is fixed** after creation (a deceased persona can't become a companion), so it isn't accepted by PATCH.

Public (no auth): `GET /`, `GET /health`, `GET /api/disclosure`, `POST /api/auth/signup`, `POST /api/auth/login`.

### Two kinds of "user" — important

This backend does **not** store passwords. There are two separate records:

| | **Supabase Auth account** | **Your `users` table (profile)** |
|---|---|---|
| Holds | email + password (credentials) | name, age, language |
| Created by | `POST /api/auth/signup` — one call makes both | (same call) |
| Lives in | Supabase Auth | Your database |

They are linked because **`User.id` IS the Supabase Auth UUID**. Users are identified by their
**email** (in Supabase) — there is no separate username. `POST /api/auth/signup` creates both
records in a single step; the profile fields (name, age, language) are sent alongside the
credentials.

`/api/auth/signup` and `/api/auth/login` are thin **proxies to Supabase Auth**: Supabase remains
the identity provider and owns the credentials, but the API can be driven end-to-end (e.g. from
Swagger) without the mobile app. In production the React Native client calls Supabase directly
via the SDK; these endpoints mirror exactly what it does.

### Trying it in Swagger (no frontend needed)

Open <http://localhost:8000/docs>, then:

1. `POST /api/auth/signup` with `{"email":"...","password":"...","name":"...","age":24,"language":"English"}`
   → this creates the account **and** your profile, and returns an `access_token`.
2. Click the **Authorize** button (top right) and paste the token (no `Bearer ` prefix).
3. `POST /api/personas` → create a persona; then `POST /api/chat` to talk to it.

> **Dev note:** if the Supabase project has **Confirm email** enabled, signup returns no token
> until the address is confirmed. Turn it off (Dashboard → Authentication → Sign In / Providers →
> Email) for local testing, and **turn it back on before any real deployment**.

---

## 8. curl cheat-sheet

> Get `TOKEN` from `POST /api/auth/signup` or `POST /api/auth/login` below (or from the
> client's Supabase session). It is the Supabase `access_token`.

```bash
BASE="http://localhost:8000"

# 0a. Create an account + profile in one step (returns access_token if email confirmation is off)
TOKEN=$(curl -s -X POST $BASE/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"TestPass123!","name":"Ashwin","age":24,"language":"English"}' \
  | python -c "import sys,json; print(json.load(sys.stdin).get('access_token') or '')")

# 0b. Or, if you already have an account, log in to get a fresh token
# TOKEN=$(curl -s -X POST $BASE/api/auth/login \
#   -H "Content-Type: application/json" \
#   -d '{"email":"you@example.com","password":"TestPass123!"}' \
#   | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. Create a DECEASED persona (air-gapped)
curl -X POST $BASE/api/personas \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "persona_type":"deceased",
    "name":"Arthur","age":78,"gender":"Male",
    "relationship_with_user":"Grandfather",
    "personality_text":"Warm, wise, loved gardening and old stories.",
    "cause_of_death":"old age, peacefully in his sleep"
  }'

# 3. Create a COMPANION persona (web-connected)
curl -X POST $BASE/api/personas \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "persona_type":"companion",
    "name":"Maya","age":25,"gender":"Female",
    "relationship_with_user":"Best Friend",
    "personality_text":"Bubbly, supportive, loves current events and sports."
  }'

# 4. List / get / update / delete personas
curl $BASE/api/personas -H "Authorization: Bearer $TOKEN"
curl $BASE/api/personas/<PERSONA_ID> -H "Authorization: Bearer $TOKEN"

# Partial update - change only the personality (everything else untouched)
curl -X PATCH $BASE/api/personas/<PERSONA_ID> \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"personality_text":"Warm, wise, loved cricket and bedtime stories."}'

curl -X DELETE $BASE/api/personas/<PERSONA_ID> -H "Authorization: Bearer $TOKEN"

# 5. Text chat
curl -X POST $BASE/api/chat \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"persona_id":"<PERSONA_ID>","user_message":"Hi, I had a hard day."}'

# 6. Full voice loop: send a recording, get spoken reply back
curl -X POST $BASE/api/voice-chat \
  -H "Authorization: Bearer $TOKEN" \
  -F "persona_id=<PERSONA_ID>" \
  -F "file=@my_recording.mp3" \
  --output reply.mp3

# 7. Clone Grandpa's voice AND link it to his persona in one step
#    (pass persona_id so the cloned voice_id is saved onto the persona)
curl -X POST $BASE/api/clone-voice \
  -H "Authorization: Bearer $TOKEN" \
  -F "name=Grandpa Arthur" \
  -F "description=Warm elderly male voice" \
  -F "persona_id=<PERSONA_ID>" \
  -F "file=@grandpa_sample.mp3"
# After this, /api/voice-chat for that persona speaks in the cloned voice automatically.

# 8. OR pick a ready-made voice instead of cloning
curl $BASE/api/voices -H "Authorization: Bearer $TOKEN"            # see options + voice_ids
curl -X POST $BASE/api/personas/<PERSONA_ID>/select-voice \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"voice_id":"<PICKED_VOICE_ID>"}'
```

---

## 9. Design decisions & notes

- **Why an agent and not a plain function?** A plain function runs fixed steps. The
  agent can *decide* — e.g. the companion decides on its own whether to search the
  web, then loops back with the result (the ReAct pattern). The deceased persona is
  deliberately denied that ability. That decision-making is the whole point of the
  agent layer.
- **Memory = summary, not transcript.** Keeps storage tiny and prompts short while
  still feeling like the persona remembers you.
- **Latency.** The memory-summary rewrite (a second LLM call) runs as a background
  task, so the user gets their reply/audio without waiting for it.
- **Auth.** Supabase issues the JWT; the backend verifies it on every request. Our
  `User.id` equals the Supabase Auth UID, so they map 1:1. `SUPABASE_KEY` is the
  publishable (anon) key — the backend does not perform admin/service operations.
- **Voice resilience.** If `ELEVENLABS_API_KEY` is missing, the app still boots;
  voice endpoints return a clear `503` instead of crashing at startup.
- **AI transparency.** The persona stays in character but never actively deceives: if a user directly asks, it
  honestly confirms it is an AI recreation. A disclosure notice is exposed via `GET /api/disclosure` (and in the
  profile/persona responses) for the app to show at onboarding and as an in-app indicator (per Hollanek 2024).
- **TTS-tuned prompts.** Persona replies contain no emojis or stage directions and
  use natural pauses (`...`, `—`) so they sound right when spoken aloud.
- **Personal address.** Each persona has a `user_nickname` — what it calls the user (their name, or a
  term of endearment like "beta" / "kanna"). It's injected into the prompt so the persona addresses the
  user naturally, adding to the emotional realism (e.g. a grandfather calling you "my boy").
- **Multilingual, colloquially.** Each persona has its own `language`; the prompt tells the model
  to speak that language the way a native does — casual, colloquial, with local slang and natural
  English code-mixing — not formal/textbook. `eleven_turbo_v2_5` speaks it; Scribe auto-detects it.
- **Native accent = the voice.** The model *pronounces* any language, but the accent comes from the
  voice asset. For an authentic accent (e.g. Tamil), upload/clone a native-speaker recording; the
  default library voices are English-accented.
- **Ethics & voice licensing.** The project is designed to need **no ethics approval**: it uses
  **synthetic personas** and **synthetic voices** only — ElevenLabs' listed (default) voices are
  licensed under ElevenLabs' terms, and cloning is demonstrated on **AI-generated samples**
  (`GET /api/synthetic-voice`), not on any real person. Cloning a real, identifiable person's voice
  would require consent, licensing and ethics approval, and is deliberately kept out of scope for the
  demo and evaluation. See `docs/NinaivX-Ethics-Voice-Licensing.pdf`.

---

## 10. Status

| Capability | Status |
|------------|--------|
| Supervisor routing (deceased vs companion) | ✅ working |
| Air-gapped deceased / web-connected companion | ✅ working |
| Web search tool (live results) | ✅ working |
| Summary-based memory across turns | ✅ working |
| Supabase JWT auth + persona ownership | ✅ working |
| One-step signup + profile (`/api/auth/signup`, `/api/me`) | ✅ working |
| Persona management (create / list / get / update / delete) | ✅ working |
| Text chat (`/api/chat`) | ✅ working |
| Full voice loop — STT → agent → TTS (`/api/voice-chat`) | ✅ working |
| Review-before-send voice (`/api/stt` → `/api/chat-voice`) | ✅ working |
| Per-persona language + colloquial multilingual replies | ✅ working |
| Voice cloning from an uploaded recording (`/api/clone-voice`) | ✅ working |
| Pick a Voice Library voice, filter by gender/age/language + `conversational` default, with previews (`/api/voices`, `/select-voice`) | ✅ working |
| Record personality/memories by voice (STT, in the persona's language) | ✅ working |
| Background memory update (latency) | ✅ working |
| Voice resilience (boots without ElevenLabs key, 503 on call) | ✅ working |
| AI-transparency disclosure (honest if asked + `/api/disclosure`) | ✅ working |
| Auth proxy endpoints (`/api/auth/signup`, `/api/auth/login`) + Swagger Authorize | ✅ working |
| React Native (Expo) mobile app — auth, personas, text & voice chat | ✅ working |

### Not done yet (next steps)
| Item | Status |
|------|--------|
| Authenticated happy-path tested with a real frontend login token | ⏳ pending (needs app login; auth *enforcement* verified) |
| Deployment (hosting, HTTPS, env config on a server) | ⏳ pending |
| Tighten CORS (currently `*`) and rate limiting | ⏳ pending |
| Live clone test on real ElevenLabs account (uses a clone slot) | ⏳ pending |
| Native-accent voices per language (add to ElevenLabs library / clone) | ⏳ pending (library is English-only by default) |
| Real-time streaming / live transcription while speaking (needs a dev build) | ⏳ future work |

Built by **Ashwin Kumar Ramesh Kumar** — MSc AI, University of Sheffield.

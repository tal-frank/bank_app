# Roadmap

The 13 phases from the worksheet (~18.5 days), with the design decided for each.
Status lives in `progress.md`, not here.

## Core requirements (worksheet)
1. **Sign up:** email, password, phone; unique email (else error); valid email and phone formats.
2. **OTP:** 6 random digits by SMS or email; correct → registered + dashboard; wrong → error.
3. **Dashboard:** protected; random starting balance at sign-up; balance + recent transactions; Sign Out → login page.
4. **Login:** email + password → dashboard, else error.
5. **Transfer:** to another user's email + amount; errors for low balance / unknown email;
   sender sees receiver email and `-amount`, receiver sees sender email and `+amount`.

## Phases

| # | Days | Phase | Key design |
|---|---|---|---|
| 1 | 2 | REST API in Swagger + sequence diagrams | `server/src/docs/openapi.yaml` (OpenAPI 3.0.3), `docs/sequence-diagrams.md` (sign-up/OTP, login/refresh/logout, transfer) |
| 2 | 2 | Backend, in-memory store, Postman | Express 5 layers; zod; bcrypt; JWT access + rotating refresh cookie; OTP senders console/smtp/twilio; rate limits; atomic in-memory transfer |
| 3 | 1 | MongoDB + Mongoose | Rewrite repositories only. Unique index on email (dup key 11000 → `DuplicateEmailError`). `$inc` for OTP attempts; conditional `findOneAndUpdate` for `markVerified`. Transfer in `session.withTransaction` (needs a replica set: Atlas, or Docker `--replSet`). TTL index on refresh tokens; TTL on `otp.expiresAt` deletes pending users when their code expires. Add DB schemas to the spec |
| 4 | 0.5 | Figma | 5 screens on MUI: Registration (+ OTP step, channel toggle), Login, Logout, Dashboard, Transfer; plus error states |
| 5 | 2 | React frontend | Vite + React + TS + MUI + React Router + axios. `AuthContext` (access token in memory), `ProtectedRoute`. Single in-flight refresh on `TOKEN_EXPIRED`. react-hook-form + zod mirroring server rules. Amounts: user types ₪, send agorot. Disable Submit during a transfer. Built with: page number in the URL, `endReason` for redirects, BroadcastChannel (tab sync, per user), Web Locks around refresh, one user per browser |
| 6 | – | Deploy: Render (API) + Vercel (web) | Atlas URI; CORS = Vercel origin; refresh cookie `sameSite: 'none'` + `secure`; `app.set('trust proxy', 1)`; `/api/health` |
| 7 | 2 | Socket.IO notifications | Attach to the `http` server in `server.js`; JWT in handshake; room `user:<id>`; emit `transaction:received` / `balance:updated` after commit |
| 8 | 1 | Customer-service chatbot | `POST /api/chat`; model behind `ai/llm.js` (`LLM_PROVIDER`, `LLM_MODEL`); streamed replies; chat drawer in UI |
| 9 | 3 | LangGraph banking assistant | Tools bound to the JWT user server-side: balance, recent transactions, explain transaction, `prepare_transfer` (draft only; user confirms in UI). MongoDB checkpointer (thread = userId:conversationId). Langfuse tracing. Guardrails |
| 10 | 1 | Docker | Multi-stage `node` alpine image, non-root, `npm ci --omit=dev`; compose: api + mongo (single-node replica set) |
| 11 | 2 | Jitsi video call sender ↔ receiver | Room name from hash(transaction id + secret); invite via Socket.IO; only the two parties get the room |
| 12 | 1 | Backend tests: Jest + Supertest | `mongodb-memory-server` (replica set); mock senders and LLM; cover every error code, refresh rotation/reuse, concurrent transfers |
| 13 | 1 | Frontend tests: Cypress | Full E2E: sign up → OTP → dashboard → transfer → sign out → login error. Needs a way to read OTPs in tests (test-only endpoint, never in production): decide then |

## Open items to pick up later
- Optional: `Idempotency-Key` on transfers (protects against double submits).
- Optional: Twilio API Key (`SK...`) instead of the main Auth Token.
- Before real email/SMS: user needs an Ethereal inbox (or Gmail app password) and a Twilio trial;
  set `OTP_EMAIL_MODE=smtp` / `OTP_SMS_MODE=twilio` + credentials in `server/.env`.
- Study questions (worksheet pages 5–6): answer in `docs/answers.md` as phases cover them.

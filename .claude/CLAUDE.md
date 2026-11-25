# Bank App

Full-stack web banking app built from the ILRD worksheet `~/Downloads/banks.docx.pdf`:
sign up (email + password + phone), verify with a 6-digit OTP (email or SMS), log in,
dashboard with a random starting balance and transactions, transfer money by email.
Later phases add Socket.IO notifications, an LLM chatbot, a LangGraph assistant,
Docker, Jitsi video calls and tests. The user is learning this stack: explain *why*.

Current state: @progress.md
Full phase plan: `.claude/roadmap.md` (read when planning or starting a phase).

## Working with this user
- **Short, concise, accurate answers.** No walls of text; the user asks for more.
- Flow per step: user asks "walk me through X" → explain briefly → user says "build X".
  Don't build before being asked.
- **Never commit unless the user asks.** They often answer "Not yet". Branch: `bank_app`
  (local, in the `/home/tlfk/git` repo; never push).
- Comment new code with what it does and why: the comments are part of the lesson.
- Never print or read `.env` values; secrets go only in `server/.env`, never in chat.
- End a session with `/update` so the next one can resume from the Now block.

## Stack and layout
- Backend: Node 26 (nvm: `source ~/.nvm/nvm.sh` first), Express 5, JavaScript ES modules.
- Frontend (Phase 5): React + TypeScript + Vite + MUI. DB: MongoDB Atlas (M0, replica set) + Mongoose; `MONGODB_URI` required to start.
- LLM provider (Phases 8–9): undecided; keep it swappable behind one factory.

```
server/src/
  server.js app.js            entry point / Express app (app exported for Supertest)
  config/env.js               every setting, checked with zod; import `env` from here
  config/db.js                connectDb (before listen, builds indexes) / disconnectDb
  models/                     Mongoose schemas: User, Transaction, RefreshToken (used only by repositories)
  docs/openapi.yaml           the API contract (source of truth)
  routes/ → middleware/ → controllers/ → services/ → repositories/
  validation/                 zod schemas mirroring openapi.yaml
  otp/                        otpService + senders (console | smtp | twilio)
  utils/                      AppError, tokens, password, otp, refreshCookie, views
client/src/                   React app (Phase 5): api/ (axios client, one fn per endpoint),
                              auth/ (AuthProvider, guards), pages/, components/, validation/, utils/
docs/                         sequence diagrams (Mermaid), Postman collection + environment,
                              wireframes/ (Phase 4 screens + error states; see its README)
```

Commands: `server/`: `npm run dev` (watch, :3000), `npm start`. `client/`: `npm run dev` (:5173),
`npm run build` (tsc + vite), `npm run lint` (oxlint).
The user runs their own servers on :3000/:5173. For your own testing use the `.claude/launch.json`
configs `server-test` (:3100, test mode, 1-min tokens/OTPs, console OTP) and `client-test` (:5180);
stop them before ending the turn (a forgotten `npm run dev` once blocked the user's :3000).
There are no automated tests in the repo yet (Phase 12).

## Conventions (keep them)
- **Spec first:** change `openapi.yaml` in the same step as any API change.
- **Money = integer agorot.** Never floats. `amount` in JSON must be a number, not text.
- **Identity comes only from the JWT** (`req.user.id`): no `/users/{id}`, no ids in bodies.
- **One error shape:** `{ error: { code, message, fields? } }`. Throw `AppError(status, code, msg)`;
  `errorHandler` formats it. New codes go into the spec's `Error.code` enum.
- Request chain: `rate limit → validate(schema) → auth → controller → service → repository`.
  Controllers are thin and read `req.validated.body/query` (Express 5 `req.query` is read-only).
  Services hold the rules and know nothing about HTTP.
- **Repositories** (the only storage code): async functions, return copies, and do every
  check-then-change in ONE step (`create` = unique email, `markVerified`, `incrementOtpAttempts`,
  `transactionRepo.transfer`). They throw storage-neutral errors (`repositories/errors.js`).
  Only repositories touch Mongoose models; they return plain objects with string `id`s
  (`mongoHelpers.js`), and a bad id finds nothing instead of throwing.
- Responses use whitelists: `toPublicUser`, `toTransactionView`.
- Pending (unverified) users live only as long as their OTP (TTL index on `otp.expiresAt`).
  Never give a verified user an `otp`, or MongoDB deletes them.
- Frontend: only route guards redirect on auth changes (`ProtectedRoute` reads `endReason`,
  `GuestRoute` reads `from`); pages just call `signIn()`/`signOut()`. A page calling `navigate()`
  right after a state change races the guard and loses.
- Frontend: money stays agorot; ₪ text -> agorot via string parsing (`parseShekelsToAgorot`), never floats.
  Client zod rules copy the server's rules and messages.
- One user per browser profile (shared refresh cookie): tab messages carry the userId, and a refresh
  returning another user's token is discarded. Refresh runs under a Web Lock (tabs take turns).
- Passwords: bcrypt cost 12. OTP: `crypto.randomInt`, bcrypt cost 10, 5 min, 5 attempts.
  Access JWT: HS256 pinned, 15 min. Refresh token: random 32 bytes, stored as SHA-256,
  httpOnly cookie on `/api/auth`, rotated on use, reuse signs out all sessions.

## Gotchas
- Root `/home/tlfk/git/.gitignore` ignores `*.txt` (would hide e.g. `robots.txt`).
- VS Code (1.124) renders Mermaid natively; the `bierner.markdown-mermaid` extension conflicts.
- `libphonenumber-js` default metadata checks length only; `/max` rejects valid numbers like +972501234567.
- Phase 6 must change: refresh cookie `sameSite` → `'none'` (+ `secure`), and `app.set('trust proxy', 1)`.
- The transfer endpoint is `POST /transactions` (not `/transactions/transfer`).

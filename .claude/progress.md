# Progress

<!-- NOW:START - rewritten by /update. Read this first in every new session. -->
## Now
- **Updated:** 2026-11-24
- **Where we are:** Phase 5 (React frontend) done: all 6 steps + multi-tab fixes. Next: Phase 6 or 7.
- **Git:** branch `bank_app` (local); last commit `cfcb771` (Phase 1). Uncommitted (Phases 2–5):
  `server/` (all code; this session: TTL for pending users in `models/User.js`, `userRepo.deleteExpiredPending`,
  `authService.signup`, `openapi.yaml`), `client/` (whole React app, new), `docs/` (Postman, `wireframes/`
  incl. README endpoint fixes), `.gitignore`, `.claude/` (+ `launch.json`). 1 ahead / 4 behind `main`.
- **Next step:** ask the user: Phase 6 (deploy) or Phase 7 (Socket.IO real-time balance/transactions;
  user asked for it, walk-through already given). Then walk through the chosen phase.
- **Waiting on the user:** whether to commit Phases 2–5; Gmail SMTP in `server/.env` (as of the last
  check it still pointed to Ethereal, so codes never reach a real inbox); Figma file needed?; Twilio (optional).
- **Not verified:** real Gmail delivery; frontend against the user's own :3000 server (all Claude tests
  used :3100/:5180); no automated tests; Postman collection never run; Twilio untried.
- **Watch out:** test with `.claude/launch.json` configs `server-test` (:3100, 1-min access tokens and
  OTP codes, console OTP) + `client-test` (:5180); stop them after. Atlas is slow (~3 s per page load).
  Test users (password `Passw0rd!x`): `s3ui1@`, `s3ui2@` (14+ transfers), `a1795438356@` (none), all
  `@test.com`; Phase 3 `a/b<timestamp>@test.com` users kept. Two users in one browser profile is
  unsupported by design: use incognito for a second user.
<!-- NOW:END -->

## Phases
| # | Phase | Status |
|---|---|---|
| 1 | REST API in Swagger + sequence diagrams | ✅ done, committed |
| 2 | Backend with in-memory store + Postman | ✅ done, uncommitted |
| 3 | MongoDB + Mongoose | ✅ done, uncommitted |
| 4 | Figma designs | ✅ done, uncommitted (wireframe in `docs/wireframes/`, no Figma file) |
| 5 | React frontend | ✅ done, uncommitted (`client/`) |
| 6 | Deploy (Render + Vercel) | ⬜ |
| 7 | Socket.IO transfer notifications | ⬜ |
| 8 | Customer-service chatbot | ⬜ |
| 9 | LangGraph banking assistant | ⬜ |
| 10 | Docker | ⬜ |
| 11 | Jitsi video call | ⬜ |
| 12 | Backend tests (Jest + Supertest) | ⬜ |
| 13 | Frontend tests (Cypress) | ⬜ |

## Phase 2 detail
- [x] Day 1 morning: Node via nvm, packages, `.gitignore`, `npm run dev` / `start`
- [x] Day 1 afternoon: `env.js`, `AppError`, `errorHandler`, `notFound`, `validate`, `app.js`, `server.js`, `/health`, `/docs`
- [x] Day 2 morning: repositories, password/OTP/token helpers, auth service, auth routes, `auth` middleware
- [x] Day 2 afternoon: `/users/me`, transactions list + transfer, per-channel OTP senders, rate limits, Postman files

## Phase 3 detail
- [x] `MONGODB_URI` in env.js; `config/db.js` (connect before listen, build indexes, hints on failure)
- [x] Models: User (unique email), Transaction (from/to + createdAt indexes), RefreshToken (TTL)
- [x] Repositories rewritten, same API: 11000 -> DuplicateEmailError, `$inc`, conditional updates,
      transfer in `session.withTransaction`; `memoryStore.js` removed
- [x] `Db*` schemas in `openapi.yaml`; verified against Atlas
- [x] Later (2026-11-23): pending users deleted when their code expires (TTL on `otp.expiresAt`
      + instant cleanup on re-sign-up)

## Phase 5 detail
- [x] Step 1: Vite + React + TS scaffold, MUI theme, router, placeholder pages, `VITE_API_URL`
- [x] Step 2: axios client (token in memory, single refresh + retry), `AuthProvider`, route guards
- [x] Step 3: Register / Verify OTP / Login, zod rules mirroring the server, errors placed per wireframe
- [x] Step 4: Dashboard (fresh balance, paged table via `?page=`, skeletons, empty/error, phone layout)
- [x] Step 5: Send money (₪ text -> agorot without floats, client + server errors, success notice)
- [x] Step 6: Log out, signed-out page, "Session expired", BroadcastChannel cross-tab sign-out
- [x] Extra: Web Locks so tabs refresh one at a time; one user per browser (tagged tab messages +
      token `sub` check after refresh)

## Log
- 2026-11-12: Read the worksheet, wrote the 13-phase plan.
- 2026-11-12: Phase 1: `openapi.yaml` + 3 sequence diagrams (validated, rendered).
- 2026-11-16: Phase 2 Day 1: server skeleton and middleware.
- 2026-11-16: Phase 2 Day 2 morning: full auth flow (35 checks pass).
- 2026-11-17: Phase 2 Day 2 afternoon: transfers, senders, rate limits, Postman (21 more checks pass). `.claude/` set up.
- 2026-11-18: Ethereal SMTP works. Phase 3: MongoDB Atlas + Mongoose (31 checks pass, data persists).
- 2026-11-22: /update: tracker refreshed (no code changes since 2026-11-18).
- 2026-11-22: Phase 4: wireframe canvas (7 artboards: 6 clickable screens + error/loading sheet, messages copied from server) instead of Figma; decided to move on to Phase 5.
- 2026-11-22: Copied the wireframes into `docs/wireframes/` (7 `.dc.html` + `canvas.json` + README).
- 2026-11-23/24: Phase 5 built (steps 1–6) and tested live on :3100/:5180; pending accounts now expire with their OTP; fixed 3 redirect races, two-tab refresh sign-out (Web Locks) and cross-user tab mix-up; freed :3000 from a leftover dev server.

# Wireframes (Phase 4)

Grey wireframes of every screen, used as the reference for the React frontend (Phase 5).
Live, clickable version (private link; press Play on any screen):
https://claude.ai/artifact/RM4VbVdf2s4TmdZSYtowYv

| File | Screen | API |
|---|---|---|
| `Main.dc.html` | Register (email, password, phone, Email/SMS switch for the code) | `POST /auth/signup` |
| `Otp.dc.html` | Verify the 6-digit code, send a new one | `POST /auth/verify-otp`, `/auth/resend-otp` |
| `Login.dc.html` | Log in | `POST /auth/login` |
| `Dashboard.dc.html` | Balance and transactions table with paging | `GET /users/me`, `GET /transactions` |
| `Transfer.dc.html` | Send money, "Sending…" and success states | `POST /transactions` |
| `SignedOut.dc.html` | After logout | `POST /auth/logout` |
| `Errors.dc.html` | Every error code: message, HTTP status, where the UI shows it; loading states | all |
| `canvas.json` | Layout of the artboards on the canvas | – |

Notes:
- All error text is copied from the server (`server/src/services`, `middleware`, `validation`).
  If a server message changes, update `Errors.dc.html` too.
- Amounts show in shekels (₪ 25.00); the API takes integer agorot (2500).
- These are Design Component files: they need the canvas runtime (`support.js`) to render,
  so opening them directly in a browser shows unstyled markup. Use the link above to view them.

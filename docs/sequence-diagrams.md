# Sequence diagrams (Phase 1)

These diagrams show **who talks to whom, in what order**, for the app's core
flows. They complement `server/src/docs/openapi.yaml`: the spec says *what*
each endpoint accepts and returns; the diagrams say *how* the endpoints are
used together, and what the server does inside each one.

They render on GitLab, in VS Code (Markdown Preview Mermaid Support
extension), and at <https://mermaid.live>.

## How to read Mermaid sequence diagrams

| Syntax | Meaning |
|---|---|
| `participant A as Name` | A vertical lifeline: one actor or system |
| `A->>B: text` | A sends a request/message to B (solid arrow) |
| `B-->>A: text` | B replies to A (dashed arrow) |
| `A->>A: text` | A does some work internally |
| `alt ... else ... end` | Alternatives: exactly one branch happens |
| `opt ... end` | Optional: happens only if the condition holds |
| `Note over A,B: text` | A comment spanning lifelines |
| `rect rgb(...)` | Shaded box grouping steps (used here for DB transactions) |

Participants used below:

- **User**: the person at the keyboard
- **FE**: the React app in the browser
- **API**: the Express server
- **DB**: MongoDB (in Phase 2 it's an in-memory store, but the steps are the same)
- **OTP**: the email (Nodemailer) or SMS (Twilio) provider

---

## 1. Sign-up + OTP verification (requirements 1, 2, 3b)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant FE as React app
    participant API as Express API
    participant DB as MongoDB
    participant OTP as Email / SMS provider

    User->>FE: Fill email, password, phone, choose email or SMS
    FE->>FE: Validate formats (instant feedback)
    FE->>API: POST /auth/signup {email, password, phone, otpChannel}
    API->>API: Validate body again (never trust the client)
    alt invalid email / phone / password
        API-->>FE: 400 VALIDATION_ERROR + fields
        FE-->>User: Show message under each bad field
    else valid
        API->>DB: Find user by email (lowercased)
        alt email already exists
            API-->>FE: 409 EMAIL_TAKEN
            FE-->>User: "An account with this email already exists"
        else new email
            API->>API: Hash password (bcrypt)
            API->>API: Generate 6-digit code, hash it, expiry = now + 5 min
            API->>DB: Insert user {isVerified: false, otp: {hash, expiresAt, attempts: 0}}
            API->>OTP: Send code to email or phone
            alt provider fails
                API-->>FE: 502 OTP_DELIVERY_FAILED
                FE-->>User: "Couldn't send the code, try again"
            else sent
                API-->>FE: 201 {email, otpChannel, otpExpiresAt}
                FE-->>User: Show code-entry screen with countdown
            end
        end
    end

    OTP-->>User: Message with the 6-digit code
    User->>FE: Type the code
    FE->>API: POST /auth/verify-otp {email, code}
    API->>DB: Load user by email
    alt no such user or code wrong
        API->>DB: attempts += 1
        API-->>FE: 400 INVALID_OTP
        FE-->>User: "The code is incorrect"
    else code expired
        API-->>FE: 400 OTP_EXPIRED
        FE-->>User: Offer "Send a new code" (POST /auth/resend-otp)
    else 5 wrong attempts already
        API-->>FE: 429 OTP_ATTEMPTS_EXCEEDED
        FE-->>User: Offer "Send a new code"
    else code correct
        API->>DB: Set isVerified = true, balance = random amount, delete otp
        API->>API: Create access JWT (15 min) + refresh token (7 days)
        API->>DB: Store hash of refresh token
        API-->>FE: 200 {accessToken, user} + Set-Cookie refreshToken
        FE->>FE: Keep accessToken in memory, store user in AuthContext
        FE-->>User: Redirect to dashboard
    end
```

**What to notice and why it matters**

- **Validation happens twice (steps 2 and 4).** The frontend check is only for
  a fast, friendly UI. Anyone can bypass it with Postman or curl, so the
  server must validate everything again.
- **The user is inserted *before* the code is checked**, as a pending user
  (`isVerified: false`). The server needs somewhere to keep the code hash
  while waiting, and the user record is the natural place. Login refuses
  pending users with 403.
- **Passwords and OTP codes are stored only as hashes.** If the database
  leaks, the attacker gets hashes, not passwords or valid codes.
- **The code is sent *after* the DB insert.** If we sent first and the insert
  then failed, the user would get a code for an account that doesn't exist.
- **Wrong attempts are counted** and capped at 5. A 6-digit code has only
  1,000,000 values, so without a cap a script could try them all.
- **"No such user" and "wrong code" return the same 400.** The verify screen
  doesn't need to tell an attacker which emails have pending accounts.
- **The random balance is assigned at verification**, not sign-up: an account
  that never finishes sign-up shouldn't hold money.
- **Verification logs the user in** (same response as login), because
  requirement 2b says the user goes straight to the dashboard.

---

## 2. Login, token refresh and logout (requirements 3a, 3d, 4)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant FE as React app
    participant API as Express API
    participant DB as MongoDB

    User->>FE: Enter email + password
    FE->>API: POST /auth/login {email, password}
    API->>DB: Find user by email
    alt user not found or bcrypt.compare fails
        API-->>FE: 401 INVALID_CREDENTIALS
        FE-->>User: "Invalid email or password"
    else not verified yet
        API-->>FE: 403 ACCOUNT_NOT_VERIFIED
        FE-->>User: Go to code-entry screen
    else OK
        API->>API: Sign access JWT {sub: userId, exp: 15 min}
        API->>DB: Store hash of new refresh token
        API-->>FE: 200 {accessToken, user} + Set-Cookie refreshToken
        FE-->>User: Redirect to dashboard
    end

    Note over FE,API: Every protected request carries the access token
    FE->>API: GET /users/me  Authorization: Bearer accessToken
    API->>API: authMiddleware verifies JWT signature + expiry
    API->>DB: Load user by id from token
    API-->>FE: 200 User {email, balance, ...}

    Note over FE,API: 15 minutes later the access token has expired
    FE->>API: GET /transactions  Authorization: Bearer expiredToken
    API-->>FE: 401 TOKEN_EXPIRED
    FE->>API: POST /auth/refresh  (browser sends refreshToken cookie)
    API->>DB: Find refresh token hash, check not revoked / expired
    alt valid
        API->>DB: Revoke old refresh token, store new one (rotation)
        API-->>FE: 200 {accessToken} + Set-Cookie new refreshToken
        FE->>API: Retry GET /transactions with new token
        API-->>FE: 200 TransactionPage
    else invalid, expired or reused
        API-->>FE: 401 UNAUTHORIZED
        FE-->>User: Redirect to login
    end

    User->>FE: Click Sign Out
    FE->>API: POST /auth/logout  (refreshToken cookie)
    API->>DB: Revoke refresh token
    API-->>FE: 204 + clear cookie
    FE->>FE: Forget accessToken and user
    FE-->>User: Redirect to /login
```

**What to notice and why it matters**

- **Same 401 message for "no user" and "wrong password"**, so the login
  form can't be used to find out which emails are registered.
- **Why two tokens?** A JWT can't be cancelled once issued; it's valid until
  it expires. So the access token is kept short (15 min) to limit the damage
  if it's stolen. The refresh token lives longer, but it is stored on the
  server (as a hash), so logout or theft detection can revoke it.
- **Why a cookie for the refresh token?** It's `httpOnly`, so JavaScript
  (including injected XSS code) can't read it. The access token stays in
  memory, never in `localStorage`.
- **The protected request needs no session lookup.** `authMiddleware` only
  checks the JWT signature and expiry. That's the main point of JWT: the
  token proves who you are, so the server stays stateless.
- **Rotation:** every refresh replaces the refresh token. If an attacker
  reuses an old one, the server sees a revoked token and refuses it.
- **Logout uses the cookie, not the access token**, so it still works after
  the access token has expired.

---

## 3. Money transfer (requirement 5)

```mermaid
sequenceDiagram
    autonumber
    actor Sender
    participant FE as React app
    participant API as Express API
    participant DB as MongoDB

    Sender->>FE: Enter receiver email + amount, press Submit
    FE->>FE: Convert 25.00 to 2500 agorot, validate
    FE->>API: POST /transactions {toEmail, amount: 2500}  Bearer token
    API->>API: authMiddleware: senderId from JWT
    API->>API: Validate body
    alt invalid amount or email format
        API-->>FE: 400 VALIDATION_ERROR
    else toEmail is the sender's own email
        API-->>FE: 400 SELF_TRANSFER
    else valid
        API->>DB: Find verified user by toEmail
        alt not found
            API-->>FE: 404 RECIPIENT_NOT_FOUND
            FE-->>Sender: "No user found with this email"
        else found
            rect rgb(235, 245, 255)
                Note over API,DB: One DB transaction: all steps succeed or none do
                API->>DB: Update sender where balance >= 2500: balance -= 2500
                alt no document matched (balance too low)
                    API->>DB: Abort transaction
                    API-->>FE: 422 INSUFFICIENT_FUNDS
                    FE-->>Sender: "Your balance is too low"
                else debited
                    API->>DB: Update receiver: balance += 2500
                    API->>DB: Insert Transaction {from, to, amount: 2500, createdAt}
                    API->>DB: Commit
                    API-->>FE: 201 {transaction: {direction: sent, amount: -2500}, balance}
                    FE-->>Sender: New record "-25.00 to receiver", updated balance
                end
            end
        end
    end

    Note over FE,DB: Later, the receiver loads their dashboard
    FE->>API: GET /transactions  (receiver's token)
    API->>DB: Find transactions where from = me OR to = me, newest first
    API->>API: Project each one to the caller's view
    API-->>FE: 200 items include {direction: received, counterpartyEmail: sender, amount: +2500}
```

**What to notice and why it matters**

- **The sender's id comes from the JWT**, never from the request body.
  Otherwise anyone could send money *from* someone else's account.
- **Cheap checks first:** validation, self-transfer, then the recipient
  lookup, all before the transaction starts. Failing early keeps the DB
  transaction short.
- **The balance check is *inside* the debit** (`update ... where balance >=
  amount`), not a separate read-then-write. With a separate read, two
  transfers sent at the same moment could both see "enough money" and both
  succeed, overdrawing the account. A conditional update is atomic: only one
  of them can match.
- **Debit, credit and the record are one DB transaction.** If the server
  crashes after the debit but before the credit, Mongo rolls the debit back,
  so money can't disappear or be created. (MongoDB transactions need a
  replica set. Atlas has one; locally, run Mongo with `--replSet`.)
- **One stored document, two views.** The DB holds one Transaction
  `{from, to, amount}`. The API shows it as `-2500` with the receiver's email
  to the sender, and `+2500` with the sender's email to the receiver
  (requirement 5c). Storing two copies could let them disagree.
- **Amounts are integers in agorot** from the frontend onward, so no
  floating-point rounding can ever create or lose money.
- **The response includes the new balance**, so the dashboard updates
  without a second request.

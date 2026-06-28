# 🔐 Security Audit Loop Agent
### Apartment Security Backend — Full Edge Case & Security Checklist

> **How to use:** Run through every section top to bottom. Each item is a checkbox. Mark `[x]` when verified, `[!]` when a bug is found. Re-run the full loop after every major code change. Nothing ships until every `[ ]` is `[x]`.

---

## LOOP 0 — Environment & Bootstrap

### 0.1 Environment Variables
- [ ] All required env vars are validated at startup via Zod schema (`src/config/env.ts`)
- [ ] Server crashes immediately (`process.exit(1)`) if any env var is missing or malformed
- [ ] `JWT_SECRET` is at minimum 32 characters
- [ ] `JWT_REFRESH_SECRET` is at minimum 32 characters and **different** from `JWT_SECRET`
- [ ] `QR_HMAC_SECRET` is at minimum 32 characters and **different** from both JWT secrets
- [ ] `DATABASE_URL` points to correct DB for the current `NODE_ENV` (no prod URL in dev `.env`)
- [ ] `.env` file is in `.gitignore` — confirm it is **never committed**
- [ ] Production secrets are stored in a secret manager (AWS Secrets Manager / Vault), not in plaintext files
- [ ] `NODE_ENV=production` is explicitly set in all production deployment configs

### 0.2 Startup & Dependencies
- [ ] Prisma client is generated before server starts (`npx prisma generate` in Dockerfile)
- [ ] Migrations run before server starts in production (`npx prisma migrate deploy`)
- [ ] Redis connection is verified on startup — server does not start if Redis is unreachable
- [ ] PostgreSQL connection is verified on startup — server does not start if DB is unreachable
- [ ] Graceful shutdown handles `SIGTERM`: closes DB connections, disconnects Redis, stops HTTP server cleanly
- [ ] No `console.log` of secrets, tokens, or full request bodies anywhere in the codebase

---

## LOOP 1 — Authentication

### 1.1 OTP Flow
- [ ] OTP is generated using `crypto.randomBytes` — **not** `Math.random()`
- [ ] OTP is exactly 6 digits, zero-padded
- [ ] OTP has a hard expiry (default: 10 minutes via `OTP_EXPIRY_MINUTES`)
- [ ] OTP is **single-use** — marked `usedAt` immediately on successful verification
- [ ] All previous OTPs for the same `userId + purpose` are invalidated before issuing a new one
- [ ] OTP is **never returned** in the API response — only sent via SMS
- [ ] OTP verification is constant-time (no early return that leaks timing info)
- [ ] If phone number is not found, return `404` — **do not** leak "wrong OTP" vs "no account" distinction to attackers (consider returning same error for both in high-security mode)
- [ ] OTP request endpoint is rate-limited: max 10 requests per 10 minutes per IP
- [ ] Brute-force lock: after N failed OTP attempts for a user, account is temporarily locked (add if not present)

### 1.2 JWT Access Tokens
- [ ] Access token is signed with `HS256` or stronger (`RS256` preferred for production)
- [ ] Token contains: `userId`, `role`, `propertyId`, `unitId`, `guardId`, `residentId`
- [ ] Token has short expiry (`JWT_EXPIRES_IN` — recommended: `15m` for production, not `7d`)
- [ ] `issuer` claim is set (`apartment-security`) and verified on every decode
- [ ] Token is verified on **every** protected request — not cached
- [ ] User `isActive` status is checked in DB on every request (not just at login)
- [ ] Expired tokens return `401`, not `500`
- [ ] Malformed tokens (wrong format, wrong secret) return `401`

### 1.3 Refresh Token Rotation
- [ ] Refresh token is `crypto.randomBytes(64).toString('hex')` — cryptographically random
- [ ] Old refresh token is **immediately revoked** when a new one is issued
- [ ] Refresh token expiry is checked before issuing new tokens
- [ ] Revoked tokens cannot be reused — `revokedAt` is checked
- [ ] Reuse of a revoked refresh token should trigger a **security alert** and revoke all sessions for that user (token theft detection — add if not present)
- [ ] Refresh tokens are stored in the DB, not in Redis (so they survive restarts and can be individually revoked)
- [ ] Logout revokes the specific refresh token (not all sessions, unless the user chooses "logout all")

### 1.4 FCM Token Management
- [ ] Duplicate FCM tokens are deduplicated using a `Set` before storage
- [ ] Invalid/expired FCM tokens returned by Firebase are cleaned from the DB after each push send
- [ ] FCM tokens are scoped to the authenticated user — a user cannot register a token for another user
- [ ] FCM tokens are cleared on logout (or at minimum, on deactivation)

---

## LOOP 2 — Authorization & Role-Based Access Control

### 2.1 Middleware Order
- [ ] `authenticate` middleware runs **before** `requireRole` on every protected route
- [ ] `requireRole` is applied to **every non-public** route — no route is accidentally left open
- [ ] The `/health` endpoint is the only route without authentication
- [ ] Swagger/OpenAPI docs (if added) are protected behind auth in production

### 2.2 Resident Isolation
- [ ] A resident can only read their **own unit's** passes — not other units'
- [ ] A resident can only read their **own unit's** entries
- [ ] A resident can only respond to walk-in approvals assigned to their `residentId`
- [ ] A resident cannot add household members if they are not `isPrimary`
- [ ] A resident cannot remove the primary resident (including themselves)
- [ ] A resident cannot view another unit's vehicle registry
- [ ] A resident cannot cancel another resident's amenity booking
- [ ] `req.user.residentId` and `req.user.unitId` are always sourced from the verified JWT — **never** from `req.body` or `req.params`

### 2.3 Guard Isolation
- [ ] A guard can only scan passes and log entries for their **own property**
- [ ] A guard can only check-in to entry points that belong to their property
- [ ] A guard can only start/end their own shift — not another guard's
- [ ] A guard cannot create or revoke passes
- [ ] A guard cannot access reports or resident PII beyond what's needed for entry decisions
- [ ] `req.user.guardId` is always sourced from the verified JWT — never from the request body

### 2.4 Manager Isolation
- [ ] A manager can only access data for their **own `propertyId`**
- [ ] A manager cannot access another property's residents, passes, entries, or incidents
- [ ] `req.user.propertyId` is always sourced from the verified JWT
- [ ] Manager can onboard/deactivate residents only within their property
- [ ] Manager can assign/close incidents only within their property

### 2.5 Cross-Entity Ownership Checks
- [ ] Every `GET /:id`, `PUT /:id`, `DELETE /:id` verifies the record belongs to the authenticated user's scope before returning data
- [ ] Pass operations (suspend/reactivate/revoke) verify `pass.residentId === req.user.residentId` for residents
- [ ] Incident operations verify `incident.propertyId === req.user.propertyId` for managers
- [ ] Walk-in approval response verifies `approval.residentId === req.user.residentId`
- [ ] Unit operations verify `unit.propertyId === req.user.propertyId`

---

## LOOP 3 — QR Code & OTP Security

### 3.1 QR Payload Integrity
- [ ] QR payload is HMAC-SHA256 signed using `QR_HMAC_SECRET`
- [ ] Signature is verified with `crypto.timingSafeEqual` — **not** `===` (prevents timing attacks)
- [ ] If signature is invalid, entry is **denied** and logged — never silently skipped
- [ ] `passId` is extracted from the verified payload, not from `req.body` directly
- [ ] QR payload JSON is parsed inside a `try/catch` — malformed JSON returns `DENIED`, not `500`
- [ ] QR codes do not embed sensitive PII (resident name, phone, unit address)
- [ ] Consider adding a timestamp to the QR payload and rejecting QRs older than X hours (replay attack prevention — add if not present)

### 3.2 Pass OTP (Delivery)
- [ ] OTP code is stored as **SHA-256 hash** — plaintext is never persisted
- [ ] OTP verification uses `crypto.timingSafeEqual` on the hash
- [ ] The plaintext OTP is sent to the visitor once (WhatsApp/SMS) and then discarded
- [ ] Pass OTP cannot be reused after a successful entry (mark entry and check)
- [ ] Pass OTP is invalid if the pass is REVOKED, SUSPENDED, or EXPIRED

### 3.3 Pass Validation Logic
Every entry attempt must validate ALL of the following in order:

- [ ] `status === 'REVOKED'` → **DENY**
- [ ] `status === 'SUSPENDED'` → **DENY**
- [ ] `status === 'EXPIRED'` OR `now > validUntil` → **DENY**
- [ ] `now < validFrom` → **DENY** (not yet valid)
- [ ] `entryPointIds.length > 0 AND entryPointId NOT IN entryPointIds` → **DENY**
- [ ] `type === 'RECURRING'` → check `dayOfWeek IN allowedDays` → **DENY** if not
- [ ] `type === 'RECURRING'` → check `now` is within `windowStartTime–windowEndTime` → **DENY** if outside
- [ ] `ONE_TIME` pass: after one `APPROVED` entry, it should not allow re-entry (add single-use flag check if not present)
- [ ] All validation happens **server-side** — guard app offline cache is only for pre-screening, final decision is always server-side when online

---

## LOOP 4 — Input Validation & Injection Prevention

### 4.1 Zod Schema Coverage
- [ ] Every route with a request body has a Zod schema applied via `validate` middleware
- [ ] Every route with URL params (`/:id`) validates the param is a valid `cuid` or `string`
- [ ] Every route with query params validates and sanitises them
- [ ] No `req.body` property is passed directly into a Prisma query without going through the schema first

### 4.2 Specific Field Validations
- [ ] Phone numbers are validated against E.164 format regex (`/^\+[1-9]\d{7,14}$/`)
- [ ] Date strings are validated as ISO 8601 (`z.string().datetime()`)
- [ ] `validFrom < validUntil` is enforced in the pass schema `.refine()`
- [ ] `RECURRING` pass requires `recurringRule` — enforced in schema
- [ ] Time strings (`windowStartTime`, `windowEndTime`) are validated against `HH:MM` regex
- [ ] `allowedDays` contains only valid `DayOfWeek` enum values
- [ ] `type` fields accept only defined enum values — no open strings
- [ ] Numeric query params (`page`, `limit`, `floor`) are parsed with `parseInt` and have sane defaults
- [ ] `limit` query param has a maximum cap (e.g., max 100) to prevent memory exhaustion

### 4.3 SQL Injection
- [ ] All DB queries use Prisma's parameterised query builder — **no raw SQL strings** with interpolated values
- [ ] If `prisma.$queryRaw` is used anywhere, it uses the `Prisma.sql` tagged template literal — never string concatenation
- [ ] Search inputs (`contains`, `search`) are passed to Prisma as-is — Prisma handles escaping

### 4.4 NoSQL / JSON Injection
- [ ] `alertPreferences` JSON field input is validated by Zod before storage
- [ ] `JSON.parse` calls are wrapped in `try/catch`
- [ ] `before`/`after` fields in `AuditLog` are serialised with `JSON.parse(JSON.stringify(data))` to strip non-serialisable values and prevent prototype pollution

### 4.5 File Upload Security (Incident Photos)
- [ ] File MIME type is validated server-side (not just by extension)
- [ ] Allowed types are: `image/jpeg`, `image/png`, `image/webp` only
- [ ] File size limit is enforced (recommended: 5MB per file)
- [ ] Files are stored in object storage (S3/GCS) — never on the local filesystem
- [ ] Uploaded filenames are replaced with a server-generated UUID — original filenames are never used in storage paths
- [ ] Stored file URLs are not guessable (use signed URLs or a private bucket)

---

## LOOP 5 — Rate Limiting & Abuse Prevention

### 5.1 Rate Limiter Coverage
- [ ] **Global**: 300 requests / 15 minutes / IP — applied to all routes
- [ ] **Auth** (`/otp/request`, `/otp/verify`): 10 requests / 10 minutes / IP
- [ ] **QR Scan** (`/entries/scan`): 60 requests / 1 minute / IP
- [ ] **Walk-in request**: separate limiter to prevent flooding (recommended: 20/min/guard)
- [ ] **Report generation**: separate limiter (recommended: 5/hour/user) — PDF generation is CPU-heavy
- [ ] Rate limit headers (`RateLimit-*`) are returned to clients
- [ ] Rate limiter uses Redis as the store in production (not in-memory, which doesn't work across instances)

### 5.2 Denial of Service Protection
- [ ] Request body size is capped at `10mb` (`express.json({ limit: '10mb' })`)
- [ ] Large `limit` query params cannot be used to dump the entire DB (max cap enforced)
- [ ] `fcmTokens` array per user has a maximum size (recommended: 10 tokens max)
- [ ] `entryPointIds` array in a pass has a maximum size
- [ ] `photoUrls` array in incidents has a maximum size (recommended: 5 photos)
- [ ] Cron jobs have error handling — one failing property must not stop all others from refreshing

---

## LOOP 6 — Data Privacy & Exposure

### 6.1 API Response Sanitisation
- [ ] `passwordHash` is **never** returned in any API response
- [ ] `otpCode` (hashed) is **never** returned in any API response
- [ ] `qrPayload` (raw signed string) is returned to resident only when they first create the pass — **not** in list endpoints
- [ ] `fcmTokens` array is **never** returned to the client
- [ ] `refreshTokens` records are **never** returned to the client
- [ ] `AuditLog` entries are not accessible via the API (internal only)
- [ ] `passwordHash` column is selected with `{ select: { passwordHash: false } }` (or excluded via Prisma `omit`)
- [ ] Resident personal data (phone, emergency contact) is only accessible to the same unit's residents and managers

### 6.2 Pagination & Enumeration
- [ ] All list endpoints (`getAllResidents`, `getAllPasses`, etc.) are paginated — no unbounded `findMany`
- [ ] Resident list is scoped to the manager's `propertyId` — cannot enumerate residents across properties
- [ ] Pass list for a resident only returns their own passes — no `residentId` filter bypass via query param
- [ ] Guard cannot enumerate all units or all residents — only what's needed for entry decisions

### 6.3 Logging
- [ ] HTTP request logs include: method, path, status code, response time, IP — **not** request bodies
- [ ] Error logs include stack traces in development — **not** in production responses
- [ ] OTP codes are **never** logged
- [ ] Passwords and JWT secrets are **never** logged
- [ ] Visitor phone numbers in logs are masked (e.g., `+91XXXXXX789`)
- [ ] Log files are rotated and have a maximum size (implemented in `logger.util.ts`)
- [ ] Production logs are shipped to a centralised log aggregator (CloudWatch / Datadog / Loki)

---

## LOOP 7 — Real-Time (WebSocket) Security

### 7.1 Socket Authentication
- [ ] Every socket connection is authenticated via JWT in `socket.handshake.auth.token`
- [ ] Unauthenticated socket connections are rejected with `new Error('No token')`
- [ ] Socket middleware verifies the token using the same `verifyAccessToken` function as HTTP
- [ ] Socket `data.user` payload is set from the verified JWT — never from client-sent data

### 7.2 Room Isolation
- [ ] Residents join only `user:{userId}` — they cannot join `property:*` or `guard:*` rooms
- [ ] Guards join `guard:{guardId}` and `property:{propertyId}` — they cannot join other guards' rooms
- [ ] Walk-in decisions are emitted to `guard:{guardId}` — not broadcast to the whole property room
- [ ] Sensitive data (resident names, phone numbers) is **not** included in property-wide socket events
- [ ] Walk-in approval requests go to `user:{residentId}` — not to all residents

### 7.3 Event Validation
- [ ] Server never trusts data in socket events from the client — all actions re-validate against the DB
- [ ] Rate limiting is applied to socket events (prevent event flooding)
- [ ] Socket connections are closed when the JWT expires (add heartbeat-based expiry check if not present)

---

## LOOP 8 — Walk-in Approval Edge Cases

- [ ] Walk-in approval cannot be responded to after `timeoutAt` has passed
- [ ] Walk-in approval cannot be responded to twice (`respondedAt` is checked)
- [ ] Only the correct resident (`residentId` match) can respond — not any authenticated resident
- [ ] Timeout handler is idempotent — if it fires twice (race condition), the second call is a no-op
- [ ] When timeout fires, guard is notified via `walkin:timeout` WebSocket event
- [ ] If the resident app is offline (no FCM delivery), the guard still gets a timeout after 90 seconds
- [ ] `$transaction` is used for `WalkinApproval` + `Entry` updates — both succeed or both fail atomically
- [ ] Entry created during walk-in request has `status: 'PENDING_APPROVAL'` — not `APPROVED` — until the resident responds
- [ ] A guard cannot submit a second walk-in request for the same unit while one is already pending

---

## LOOP 9 — Incident Management Edge Cases

- [ ] An incident can only be closed if it is in `OPEN` or `IN_PROGRESS` status — not already `CLOSED`
- [ ] Closing an already-closed incident returns `400`, not `500`
- [ ] Escalating an incident to P1 sends SMS to managers **and** committee members
- [ ] Incident photos are validated for MIME type before storage URL is saved
- [ ] Incident assignment notifies the assigned guard via FCM
- [ ] A guard can only create incidents for their own property (verified via `guard.propertyId`)
- [ ] `IncidentAction` timeline is append-only — no update or delete endpoints exposed
- [ ] P1 incidents trigger SMS to `EMERGENCY_SMS_NUMBER`

---

## LOOP 10 — Alert & Notification Edge Cases

### 10.1 Alert Routing
- [ ] P1: push **and** SMS sent simultaneously (not sequentially) — use `Promise.allSettled`
- [ ] P2: push only; SMS escalation via the cron job if unacknowledged for 15 minutes
- [ ] P3: push only; no SMS escalation
- [ ] `Promise.allSettled` is used for all multi-recipient sends — one failure doesn't block others
- [ ] SMS send failure is logged but **never** throws an error that crashes the main request

### 10.2 Alert SLA Escalation (Cron Job)
- [ ] Escalation cron runs every minute
- [ ] SLA thresholds: P1 = 3 min, P2 = 15 min, P3 = 60 min
- [ ] Alert status is updated to `ESCALATED` after escalation — it won't be escalated again on next run
- [ ] Cron job error on one property does not prevent escalation for other properties
- [ ] Escalation targets are scoped to the correct `propertyId`

### 10.3 FCM Edge Cases
- [ ] FCM multicast handles the 500-token-per-call limit (chunking implemented)
- [ ] Invalid token error (`messaging/registration-token-not-registered`) triggers token cleanup from DB
- [ ] FCM send errors are caught per-chunk and logged — a failed chunk does not crash the request
- [ ] Push notifications include `data.alertId` so the client app can deep-link to the correct screen

---

## LOOP 11 — Pass Lifecycle Edge Cases

- [ ] A revoked pass **cannot** be reactivated — only ACTIVE/SUSPENDED passes can change state
- [ ] A suspended pass past `validUntil` is **not** reactivated by the cron job
- [ ] Auto-reactivation cron job (`suspendedUntil < now` AND `validUntil > now`) is idempotent
- [ ] Pass expiry cron runs every 15 minutes — passes may be valid for up to 15 extra minutes (document this SLA)
- [ ] `ONE_TIME` pass: verify it hasn't already been used for a successful `APPROVED` entry before allowing re-scan
- [ ] Deactivating a resident automatically revokes all their `ACTIVE` and `SUSPENDED` passes
- [ ] Pass cache in Redis is invalidated when a pass is created, suspended, reactivated, or revoked
- [ ] Redis cache TTL is 15 minutes — guards' offline cache is at most 15 minutes stale
- [ ] Pass creation validates that `entryPointIds` all belong to the resident's property
- [ ] Delivery pass OTP is regenerated if the pass is reactivated after suspension

---

## LOOP 12 — Offline Sync Edge Cases

- [ ] Offline sync endpoint is guard-only
- [ ] Each offline entry submission checks for duplicates by `(guardId, entryAt, passId)` — idempotent
- [ ] Duplicate entries return `{ synced: false, reason: 'DUPLICATE' }` — not an error
- [ ] Offline entries submitted after a pass has been revoked/expired are stored with status `DENIED` (retroactive validation)
- [ ] Offline entries that reference a non-existent `passId` are stored with `passId: null` and flagged
- [ ] `localId` from the client is returned in the response for client-side reconciliation
- [ ] Guard cannot submit offline entries for another guard's `guardId` (sourced from JWT, not body)
- [ ] Redis pass cache is seeded via `GET /offline/pass-cache` — this endpoint is guard-only and rate-limited

---

## LOOP 13 — Database & Prisma Edge Cases

- [ ] `@@unique` constraints exist for: `(propertyId, unitNumber)`, `(unitId, registrationNo)`, `badgeNumber`, `User.phone`, `User.email`
- [ ] Prisma `P2002` (unique constraint) is caught by `errorHandler` and returns `409`
- [ ] Prisma `P2025` (record not found) is caught by `errorHandler` and returns `404`
- [ ] `$transaction` is used wherever two or more tables must be updated atomically
- [ ] `findFirst` vs `findUnique`: use `findUnique` only on `@id` or `@unique` fields — use `findFirst` for composite lookups
- [ ] DB queries in list endpoints always have `orderBy` for consistent pagination
- [ ] No N+1 query loops — use `include` and `_count` instead of fetching in a `for` loop
- [ ] Prisma client is a singleton (one instance per process) — no new `PrismaClient()` inside request handlers
- [ ] DB connection pool size is configured appropriately for production load

---

## LOOP 14 — HTTP Security Headers

- [ ] `helmet()` is applied before all routes
- [ ] `Content-Security-Policy` is set (Helmet default or custom)
- [ ] `X-Frame-Options: DENY` is set (prevents clickjacking)
- [ ] `X-Content-Type-Options: nosniff` is set
- [ ] `Strict-Transport-Security` is set (HSTS — production only, requires HTTPS)
- [ ] `X-Powered-By` header is removed (Helmet does this by default)
- [ ] CORS `origin` is a whitelist of exact URLs — `origin: '*'` is **never** used
- [ ] CORS `credentials: true` is only set when required and combined with a specific origin
- [ ] Cookies (if used for refresh tokens) have `httpOnly`, `Secure`, `SameSite=Strict`

---

## LOOP 15 — Reporting & PDF Generation

- [ ] Report generation is scoped to the authenticated manager's `propertyId`
- [ ] PDF is streamed to the response, not saved to disk
- [ ] Report generation is rate-limited (CPU-heavy operation)
- [ ] `generateMonthlyReport` requires `month` and `year` query params — validated as integers in range
- [ ] Report access is logged in `AuditLog`
- [ ] Anomaly flags (passes with `validUntil` > 60 days ago but still `ACTIVE`) are included in the report
- [ ] Report contains no raw token data, no OTP hashes, no password hashes

---

## LOOP 16 — Cron Job Safety

- [ ] All cron jobs are started only once (in `server.ts` bootstrap, not `app.ts`)
- [ ] All cron jobs have a `try/catch` wrapping the entire job body
- [ ] Cron errors are logged with `logger.error` — never `console.error`
- [ ] `passExpiryJob` runs every 15 minutes — verify the schedule string `*/15 * * * *`
- [ ] `cacheRefreshJob` runs every 15 minutes — aligned with pass expiry job
- [ ] `alertEscalationJob` runs every minute — verify `*/1 * * * *`
- [ ] Cron jobs do not block each other (each is independently scheduled)
- [ ] In a multi-instance deployment, cron jobs use a distributed lock (Redis `SET NX EX`) to prevent duplicate runs

---

## LOOP 17 — Audit Trail Completeness

Verify that every one of these actions creates an `AuditLog` record:

- [ ] `LOGIN` — user logs in
- [ ] `LOGOUT` — user logs out
- [ ] `UPDATE_PROFILE` — resident updates their profile
- [ ] `CREATE_PASS` — resident creates a pass
- [ ] `SUSPEND_PASS` — resident suspends a pass
- [ ] `REACTIVATE_PASS` — resident reactivates a pass
- [ ] `REVOKE_PASS` — resident or manager revokes a pass
- [ ] `ONBOARD_RESIDENT` — manager onboards a resident
- [ ] `DEACTIVATE_RESIDENT` — manager deactivates a resident + revokes all passes
- [ ] `REMOVE_MEMBER` — primary resident removes a household member
- [ ] `CLOSE_INCIDENT` — manager/committee closes an incident
- [ ] `GENERATE_REPORT` — manager/committee generates a monthly report
- [ ] Each `AuditLog` record includes: `userId`, `action`, `entity`, `entityId`, `before`, `after`, `ipAddress`, `userAgent`
- [ ] `AuditLog` records are **never deleted** — no `DELETE` endpoint exists for audit logs
- [ ] `AuditLog` table has an index on `(userId, createdAt)` for efficient querying

---

## LOOP 18 — Vehicle Registry Edge Cases

- [ ] `registrationNo` is always stored and compared as **uppercase**
- [ ] An unregistered vehicle triggers a P2 alert to managers
- [ ] Vehicle check response does not expose the full resident profile — only name and unit number
- [ ] A deactivated vehicle (`isActive: false`) is treated as unregistered
- [ ] A vehicle can only be registered by the resident of the unit or a manager
- [ ] Duplicate vehicle registration returns `409` (enforced by `@@unique([unitId, registrationNo])`)

---

## LOOP 19 — Amenity Booking Edge Cases

- [ ] Overlapping booking check uses correct date + time intersection logic
- [ ] `capacity` check counts only `CONFIRMED` bookings (not `CANCELLED`)
- [ ] Resident can only cancel their own booking
- [ ] Amenity with `status !== 'AVAILABLE'` cannot be booked
- [ ] Booking for a past date/time is rejected (add `date >= today` validation if not present)
- [ ] `startTime < endTime` is enforced (add schema validation if not present)
- [ ] Amenity booking is scoped to the resident's property (amenity belongs to the same property as the unit)

---

## LOOP 20 — Final Pre-Deploy Checklist

### Code Quality
- [ ] No `any` TypeScript type used in request handlers or DB queries
- [ ] No `.then()` chains — all async code uses `async/await` with `try/catch`
- [ ] No unhandled promise rejections — all `async` route handlers call `next(err)` in catch blocks
- [ ] `validatePassForEntry` is a pure function — no DB calls inside (tested with unit tests)
- [ ] Unit tests pass: `npm test`
- [ ] Integration tests pass against a test DB

### Infrastructure
- [ ] HTTPS is enforced in production (TLS termination at load balancer)
- [ ] Health check endpoint (`/health`) is used by load balancer health checks
- [ ] Database has automated daily backups enabled
- [ ] Redis persistence (`RDB` or `AOF`) is enabled to survive restarts
- [ ] Logs are retained for at least 90 days
- [ ] Alerts are set up for: error rate > 1%, response time > 2s, DB connection failures, Redis failures

### Secrets Rotation
- [ ] Plan exists to rotate `JWT_SECRET` (requires all users to re-login)
- [ ] Plan exists to rotate `QR_HMAC_SECRET` (requires all QR codes to be regenerated)
- [ ] Twilio and Firebase credentials can be rotated without downtime

---

## Severity Classification

| Priority | Description | Action |
|----------|-------------|--------|
| 🔴 **P0 — Critical** | Authentication bypass, data exposure across properties, token forgery | Block deployment, fix immediately |
| 🟠 **P1 — High** | Role escalation, missing ownership check, OTP replay | Fix before next deploy |
| 🟡 **P2 — Medium** | Missing rate limit, unbounded query, audit log gap | Fix within 1 sprint |
| 🟢 **P3 — Low** | Missing field validation, minor info leak in error message | Fix in backlog |

---

## How to Run This Loop

```bash
# 1. Run all unit tests
npm test

# 2. Run integration tests against test DB
DATABASE_URL="postgresql://..." npm test -- --testPathPattern=integration

# 3. Check for exposed secrets in git history
git log --all --full-history -- '*.env*'
npx secretlint .

# 4. Static analysis for security
npx audit-ci --moderate
npm audit --audit-level=high

# 5. Check rate limiter is using Redis store (not MemoryStore)
grep -r "MemoryStore\|new Map" src/middlewares/

# 6. Verify no raw SQL with string interpolation
grep -r "queryRaw\|executeRaw" src/ | grep -v "Prisma.sql"

# 7. Verify all routes have authenticate middleware
grep -r "router\." src/modules/ | grep -v "authenticate\|router.use"

# 8. Verify no secrets in logs
grep -r "console.log\|logger.info\|logger.debug" src/ | grep -i "token\|secret\|password\|otp"
```

---

*Last updated: Generated from Apartment Security Backend Implementation Guide v1.0*
*Re-run this loop after every feature addition, dependency update, or schema change.*

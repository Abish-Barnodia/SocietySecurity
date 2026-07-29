# SecureGate Manager Portal — Frontend Specification

Source of truth for UI structure. Cross-referenced against `backend.md` (Apartment Security Backend Implementation Guide). Every section states whether it binds to a real endpoint/model or is a **BACKEND GAP** — a UI element visible in the screenshots that has no corresponding Prisma model or route in `backend.md` today. Gaps must not be silently wired to a guessed endpoint; they need new backend work before they can be real.

**Role in scope**: `MANAGER` (Facility Manager), with some views also visible to `COMMITTEE`. Base path assumed: `/api/v1`. Auth: Bearer JWT from `POST /auth/otp/verify`, attached as `Authorization: Bearer <accessToken>` on every call. Socket.IO connects with `{ auth: { token } }` and auto-joins `property:{propertyId}` and `user:{userId}` rooms per `socket.handler.ts`.

---

## Legend

- ✅ **Bound** — maps directly to an existing backend.md model/endpoint.
- ⚠️ **Partial** — some fields map, others don't; noted inline.
- ❌ **BACKEND GAP** — no model/route exists; UI must either be stubbed, mocked, or backend work must be scoped first.

---

## Global Shell (all pages)

**Top bar**: live/refresh indicator, last-refresh timestamp, global search, notification bell, avatar menu, property switcher ("Greenwood Towers").

- Live indicator + "Last refresh: 30s ago" → ⚠️ Partial. No polling/refresh-interval endpoint per se, but `Platform Config` (Settings) exposes `Data Refresh Interval (seconds)` — ❌ **BACKEND GAP** (no `PlatformConfig` model in schema; this needs a new per-property settings table).
- Notification bell badge count → ✅ Bound to unread `Alert` count: `GET /alerts?status=SENT&propertyId=...` (filtered client-side or via a new `unreadCount` query param — see Alerts page for exact contract).
- Property switcher → ⚠️ Partial. `Property` model exists, but backend.md has no `GET /properties` (multi-property listing for a manager) documented. If a manager can operate more than one property, add `GET /properties/my` — ❌ **GAP** for multi-property manager account; current schema ties one `Manager` row to one `propertyId`.
- Avatar menu → user session actions, routes to My Profile page.

**Sidebar navigation** — 13 primary destinations, grouped as:
- Operations: Dashboard, Guard Management, Resident Directory, Event Timeline, Alerts & Escalation, Expected Visitors, Parking & Vehicles, CCTV Monitoring
- Administration: Reports, Community Control, Workforce Mgmt, Settings
- Account: My Profile (via avatar, not sidebar)

**Global states** (apply to every data view below unless noted): `loading` (skeleton rows/cards), `empty` (contextual empty-state copy + primary CTA), `error` (retry banner, preserves last-good data if available), `permission-denied` (role-gated section hidden entirely rather than shown disabled, per backend's `requireRole` pattern — a MANAGER-only action should not even render for COMMITTEE).

---

## 1. Dashboard (`/dashboard`)

### Purpose
Single-glance operations snapshot: guard post status, pending approvals, active alerts, live activity feed, active visitor board.

### Data bindings

| Widget | Binding | Status |
|---|---|---|
| Stat tiles (Active Guards, Residents On Premises, Visitors Today, Pending Approvals, Open Alerts, Gate Events Today) | `GET /reports/operations-overview` → `{ totalEntriesToday, activeVisitors, guardsOnDuty, openIncidents, unacknowledgedAlerts, pendingWalkins }` (`getOperationsOverview`, report.controller) | ⚠️ Partial — backend returns 6 of these fields; "Residents On Premises" (847) and "Gate Events Today" (412) are **not** in the current response shape. **GAP**: extend `getOperationsOverview` to include `residentsOnPremises` (distinct resident count with an open `Entry`/presence signal — residents don't have entries logged the same way visitors do, so this needs a new concept) and `totalGateEventsToday` (all `Entry` rows regardless of status, today). |
| Guard Post Status cards (On Post / Overdue / Break / Unassigned per `EntryPoint`) | `GET /guards/active` (`getActiveGuards`) returns guards with `isOnDuty: true`, their open `Shift`, and latest `GuardPost` check-in incl. `entryPoint` | ⚠️ Partial — gives "last check-in" and post, but the **Overdue** badge (18 min since last check-in vs. some SLA) and **Break** status require a computed staleness threshold and a distinct on-break state that don't exist on `Guard`/`GuardPost` today. **GAP**: add `guardStatus` enum (`ON_POST`, `ON_BREAK`, `OFFLINE`) to `Guard` or `Shift`, and a post-check-in SLA (visible in Settings as "Post Check-In Compliance" target 95%) to compute overdue client- or server-side. |
| Pending Approvals list (walk-ins, deliveries, unauthorized guest claims) | `WalkinApproval` where `respondedAt: null` — needs a manager-facing list endpoint. Backend only exposes guard-side `POST /walkin/request` and resident-side `POST /walkin/:id/respond`. | ❌ **GAP** — no `GET /walkin?status=pending&propertyId=` for managers to view/force-approve pending requests. The screenshot's "Approve/Deny" buttons on pending items imply a manager override path that isn't in backend.md at all (see Guard Management → Override Log below). |
| Active Alerts panel | `GET /alerts` filtered `propertyId`, sorted by `createdAt desc`, `status != RESOLVED` | ✅ Bound — `Alert` model has `priority`, `status`, `title`, `body`, `acknowledgedAt`. "Acknowledge" button → needs `POST /alerts/:id/acknowledge` calling `acknowledgeAlert()` util — util function exists in `alert.util.ts` but **no route wraps it** in backend.md. **GAP**: add `PUT /alerts/:id/acknowledge` route. |
| Live Activity Feed (visitor scans, guard check-ins, pass created, walk-in approved) | Composite feed. `Entry` (scans), `GuardPost` (check-ins), `Pass` creation (`createdAt`), `WalkinApproval` decisions | ❌ **GAP** — no unified activity/timeline endpoint exists. Each source is a separate table; frontend would need either (a) a new aggregation endpoint `GET /activity-feed?propertyId=` that unions these tables server-side ordered by timestamp, or (b) client-side merge of 3-4 separate polling/socket streams. Recommend (a). |
| Active Visitor Board table (Visitor / Unit / Category / Entry Point / Check-in / Status) | `GET /entries` (manager-wide variant) — backend only has `getMyEntries` scoped to `req.user.unitId` (resident-only). | ❌ **GAP** — need `GET /entries/all?propertyId=` for manager role (route table in §8 of backend.md lists this endpoint conceptually — "GET /entries/all" — but no controller implementation exists in the code shown). Must implement `getAllEntries` controller before this table can bind. |

### Modals
- None on this page (all actions deep-link to Guard Management / Alerts / Expected Visitors).

### Real-time (Socket.IO)
- `entry:logged` (emitted in `scanQR`) → prepend to Live Activity Feed, bump "Gate Events Today" tile.
- `incident:new` → bump "Open Alerts", flash Active Alerts panel.
- `walkin:request` / `walkin:decision` / `walkin:timeout` → update Pending Approvals count live.
- Room: `property:{propertyId}`.

### Component states
- Loading: skeleton tiles + skeleton table rows.
- Empty: "No pending approvals" / "No open alerts — all clear" per panel independently (not a single page-level empty state).
- Error: per-widget retry (dashboard is composed of independent fetches; one failing shouldn't blank the page).

---

## 2. Guard Management (`/guards`)

Tabs: **Guard Roster**, **Live Monitoring**, **Incidents**, **Override Log**. Plus a drill-down **Guard Detail** page and a **Reassign Post** modal.

### 2.1 Guard Roster tab
| Column | Binding |
|---|---|
| Guard, Badge ID, Post, Shift, Status, Last Check-In, Entries Today | `GET /guards/directory` (`getGuardDirectory` — referenced in route table, controller not shown in backend.md body) ⚠️ Partial: needs to join `Guard` + `User.phone` + latest `Shift` + latest `GuardPost` + count of `Entry` where `guardId` today. |
| "Add Guard" button | `POST /guards` (`onboardGuard` — referenced in routes, controller body not shown) ⚠️ Partial — assume it takes `{ phone, name, badgeNumber, propertyId }`, creates `User(role: GUARD)` + `Guard`. Confirm required fields match Add Guard form (name, phone, post assignment, shift, badge). Post/shift assignment at creation time is **not shown** in the referenced controller signature — **GAP** to confirm. |
| Search / Shift filter / Status filter | Client-side or query params on `GET /guards/directory?shift=&status=&search=` — query param support not confirmed in backend.md. |

### 2.2 Live Monitoring tab
Guard cards (On Post / Overdue / On Break) with entries count and "View Details" → same data as Dashboard's Guard Post Status widget, scoped to this page: `GET /guards/active`. Same **GAP** noted above re: Overdue/Break computed status.

### 2.3 Incidents tab
| Column | Binding |
|---|---|
| Time, Guard/Post, Type, Severity, Description, Status, Assigned To | `GET /incidents?propertyId=` — route not explicitly listed in backend.md's incident module, but `Incident` model + `createIncident`/`assignIncident`/`escalateIncident`/`closeIncident` controllers exist. **GAP**: a list/index route (`GET /incidents`) is implied but not shown — needs adding alongside the mutation routes. |
| Severity badge (low/medium/high) | ⚠️ Partial — `Incident.type` (enum) exists but there is **no `severity` field** on the `Incident` model in schema. Screenshot shows severity independent of type (e.g., "Unauthorized Entry" = medium, "Suspicious Activity" = high in one row, medium in another). **GAP**: add `severity` enum (`low`/`medium`/`high`) to `Incident` model — currently only `IncidentType` and `IncidentStatus` exist, no severity. |
| Status (open/investigating/resolved) | ⚠️ Partial — schema's `IncidentStatus` enum is `OPEN / IN_PROGRESS / CLOSED`, but UI shows `open / investigating / resolved`. Needs a label mapping (`IN_PROGRESS` → "investigating", `CLOSED` → "resolved") — no gap, just a display mapping, unless the extra `resolved`-vs-`closed` distinction is meant to be a real 4th state, in which case it's a **GAP**. |
| Row click → detail / resolve | `PUT /incidents/:id/assign`, `PUT /incidents/:id/close` (escalate: `PUT /incidents/:id/escalate`) — routes implied by controllers `assignIncident`, `closeIncident`, `escalateIncident`; exact route paths not shown in backend.md's incident section (only controller code is given) — **confirm route registration exists in `incident.routes.ts`, which is not shown in backend.md.** Treat as ⚠️ Partial until route file is confirmed. |

### 2.4 Override Log tab
Columns: Timestamp, Manager, Action (force approve / credential suspend / force deny / guard reassign / force clear), Reason Code (RC-101…RC-305), Reason, Affected Entity.

❌ **BACKEND GAP — entire tab.** There is no `Override` or `ManagerAction` model in `backend.md`'s schema. The closest primitive is `AuditLog` (`action`, `entity`, `entityId`, `before`, `after`, `userId`, `createdAt`) written via `auditLog()` in several controllers (pass revoke/suspend, incident close, resident onboarding/deactivation, login/logout). However:
- `AuditLog` has no `reasonCode` or free-text `reason` field — the screenshot's "RC-104 — Resident unreachable for 12+ minutes" style structured reason has no home in the current schema.
- `AuditLog.action` values in existing code are things like `CREATE_PASS`, `SUSPEND_PASS`, `CLOSE_INCIDENT` — not the manager-override vocabulary shown (`force approve`, `force deny`, `guard reassign`, `force clear`, `credential suspend`).
- The underlying **actions themselves** (force-approving a stuck walk-in, force-clearing a stuck gate event, reassigning a guard's post) also mostly lack routes:
  - "guard reassign" → **GAP**: no `PUT /guards/:id/reassign-post` route exists. `GuardPost` records are only ever created by the guard via `POST /guards/post-checkin`; there's no manager-initiated reassignment endpoint.
  - "force approve / force deny" on a `WalkinApproval` → **GAP**: only the resident can respond via `POST /walkin/:approvalId/respond`; there is no manager override route.
  - "credential suspend" → ✅ **partially bound**: this is `PUT /passes/:id/suspend` (`suspendPass`), but that controller currently only allows the pass's owning **resident** (`findOwnedPass` checks `residentId === req.user.residentId`) — a manager cannot call it today. **GAP**: needs a manager-scoped suspend path or a role check added to `suspendPass`.
  - "force clear" (barrier gate stuck-open manual clearance) → **GAP**: no hardware/gate-state model exists at all (see CCTV/Hardware gaps below).

**Recommendation to note in spec**: Before building this tab for real, backend needs (1) a `ManagerOverride` (or extended `AuditLog`) model with `reasonCode` + `reason` + `affectedEntityType/Id`, and (2) the four missing mutation routes above. Until then, render this tab against `GET /audit-logs` (if/when added) with a "reason code" column left blank, or keep it explicitly mocked and labeled as such in a dev banner.

### 2.5 Guard Detail page (`/guards/:id`)
Header: name, status, badge, post, shift hours, phone, joined date. Stats: Monthly Scans, Compliance %, Rating, Incidents. Certifications & Training chips. Activity Timeline. Current Shift panel. Shift History table. "Force Clear / Flag" and "Reassign Post" buttons.

| Element | Binding |
|---|---|
| Header + stats | ⚠️ Partial. `Guard`, `User.phone`, `Guard.createdAt` (joined) map fine. `Monthly Scans` = count of `Entry` by `guardId` this month — computable but no dedicated endpoint. `Compliance %` and `Rating` (4.5★) → **GAP**: no `rating` or `compliance` field exists on `Guard`. These look borrowed from the `WorkerPool` rating concept (see Workforce Mgmt) but `Guard` model has no such field. |
| Certifications & Training | ❌ **BACKEND GAP** — no `Certification`/`Training` model or relation on `Guard` anywhere in schema. |
| Activity Timeline ("Post Check-in", location verified) | ✅ Bound — `GuardPost` rows (`checkedInAt`, `entryPointId`, lat/long) for this guard, reverse-chronological. |
| Current Shift panel (Post, Timing, Last Check-in, Entries Today, Emergency Contact) | ⚠️ Partial — `Shift` + `GuardPost` cover Post/Timing/Last Check-in/Entries; `Emergency Contact` for a **guard** has no field (`emergencyContact` only exists on `Resident`, not `Guard`). **GAP**. |
| Shift History table (Date, Shift, Post, Status, Entries, Check-ins, Compliance, Notes) | ⚠️ Partial — `Shift` model gives `startedAt/endedAt/totalEntries/totalIncidents/handoverNote/openItems`; "Check-ins" count = `GuardPost` count for that shift (derivable); "Compliance" per shift → **GAP**, no such field; "Post" per shift row assumes one post per shift, but a guard could check into multiple posts in one shift per the schema (`GuardPost` has its own `entryPointId`) — needs a "primary post for the shift" convention. |
| "Force Clear / Flag" button | ❌ **GAP** — no such mutation exists (see Override Log gaps). |

### 2.6 Reassign Post modal
Lists all posts with current occupant, radio-select new post, Confirm Reassign.
- List of posts + current occupant → derivable from `GuardPost` (latest per `EntryPoint` per property) + `EntryPoint` model.
- Confirm action → ❌ **GAP**, no reassignment route (see 2.4).

### Real-time
- `incident:new` → live-prepend to Incidents tab.
- No current socket event for guard post/shift changes — **GAP**: consider emitting `guard:status_changed` on shift start/end and post check-in so Live Monitoring updates without polling.

---

## 3. Resident Directory (`/residents`)

Tabs: **Directory**, **Credentials & Passes**, **Broadcast History**. Plus **Add Resident** modal, and an alternate **Unit Map** view (grid-by-tower with occupancy).

### 3.1 Directory tab
| Element | Binding |
|---|---|
| Household cards (name, unit/floor, occupancy type, members, active passes, since-date, contact, actions) | ✅ Bound — `GET /residents` (`getAllResidents`, MANAGER/COMMITTEE) returns paginated residents with `unit`, `user.phone`, `user.isActive`. "Active Passes" count needs `Pass` count per unit — not in current `getAllResidents` include, but easy addition (`_count` on unit's passes). ⚠️ Partial for that one count field. |
| Suspend button | ⚠️ Partial/Mislabeled — backend's `deactivateResident` (`DELETE /residents/:id`) sets `user.isActive = false` and **revokes all passes**, which is a hard deactivation, not a soft "Suspend" as implied by the UI. The screenshot also shows a distinct `suspended` badge state on resident cards elsewhere (Unit Map view) that is separate from "active". **GAP**: `Resident`/`User` has no explicit `SUSPENDED` status distinct from `isActive: false` + passes revoked — confirm whether "Suspend" in this UI should literally call `deactivateResident`, or whether a lighter reversible suspend state is wanted (in which case it's a new field). |
| "Add Resident" button → modal | `POST /residents` (`onboardResident`) — fields: Household Name, Unit, Tower, Floor, Members, Phone, Email, Occupancy Type (Owner/Tenant). ⚠️ Partial: backend's `onboardResident` accepts `{ phone, name, unitId, isPrimary }` only — it does **not** accept `tower`, `floor`, `members` count, `email`, or `occupancyType` directly. Those either belong on `Unit` (tower/floor — `updateUnit` exists separately) or don't exist at all yet: **GAP** — `Resident`/`Unit` has no `occupancyType` (Owner/Tenant) field and no `members` count field (member count is implicitly `COUNT(Resident) per unit`, capped at 6 per `addHouseholdMember`'s business rule, but not a stored field) and `User.email` exists on schema but isn't part of `onboardResident`'s current body. |
| "Import CSV" button | ❌ **BACKEND GAP** — no bulk-import endpoint for residents exists anywhere in backend.md (Settings' "Onboarding Admin" role even lists a `resident:import` permission, implying this is planned, but no route/controller exists). |

### 3.2 Credentials & Passes tab
| Column | Binding |
|---|---|
| Pass ID, Resident/Unit, Visitor, Type, Status, Created, Expires, Last Used, Usage | ✅ Bound, mostly — `GET /passes/all` (property-wide; listed in the role matrix in backend.md §8 but no controller shown for it — only `getMyPasses` scoped to the calling resident exists). **GAP**: implement the manager-facing `getAllPasses` controller/route explicitly; today only the route table entry exists, not the code. |
| "72d stale" badge | ⚠️ Partial — this maps to the stale-credential concept referenced in Settings' `Stale Credential Threshold (days)` config and the `Compliance Dashboard`'s "Stale Credential Detection" metric, but there is **no scheduled job in backend.md that flags/labels a pass as stale** (only `passExpiryJob` which expires/reactivates based on `validUntil`/`suspendedUntil` — nothing about last-used inactivity). **GAP**: needs a new job or computed field, e.g. `lastUsedAt` on `Pass` (derivable from latest `PassUsageHistory`) compared against `Stale Credential Threshold`. |
| Suspended row highlighting | ✅ Bound — `Pass.status === 'SUSPENDED'`. |

### 3.3 Broadcast History tab
| Element | Binding |
|---|---|
| Broadcast list (title, sender, timestamp, priority tag, scope, body, "sent" status) | ✅ Bound — `Broadcast` model (`propertyId`, `sentBy`, `title`, `body`, `targetScope`, `sentAt`). No `priority` field on `Broadcast` in schema though — screenshot shows "important"/"normal" tags. **GAP**: add `priority` (or reuse `AlertPriority`) to `Broadcast`. |
| "Compose New Broadcast" | ❌ **GAP** — no `POST /broadcasts` route/controller exists in backend.md at all; only the `Broadcast` table and its relation to `Property` are defined. Route table mentions `POST /alerts/broadcast` conceptually (role matrix: "POST /alerts/broadcast — MANAGER, COMMITTEE") but no controller is implemented for it. |

### 3.4 Unit Map view (grid by tower, vacant/occupied/suspended)
| Element | Binding |
|---|---|
| Per-unit tile (unit no., occupied/vacant/suspended, resident names, pass count) | ⚠️ Partial — `GET /units` (`getAllUnits`) returns units with primary resident name + active pass count via `_count`. "Suspended" tile state is not a `Unit` field — it's derived from whether the unit's resident(s) are deactivated, which is fine to compute client-side from the residents list, **but** see 3.1's gap about what "Suspended" even means for a resident today. |
| Tower/floor grouping | ✅ Bound — `Unit.tower`, `Unit.floor`. |

### Real-time
- No dedicated socket events for resident/pass changes are defined in backend.md. **GAP**: consider `pass:status_changed` and `resident:updated` emits so Directory/Credentials tabs refresh live rather than via polling.

---

## 4. Event Timeline (`/timeline`)

Tabs: **By Unit**, **By Guard**. Chronological entries with type badges (Scan, Approval, Alert, Incident, Pass Created) and "Linked Event" cross-references.

❌ **BACKEND GAP — no unified timeline endpoint.** This is the same aggregation problem as the Dashboard's Live Activity Feed, but scoped and filterable per unit or per guard, plus explicit "linked event" pairs (e.g., a Walk-In Request event linked forward to its Walk-In Approved/Denied event).

What exists per source, and what's missing to assemble this page:

| Source event type | Backing model | Notes |
|---|---|---|
| Visitor Entry / Exit Scanned | `Entry` (`entryAt`, `exitAt`, `method`, `pass`, `guard`, `entryPoint`) | ✅ Bound per-row. |
| Walk-In Request / Walk-In Approved (or Denied) | `WalkinApproval` (`requestedAt`, `respondedAt`, `decision`) + parent `Entry` | ✅ Bound per-row, but the "Linked Event" pointer between request→decision is implicit (same `entryId`), not an explicit graph — fine to derive client-side. |
| Pass Created | `Pass.createdAt` | ✅ Bound. |
| Incident Reported | `Incident.createdAt` + `IncidentAction` timeline | ✅ Bound. |
| Delivery scan / Vehicle events | `Entry` with `vehicleNumber` set | ✅ Bound. |

**What's missing**: a single `GET /timeline?unitId=` or `GET /timeline?guardId=` that server-side unions `Entry`, `WalkinApproval`, `Pass`, `Incident`/`IncidentAction` ordered by time, with a consistent `{ type, title, subtitle, actorName, timestamp, refId, linkedRefId? }` shape. Building this by making 4 separate calls and merging client-side is a viable fallback but should be called out as a stopgap, not the target architecture.

### Component states
- Unit/Guard selector chips at top — `GET /units` / `GET /guards/directory` to populate the picker (✅ bound, reusing endpoints from other pages).
- Empty: "No activity recorded for this unit/guard yet."

---

## 5. Alerts & Escalation (`/alerts`)

Left: unified alert queue with priority filter, Acknowledge/Resolve/Escalate actions. Right: static "Escalation Chains" reference panel (P1/P2/P3 chain of contacts + timing + channel).

### 5.1 Alert queue
| Element | Binding |
|---|---|
| Alert list (priority badge, title, status, timestamp, source, description, Acknowledge/Resolve/Escalate buttons) | ✅ Bound to `Alert` model — `priority`, `status` (`SENT/ACKNOWLEDGED/ESCALATED/RESOLVED`), `title`, `body`, `createdAt`. Need `GET /alerts?propertyId=&priority=&status=` — **not explicitly shown as a route in backend.md** (only `triggerAlert()` and `acknowledgeAlert()` utility functions exist, called internally by other modules). **GAP**: add an actual `GET /alerts` index route and `alert.routes.ts`/`alert.controller.ts` wrapping these utils for direct manager consumption. |
| "Acknowledge" action | ⚠️ Partial — `acknowledgeAlert(alertId, userId)` util exists but isn't wired to any route. **GAP**: add `PUT /alerts/:id/acknowledge`. |
| "Resolve" action | ❌ **GAP** — no `resolvedAt`-setting logic exists anywhere in backend.md, even though `Alert.status` enum includes `RESOLVED` and `Alert.resolvedAt` is a schema field. Needs `PUT /alerts/:id/resolve`. |
| "Escalate" action (manual, from the queue) | ⚠️ Partial — automatic escalation exists via `alertEscalationJob` (cron, SLA-based), but there's no **manual** "Escalate now" route a manager can click. **GAP**: add `PUT /alerts/:id/escalate` for manual escalation, distinct from the cron job. |
| Priority/status filters | Query params on the above index route — to be added alongside it. |

### 5.2 Escalation Chains panel
Shows fixed chains: P1 (Facility Manager → Committee Head → Regional Security HQ → Emergency Services, with delay + channel per step), P2, P3.

❌ **BACKEND GAP — entirely hardcoded today.** `alertEscalation.job.ts` has `SLA_MINUTES = { P1: 3, P2: 15, P3: 60 }` and a fixed rule ("escalate to MANAGER/COMMITTEE via push, +SMS for P1") baked directly into the cron job — there is **no configurable `EscalationChain` model** with per-step contacts, delays, and channels as shown in the UI (e.g., "+5m", "+10m", "SMS", "ALL"). If the product intent is for managers to edit this chain, a new model (e.g., `EscalationStep { priority, order, roleOrUserId, delayMinutes, channel }`) is required, plus a `GET/PUT /escalation-chains` pair. Until then, render this panel as read-only, sourced from a static config file, not the live backend.

### Real-time
- New `Alert` rows should arrive via socket — backend already emits alert-adjacent events indirectly (e.g. `incident:new`), but there's **no dedicated `alert:new` socket emit** in `triggerAlert()`. **GAP**: emit `io.to('property:'+propertyId).emit('alert:new', alert)` inside `triggerAlert()` so this page updates live instead of polling.

---

## 6. Expected Visitors (`/expected-visitors`)

Categorized visitor list (Family/Delivery/Service/Guest/House-Help) with status (checked in / checked out / approved / pending), host unit, expected vs. actual entry/exit times, notes. "Add Visitor" modal for pre-registration.

❌ **BACKEND GAP — no `ExpectedVisitor` (pre-registration) model exists.** The closest concept in backend.md is `Pass` (has `visitorName`, `validFrom/validUntil`, `type`), but:
- `Pass.type` enum is `ONE_TIME / RECURRING / DELIVERY / CONTRACTOR` — it has **no "Family/Guest/House-Help/Service" categories** as shown in the visitor-type dropdown of the Add Visitor modal.
- A `Pass` doesn't carry a separate "expected time" distinct from its validity window, and doesn't track a `checked-in / checked-out / approved / pending` visitor-facing status independent of the underlying `Entry` — that status today only exists per `Entry.status` (`APPROVED/DENIED/PENDING_APPROVAL/NO_RESPONSE`), which requires an actual gate scan to exist, whereas "Expected Visitors" here clearly means **pre-arrival registrations that may not have checked in yet.**
- The Add Visitor modal's fields (Visitor Name, Visitor Type, Host Unit, Host Resident Name, Expected Date, Expected Time, Notes) most closely resemble creating a `Pass` with `type: ONE_TIME`, but `createPass` today is **resident-only** (`req.user.residentId`) — a manager cannot call it on a resident's behalf per the current controller, and there's no `hostResidentName` free-text field (it infers resident from the JWT).

**Recommendation**: either (a) extend `Pass` with a `visitorCategory` field and allow manager-initiated creation with an explicit `residentId`/`unitId` target, or (b) introduce a dedicated `ExpectedVisitor` model separate from `Pass` for pre-registration bookkeeping, converting to a real `Pass`/`Entry` only at gate scan time. This is a product decision to flag back to the backend owner before wiring this page.

Given the above, the entire page (list + modal + status badges) is a **GAP** and should be built against a mocked/local data source until the backend decision is made, clearly marked as non-functional in a dev banner.

---

## 7. Parking & Vehicles (`/parking`)

Tabs: **Occupancy Overview**, **Vehicle Log**.

### 7.1 Occupancy Overview
| Element | Binding |
|---|---|
| Stat tiles (Resident Occupied 213/280, Visitor Occupied 18/40, Overstays, Available Slots) | ❌ **BACKEND GAP** — there is no parking-slot/capacity model at all in backend.md. `Vehicle` only records `unitId`, `registrationNo`, make/model/color, `isResident`, `isActive` — it has no relationship to a parking slot, no capacity concept, and no notion of "resident slots" vs. "visitor slots" totals. |
| "Currently Present" table (Plate, Type, Owner/Unit, Entry Time, Duration, Overstay flag) | ⚠️ Partial — `Vehicle` gives plate/owner/unit, and `Entry.vehicleNumber` + `Entry.entryAt`/`exitAt` could theoretically derive "currently present" (an entry with no exit yet and a vehicle plate), so a **presence table is buildable** by joining `Entry` (where `exitAt IS NULL` and `vehicleNumber IS NOT NULL`) to `Vehicle`. But "Duration" and "Overstay" require a configurable max-duration-per-type policy that doesn't exist anywhere in the schema. **GAP** for the overstay/duration logic specifically; the base presence list is close to buildable if a manager-scoped `GET /entries/all?hasVehicle=true&open=true` existed (see Dashboard gap #6 — same missing endpoint). |

### 7.2 Vehicle Log
| Column | Binding |
|---|---|
| Plate, Type, Owner/Unit, Entry, Exit, Status, Pass | ⚠️ Partial — same as above: derivable from `Entry` + `Vehicle` + `Pass` joins, but needs the missing `GET /entries/all` (manager-wide) endpoint, and "Type" (Resident/Service/Delivery/Visitor) needs to be inferred from `Vehicle.isResident` + `Pass.type`, which is a client-side mapping exercise, not a stored field. |
| checkVehicle (ANPR / plate lookup used by guards, not shown directly here but implies the source of truth) | ✅ Bound — `GET /vehicles/check/:registrationNo` (`checkVehicle`) exists guard-side and fires a P2 alert on unregistered plates; this manager page would just be reading historical `Entry` rows, not calling this guard-facing check itself. |

---

## 8. CCTV Monitoring (`/cctv`)

Camera grid (36 cameras) with per-camera resolution/FPS/uptime/last-motion/status (Online/Recording/Issue), area filters (Gates, Parking, Amenities, Common Areas, Perimeter), storage stats (retention days, TB free/used), and an Area Overview summary (online counts per zone).

❌ **BACKEND GAP — entirely absent from backend.md.** There is no `Camera`, `Hardware`, or `NVR` model, no streaming/snapshot endpoint, and no storage/retention tracking anywhere in the schema or modules list. This is a completely separate subsystem (likely integrating with an NVR/VMS vendor API or an RTSP/HLS streaming service) that has zero backend representation today.

This entire page must be treated as **out of scope for the current backend** and either:
1. Stubbed with static/mock camera tiles for design/demo purposes, clearly flagged as non-functional, or
2. Scoped as a new backend module (`Camera` model with `location`, `type`, `resolution`, `status`, `ipAddress`, `firmwareVersion`, `lastMotionAt`, `uptimeSeconds`; plus a streaming proxy layer) before any real integration work begins on the frontend.

Do not attempt to bind this page to any existing endpoint — none apply.

---

## 9. Reports & Compliance (`/reports`)

Tabs: **Monthly Reports**, **Audit Trail**, **Compliance Dashboard**.

### 9.1 Monthly Reports
| Element | Binding |
|---|---|
| Report cards (title, summary line, generated-by/date, 6 stat tiles, Download button) | ⚠️ Partial — `GET /reports/monthly?month=&year=` (`generateMonthlyReport`) exists and **streams a PDF directly** (`Content-Type: application/pdf`); it does not return a JSON summary object for rendering the on-screen stat tiles (Total Gate Events, Incidents Reported, Guard Post Compliance %, Credential Audit Coverage %, Pending Overrides, Resident Satisfaction). **GAP**: the frontend needs a JSON-returning sibling endpoint (e.g. `GET /reports/monthly/summary?month=&year=`) built from the same underlying queries as `generateMonthlyReport`, so the UI can render tiles before the user clicks Download. The Download button itself → ✅ bound directly to `GET /reports/monthly?month=&year=` (PDF stream). |
| "Guard Post Compliance %", "Credential Audit Coverage %", "Resident Satisfaction" tiles specifically | ❌ **GAP** — none of these three metrics are computed anywhere in `generateMonthlyReport`'s current logic (it computes entries, incidents, guard shift compliance list, active pass count, and stale-pass anomalies — not percentage roll-ups, and "Resident Satisfaction" (4.2/5) has **no data source at all** in the schema — no ratings/survey model exists). |
| "Export All" button | ❌ **GAP** — no bulk-export route exists. |

### 9.2 Audit Trail
| Column | Binding |
|---|---|
| Timestamp, Manager, Action, Reason Code, Reason, Affected Entity | ⚠️ Partial — `AuditLog` model covers Timestamp (`createdAt`), Manager (`userId` → resolve name), Action (`action` string), Affected Entity (`entity` + `entityId`). **No `reasonCode` or free-text `reason` field exists on `AuditLog`** — same gap as Guard Management's Override Log (§2.4). A `GET /audit-logs?propertyId=` index route is also not shown in backend.md (only the `auditLog()` write-side util is documented). **GAP**: add the read route, and add `reasonCode`/`reason` columns to `AuditLog` (or accept that this tab and the Override Log tab in §2.4 are the same data source and should be unified). |

### 9.3 Compliance Dashboard
Cards: Post Check-In Compliance (91%/95% target), Shift Handover Completion (97%/100%), Incident Response Time (4.2min/5min), Time-Bounded Credentials (88%/90%), Credential Audit Coverage (97%/100%), Stale Credential Detection (82%/85%), CCTV Uptime (99.2%/99.5%), Barrier Gate Availability (99.8%/99.5%), each with a compliant/warning badge and "Last checked" timestamp.

❌ **BACKEND GAP — no compliance-metrics model or computation exists for any of these 8 KPIs.** Partial raw ingredients exist for a few (e.g., `Shift.signedOffAt` could feed "Shift Handover Completion"; `IncidentAction` timestamps could feed "Incident Response Time"; `Pass`/`PassUsageHistory` could feed credential-related metrics), but there is no service in backend.md that rolls these into percentages against configurable targets, and CCTV/Barrier-Gate uptime depend entirely on the hardware subsystem that doesn't exist (§8). This whole tab needs a new `ComplianceMetric` computation job/model plus a target-configuration surface (tying into the same `PlatformConfig` gap noted in Settings §12).

---

## 10. Community Control (`/community`)

Tabs: **Community Feed**, **Members**, **Flagged Content**.

❌ **BACKEND GAP — entirely absent from backend.md.** There is no social/community-post model, no member-role-within-community concept beyond the four system `Role`s, no chat-toggle field, and no content-flagging/moderation model anywhere in the schema.

- Community Feed (posts with pin/like/comment counts, Hide action) → needs a new `CommunityPost` model (`authorId`, `body`, `createdAt`, `pinned`, `likeCount`, `commentCount`, `hidden`) plus `POST /community/posts`, `PUT /community/posts/:id/hide`, `PUT /community/posts/:id/pin`.
- Members tab (role: admin/member, joined date, post count, chat toggle, active/suspended, Suspend/Restore) → needs a `CommunityMember` concept layered on top of `Resident`/`CommitteeMember` — the "chat toggle" per member and community-specific "admin" role are **not** the same as the system `Role` enum (`RESIDENT/GUARD/MANAGER/COMMITTEE`) and have no field to hold them today.
- Flagged Content tab (flagged-by, reason, Dismiss/Suspend Member) → needs a `ContentFlag` model referencing the (also-missing) `CommunityPost`/member.

Treat this entire page as a future module. Do not attempt partial binding — none of the required models exist.

---

## 11. Workforce Mgmt (`/workforce`)

Tabs: **Leave Records**, **Worker Pool**, **Active Assignments**. Plus **Add Worker to Pool** modal.

### 11.1 Leave Records
Columns: Guard, Type (Sick/Festival/Annual/Emergency), Dates, Days, Post Affected, Covered By, Status (approved/pending), Approver.

❌ **BACKEND GAP — no `Leave`/`LeaveRecord` model exists in backend.md.** `Guard` and `Shift` models track on-duty status and shift start/end, but there is no leave-request, leave-type, or approval-workflow model anywhere in the schema. This entire tab needs a new module (`LeaveRecord { guardId, type, startDate, endDate, postAffected, coveredByGuardId?, status, approvedBy }`) plus routes for request/approve/deny.

### 11.2 Worker Pool
Cards: name, worker type (Relief Guard / Housekeeping / Maintenance / Electrician), rating, available date range, phone, assignment count, "Assign to Post" button.

❌ **BACKEND GAP.** The `Guard` model represents only security guards tied to a `propertyId` with a `badgeNumber` — there is no generalized `Worker`/`WorkerPool` model covering non-guard roles (housekeeping, maintenance, electrician) or a `rating` field on anyone. The "Assign to Post" action similarly has no backing route (`GuardPost` creation is guard-self-service only, per §2.4's gap).

### 11.3 Active Assignments
List: worker name, role/post, date + shift window, status (active/upcoming), assigned-by, assigned-at.

❌ **BACKEND GAP** — same missing `Worker`/assignment model as above; nothing to bind to.

### 11.4 Add Worker to Pool modal
Fields: Full Name, Worker Type, Phone, Available From/To, Rating slider.

❌ **BACKEND GAP** — no `POST /workers` (or equivalent) exists; would be the creation endpoint for the new `Worker` model proposed above.

**Summary for this page**: build entirely against a new backend module. Nothing here maps to `Guard`/`Shift` in a way that's safe to reuse, since guards and general workers are conflated in the UI but modeled completely separately (or not at all) in the backend.

---

## 12. Settings (`/settings`)

Tabs: **Roles & Permissions**, **Hardware**, **API Keys**, **Platform Config**.

### 12.1 Roles & Permissions
Cards per role (Facility Manager, Committee Member, Regional Manager, Onboarding Admin) showing member count and permission-tag chips, "Edit Permissions" link.

⚠️ **Partial / mostly GAP.** Backend.md documents a **hardcoded** role matrix (§8, "Every route is protected... Here is the full role permission matrix") baked into route-level `requireRole(...)` calls in code — permissions are not data-driven. There is no `Role`-to-`permission` mapping table, no per-role member-count query, and critically:
- Two of the four roles shown in the UI (**Regional Manager**, **Onboarding Admin**) **don't exist at all** in the backend's `Role` enum, which only has `RESIDENT / GUARD / MANAGER / COMMITTEE`. **GAP**: either extend the `Role` enum (breaking change — every `requireRole()` call site would need review) or introduce a separate finer-grained permissions system layered on top of the 4 base roles.
- "Edit Permissions" implies runtime-editable permission sets — today permissions are compile-time `requireRole()` calls per route, not data. This would require a fundamental RBAC redesign (a `Permission` model + `RolePermission` join table + middleware reading from DB instead of hardcoded enums).

Render this tab read-only against the static matrix in backend.md as a stopgap; "Edit Permissions" should be disabled/hidden until real RBAC-as-data exists.

### 12.2 Hardware
Table: Device, Type: Gate/CCTV Camera/Intercom/Access Panel/NVR), Location, Status (online/degraded/maintenance), IP Address, Firmware, Last Checked.

❌ **BACKEND GAP** — no hardware/device model exists (same root gap as CCTV Monitoring, §8). Needs a `Device` model (`type`, `location`, `status`, `ipAddress`, `firmwareVersion`, `lastCheckedAt`) plus a device-heartbeat/health-check subsystem.

### 12.3 API Keys
Table: integration name, masked key, scopes (read:events, write:broadcast, etc.), status (active/revoked), created/last-used dates, Revoke/Generate actions.

❌ **BACKEND GAP** — no `ApiKey` model, no key-generation/revocation endpoints, and no scope system exists in backend.md. The JWT auth system documented is for human users (phone+OTP / manager password) only; there's no service-account/API-key issuance flow.

### 12.4 Platform Config
Fields: Pending Approval Timeout (minutes), Stale Credential Threshold (days), Auto-Suspend Grace Period (days), Data Refresh Interval (seconds), Data Retention (years), Enforce MFA (toggle).

⚠️ **Partial / mostly GAP.** These look like they should back real backend behavior, and in fact **some of the underlying behaviors already exist as hardcoded constants in code** rather than editable config:
- "Pending Approval Timeout" ↔ `WALKIN_TIMEOUT_SECONDS = 90` constant in `walkin.controller.ts` — currently **not configurable**, it's a literal in code.
- "Stale Credential Threshold" ↔ referenced conceptually by the Compliance Dashboard's stale-credential metric, but as noted in §3.2/§9.3, no job actually computes staleness against a threshold today — there's nothing to configure yet.
- "Auto-Suspend Grace Period" ↔ no matching logic anywhere; passes are only auto-expired by `validUntil`/`suspendedUntil` in `passExpiryJob`, not by an inactivity grace period.
- "Data Retention (years)" ↔ no data-retention/purge job exists in backend.md.
- "Enforce MFA" ↔ no MFA implementation exists at all — auth is phone+OTP or (for manager/committee) phone+password per backend.md's auth section; there's no second factor to toggle.

**GAP, in full**: introduce a `PlatformConfig` (or `PropertyConfig`) model keyed by `propertyId` holding all of the above as editable fields, then refactor the hardcoded constants (`WALKIN_TIMEOUT_SECONDS`, SLA minutes, etc.) to read from it instead of literals in code.

---

## 13. My Profile (`/profile`)

Tabs: **General**, **Security**, **Notifications**.

| Element | Binding |
|---|---|
| General (Full Name, Email, Role, Phone, Assigned Property) | ✅ Bound — `Manager` model (`name`, `propertyId`) + `User` (`phone`, `email`, `role`). Needs a `GET /managers/me` (or generic `GET /users/me`) — **not explicitly shown in backend.md**, but trivially composable from existing `prisma.user`/`prisma.manager` queries used elsewhere (e.g., pattern mirrors `getMyProfile` in resident.controller.ts, which is resident-only today). **GAP**: add the manager-equivalent `getMyProfile`. |
| Last login, Sessions (2 active), Member since | ⚠️ Partial — `User.lastLoginAt` and `Manager.createdAt` map directly. "Sessions: 2 active" → **GAP**, no session-count concept exists; the closest primitive is counting non-revoked, non-expired `RefreshToken` rows for the user, which is derivable but not currently exposed by any endpoint. |
| "Edit Profile" | ❌ **GAP** — no `PUT /managers/me` (or `/users/me`) route exists; only the resident-side `updateMyProfile` (`PUT /residents/me`) is implemented. |
| Security tab (password change, presumably) | ⚠️ Partial — `User.passwordHash` exists for manager/committee auth, but backend.md's auth module (§7) is entirely OTP-based for login and never shows a password-set/change route being called, despite the model supporting it. **GAP**: add `PUT /auth/password` for manager/committee accounts. |
| Notifications tab (alert channel preferences) | ⚠️ Partial — `Resident.alertPreferences` (JSON) exists and has a dedicated `PUT /residents/me/alerts` route, but **there is no equivalent field or route for `Manager`** — managers currently get alerts unconditionally via `triggerAlert`'s `targetRoles` matching, with no per-manager opt-out. **GAP** if per-manager notification preferences are meant to be real. |

---

## Cross-Cutting Backend Gaps Summary

For quick reference when scoping backend work, the following net-new models/routes are required before the pages above can be fully live (beyond what backend.md documents today):

1. **Manager-wide entry visibility**: `GET /entries/all?propertyId=` (referenced in role matrix, never implemented) — blocks Dashboard visitor board, Event Timeline, Parking & Vehicles.
2. **Manager-wide pass visibility**: `GET /passes/all?propertyId=` (referenced in role matrix, never implemented) — blocks Credentials & Passes tab.
3. **Alert index + acknowledge/resolve/manual-escalate routes**, plus `alert:new` socket emit — blocks Dashboard alerts panel and Alerts & Escalation page.
4. **Manager override/reason-code system** (force approve/deny walk-ins, force clear gates, guard reassignment, manager-initiated pass suspend) — blocks Guard Management's Override Log and half its Guard Detail actions.
5. **Incident list route** (`GET /incidents`) and `severity` field on `Incident` — blocks Guard Management's Incidents tab.
6. **Unified activity/timeline aggregation endpoint** — blocks Dashboard's Live Activity Feed and the entire Event Timeline page.
7. **Broadcast creation route + priority field** — blocks Resident Directory's Broadcast History "compose" action.
8. **Expected-visitor pre-registration model** (distinct from `Pass`) — blocks the entire Expected Visitors page.
9. **Parking capacity/slot model + overstay policy** — blocks Parking & Vehicles' Occupancy Overview stat tiles.
10. **Hardware/device/camera subsystem** — blocks CCTV Monitoring entirely and Settings' Hardware tab.
11. **Compliance metrics computation + configurable targets** — blocks Reports' Compliance Dashboard and several Guard Detail stats (rating, compliance %).
12. **Community module** (posts, members, flags) — blocks Community Control entirely.
13. **Workforce/Worker Pool + Leave module** — blocks Workforce Mgmt entirely.
14. **Data-driven RBAC (Permission/RolePermission), API key issuance, and PlatformConfig model** — blocks most of Settings.
15. **Manager self-service profile routes** (`GET/PUT /managers/me`, password change, notification prefs) — blocks parts of My Profile.

---

## Component State Conventions (applies everywhere above)

- **Loading**: skeleton placeholders matching the real layout (not spinners) for tables/cards; keep tab bar interactive during load.
- **Empty**: contextual copy + a primary action where one exists (e.g., "No active passes for this unit — Create Pass"); never a bare "No data."
- **Error**: inline retry affordance scoped to the failed widget/section, not a full-page crash; preserve any previously successful data on screen.
- **Permission-denied**: hide the nav item / section entirely for roles that fail `requireRole` server-side rather than rendering a disabled state, matching backend's all-or-nothing route gating.
- **Stale/gap-mode**: for any section marked ❌ **BACKEND GAP** above, render a small persistent dev-mode banner ("Not yet connected to backend — placeholder data") rather than silently faking success states, so gaps aren't mistaken for working features during review.

---

## Production Readiness & Gap Resolution Plan

To transform this frontend specification into a production-ready implementation with no mock data, the following comprehensive approach is required:

### 1. Backend Gap Resolution Strategy

Each identified BACKEND GAP must be addressed through targeted backend development:

**Priority 1: Core Data Access Gaps**
- Implement `GET /entries/all?propertyId=` for manager-wide entry visibility
- Implement `GET /passes/all?propertyId=` for manager-wide pass visibility
- Create alert management endpoints: `GET /alerts`, `PUT /alerts/:id/acknowledge`, `PUT /alerts/:id/resolve`, `PUT /alerts/:id/escalate`
- Implement unified activity/timeline endpoint: `GET /activity-feed?propertyId=`
- Add incident management: `GET /incidents` and `severity` field on Incident model
- Create broadcast endpoints: `POST /broadcasts` with priority field
- Implement expected visitor system (either extended Pass or new ExpectedVisitor model)
- Add parking capacity/slot management with overstay policies
- Build hardware/device/camera subsystem for CCTV monitoring
- Develop compliance metrics computation engine with configurable targets
- Create community module (posts, members, flags)
- Implement workforce/worker pool and leave management modules
- Establish data-driven RBAC system with Permission/RolePermission models
- Add API key management system with scope-based permissions
- Implement PlatformConfig model for editable system settings
- Create manager self-service endpoints: `GET/PUT /managers/me`, password change, notification preferences

**Priority 2: Manager Override System**
- Create ManagerOverride model with reasonCode, reason, affectedEntityType/Id
- Implement manager override routes:
  - `PUT /guards/:id/reassign-post` (guard reassignment)
  - `PUT /walkin/:approvalId/manager-respond` (force approve/deny walk-ins)
  - `PUT /passes/:id/manager-suspend` (manager-initiated pass suspend)
  - Hardware control endpoints for gate clearance (when hardware subsystem exists)
- Extend AuditLog with reasonCode and reason fields for audit trail completeness

**Priority 3: Real-time Synchronization**
- Implement missing socket events:
  - `alert:new` in triggerAlert()
  - `pass:status_changed` and `resident:updated` for resident directory
  - `guard:status_changed` for guard monitoring
  - Hardware status events for CCTV and barrier gates
- Ensure all critical data changes trigger appropriate socket updates

### 2. Production-Ready Implementation Principles

**No Mock Data Policy:**
- All UI components must be backed by real API endpoints
- Loading states must be implemented for all data fetching operations
- Error boundaries must gracefully handle API failures
- Empty states must show meaningful calls-to-action, not just empty screens
- Development/staging environments must use realistic test data, not hardcoded mocks

**Security Hardening:**
- **Authentication & Authorization:**
  - JWT token validation on all API endpoints
  - Role-based access control (RBAC) enforcement at middleware level
  - Token refresh mechanism with secure storage (HttpOnly cookies preferred)
  - Session management with proper expiration and revocation
  - Multi-factor authentication support for sensitive operations
  
- **Data Protection:**
  - Input validation and sanitization on all endpoints
  - Output encoding to prevent XSS attacks
  - SQL injection prevention through parameterized queries/ORM
  - Rate limiting on authentication and sensitive endpoints
  - CORS policies restricted to trusted domains
  - Security headers implementation (CSP, HSTS, X-Frame-Options, etc.)
  
- **API Security:**
  - HTTPS enforcement in production
  - Proper error handling that doesn't leak sensitive information
  - API versioning for backward compatibility
  - Request/response size limits
  - Comprehensive logging and monitoring for security events

**Performance & Scalability:**
- Pagination for all list views (residents, guests, alerts, etc.)
- Efficient database queries with proper indexing
- Caching strategies for frequently accessed, slowly changing data
- Image optimization for user-uploaded content
- Lazy loading for non-critical resources
- Bundle optimization and code splitting for frontend assets

**Reliability & Observability:**
- Comprehensive error boundaries and fallback UIs
- Retry mechanisms with exponential backoff for failed requests
- Health check endpoints for all services
- Distributed tracing for request flow monitoring
- Metrics collection for performance monitoring
- Structured logging for debugging and audit trails

### 3. Integration with Guard and Resident Applications

**Shared Authentication System:**
- Unified JWT-based authentication across all three applications (Manager, Guard, Resident)
- Role-based token claims determining accessible features in each app
- Single sign-on capability with shared session management
- Token refresh mechanism working across all client applications

**API Contract Consistency:**
- Shared API gateway with versioned endpoints
- Consistent data models and response formats across applications
- Standardized error response formats
- Unified WebSocket connection handling and event naming

**Data Synchronization Patterns:**
- Real-time updates via Socket.IO with room-based scoping:
  - Property-specific rooms: `property:{propertyId}`
  - User-specific rooms: `user:{userId}`
  - Role-based rooms: `role:{role:{role} (for broadcasts)
- Event-driven updates ensuring data consistency across clients
- Conflict resolution strategies for concurrent updates
- Offline capability with sync when connectivity restored (for mobile guard app)

**Cross-App Feature Integration:**

1. **Guard-Manager Integration:**
   - Guard check-ins/post updates visible in Manager Dashboard Live Monitoring
   - Manager-initiated guard reassignments pushed to Guard app in real-time
   - Incident reporting flow: Guard creates → Manager reviews/assigns → Guard updates
   - Walk-in request flow: Guest requests → Guard forwards → Manager approves/denies → Guest notified

2. **Resident-Manager Integration:**
   - Resident-initiated pass requests visible in Manager Pending Approvals
   - Manager-created broadcasts/residents receive in Resident app
   - Emergency alerts flow from any app to all others with appropriate targeting
   - Visitor pre-approvals: Resident requests → Manager approves → Guard executes
   - Community features: Resident posts → Manager moderation → All residents view

3. **Guard-Resident Integration:**
   - Visitor management: Resident pre-registers → Guest checks in with Guard → Resident notified
   - Emergency reporting: Either party can report incidents visible to all
   - Announcements: Management posts visible to both Guard and Resident apps
   - Facility status: Maintenance schedules, amenity availability shared across apps

**Technical Integration Points:**
- Shared UI component library for consistent UX across platforms
- Common utility libraries for date formatting, validation, etc.
- Unified error handling and reporting mechanisms
- Shared configuration management for feature flags and environment settings
- Coordinated release management with version compatibility matrix

### 4. Deployment and Operations Strategy

**Environment Strategy:**
- Development: Local mock services for rapid iteration
- Staging: Production-like environment with anonymized data
- Production: High-availability deployment with monitoring and alerting

**Deployment Pipeline:**
- Automated testing (unit, integration, end-to-end) on every commit
- Staging deployment with automated smoke tests
- Blue-green or canary deployment strategies for zero-downtime releases
- Rollback capabilities for failed deployments
- Feature flags for gradual rollout of new functionality

**Monitoring and Observability:**
- Application Performance Monitoring (APM) for backend services
- Real-user monitoring (RUM) for frontend performance
- Error tracking and alerting for production issues
- Business metrics dashboard for key performance indicators
- Security information and event management (SIEM) integration

**Data Management:**
- Database migration strategy with version control
- Backup and disaster recovery procedures
- Data retention and archival policies
- GDPR/CCPA compliance measures for personal data
- Regular security audits and penetration testing

### 5. Implementation Roadmap

**Phase 1: Foundation (Weeks 1-3)**
- Implement core data access endpoints (entries, passes, alerts)
- Establish authentication and authorization framework
- Set up real-time communication infrastructure
- Create basic UI skeletons with loading/error states

**Phase 2: Core Features (Weeks 4-6)**
- Build Dashboard with real data bindings
- Implement Guard Management core functionality
- Develop Resident Directory with actual data integration
- Create Alerts & Escalation system with real-time updates

**Phase 3: Advanced Features (Weeks 7-9)**
- Complete Event Timeline with unified activity feed
- Implement Expected Visitors system
- Develop Parking & Vehicles management
- Build Reports & Compliance dashboard with real metrics

**Phase 4: Integration & Polish (Weeks 10-12)**
- Finalize CCTV Monitoring integration (when backend ready)
- Complete Community Control and Workforce Management modules
- Implement all cross-app integration points
- Conduct security audit and performance optimization
- User acceptance testing and feedback incorporation

**Phase 5: Production Readiness (Weeks 13-14)**
- Load testing and performance tuning
- Security penetration testing and remediation
- Documentation and knowledge transfer
- Production deployment and monitoring setup
- Go-live readiness review and sign-off

This comprehensive approach ensures that the Manager Portal evolves from a specification with identified gaps into a production-ready, secure, and fully integrated application that provides real value to facility managers while maintaining seamless coordination with the Guard and Resident applications.
</task_progress>
- [x] Add production readiness and gap resolution section to frontend.md
</task_progress>
</write_to_file>
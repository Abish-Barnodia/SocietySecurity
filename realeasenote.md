<!-- ponytail: high-signal, enterprise-grade software release notes -->
# Release Notes — My_Gate_Clone `v1.0.0`

| Metric / Attribute | Value |
| :--- | :--- |
| **Release Version** | `v1.0.0` (General Availability) |
| **Release Date** | September 2, 2026 |
| **Release Tag** | `v1.0.0-ga` |
| **Repository** | `ellipsonic-projects/My_Gate_Clone` |
| **Monorepo Engine** | PNPM Workspaces + Turborepo |
| **Target Runtime** | Node.js `v20.x`, React Native `0.86` / Expo `~57.0`, Express `v5.x` |
| **Lead Engineer** | Abish Barnodia |

---

## 📌 Executive Summary

**My_Gate_Clone v1.0.0** marks the initial major release of the end-to-end Apartment Security & Society Management Platform. This release unifies resident access management, guard gate verification, manager dashboard analytics, and real-time security alerts into a production-grade monorepo architecture. 

Key milestones include native OS incoming visitor call alerts via Expo push dispatching, real-time WebSocket property room broadcasting, automated maintenance ledger entry via Razorpay hooks, and PDF credential export mechanisms with strict audit limits.

---

## 🏗️ Architecture & Component Matrix

| Workspace Package | Type | Core Technologies | Primary Function |
| :--- | :--- | :--- | :--- |
| `apps/api-server` | Backend Service | Express 5, Prisma 7, PostgreSQL, Socket.IO, Redis, Bull | REST API endpoints, real-time WebSocket events, background queues, push dispatching |
| `apps/resident-app` | Cross-Platform Mobile | React Native 0.86, Expo 57, React 19 | Visitor approval, gate pass QR generation, community feed, maintenance payments |
| `apps/guard-app` | Mobile App | React Native 0.86, Expo 57 | Visitor entry QR scanning, guard roster verification, post allocation |
| `apps/manager-dashboard` | Web Application | React 19, TypeScript, Socket.IO Client | Property-wide administration, guard post management, live incident monitoring |
| `services/visitor-access` | Microservice Layer | Node.js, Express, Socket.IO | Real-time visitor state machine & gate passage validation |
| `services/alert-notification` | Microservice Layer | Node.js, Expo Server SDK, Firebase Admin | Asynchronous multi-channel push notification dispatcher |

---

## 🚀 New Features & System Additions

### 🔔 Native OS Actionable Visitor Ring Notifications (`apps/resident-app`, `apps/api-server`)
- **Full-Screen Incoming Call UI**: Implemented actionable push payloads (`actionableType: "VISITOR_RING"`) allowing residents to respond with interactive **Accept** or **Deny** actions directly from system lock screens.
- **Dedicated Android Alarm Channels**: Configured high-priority Android sound channels with custom audio attachments (`expo-audio` / `expo-notifications`) to guarantee distinct ringing tones without premature cut-offs (`e08c057`, `c906ac0`).
- **Household Multi-Device Dispatch**: Visitor arrivals automatically broadcast alerts simultaneously to all active devices registered to the target household (`dec592d`).
- **Expo Push Fallback Resolver**: Added explicit fallback `projectId` resolution hooks in the push token registration pipeline (`5dcbc74`).

### 🛡️ International Visitor Gate Passes & Visual QR Code Sharing (`apps/resident-app`)
- **International Country-Code Selector**: Integrated country dialing code selection for international visitor phone numbers during gate pass generation (`5faa339`).
- **Binary Image QR Export**: Upgraded QR code sharing functionality to export passes as actual binary image files (`.png`) via `react-native-view-shot` / `expo-sharing` rather than plain string representations (`122aa98`).

### 📄 Secure Onboarding Credential PDF Generator (`apps/api-server`, `apps/manager-dashboard`)
- **PDF Card Export Engine**: Built PDF document generation backend using `pdfkit` for generating standardized account login cards for new security guards and residents (`e3b192c`).
- **Strict Sharing Quota**: Enforced server-side quota tracking that limits account credential PDF sharing (via WhatsApp Web & Email API) to a **maximum of 2 shares per account** (`2dadfb6`).

### 🏡 Resident Directory Governance & Soft Deletion (`apps/api-server`, `apps/manager-dashboard`)
- **Prisma Cascade Soft Delete**: Introduced a `isDeleted` soft-deletion workflow for households, hiding families from active directory queries while preserving historical audit trails (`9cf6bd6`, `b03e256`).
- **Historical Audit & Restoration Endpoint**: Added a dedicated `/api/v1/households/deleted-history` route and Manager UI tab to review and restore soft-deleted family accounts (`51ae5cb`, `8ce6e7b`).
- **Simplified Profile Management**: Removed mandatory password fields when editing existing household members to streamline administrator workflows (`020e551`).

### 📷 Community Board Media Workflow (`apps/resident-app`)
- **Image Preview & Caption Attachment**: Built a WhatsApp-style media upload workflow enabling residents to crop, preview, and attach text captions to images prior to publishing (`82b39b8`).

### 📊 Real-Time Escalations & Automated Ledger Sync (`apps/api-server`, `apps/manager-dashboard`)
- **Socket.IO Room Broadcasting**: Integrated property-level WebSocket rooms (`property:<id>`) for instant dispatching of security alerts to all connected manager dashboards (`0757700`).
- **Live Sidebar Badge**: Dynamic real-time badge updates for active escalations without page refreshes (`b7b5752`).
- **Automated Financial Reconciliation**: Webhook handlers automatically record completed Razorpay maintenance payments into the Fund Management ledger as verified income (`ae50ebf`).

---

## ⚡ Enhancements & Refactoring

- **Client-Side Routing Normalization**: Enforced consistent URL state management across dashboard views using HTML5 `history.pushState`, ensuring `/dashboard` remains in the browser address bar instead of naked origin URLs (`c6b37ae`, `80026a6`).
- **Authentication Route Guards**: Refactored application routing to intercept unauthenticated access, redirecting users to `/login` and restoring target paths post-authentication (`a419a3e`).
- **Guard Badge Case Normalization**: Implemented automatic uppercase transformation for guard names and badge identifiers on submission to eliminate duplicate case-sensitivity collisions (`606779d`).
- **Dynamic Gate Allocation**: Populated Guard Post Assignment interfaces dynamically from active property database records (`4844a2f`).
- **Flicker-Free Directory Polling**: Removed loader spinners on periodic 15-second background refetches in the Resident Directory (`8d2c0d0`).
- **Modal System Standardization**: Replaced native OS alerts (`Alert.alert()`) with unified, themed in-app modal components across login and password recovery screens (`77bdeac`, `14f8a9f`).
- **Responsive Layout Adjustments**: Added `KeyboardAvoidingView` wrappers and scroll behavior fixes on **Create Pass** and **Add Member** forms to prevent soft-keyboard obstruction (`fdede6d`).

---

## 🐛 Bug Fixes & System Stability

| Component | Issue Identified | Resolution Applied | Commit |
| :--- | :--- | :--- | :--- |
| **Notification Dispatch** | Visitor scan alerts dispatched to security guards instead of residents | Corrected target payload address mapping to resident household IDs | `338d031` |
| **Manager Web App** | Socket.IO CORS rejections on Vercel deployment | Configured origin whitelist and engine transport options | `767536b` |
| **API Transport** | Private IP exposure in upload URLs and Socket.IO 400 errors on Render | Sanitized public hostname resolution and upgraded Socket.IO transport layer | `17146da` |
| **Manager UI** | Unresponsive "Acknowledge" button on alert cards | Fixed unhandled promise rejection and attached bulk "Mark all as read" handler | `5c2465a` |
| **Auth System** | Forgot password hanging indefinitely on missing SMTP credentials | Delegated password reset email delivery to Supabase Auth with clear diagnostic errors | `7ade9ad`, `03fd914` |
| **Guard Roster** | Mock data fallback rendering on post assignments | Replaced fallback mock arrays with live backend query hooks | `b2918bb` |
| **Household API** | HTTP 500 Internal Server Error when saving edited household profiles | Fixed invalid Prisma update payload structure for nested relation updates | `439251b` |
| **Visitor Access** | Walk-in visitor API route mismatch (`walkin` vs `walkins`) | Standardized API REST pathing across client and server | `d503015` |

---

## 🔒 Security, Auth & Compliance Updates

- **Supabase Auth Integration**: Migrated password reset transactional emails to Supabase Auth services to enhance delivery reliability and prevent local SMTP credential leakage (`7ade9ad`, `7b3843d`).
- **Credential Export Security**: Enforced server-side rate limits (max 2 PDF downloads per account) to protect initial account credentials (`2dadfb6`).
- **Input Sanitization**: Enforced strict Zod schema validation on incoming visitor pass inputs and guard creation forms (`8ce6e7b`).

---

## 💥 Breaking Changes & Migration Guide

> [!WARNING]
> **Push Notification Payload Specification Update**  
> Mobile client apps must update to version `v1.0.0` to parse the new actionable payload structure (`actionableType: "VISITOR_RING"`). Legacy client builds will treat visitor incoming call notifications as standard static push alerts.

> [!IMPORTANT]
> **Database Unique Constraint Enforcement on Guard Badges**  
> Guard badge numbers are now strictly uppercase. Run the database migration script below to convert any legacy lower-case or mixed-case guard badges before executing `prisma migrate deploy`.

```sql
-- Migration Script: Uppercase Guard Badges
UPDATE "Guard" SET "badgeNumber" = UPPER("badgeNumber");
```

---

## ⚠️ Known Limitations

1. **Android Battery Optimization**: Devices running heavily modified Android OS distributions (e.g., MIUI, ColorOS) with battery saver enabled may suppress background ringing audio; users should disable battery optimization for the Resident App.
2. **Desktop Web Share Fallback**: Browsers without native Web Share API support will automatically trigger direct PDF download when exporting gate credentials.

---

## 🛠️ Environment Configuration & Deployment Setup

### Environment Variables (`.env`)
Ensure the following variables are configured in `apps/api-server/.env`:

```env
PORT=5000
DATABASE_URL="postgresql://user:password@localhost:5432/society_db?schema=public"
JWT_SECRET="your-production-jwt-secret"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-supabase-anon-key"
EXPO_PROJECT_ID="your-eas-project-id"
RAZORPAY_KEY_ID="rzp_live_xxx"
RAZORPAY_KEY_SECRET="your-razorpay-secret"
```

### Installation & Execution Commands

```bash
# 1. Clone & Bootstrap Workspace Dependencies
git clone https://github.com/ellipsonic-projects/My_Gate_Clone.git
cd My_Gate_Clone/apartment-security
pnpm install

# 2. Run Database Migrations & Prisma Client Generation
npm run prisma:generate --prefix apps/api-server
npm run prisma:migrate --prefix apps/api-server

# 3. Start Backend Services
npm run dev:api

# 4. Launch Resident Mobile App (Expo)
npm run dev:resident
```

---

## 👥 Ownership & Maintainers

- **Lead Software Engineer**: Abish Barnodia ([@AbishBarnodia](https://github.com/AbishBarnodia))
- **Engineering Group**: Ellipsonic Projects / Society Security System Team

---

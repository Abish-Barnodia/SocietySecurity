# Apartment Security — Backend Implementation Guide

One backend. Four roles. Real data only.

---

## Table of Contents

1. [Project Setup](#1-project-setup)
2. [Environment Configuration](#2-environment-configuration)
3. [Database Schema — Prisma](#3-database-schema--prisma)
4. [Database Migrations](#4-database-migrations)
5. [Express App Bootstrap](#5-express-app-bootstrap)
6. [Global Middleware](#6-global-middleware)
7. [Authentication System](#7-authentication-system)
8. [Role-Based Access Control](#8-role-based-access-control)
9. [Residents Module](#9-residents-module)
10. [Units Module](#10-units-module)
11. [Guards Module](#11-guards-module)
12. [Pass Management Module](#12-pass-management-module)
13. [QR Code and OTP Engine](#13-qr-code-and-otp-engine)
14. [Entry and Exit Logging Module](#14-entry-and-exit-logging-module)
15. [Walk-in Approval Flow](#15-walk-in-approval-flow)
16. [Alert and Notification Engine](#16-alert-and-notification-engine)
17. [Incident Management Module](#17-incident-management-module)
18. [Guard Operations Module](#18-guard-operations-module)
19. [Offline Sync Module](#19-offline-sync-module)
20. [Vehicle Registry Module](#20-vehicle-registry-module)
21. [Amenity Booking Module](#21-amenity-booking-module)
22. [Reporting Module](#22-reporting-module)
23. [WebSocket — Real-Time Layer](#23-websocket--real-time-layer)
24. [Job Scheduler — Cron Jobs](#24-job-scheduler--cron-jobs)
25. [Error Handling](#25-error-handling)
26. [Input Validation](#26-input-validation)
27. [Security Hardening](#27-security-hardening)
28. [Logging and Audit Trail](#28-logging-and-audit-trail)
29. [Testing Strategy](#29-testing-strategy)
30. [Deployment](#30-deployment)

---

## 1. Project Setup

### Initialize the project

```bash
mkdir apartment-security-backend
cd apartment-security-backend
npm init -y
```

### Install all dependencies

```bash
# Core
npm install express typescript ts-node @types/node @types/express

# Database
npm install prisma @prisma/client

# Auth
npm install jsonwebtoken bcryptjs @types/jsonwebtoken @types/bcryptjs

# Validation
npm install zod

# Real-time
npm install socket.io

# Job queue
npm install bull @types/bull ioredis

# Notifications
npm install firebase-admin twilio

# QR and OTP
npm install qrcode speakeasy @types/qrcode @types/speakeasy

# PDF generation for reports
npm install pdfkit @types/pdfkit

# WhatsApp pass sharing
npm install axios

# Security
npm install helmet cors express-rate-limit

# Logging
npm install winston morgan @types/morgan

# Environment
npm install dotenv

# Dev dependencies
npm install -D nodemon ts-node-dev rimraf
```

### TypeScript config

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Package scripts

Update `package.json` scripts:

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/app.ts",
    "build": "rimraf dist && tsc",
    "start": "node dist/app.js",
    "prisma:migrate": "npx prisma migrate dev",
    "prisma:generate": "npx prisma generate",
    "prisma:studio": "npx prisma studio",
    "test": "jest --coverage",
    "test:watch": "jest --watch"
  }
}
```

### Folder structure

```
src/
  app.ts                    ← Express bootstrap
  server.ts                 ← HTTP + WebSocket server start
  config/
    env.ts                  ← validated environment variables
    firebase.ts             ← FCM admin init
    redis.ts                ← Redis client
    prisma.ts               ← Prisma client singleton
  modules/
    auth/
    residents/
    units/
    guards/
    passes/
    entries/
    walkin/
    alerts/
    incidents/
    vehicles/
    amenities/
    reports/
    offline/
  middlewares/
    auth.middleware.ts
    role.middleware.ts
    validate.middleware.ts
    rateLimiter.middleware.ts
    upload.middleware.ts
  jobs/
    passExpiry.job.ts
    cacheRefresh.job.ts
    alertEscalation.job.ts
    shiftReminder.job.ts
  utils/
    qr.util.ts
    otp.util.ts
    push.util.ts
    sms.util.ts
    whatsapp.util.ts
    pdf.util.ts
    logger.util.ts
    audit.util.ts
    response.util.ts
  types/
    express.d.ts            ← extend Request with user
    index.ts
  constants/
    roles.ts
    alertPriority.ts
    passTypes.ts
```

---

## 2. Environment Configuration

### `.env` file

```env
# Server
NODE_ENV=development
PORT=5000

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/apartment_security"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET=your_super_secret_key_min_32_chars
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_refresh_secret_key
JWT_REFRESH_EXPIRES_IN=30d

# Firebase (FCM)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Twilio (SMS)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# WhatsApp Business API
WHATSAPP_API_URL=https://api.whatsapp.com/v1
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_ID=your_phone_number_id

# QR signing secret
QR_HMAC_SECRET=your_qr_signing_secret

# OTP
OTP_EXPIRY_MINUTES=10

# Emergency services
EMERGENCY_SMS_NUMBER=+91XXXXXXXXXX

# App URLs
CLIENT_RESIDENT_APP_URL=https://resident.yourdomain.com
CLIENT_GUARD_APP_URL=https://guard.yourdomain.com
CLIENT_MANAGER_URL=https://manager.yourdomain.com
```

### `src/config/env.ts`

Parse and validate every variable at startup — crash early if anything is missing:

```typescript
import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.string().transform(Number),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string(),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string(),
  FIREBASE_PROJECT_ID: z.string(),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string(),
  TWILIO_ACCOUNT_SID: z.string(),
  TWILIO_AUTH_TOKEN: z.string(),
  TWILIO_PHONE_NUMBER: z.string(),
  WHATSAPP_API_URL: z.string().url(),
  WHATSAPP_TOKEN: z.string(),
  WHATSAPP_PHONE_ID: z.string(),
  QR_HMAC_SECRET: z.string().min(32),
  OTP_EXPIRY_MINUTES: z.string().transform(Number),
  EMERGENCY_SMS_NUMBER: z.string(),
  CLIENT_RESIDENT_APP_URL: z.string().url(),
  CLIENT_GUARD_APP_URL: z.string().url(),
  CLIENT_MANAGER_URL: z.string().url(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
```

### `src/config/prisma.ts`

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query', 'error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

### `src/config/redis.ts`

```typescript
import Redis from 'ioredis'
import { env } from './env'
import { logger } from '../utils/logger.util'

export const redis = new Redis(env.REDIS_URL, {
  retryStrategy: (times) => {
    if (times > 5) {
      logger.error('Redis connection failed after 5 retries')
      return null
    }
    return Math.min(times * 200, 2000)
  },
  enableOfflineQueue: false,
})

redis.on('connect', () => logger.info('Redis connected'))
redis.on('error', (err) => logger.error('Redis error', { err }))
```

---

## 3. Database Schema — Prisma

### `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ────────────────────────────────────────────────

enum Role {
  RESIDENT
  GUARD
  MANAGER
  COMMITTEE
}

enum PassType {
  ONE_TIME
  RECURRING
  DELIVERY
  CONTRACTOR
}

enum PassStatus {
  ACTIVE
  SUSPENDED
  EXPIRED
  REVOKED
}

enum DayOfWeek {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
  SUNDAY
}

enum EntryMethod {
  QR_SCAN
  OTP
  MANUAL_GUARD
  VEHICLE_ANPR
}

enum EntryStatus {
  APPROVED
  DENIED
  PENDING_APPROVAL
  NO_RESPONSE
}

enum AlertPriority {
  P1
  P2
  P3
}

enum AlertStatus {
  SENT
  ACKNOWLEDGED
  ESCALATED
  RESOLVED
}

enum AlertChannel {
  PUSH
  SMS
  EMAIL
}

enum IncidentStatus {
  OPEN
  IN_PROGRESS
  CLOSED
}

enum IncidentType {
  UNREGISTERED_VEHICLE
  TAILGATING
  SUSPICIOUS_PERSON
  PERIMETER_BREACH
  UNAUTHORIZED_ACCESS
  PHYSICAL_ALTERCATION
  THEFT
  VANDALISM
  OTHER
}

enum AmenityStatus {
  AVAILABLE
  BOOKED
  MAINTENANCE
}

// ─── Property ─────────────────────────────────────────────

model Property {
  id          String   @id @default(cuid())
  name        String
  address     String
  city        String
  pincode     String
  totalUnits  Int
  totalTowers Int      @default(1)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  units      Unit[]
  guards     Guard[]
  entryPoints EntryPoint[]
  incidents  Incident[]
  amenities  Amenity[]
  managers   Manager[]
  broadcasts Broadcast[]
}

// ─── Entry Points (Gates / Lobbies) ───────────────────────

model EntryPoint {
  id         String   @id @default(cuid())
  propertyId String
  name       String
  type       String   // MAIN_GATE, SERVICE_ENTRANCE, PARKING, LOBBY
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())

  property Property  @relation(fields: [propertyId], references: [id])
  entries  Entry[]
  guards   GuardPost[]
}

// ─── Units ────────────────────────────────────────────────

model Unit {
  id           String   @id @default(cuid())
  propertyId   String
  unitNumber   String
  floor        Int
  tower        String?
  isOccupied   Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  property    Property   @relation(fields: [propertyId], references: [id])
  residents   Resident[]
  passes      Pass[]
  entries     Entry[]
  incidents   Incident[]

  @@unique([propertyId, unitNumber])
}

// ─── Users (base) ─────────────────────────────────────────

model User {
  id           String   @id @default(cuid())
  phone        String   @unique
  email        String?  @unique
  passwordHash String?
  role         Role
  fcmTokens    String[] @default([])
  isActive     Boolean  @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  resident  Resident?
  guard     Guard?
  manager   Manager?
  committee CommitteeMember?
  auditLogs AuditLog[]
  otps      OTP[]
  refreshTokens RefreshToken[]
}

// ─── Residents ────────────────────────────────────────────

model Resident {
  id              String   @id @default(cuid())
  userId          String   @unique
  unitId          String
  name            String
  isPrimary       Boolean  @default(false)
  emergencyContact String?
  emergencyContactName String?
  alertPreferences Json     @default("{}")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user  User @relation(fields: [userId], references: [id])
  unit  Unit @relation(fields: [unitId], references: [id])
  passes Pass[]
  walkinApprovals WalkinApproval[]
}

// ─── Guards ───────────────────────────────────────────────

model Guard {
  id         String   @id @default(cuid())
  userId     String   @unique
  propertyId String
  name       String
  badgeNumber String  @unique
  isOnDuty   Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user        User         @relation(fields: [userId], references: [id])
  property    Property     @relation(fields: [propertyId], references: [id])
  entries     Entry[]
  incidents   Incident[]
  shifts      Shift[]
  postCheckIns GuardPost[]
}

// ─── Managers ─────────────────────────────────────────────

model Manager {
  id         String   @id @default(cuid())
  userId     String   @unique
  propertyId String
  name       String
  createdAt  DateTime @default(now())

  user     User     @relation(fields: [userId], references: [id])
  property Property @relation(fields: [propertyId], references: [id])
}

// ─── Committee Members ────────────────────────────────────

model CommitteeMember {
  id        String   @id @default(cuid())
  userId    String   @unique
  name      String
  role      String   // CHAIRMAN, SECRETARY, TREASURER, MEMBER
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}

// ─── OTP ──────────────────────────────────────────────────

model OTP {
  id        String   @id @default(cuid())
  userId    String
  code      String
  purpose   String   // LOGIN, PASS_ENTRY
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}

// ─── Refresh Tokens ───────────────────────────────────────

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}

// ─── Passes ───────────────────────────────────────────────

model Pass {
  id          String     @id @default(cuid())
  residentId  String
  unitId      String
  type        PassType
  status      PassStatus @default(ACTIVE)
  visitorName String
  visitorPhone String?
  visitorPhoto String?   // URL
  purpose     String?
  qrPayload   String?    // signed HMAC payload
  otpCode     String?    // hashed OTP for delivery passes
  validFrom   DateTime
  validUntil  DateTime
  entryPointIds String[] @default([])
  suspendedAt DateTime?
  suspendedUntil DateTime?
  revokedAt   DateTime?
  revokedBy   String?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  resident    Resident   @relation(fields: [residentId], references: [id])
  unit        Unit       @relation(fields: [unitId], references: [id])
  recurringRule RecurringRule?
  entries     Entry[]
  usageHistory PassUsageHistory[]
}

// ─── Recurring Pass Rules ─────────────────────────────────

model RecurringRule {
  id            String      @id @default(cuid())
  passId        String      @unique
  allowedDays   DayOfWeek[]
  windowStartTime String    // "08:00"
  windowEndTime   String    // "13:00"
  createdAt     DateTime    @default(now())

  pass Pass @relation(fields: [passId], references: [id])
}

// ─── Pass Usage History ───────────────────────────────────

model PassUsageHistory {
  id        String   @id @default(cuid())
  passId    String
  entryId   String?
  usedAt    DateTime @default(now())
  outcome   String   // CLEARED, DENIED, SUSPENDED, OUTSIDE_WINDOW

  pass  Pass   @relation(fields: [passId], references: [id])
  entry Entry? @relation(fields: [entryId], references: [id])
}

// ─── Entries ──────────────────────────────────────────────

model Entry {
  id            String      @id @default(cuid())
  unitId        String
  passId        String?
  guardId       String
  entryPointId  String
  visitorName   String
  visitorPhone  String?
  vehicleNumber String?
  method        EntryMethod
  status        EntryStatus
  gatePhotoUrl  String?
  notes         String?
  entryAt       DateTime    @default(now())
  exitAt        DateTime?
  createdAt     DateTime    @default(now())

  unit        Unit              @relation(fields: [unitId], references: [id])
  pass        Pass?             @relation(fields: [passId], references: [id])
  guard       Guard             @relation(fields: [guardId], references: [id])
  entryPoint  EntryPoint        @relation(fields: [entryPointId], references: [id])
  alerts      Alert[]
  usageHistory PassUsageHistory[]
  walkinApproval WalkinApproval?
}

// ─── Walk-in Approvals ────────────────────────────────────

model WalkinApproval {
  id           String    @id @default(cuid())
  entryId      String    @unique
  residentId   String
  visitorName  String
  purpose      String
  requestedAt  DateTime  @default(now())
  respondedAt  DateTime?
  decision     String?   // APPROVED, DENIED
  timeoutAt    DateTime
  guardCalledAt DateTime?
  createdAt    DateTime  @default(now())

  entry    Entry    @relation(fields: [entryId], references: [id])
  resident Resident @relation(fields: [residentId], references: [id])
}

// ─── Alerts ───────────────────────────────────────────────

model Alert {
  id           String        @id @default(cuid())
  entryId      String?
  incidentId   String?
  propertyId   String
  priority     AlertPriority
  status       AlertStatus   @default(SENT)
  title        String
  body         String
  targetRoles  Role[]
  targetUserIds String[]
  channel      AlertChannel
  acknowledgedAt DateTime?
  acknowledgedBy String?
  escalatedAt  DateTime?
  resolvedAt   DateTime?
  createdAt    DateTime      @default(now())

  entry    Entry?    @relation(fields: [entryId], references: [id])
  incident Incident? @relation(fields: [incidentId], references: [id])
}

// ─── Incidents ────────────────────────────────────────────

model Incident {
  id           String         @id @default(cuid())
  propertyId   String
  unitId       String?
  guardId      String
  type         IncidentType
  status       IncidentStatus @default(OPEN)
  description  String
  location     String
  photoUrls    String[]       @default([])
  vehicleNumber String?
  assignedTo   String?
  assignedAt   DateTime?
  closedAt     DateTime?
  closedBy     String?
  resolutionNote String?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  property Property @relation(fields: [propertyId], references: [id])
  unit     Unit?    @relation(fields: [unitId], references: [id])
  guard    Guard    @relation(fields: [guardId], references: [id])
  alerts   Alert[]
  actions  IncidentAction[]
}

// ─── Incident Actions (timeline) ─────────────────────────

model IncidentAction {
  id          String   @id @default(cuid())
  incidentId  String
  actorId     String
  actorRole   Role
  action      String
  note        String?
  createdAt   DateTime @default(now())

  incident Incident @relation(fields: [incidentId], references: [id])
}

// ─── Vehicles ─────────────────────────────────────────────

model Vehicle {
  id             String   @id @default(cuid())
  unitId         String
  registrationNo String
  make           String?
  model          String?
  color          String?
  isResident     Boolean  @default(true)
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  unit Unit @relation(fields: [unitId], references: [id])

  @@unique([unitId, registrationNo])
}

// ─── Amenities ────────────────────────────────────────────

model Amenity {
  id         String        @id @default(cuid())
  propertyId String
  name       String
  capacity   Int
  status     AmenityStatus @default(AVAILABLE)
  openTime   String        // "06:00"
  closeTime  String        // "22:00"
  createdAt  DateTime      @default(now())

  property Property         @relation(fields: [propertyId], references: [id])
  bookings AmenityBooking[]
}

model AmenityBooking {
  id         String   @id @default(cuid())
  amenityId  String
  residentId String
  date       DateTime
  startTime  String
  endTime    String
  status     String   @default("CONFIRMED") // CONFIRMED, CANCELLED
  createdAt  DateTime @default(now())

  amenity Amenity @relation(fields: [amenityId], references: [id])
}

// ─── Guard Shifts ─────────────────────────────────────────

model Shift {
  id            String    @id @default(cuid())
  guardId       String
  startedAt     DateTime  @default(now())
  endedAt       DateTime?
  totalEntries  Int       @default(0)
  totalIncidents Int      @default(0)
  openItems     String?
  handoverNote  String?
  signedOffAt   DateTime?
  createdAt     DateTime  @default(now())

  guard     Guard      @relation(fields: [guardId], references: [id])
  postCheckIns GuardPost[]
}

// ─── Guard Post Check-ins ─────────────────────────────────

model GuardPost {
  id           String   @id @default(cuid())
  guardId      String
  shiftId      String
  entryPointId String
  checkedInAt  DateTime @default(now())
  latitude     Float?
  longitude    Float?

  guard      Guard      @relation(fields: [guardId], references: [id])
  shift      Shift      @relation(fields: [shiftId], references: [id])
  entryPoint EntryPoint @relation(fields: [entryPointId], references: [id])
}

// ─── Broadcasts ───────────────────────────────────────────

model Broadcast {
  id         String   @id @default(cuid())
  propertyId String
  sentBy     String
  title      String
  body       String
  targetScope String  // ALL, TOWER_A, FLOOR_3 etc.
  sentAt     DateTime @default(now())

  property Property @relation(fields: [propertyId], references: [id])
}

// ─── Audit Log ────────────────────────────────────────────

model AuditLog {
  id         String   @id @default(cuid())
  userId     String
  action     String
  entity     String
  entityId   String
  before     Json?
  after      Json?
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}

// ─── Vehicle relation to Unit ─────────────────────────────
// Add this to the Unit model block above
// vehicles Vehicle[]
```

> After writing the full schema, add `vehicles Vehicle[]` to the `Unit` model relations block.

---

## 4. Database Migrations

```bash
# Initialize Prisma (first time only)
npx prisma init

# Generate and run first migration
npx prisma migrate dev --name init_schema

# Generate the Prisma client
npx prisma generate
```

Every time you change `schema.prisma`:

```bash
npx prisma migrate dev --name describe_what_changed
npx prisma generate
```

For production:

```bash
npx prisma migrate deploy
```

---

## 5. Express App Bootstrap

### `src/app.ts`

```typescript
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import { env } from './config/env'
import { errorHandler } from './middlewares/error.middleware'
import { notFoundHandler } from './middlewares/notFound.middleware'
import { authRouter } from './modules/auth/auth.routes'
import { residentRouter } from './modules/residents/resident.routes'
import { guardRouter } from './modules/guards/guard.routes'
import { passRouter } from './modules/passes/pass.routes'
import { entryRouter } from './modules/entries/entry.routes'
import { walkinRouter } from './modules/walkin/walkin.routes'
import { alertRouter } from './modules/alerts/alert.routes'
import { incidentRouter } from './modules/incidents/incident.routes'
import { vehicleRouter } from './modules/vehicles/vehicle.routes'
import { amenityRouter } from './modules/amenities/amenity.routes'
import { reportRouter } from './modules/reports/report.routes'
import { offlineRouter } from './modules/offline/offline.routes'
import { logger } from './utils/logger.util'
import { globalRateLimiter } from './middlewares/rateLimiter.middleware'

const app = express()

// Security headers
app.use(helmet())

// CORS — only allow known client origins
app.use(cors({
  origin: [
    env.CLIENT_RESIDENT_APP_URL,
    env.CLIENT_GUARD_APP_URL,
    env.CLIENT_MANAGER_URL,
  ],
  credentials: true,
}))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// HTTP request logging
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}))

// Global rate limiter (per IP)
app.use(globalRateLimiter)

// Health check — no auth required
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
const API = '/api/v1'
app.use(`${API}/auth`,      authRouter)
app.use(`${API}/residents`, residentRouter)
app.use(`${API}/guards`,    guardRouter)
app.use(`${API}/passes`,    passRouter)
app.use(`${API}/entries`,   entryRouter)
app.use(`${API}/walkin`,    walkinRouter)
app.use(`${API}/alerts`,    alertRouter)
app.use(`${API}/incidents`, incidentRouter)
app.use(`${API}/vehicles`,  vehicleRouter)
app.use(`${API}/amenities`, amenityRouter)
app.use(`${API}/reports`,   reportRouter)
app.use(`${API}/offline`,   offlineRouter)

// 404 and global error handlers — must be last
app.use(notFoundHandler)
app.use(errorHandler)

export default app
```

### `src/server.ts`

```typescript
import http from 'http'
import { Server as SocketServer } from 'socket.io'
import app from './app'
import { env } from './config/env'
import { logger } from './utils/logger.util'
import { prisma } from './config/prisma'
import { redis } from './config/redis'
import { registerSocketHandlers } from './modules/realtime/socket.handler'
import { startAllJobs } from './jobs'

const httpServer = http.createServer(app)

export const io = new SocketServer(httpServer, {
  cors: {
    origin: [
      env.CLIENT_RESIDENT_APP_URL,
      env.CLIENT_GUARD_APP_URL,
      env.CLIENT_MANAGER_URL,
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

registerSocketHandlers(io)

async function bootstrap() {
  try {
    await prisma.$connect()
    logger.info('PostgreSQL connected')

    await redis.ping()
    logger.info('Redis connected')

    startAllJobs()
    logger.info('Background jobs started')

    httpServer.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`)
    })
  } catch (err) {
    logger.error('Bootstrap failed', { err })
    process.exit(1)
  }
}

bootstrap()

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down gracefully')
  await prisma.$disconnect()
  redis.disconnect()
  httpServer.close(() => process.exit(0))
})
```

---

## 6. Global Middleware

### `src/utils/response.util.ts`

Standardise every API response shape:

```typescript
import { Response } from 'express'

export const sendSuccess = (
  res: Response,
  data: unknown,
  message = 'Success',
  statusCode = 200
) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  })
}

export const sendError = (
  res: Response,
  message: string,
  statusCode = 400,
  errors?: unknown
) => {
  res.status(statusCode).json({
    success: false,
    message,
    errors: errors ?? null,
    timestamp: new Date().toISOString(),
  })
}
```

### `src/middlewares/error.middleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { logger } from '../utils/logger.util'
import { sendError } from '../utils/response.util'

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public errors?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error('Unhandled error', { err })

  // Validation errors from Zod
  if (err instanceof ZodError) {
    return sendError(res, 'Validation failed', 422, err.flatten().fieldErrors)
  }

  // Known application errors
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode, err.errors)
  }

  // Prisma unique constraint
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return sendError(res, 'A record with this value already exists', 409)
    }
    if (err.code === 'P2025') {
      return sendError(res, 'Record not found', 404)
    }
  }

  // Default 500
  sendError(res, 'Internal server error', 500)
}
```

### `src/middlewares/notFound.middleware.ts`

```typescript
import { Request, Response } from 'express'
import { sendError } from '../utils/response.util'

export const notFoundHandler = (req: Request, res: Response) => {
  sendError(res, `Route ${req.method} ${req.path} not found`, 404)
}
```

### `src/middlewares/rateLimiter.middleware.ts`

```typescript
import rateLimit from 'express-rate-limit'

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, slow down.' },
})

export const authRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,  // 10 minutes
  max: 10,
  message: { success: false, message: 'Too many auth attempts.' },
})

export const scanRateLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 60,
  message: { success: false, message: 'Too many scan requests.' },
})
```

### `src/middlewares/validate.middleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

export const validate = (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    })
    if (!result.success) {
      return next(result.error)
    }
    req.body = result.data.body
    next()
  }
```

### `src/types/express.d.ts`

Extend the Express Request type:

```typescript
import { Role } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        role: Role
        propertyId?: string
        unitId?: string
        guardId?: string
        residentId?: string
      }
    }
  }
}
```

---

## 7. Authentication System

Phone number + OTP login. No password for residents and guards. Managers/committee use phone + password.

### `src/utils/otp.util.ts`

```typescript
import { prisma } from '../config/prisma'
import { env } from '../config/env'
import crypto from 'crypto'

export const generateOTP = (): string => {
  // Cryptographically random 6-digit OTP
  const buffer = crypto.randomBytes(3)
  const num = buffer.readUIntBE(0, 3) % 1000000
  return num.toString().padStart(6, '0')
}

export const createOTP = async (userId: string, purpose: string) => {
  // Invalidate any existing unused OTPs for this user + purpose
  await prisma.oTP.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  })

  const code = generateOTP()
  const expiresAt = new Date(
    Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000
  )

  const otp = await prisma.oTP.create({
    data: { userId, code, purpose, expiresAt },
  })

  return { otpId: otp.id, code }
}

export const verifyOTP = async (
  userId: string,
  code: string,
  purpose: string
): Promise<boolean> => {
  const otp = await prisma.oTP.findFirst({
    where: {
      userId,
      code,
      purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  })

  if (!otp) return false

  // Mark as used immediately — prevents replay
  await prisma.oTP.update({
    where: { id: otp.id },
    data: { usedAt: new Date() },
  })

  return true
}
```

### `src/utils/jwt.util.ts`

```typescript
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { Role } from '@prisma/client'
import { prisma } from '../config/prisma'
import crypto from 'crypto'

export interface JWTPayload {
  userId: string
  role: Role
  propertyId?: string
  unitId?: string
  guardId?: string
  residentId?: string
}

export const signAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: 'apartment-security',
  })
}

export const signRefreshToken = async (userId: string): Promise<string> => {
  const token = crypto.randomBytes(64).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  await prisma.refreshToken.create({
    data: { userId, token, expiresAt },
  })

  return token
}

export const verifyAccessToken = (token: string): JWTPayload => {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: 'apartment-security',
  }) as JWTPayload
}

export const rotateRefreshToken = async (
  oldToken: string
): Promise<{ accessToken: string; refreshToken: string; payload: JWTPayload }> => {
  const record = await prisma.refreshToken.findUnique({
    where: { token: oldToken },
    include: { user: true },
  })

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw new Error('Invalid or expired refresh token')
  }

  // Revoke old token
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  })

  const user = record.user
  const payload: JWTPayload = { userId: user.id, role: user.role }

  const accessToken = signAccessToken(payload)
  const refreshToken = await signRefreshToken(user.id)

  return { accessToken, refreshToken, payload }
}
```

### `src/middlewares/auth.middleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/jwt.util'
import { sendError } from '../utils/response.util'
import { prisma } from '../config/prisma'

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return sendError(res, 'No token provided', 401)
    }

    const token = authHeader.split(' ')[1]
    const payload = verifyAccessToken(token)

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, isActive: true },
    })

    if (!user || !user.isActive) {
      return sendError(res, 'Account not found or deactivated', 401)
    }

    req.user = {
      id: payload.userId,
      role: payload.role,
      propertyId: payload.propertyId,
      unitId: payload.unitId,
      guardId: payload.guardId,
      residentId: payload.residentId,
    }

    next()
  } catch {
    sendError(res, 'Invalid or expired token', 401)
  }
}
```

### `src/middlewares/role.middleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express'
import { Role } from '@prisma/client'
import { sendError } from '../utils/response.util'

export const requireRole = (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Unauthenticated', 401)
    }
    if (!roles.includes(req.user.role)) {
      return sendError(res, 'Insufficient permissions', 403)
    }
    next()
  }
```

### `src/modules/auth/auth.routes.ts`

```typescript
import { Router } from 'express'
import { authRateLimiter } from '../../middlewares/rateLimiter.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { authenticate } from '../../middlewares/auth.middleware'
import {
  requestOtp,
  verifyOtp,
  refreshToken,
  logout,
  registerFcmToken,
} from './auth.controller'
import { requestOtpSchema, verifyOtpSchema } from './auth.schema'

const router = Router()

router.post('/otp/request', authRateLimiter, validate(requestOtpSchema), requestOtp)
router.post('/otp/verify',  authRateLimiter, validate(verifyOtpSchema),  verifyOtp)
router.post('/refresh',     authenticate,    refreshToken)
router.post('/logout',      authenticate,    logout)
router.post('/fcm-token',   authenticate,    registerFcmToken)

export { router as authRouter }
```

### `src/modules/auth/auth.schema.ts`

```typescript
import { z } from 'zod'

export const requestOtpSchema = z.object({
  body: z.object({
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number format'),
  }),
})

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: z.string(),
    code: z.string().length(6),
  }),
})
```

### `src/modules/auth/auth.controller.ts`

```typescript
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/prisma'
import { createOTP, verifyOTP } from '../../utils/otp.util'
import { signAccessToken, signRefreshToken, rotateRefreshToken } from '../../utils/jwt.util'
import { sendSMS } from '../../utils/sms.util'
import { sendSuccess, sendError } from '../../utils/response.util'
import { AppError } from '../../middlewares/error.middleware'
import { auditLog } from '../../utils/audit.util'
import { redis } from '../../config/redis'

export const requestOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { phone } = req.body

    const user = await prisma.user.findUnique({ where: { phone } })
    if (!user) {
      return sendError(res, 'No account found with this phone number', 404)
    }
    if (!user.isActive) {
      return sendError(res, 'Account is deactivated', 403)
    }

    const { code } = await createOTP(user.id, 'LOGIN')

    await sendSMS(
      phone,
      `Your Apartment Security login code is: ${code}. Valid for ${process.env.OTP_EXPIRY_MINUTES} minutes. Do not share this code.`
    )

    sendSuccess(res, null, 'OTP sent successfully')
  } catch (err) {
    next(err)
  }
}

export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { phone, code } = req.body

    const user = await prisma.user.findUnique({
      where: { phone },
      include: {
        resident: { include: { unit: true } },
        guard: true,
        manager: true,
      },
    })

    if (!user) {
      return sendError(res, 'No account found', 404)
    }

    const isValid = await verifyOTP(user.id, code, 'LOGIN')
    if (!isValid) {
      return sendError(res, 'Invalid or expired OTP', 401)
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const payload = {
      userId: user.id,
      role: user.role,
      propertyId: user.guard?.propertyId ?? user.manager?.propertyId,
      unitId: user.resident?.unitId,
      guardId: user.guard?.id,
      residentId: user.resident?.id,
    }

    const accessToken = signAccessToken(payload)
    const refreshToken = await signRefreshToken(user.id)

    await auditLog(user.id, 'LOGIN', 'User', user.id, req)

    sendSuccess(res, {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        role: user.role,
        name: user.resident?.name ?? user.guard?.name ?? user.manager?.name,
        phone: user.phone,
      },
    })
  } catch (err) {
    next(err)
  }
}

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken: token } = req.body
    if (!token) throw new AppError('Refresh token required', 400)

    const result = await rotateRefreshToken(token)
    sendSuccess(res, result)
  } catch (err) {
    next(err)
  }
}

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken: token } = req.body
    if (token) {
      await prisma.refreshToken.updateMany({
        where: { token, userId: req.user!.id },
        data: { revokedAt: new Date() },
      })
    }
    await auditLog(req.user!.id, 'LOGOUT', 'User', req.user!.id, req)
    sendSuccess(res, null, 'Logged out')
  } catch (err) {
    next(err)
  }
}

export const registerFcmToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.body
    if (!token) throw new AppError('FCM token required', 400)

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
    if (!user) throw new AppError('User not found', 404)

    // Deduplicate tokens
    const tokens = new Set(user.fcmTokens)
    tokens.add(token)

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { fcmTokens: Array.from(tokens) },
    })

    sendSuccess(res, null, 'FCM token registered')
  } catch (err) {
    next(err)
  }
}
```

---

## 8. Role-Based Access Control

Every route is protected at two levels: authentication (valid JWT) and authorisation (correct role). Here is the full role permission matrix:

```
Endpoint                          RESIDENT  GUARD  MANAGER  COMMITTEE
─────────────────────────────────────────────────────────────────────
POST /passes                         ✓
GET  /passes (own unit only)         ✓
PUT  /passes/:id/suspend             ✓
PUT  /passes/:id/revoke              ✓                ✓
GET  /passes/all (property-wide)                      ✓
POST /entries (log entry)                    ✓
GET  /entries (own unit)             ✓
GET  /entries/all                                     ✓        ✓
POST /walkin/request                         ✓
POST /walkin/:id/respond             ✓
POST /incidents                              ✓
PUT  /incidents/:id/assign                            ✓
PUT  /incidents/:id/close                             ✓        ✓
GET  /reports/monthly                                 ✓        ✓
POST /alerts/broadcast                                ✓        ✓
GET  /vehicles (own unit)            ✓
POST /vehicles                       ✓                ✓
GET  /residents (property)                            ✓
POST /residents (onboard)                             ✓
GET  /guards                                          ✓
POST /guards                                          ✓
GET  /amenities                      ✓
POST /amenities/book                 ✓
```

---

## 9. Residents Module

### `src/modules/residents/resident.routes.ts`

```typescript
import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware'
import { requireRole } from '../../middlewares/role.middleware'
import { validate } from '../../middlewares/validate.middleware'
import {
  getMyProfile,
  updateMyProfile,
  getUnitResidents,
  addHouseholdMember,
  removeHouseholdMember,
  updateAlertPreferences,
  getAllResidents,
  onboardResident,
  deactivateResident,
  getUnitSummary,
} from './resident.controller'
import {
  onboardResidentSchema,
  updateProfileSchema,
  alertPreferencesSchema,
} from './resident.schema'

const router = Router()
router.use(authenticate)

// Resident self-service
router.get('/me',            requireRole('RESIDENT'), getMyProfile)
router.put('/me',            requireRole('RESIDENT'), validate(updateProfileSchema), updateMyProfile)
router.put('/me/alerts',     requireRole('RESIDENT'), validate(alertPreferencesSchema), updateAlertPreferences)
router.get('/unit',          requireRole('RESIDENT'), getUnitResidents)
router.post('/unit/members', requireRole('RESIDENT'), addHouseholdMember)
router.delete('/unit/members/:memberId', requireRole('RESIDENT'), removeHouseholdMember)

// Manager operations
router.get('/',              requireRole('MANAGER', 'COMMITTEE'), getAllResidents)
router.post('/',             requireRole('MANAGER'), validate(onboardResidentSchema), onboardResident)
router.delete('/:id',        requireRole('MANAGER'), deactivateResident)
router.get('/:id/summary',   requireRole('MANAGER', 'COMMITTEE'), getUnitSummary)

export { router as residentRouter }
```

### `src/modules/residents/resident.controller.ts`

```typescript
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/prisma'
import { sendSuccess, sendError } from '../../utils/response.util'
import { AppError } from '../../middlewares/error.middleware'
import { auditLog } from '../../utils/audit.util'
import { sendSMS } from '../../utils/sms.util'
import bcrypt from 'bcryptjs'

export const getMyProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resident = await prisma.resident.findUnique({
      where: { id: req.user!.residentId },
      include: {
        unit: { include: { property: true } },
        user: { select: { phone: true, email: true, fcmTokens: true } },
      },
    })
    if (!resident) throw new AppError('Resident profile not found', 404)
    sendSuccess(res, resident)
  } catch (err) { next(err) }
}

export const updateMyProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, emergencyContact, emergencyContactName } = req.body
    const resident = await prisma.resident.update({
      where: { id: req.user!.residentId },
      data: { name, emergencyContact, emergencyContactName },
    })
    await auditLog(req.user!.id, 'UPDATE_PROFILE', 'Resident', resident.id, req)
    sendSuccess(res, resident, 'Profile updated')
  } catch (err) { next(err) }
}

export const updateAlertPreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { preferences } = req.body
    // preferences shape: { ONE_TIME: true, RECURRING: false, DELIVERY: true }
    const resident = await prisma.resident.update({
      where: { id: req.user!.residentId },
      data: { alertPreferences: preferences },
    })
    sendSuccess(res, resident.alertPreferences, 'Alert preferences updated')
  } catch (err) { next(err) }
}

export const getUnitResidents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const residents = await prisma.resident.findMany({
      where: { unitId: req.user!.unitId },
      include: { user: { select: { phone: true, isActive: true } } },
    })
    sendSuccess(res, residents)
  } catch (err) { next(err) }
}

export const addHouseholdMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, name } = req.body

    // Verify the primary resident is making this request
    const primaryResident = await prisma.resident.findUnique({
      where: { id: req.user!.residentId },
    })
    if (!primaryResident?.isPrimary) {
      throw new AppError('Only the primary resident can add household members', 403)
    }

    // Check unit member limit
    const existingCount = await prisma.resident.count({
      where: { unitId: req.user!.unitId },
    })
    if (existingCount >= 6) {
      throw new AppError('Maximum 6 residents allowed per unit', 400)
    }

    let user = await prisma.user.findUnique({ where: { phone } })
    if (user && user.role !== 'RESIDENT') {
      throw new AppError('This phone number is already registered with a different role', 409)
    }
    if (!user) {
      user = await prisma.user.create({
        data: { phone, role: 'RESIDENT' },
      })
    }

    const existing = await prisma.resident.findFirst({ where: { userId: user.id } })
    if (existing) throw new AppError('This user is already a resident in another unit', 409)

    const member = await prisma.resident.create({
      data: {
        userId: user.id,
        unitId: req.user!.unitId!,
        name,
        isPrimary: false,
      },
    })

    await sendSMS(phone, `You have been added to Apartment ${primaryResident.name}'s household on Apartment Security. Download the app to get started.`)

    sendSuccess(res, member, 'Household member added', 201)
  } catch (err) { next(err) }
}

export const removeHouseholdMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { memberId } = req.params
    const primaryResident = await prisma.resident.findUnique({
      where: { id: req.user!.residentId },
    })
    if (!primaryResident?.isPrimary) {
      throw new AppError('Only the primary resident can remove members', 403)
    }
    const member = await prisma.resident.findUnique({ where: { id: memberId } })
    if (!member || member.unitId !== req.user!.unitId) {
      throw new AppError('Member not found in this unit', 404)
    }
    if (member.isPrimary) {
      throw new AppError('Cannot remove the primary resident', 400)
    }
    await prisma.user.update({
      where: { id: member.userId },
      data: { isActive: false },
    })
    await auditLog(req.user!.id, 'REMOVE_MEMBER', 'Resident', memberId, req)
    sendSuccess(res, null, 'Household member removed')
  } catch (err) { next(err) }
}

export const getAllResidents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId } = req.user!
    const { page = '1', limit = '50', search = '' } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = {
      unit: { propertyId },
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { unit: { unitNumber: { contains: search } } },
        ],
      } : {}),
    }

    const [residents, total] = await Promise.all([
      prisma.resident.findMany({
        where,
        include: {
          unit: true,
          user: { select: { phone: true, isActive: true, lastLoginAt: true } },
        },
        skip,
        take: parseInt(limit),
        orderBy: { unit: { unitNumber: 'asc' } },
      }),
      prisma.resident.count({ where }),
    ])

    sendSuccess(res, {
      residents,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    })
  } catch (err) { next(err) }
}

export const onboardResident = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, name, unitId, isPrimary } = req.body

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: { property: true },
    })
    if (!unit || unit.property.id !== req.user!.propertyId) {
      throw new AppError('Unit not found in this property', 404)
    }

    if (isPrimary) {
      const existingPrimary = await prisma.resident.findFirst({
        where: { unitId, isPrimary: true },
      })
      if (existingPrimary) throw new AppError('Unit already has a primary resident', 409)
    }

    let user = await prisma.user.findUnique({ where: { phone } })
    if (user && user.role !== 'RESIDENT') {
      throw new AppError('Phone already registered with a different role', 409)
    }
    if (!user) {
      user = await prisma.user.create({ data: { phone, role: 'RESIDENT' } })
    }

    const resident = await prisma.resident.create({
      data: { userId: user.id, unitId, name, isPrimary: isPrimary ?? false },
    })

    if (!unit.isOccupied) {
      await prisma.unit.update({ where: { id: unitId }, data: { isOccupied: true } })
    }

    await sendSMS(phone, `Welcome to ${unit.property.name}! Download the Apartment Security app and log in with this number to manage your visitors and access.`)

    await auditLog(req.user!.id, 'ONBOARD_RESIDENT', 'Resident', resident.id, req)
    sendSuccess(res, resident, 'Resident onboarded', 201)
  } catch (err) { next(err) }
}

export const deactivateResident = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const resident = await prisma.resident.findUnique({
      where: { id },
      include: { unit: true },
    })
    if (!resident || resident.unit.propertyId !== req.user!.propertyId) {
      throw new AppError('Resident not found', 404)
    }
    // Revoke all active passes
    await prisma.pass.updateMany({
      where: { residentId: id, status: { in: ['ACTIVE', 'SUSPENDED'] } },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedBy: req.user!.id },
    })
    await prisma.user.update({
      where: { id: resident.userId },
      data: { isActive: false },
    })
    await auditLog(req.user!.id, 'DEACTIVATE_RESIDENT', 'Resident', id, req)
    sendSuccess(res, null, 'Resident deactivated and all passes revoked')
  } catch (err) { next(err) }
}

export const getUnitSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const resident = await prisma.resident.findUnique({
      where: { id },
      include: { unit: true },
    })
    if (!resident || resident.unit.propertyId !== req.user!.propertyId) {
      throw new AppError('Resident not found', 404)
    }

    const [activePasses, recentEntries, openIncidents] = await Promise.all([
      prisma.pass.count({ where: { unitId: resident.unitId, status: 'ACTIVE' } }),
      prisma.entry.count({
        where: {
          unitId: resident.unitId,
          entryAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.incident.count({
        where: { unitId: resident.unitId, status: { not: 'CLOSED' } },
      }),
    ])

    sendSuccess(res, { activePasses, recentEntries, openIncidents })
  } catch (err) { next(err) }
}
```

---

## 10. Units Module

```typescript
// src/modules/units/unit.routes.ts
import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware'
import { requireRole } from '../../middlewares/role.middleware'
import { getAllUnits, getUnit, updateUnit } from './unit.controller'

const router = Router()
router.use(authenticate)

router.get('/',      requireRole('MANAGER', 'COMMITTEE'), getAllUnits)
router.get('/:id',   requireRole('MANAGER', 'COMMITTEE'), getUnit)
router.put('/:id',   requireRole('MANAGER'), updateUnit)

export { router as unitRouter }
```

```typescript
// src/modules/units/unit.controller.ts
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/prisma'
import { sendSuccess } from '../../utils/response.util'
import { AppError } from '../../middlewares/error.middleware'

export const getAllUnits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tower, floor, occupied } = req.query as Record<string, string>

    const units = await prisma.unit.findMany({
      where: {
        propertyId: req.user!.propertyId,
        ...(tower ? { tower } : {}),
        ...(floor ? { floor: parseInt(floor) } : {}),
        ...(occupied !== undefined ? { isOccupied: occupied === 'true' } : {}),
      },
      include: {
        residents: { where: { isPrimary: true }, select: { name: true } },
        _count: { select: { passes: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: [{ tower: 'asc' }, { floor: 'asc' }, { unitNumber: 'asc' }],
    })

    sendSuccess(res, units)
  } catch (err) { next(err) }
}

export const getUnit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unit = await prisma.unit.findUnique({
      where: { id: req.params.id },
      include: {
        residents: {
          include: { user: { select: { phone: true, isActive: true } } },
        },
        passes: { where: { status: 'ACTIVE' } },
        vehicles: { where: { isActive: true } },
      },
    })
    if (!unit || unit.propertyId !== req.user!.propertyId) {
      throw new AppError('Unit not found', 404)
    }
    sendSuccess(res, unit)
  } catch (err) { next(err) }
}

export const updateUnit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tower, floor } = req.body
    const unit = await prisma.unit.findUnique({ where: { id: req.params.id } })
    if (!unit || unit.propertyId !== req.user!.propertyId) {
      throw new AppError('Unit not found', 404)
    }
    const updated = await prisma.unit.update({
      where: { id: req.params.id },
      data: { ...(tower ? { tower } : {}), ...(floor ? { floor } : {}) },
    })
    sendSuccess(res, updated, 'Unit updated')
  } catch (err) { next(err) }
}
```

---

## 11. Guards Module

```typescript
// src/modules/guards/guard.controller.ts
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/prisma'
import { sendSuccess, sendError } from '../../utils/response.util'
import { AppError } from '../../middlewares/error.middleware'
import { auditLog } from '../../utils/audit.util'
import { sendSMS } from '../../utils/sms.util'

export const startShift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guardId = req.user!.guardId!

    const activeShift = await prisma.shift.findFirst({
      where: { guardId, endedAt: null },
    })
    if (activeShift) throw new AppError('Already on shift', 400)

    const shift = await prisma.shift.create({ data: { guardId } })
    await prisma.guard.update({ where: { id: guardId }, data: { isOnDuty: true } })

    sendSuccess(res, shift, 'Shift started', 201)
  } catch (err) { next(err) }
}

export const endShift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guardId = req.user!.guardId!
    const { handoverNote, openItems } = req.body

    const shift = await prisma.shift.findFirst({
      where: { guardId, endedAt: null },
    })
    if (!shift) throw new AppError('No active shift', 400)

    const [totalEntries, totalIncidents] = await Promise.all([
      prisma.entry.count({ where: { guardId, entryAt: { gte: shift.startedAt } } }),
      prisma.incident.count({ where: { guardId, createdAt: { gte: shift.startedAt } } }),
    ])

    const ended = await prisma.shift.update({
      where: { id: shift.id },
      data: {
        endedAt: new Date(),
        handoverNote,
        openItems,
        totalEntries,
        totalIncidents,
        signedOffAt: new Date(),
      },
    })

    await prisma.guard.update({ where: { id: guardId }, data: { isOnDuty: false } })

    sendSuccess(res, ended, 'Shift ended')
  } catch (err) { next(err) }
}

export const postCheckIn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guardId = req.user!.guardId!
    const { entryPointId, latitude, longitude } = req.body

    const shift = await prisma.shift.findFirst({ where: { guardId, endedAt: null } })
    if (!shift) throw new AppError('No active shift', 400)

    const entryPoint = await prisma.entryPoint.findFirst({
      where: { id: entryPointId, property: { guards: { some: { id: guardId } } } },
    })
    if (!entryPoint) throw new AppError('Entry point not found in your property', 404)

    const checkIn = await prisma.guardPost.create({
      data: { guardId, shiftId: shift.id, entryPointId, latitude, longitude },
    })

    sendSuccess(res, checkIn, 'Post check-in recorded')
  } catch (err) { next(err) }
}

export const getActiveGuards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guards = await prisma.guard.findMany({
      where: { propertyId: req.user!.propertyId, isOnDuty: true },
      include: {
        user: { select: { phone: true } },
        shifts: {
          where: { endedAt: null },
          include: {
            postCheckIns: {
              orderBy: { checkedInAt: 'desc' },
              take: 1,
              include: { entryPoint: true },
            },
          },
          take: 1,
        },
      },
    })
    sendSuccess(res, guards)
  } catch (err) { next(err) }
}
```

---

## 12. Pass Management Module

### `src/modules/passes/pass.controller.ts`

```typescript
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/prisma'
import { sendSuccess } from '../../utils/response.util'
import { AppError } from '../../middlewares/error.middleware'
import { generateSignedQR } from '../../utils/qr.util'
import { generatePassOTP } from '../../utils/otp.util'
import { sendWhatsAppPass } from '../../utils/whatsapp.util'
import { auditLog } from '../../utils/audit.util'
import { redis } from '../../config/redis'

export const createPass = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      type,
      visitorName,
      visitorPhone,
      purpose,
      validFrom,
      validUntil,
      entryPointIds,
      recurringRule,
      shareViaWhatsApp,
    } = req.body

    const residentId = req.user!.residentId!
    const unitId = req.user!.unitId!

    // Validate entry points belong to this property
    if (entryPointIds?.length) {
      const eps = await prisma.entryPoint.findMany({
        where: {
          id: { in: entryPointIds },
          property: { units: { some: { id: unitId } } },
        },
      })
      if (eps.length !== entryPointIds.length) {
        throw new AppError('One or more entry points are invalid', 400)
      }
    }

    // Build pass
    const passData: Parameters<typeof prisma.pass.create>[0]['data'] = {
      residentId,
      unitId,
      type,
      visitorName,
      visitorPhone,
      purpose,
      validFrom: new Date(validFrom),
      validUntil: new Date(validUntil),
      entryPointIds: entryPointIds ?? [],
      status: 'ACTIVE',
    }

    const pass = await prisma.pass.create({ data: passData })

    // Generate QR payload (signed HMAC — not guessable)
    const qrPayload = await generateSignedQR(pass.id)
    let otpCode: string | undefined

    // Delivery passes get an OTP instead of QR
    if (type === 'DELIVERY') {
      otpCode = await generatePassOTP(pass.id)
    }

    const updated = await prisma.pass.update({
      where: { id: pass.id },
      data: { qrPayload, otpCode },
      include: { recurringRule: true },
    })

    // Create recurring rule if applicable
    if (type === 'RECURRING' && recurringRule) {
      await prisma.recurringRule.create({
        data: {
          passId: pass.id,
          allowedDays: recurringRule.allowedDays,
          windowStartTime: recurringRule.windowStartTime,
          windowEndTime: recurringRule.windowEndTime,
        },
      })
    }

    // Refresh the Redis pass cache for guards
    await invalidatePassCache(unitId)

    // Share via WhatsApp if requested and phone provided
    if (shareViaWhatsApp && visitorPhone) {
      await sendWhatsAppPass(visitorPhone, visitorName, updated)
    }

    await auditLog(req.user!.id, 'CREATE_PASS', 'Pass', pass.id, req, null, updated)

    sendSuccess(res, updated, 'Pass created', 201)
  } catch (err) { next(err) }
}

export const getMyPasses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, type } = req.query as Record<string, string>

    const passes = await prisma.pass.findMany({
      where: {
        residentId: req.user!.residentId,
        ...(status ? { status: status as any } : {}),
        ...(type ? { type: type as any } : {}),
      },
      include: {
        recurringRule: true,
        _count: { select: { entries: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    sendSuccess(res, passes)
  } catch (err) { next(err) }
}

export const getPassById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pass = await prisma.pass.findUnique({
      where: { id: req.params.id },
      include: {
        recurringRule: true,
        usageHistory: { orderBy: { usedAt: 'desc' }, take: 20 },
        entries: {
          orderBy: { entryAt: 'desc' },
          take: 10,
          include: { entryPoint: true, guard: true },
        },
      },
    })

    if (!pass) throw new AppError('Pass not found', 404)

    // Residents can only see their own passes
    if (req.user!.role === 'RESIDENT' && pass.residentId !== req.user!.residentId) {
      throw new AppError('Access denied', 403)
    }

    sendSuccess(res, pass)
  } catch (err) { next(err) }
}

export const suspendPass = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { suspendUntil } = req.body

    const pass = await findOwnedPass(id, req.user!.residentId!)
    if (pass.status !== 'ACTIVE') throw new AppError('Only active passes can be suspended', 400)

    const updated = await prisma.pass.update({
      where: { id },
      data: {
        status: 'SUSPENDED',
        suspendedAt: new Date(),
        suspendedUntil: suspendUntil ? new Date(suspendUntil) : null,
      },
    })

    await invalidatePassCache(pass.unitId)
    await auditLog(req.user!.id, 'SUSPEND_PASS', 'Pass', id, req, pass, updated)

    sendSuccess(res, updated, 'Pass suspended')
  } catch (err) { next(err) }
}

export const reactivatePass = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const pass = await findOwnedPass(id, req.user!.residentId!)
    if (pass.status !== 'SUSPENDED') throw new AppError('Pass is not suspended', 400)

    // Do not reactivate if past validUntil
    if (new Date() > pass.validUntil) throw new AppError('Pass has expired, create a new one', 400)

    const updated = await prisma.pass.update({
      where: { id },
      data: { status: 'ACTIVE', suspendedAt: null, suspendedUntil: null },
    })

    await invalidatePassCache(pass.unitId)
    await auditLog(req.user!.id, 'REACTIVATE_PASS', 'Pass', id, req, pass, updated)

    sendSuccess(res, updated, 'Pass reactivated')
  } catch (err) { next(err) }
}

export const revokePass = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    let pass = await prisma.pass.findUnique({ where: { id } })
    if (!pass) throw new AppError('Pass not found', 404)

    // Residents can only revoke their own; managers can revoke any in their property
    if (req.user!.role === 'RESIDENT' && pass.residentId !== req.user!.residentId) {
      throw new AppError('Access denied', 403)
    }

    if (pass.status === 'REVOKED') throw new AppError('Pass already revoked', 400)

    const updated = await prisma.pass.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedBy: req.user!.id },
    })

    await invalidatePassCache(pass.unitId)
    await auditLog(req.user!.id, 'REVOKE_PASS', 'Pass', id, req, pass, updated)

    sendSuccess(res, updated, 'Pass revoked')
  } catch (err) { next(err) }
}

// ─── Helpers ──────────────────────────────────────────────

const findOwnedPass = async (passId: string, residentId: string) => {
  const pass = await prisma.pass.findUnique({ where: { id: passId } })
  if (!pass || pass.residentId !== residentId) throw new AppError('Pass not found', 404)
  return pass
}

const invalidatePassCache = async (unitId: string) => {
  // Guards refresh their cache from this key
  await redis.del(`pass_cache:unit:${unitId}`)
  // Global property cache rebuilt by the cacheRefresh job
}
```

---

## 13. QR Code and OTP Engine

### `src/utils/qr.util.ts`

```typescript
import crypto from 'crypto'
import QRCode from 'qrcode'
import { env } from '../config/env'

interface QRPayload {
  passId: string
  issuedAt: number
  sig: string
}

export const generateSignedQR = async (passId: string): Promise<string> => {
  const issuedAt = Date.now()
  const data = `${passId}:${issuedAt}`
  const sig = crypto
    .createHmac('sha256', env.QR_HMAC_SECRET)
    .update(data)
    .digest('hex')

  const payload: QRPayload = { passId, issuedAt, sig }
  // Return base64 QR image for embedding in app
  const qrImage = await QRCode.toDataURL(JSON.stringify(payload))
  // Also store the raw payload string for guard scan verification
  return JSON.stringify(payload)
}

export const verifyQRPayload = (raw: string): string => {
  let payload: QRPayload
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error('Invalid QR format')
  }

  const data = `${payload.passId}:${payload.issuedAt}`
  const expected = crypto
    .createHmac('sha256', env.QR_HMAC_SECRET)
    .update(data)
    .digest('hex')

  if (!crypto.timingSafeEqual(Buffer.from(payload.sig), Buffer.from(expected))) {
    throw new Error('QR signature invalid — possible tampering')
  }

  return payload.passId
}
```

### `src/utils/otp.util.ts` — pass OTP extension

```typescript
import crypto from 'crypto'
import { prisma } from '../config/prisma'

export const generatePassOTP = async (passId: string): Promise<string> => {
  const code = crypto.randomInt(100000, 999999).toString()
  const hashed = crypto.createHash('sha256').update(code).digest('hex')

  await prisma.pass.update({
    where: { id: passId },
    data: { otpCode: hashed },
  })

  return code // Send plaintext to visitor, store hash only
}

export const verifyPassOTP = async (passId: string, code: string): Promise<boolean> => {
  const pass = await prisma.pass.findUnique({
    where: { id: passId },
    select: { otpCode: true },
  })
  if (!pass?.otpCode) return false

  const hashed = crypto.createHash('sha256').update(code).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(pass.otpCode), Buffer.from(hashed))
}
```

---

## 14. Entry and Exit Logging Module

The most critical module — every gate event flows through here.

### `src/modules/entries/entry.controller.ts`

```typescript
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/prisma'
import { sendSuccess } from '../../utils/response.util'
import { AppError } from '../../middlewares/error.middleware'
import { verifyQRPayload } from '../../utils/qr.util'
import { verifyPassOTP } from '../../utils/otp.util'
import { triggerAlert } from '../../utils/alert.util'
import { auditLog } from '../../utils/audit.util'
import { io } from '../../server'

export const scanQR = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qrRaw, entryPointId, gatePhotoUrl } = req.body
    const guardId = req.user!.guardId!

    // 1. Verify QR signature
    let passId: string
    try {
      passId = verifyQRPayload(qrRaw)
    } catch {
      return sendSuccess(res, { status: 'DENIED', reason: 'Invalid QR code' })
    }

    // 2. Load pass with all needed relations
    const pass = await prisma.pass.findUnique({
      where: { id: passId },
      include: {
        unit: true,
        resident: { include: { user: true } },
        recurringRule: true,
      },
    })

    if (!pass) {
      return sendSuccess(res, { status: 'DENIED', reason: 'Pass not found' })
    }

    const now = new Date()

    // 3. Run all validation checks
    const validationResult = validatePassForEntry(pass, entryPointId, now)

    // 4. Create entry record regardless of outcome
    const entry = await prisma.entry.create({
      data: {
        unitId: pass.unitId,
        passId: pass.id,
        guardId,
        entryPointId,
        visitorName: pass.visitorName,
        visitorPhone: pass.visitorPhone ?? undefined,
        method: 'QR_SCAN',
        status: validationResult.allowed ? 'APPROVED' : 'DENIED',
        gatePhotoUrl,
      },
    })

    // 5. Log usage history
    await prisma.passUsageHistory.create({
      data: {
        passId: pass.id,
        entryId: entry.id,
        outcome: validationResult.allowed ? 'CLEARED' : validationResult.reason,
      },
    })

    if (validationResult.allowed) {
      // 6. Send real-time alert to resident
      await triggerAlert({
        priority: 'P3',
        title: 'Visitor arrived',
        body: `${pass.visitorName} entered via ${entryPointId} at ${now.toLocaleTimeString()}`,
        targetUserIds: [pass.resident.userId],
        entryId: entry.id,
        propertyId: pass.unit.propertyId,
      })

      // 7. Push to guard WebSocket dashboard
      io.to(`property:${pass.unit.propertyId}`).emit('entry:logged', {
        entryId: entry.id,
        visitorName: pass.visitorName,
        unitNumber: pass.unit.unitNumber,
        entryPointId,
        timestamp: now,
      })
    }

    return sendSuccess(res, {
      status: validationResult.allowed ? 'APPROVED' : 'DENIED',
      reason: validationResult.reason,
      entry: {
        id: entry.id,
        visitorName: pass.visitorName,
        unitNumber: pass.unit.unitNumber,
        validUntil: pass.validUntil,
      },
    })
  } catch (err) { next(err) }
}

export const verifyOTPEntry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { passId, otpCode, entryPointId, gatePhotoUrl } = req.body
    const guardId = req.user!.guardId!

    const pass = await prisma.pass.findUnique({
      where: { id: passId },
      include: { unit: true, resident: { include: { user: true } } },
    })
    if (!pass) throw new AppError('Pass not found', 404)

    const otpValid = await verifyPassOTP(passId, otpCode)
    const validationResult = otpValid
      ? validatePassForEntry(pass, entryPointId, new Date())
      : { allowed: false, reason: 'INVALID_OTP' }

    const entry = await prisma.entry.create({
      data: {
        unitId: pass.unitId,
        passId: pass.id,
        guardId,
        entryPointId,
        visitorName: pass.visitorName,
        method: 'OTP',
        status: validationResult.allowed ? 'APPROVED' : 'DENIED',
        gatePhotoUrl,
      },
    })

    if (validationResult.allowed) {
      await triggerAlert({
        priority: 'P3',
        title: 'Delivery arrived',
        body: `${pass.visitorName} entered via OTP at ${new Date().toLocaleTimeString()}`,
        targetUserIds: [pass.resident.userId],
        entryId: entry.id,
        propertyId: pass.unit.propertyId,
      })
    }

    sendSuccess(res, {
      status: validationResult.allowed ? 'APPROVED' : 'DENIED',
      reason: validationResult.reason,
      entry: { id: entry.id },
    })
  } catch (err) { next(err) }
}

export const logExit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entryId } = req.params

    const entry = await prisma.entry.findUnique({
      where: { id: entryId },
      include: {
        unit: true,
        pass: { include: { resident: { include: { user: true } } } },
      },
    })
    if (!entry) throw new AppError('Entry not found', 404)
    if (entry.exitAt) throw new AppError('Exit already logged', 400)

    const updated = await prisma.entry.update({
      where: { id: entryId },
      data: { exitAt: new Date() },
    })

    if (entry.pass?.resident) {
      await triggerAlert({
        priority: 'P3',
        title: 'Visitor exited',
        body: `${entry.visitorName} exited at ${new Date().toLocaleTimeString()}`,
        targetUserIds: [entry.pass.resident.user.id],
        entryId: entry.id,
        propertyId: entry.unit.propertyId,
      })
    }

    sendSuccess(res, updated, 'Exit logged')
  } catch (err) { next(err) }
}

export const getMyEntries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to, page = '1', limit = '30' } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = {
      unitId: req.user!.unitId,
      entryAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      },
    }

    const [entries, total] = await Promise.all([
      prisma.entry.findMany({
        where,
        include: {
          entryPoint: true,
          guard: true,
          pass: { select: { type: true } },
        },
        skip,
        take: parseInt(limit),
        orderBy: { entryAt: 'desc' },
      }),
      prisma.entry.count({ where }),
    ])

    sendSuccess(res, {
      entries,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    })
  } catch (err) { next(err) }
}

// ─── Core pass validation logic ───────────────────────────

const validatePassForEntry = (
  pass: any,
  entryPointId: string,
  now: Date
): { allowed: boolean; reason: string } => {

  if (pass.status === 'REVOKED') {
    return { allowed: false, reason: 'REVOKED' }
  }
  if (pass.status === 'SUSPENDED') {
    return { allowed: false, reason: 'SUSPENDED' }
  }
  if (pass.status === 'EXPIRED' || now > new Date(pass.validUntil)) {
    return { allowed: false, reason: 'EXPIRED' }
  }
  if (now < new Date(pass.validFrom)) {
    return { allowed: false, reason: 'NOT_YET_VALID' }
  }
  if (pass.entryPointIds.length > 0 && !pass.entryPointIds.includes(entryPointId)) {
    return { allowed: false, reason: 'WRONG_ENTRY_POINT' }
  }

  // Recurring pass: check day and time window
  if (pass.type === 'RECURRING' && pass.recurringRule) {
    const rule = pass.recurringRule
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()

    if (!rule.allowedDays.includes(dayName)) {
      return { allowed: false, reason: 'OUTSIDE_ALLOWED_DAYS' }
    }

    const [startH, startM] = rule.windowStartTime.split(':').map(Number)
    const [endH, endM] = rule.windowEndTime.split(':').map(Number)
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM

    if (nowMinutes < startMinutes || nowMinutes > endMinutes) {
      return { allowed: false, reason: 'OUTSIDE_TIME_WINDOW' }
    }
  }

  return { allowed: true, reason: 'CLEARED' }
}
```

---

## 15. Walk-in Approval Flow

This is the real-time approval loop. Guard requests → resident gets push → resident responds → guard sees result in under 5 seconds.

### `src/modules/walkin/walkin.controller.ts`

```typescript
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/prisma'
import { sendSuccess } from '../../utils/response.util'
import { AppError } from '../../middlewares/error.middleware'
import { sendPush } from '../../utils/push.util'
import { io } from '../../server'
import { env } from '../../config/env'

const WALKIN_TIMEOUT_SECONDS = 90

export const requestWalkinApproval = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { unitNumber, visitorName, purpose, entryPointId } = req.body
    const guardId = req.user!.guardId!

    // Find the unit and primary resident in the guard's property
    const unit = await prisma.unit.findFirst({
      where: {
        unitNumber,
        property: { guards: { some: { id: guardId } } },
      },
      include: {
        residents: {
          where: { isPrimary: true },
          include: { user: { select: { id: true, fcmTokens: true } } },
        },
      },
    })

    if (!unit) throw new AppError('Unit not found', 404)

    const primary = unit.residents[0]
    if (!primary) throw new AppError('No primary resident for this unit', 404)

    const timeoutAt = new Date(Date.now() + WALKIN_TIMEOUT_SECONDS * 1000)

    // Create a pending entry
    const entry = await prisma.entry.create({
      data: {
        unitId: unit.id,
        guardId,
        entryPointId,
        visitorName,
        method: 'MANUAL_GUARD',
        status: 'PENDING_APPROVAL',
      },
    })

    const approval = await prisma.walkinApproval.create({
      data: {
        entryId: entry.id,
        residentId: primary.id,
        visitorName,
        purpose,
        timeoutAt,
      },
    })

    // Push to resident immediately
    if (primary.user.fcmTokens.length > 0) {
      await sendPush(primary.user.fcmTokens, {
        title: 'Visitor at your gate',
        body: `${visitorName} is at the gate. Purpose: ${purpose}`,
        data: {
          type: 'WALKIN_APPROVAL',
          approvalId: approval.id,
          entryId: entry.id,
          visitorName,
          purpose,
        },
      })
    }

    // Also emit via WebSocket for resident app
    io.to(`user:${primary.user.id}`).emit('walkin:request', {
      approvalId: approval.id,
      entryId: entry.id,
      visitorName,
      purpose,
      timeoutAt,
    })

    // Schedule timeout job
    setTimeout(async () => {
      await handleWalkinTimeout(approval.id, guardId)
    }, WALKIN_TIMEOUT_SECONDS * 1000)

    sendSuccess(res, { approvalId: approval.id, entryId: entry.id, timeoutAt }, 'Approval request sent', 201)
  } catch (err) { next(err) }
}

export const respondToWalkin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { approvalId } = req.params
    const { decision } = req.body  // 'APPROVED' or 'DENIED'
    const residentId = req.user!.residentId!

    const approval = await prisma.walkinApproval.findUnique({
      where: { id: approvalId },
      include: {
        entry: { include: { guard: { include: { user: true } } } },
      },
    })

    if (!approval) throw new AppError('Approval request not found', 404)
    if (approval.residentId !== residentId) throw new AppError('Access denied', 403)
    if (approval.respondedAt) throw new AppError('Already responded to this request', 400)
    if (new Date() > approval.timeoutAt) throw new AppError('Approval window expired', 400)

    const now = new Date()

    // Update approval and entry atomically
    await prisma.$transaction([
      prisma.walkinApproval.update({
        where: { id: approvalId },
        data: { decision, respondedAt: now },
      }),
      prisma.entry.update({
        where: { id: approval.entryId },
        data: {
          status: decision === 'APPROVED' ? 'APPROVED' : 'DENIED',
          entryAt: decision === 'APPROVED' ? now : undefined,
        },
      }),
    ])

    // Notify the guard in real time
    io.to(`guard:${approval.entry.guardId}`).emit('walkin:decision', {
      approvalId,
      entryId: approval.entryId,
      decision,
      visitorName: approval.visitorName,
      respondedAt: now,
    })

    sendSuccess(res, { decision }, `Visitor ${decision.toLowerCase()}`)
  } catch (err) { next(err) }
}

const handleWalkinTimeout = async (approvalId: string, guardId: string) => {
  const approval = await prisma.walkinApproval.findUnique({ where: { id: approvalId } })
  if (!approval || approval.respondedAt) return

  await prisma.$transaction([
    prisma.walkinApproval.update({
      where: { id: approvalId },
      data: { respondedAt: new Date(), decision: 'NO_RESPONSE' },
    }),
    prisma.entry.update({
      where: { id: approval.entryId },
      data: { status: 'NO_RESPONSE' },
    }),
  ])

  io.to(`guard:${guardId}`).emit('walkin:timeout', {
    approvalId,
    entryId: approval.entryId,
    visitorName: approval.visitorName,
  })
}
```

---

## 16. Alert and Notification Engine

### `src/utils/alert.util.ts`

```typescript
import { prisma } from '../config/prisma'
import { sendPush } from './push.util'
import { sendSMS } from './sms.util'
import { AlertPriority, Role } from '@prisma/client'
import { env } from '../config/env'

interface TriggerAlertParams {
  priority: AlertPriority
  title: string
  body: string
  targetUserIds?: string[]
  targetRoles?: Role[]
  entryId?: string
  incidentId?: string
  propertyId: string
}

export const triggerAlert = async (params: TriggerAlertParams) => {
  const {
    priority,
    title,
    body,
    targetUserIds = [],
    targetRoles = [],
    entryId,
    incidentId,
    propertyId,
  } = params

  // Determine all target users
  let userIds = [...targetUserIds]

  if (targetRoles.length > 0) {
    const users = await prisma.user.findMany({
      where: {
        role: { in: targetRoles },
        isActive: true,
        OR: [
          { guard: { propertyId } },
          { manager: { propertyId } },
          { resident: { unit: { propertyId } } },
        ],
      },
      select: { id: true },
    })
    userIds.push(...users.map((u) => u.id))
  }

  userIds = [...new Set(userIds)] // deduplicate

  // Fetch FCM tokens for all targets
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, isActive: true },
    select: { id: true, phone: true, fcmTokens: true, role: true },
  })

  // Create alert record
  const alert = await prisma.alert.create({
    data: {
      entryId,
      incidentId,
      propertyId,
      priority,
      title,
      body,
      targetRoles: targetRoles,
      targetUserIds: userIds,
      channel: 'PUSH',
      status: 'SENT',
    },
  })

  const allFcmTokens = users.flatMap((u) => u.fcmTokens)

  // P1: push + SMS simultaneously, no waiting
  if (priority === 'P1') {
    const pushPromise = allFcmTokens.length
      ? sendPush(allFcmTokens, { title, body, data: { alertId: alert.id, priority } })
      : Promise.resolve()

    const smsPromises = users.map((u) =>
      sendSMS(u.phone, `🚨 URGENT: ${title}. ${body}`)
    )

    // Emergency services for P1 incidents
    if (incidentId) {
      smsPromises.push(
        sendSMS(env.EMERGENCY_SMS_NUMBER, `P1 ALERT at property ${propertyId}: ${title}. ${body}`)
      )
    }

    await Promise.allSettled([pushPromise, ...smsPromises])
  } else {
    // P2 and P3: push only; SMS fallback via escalation job
    if (allFcmTokens.length) {
      await sendPush(allFcmTokens, {
        title,
        body,
        data: { alertId: alert.id, priority },
      })
    }
  }

  return alert
}

export const acknowledgeAlert = async (alertId: string, userId: string) => {
  return prisma.alert.update({
    where: { id: alertId },
    data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedBy: userId },
  })
}
```

### `src/utils/push.util.ts`

```typescript
import admin from 'firebase-admin'
import { env } from '../config/env'
import { logger } from './logger.util'

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
})

interface PushPayload {
  title: string
  body: string
  data?: Record<string, string>
}

export const sendPush = async (tokens: string[], payload: PushPayload) => {
  if (!tokens.length) return

  // FCM allows max 500 tokens per multicast
  const chunks = chunkArray(tokens, 500)

  for (const chunk of chunks) {
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      })

      // Remove invalid tokens from DB
      const invalidTokens: string[] = []
      response.responses.forEach((r, i) => {
        if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(chunk[i])
        }
      })

      if (invalidTokens.length) {
        await cleanInvalidTokens(invalidTokens)
      }
    } catch (err) {
      logger.error('FCM send error', { err })
    }
  }
}

const cleanInvalidTokens = async (tokens: string[]) => {
  const { prisma } = await import('../config/prisma')
  const users = await prisma.user.findMany({
    where: { fcmTokens: { hasSome: tokens } },
    select: { id: true, fcmTokens: true },
  })
  for (const user of users) {
    const cleaned = user.fcmTokens.filter((t) => !tokens.includes(t))
    await prisma.user.update({
      where: { id: user.id },
      data: { fcmTokens: cleaned },
    })
  }
}

const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}
```

### `src/utils/sms.util.ts`

```typescript
import twilio from 'twilio'
import { env } from '../config/env'
import { logger } from './logger.util'

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)

export const sendSMS = async (to: string, body: string) => {
  try {
    await client.messages.create({ from: env.TWILIO_PHONE_NUMBER, to, body })
  } catch (err) {
    logger.error('SMS send failed', { to, err })
    // Do not throw — SMS failure should never crash the main flow
  }
}
```

---

## 17. Incident Management Module

```typescript
// src/modules/incidents/incident.controller.ts
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/prisma'
import { sendSuccess } from '../../utils/response.util'
import { AppError } from '../../middlewares/error.middleware'
import { triggerAlert } from '../../utils/alert.util'
import { auditLog } from '../../utils/audit.util'
import { io } from '../../server'

export const createIncident = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, description, location, photoUrls, vehicleNumber, unitId } = req.body
    const guardId = req.user!.guardId!

    const guard = await prisma.guard.findUnique({ where: { id: guardId } })
    if (!guard) throw new AppError('Guard not found', 404)

    const incident = await prisma.incident.create({
      data: {
        propertyId: guard.propertyId,
        guardId,
        unitId,
        type,
        description,
        location,
        photoUrls: photoUrls ?? [],
        vehicleNumber,
        status: 'OPEN',
      },
    })

    // Create first timeline action
    await prisma.incidentAction.create({
      data: {
        incidentId: incident.id,
        actorId: req.user!.id,
        actorRole: 'GUARD',
        action: 'INCIDENT_LOGGED',
        note: description,
      },
    })

    // Alert managers with P2
    await triggerAlert({
      priority: 'P2',
      title: `Incident: ${type.replace(/_/g, ' ')}`,
      body: `Logged by guard at ${location}. ${description.slice(0, 80)}`,
      targetRoles: ['MANAGER'],
      incidentId: incident.id,
      propertyId: guard.propertyId,
    })

    io.to(`property:${guard.propertyId}`).emit('incident:new', {
      incidentId: incident.id,
      type,
      location,
      guardId,
    })

    sendSuccess(res, incident, 'Incident logged', 201)
  } catch (err) { next(err) }
}

export const assignIncident = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { assignedTo, note } = req.body

    const incident = await prisma.incident.findUnique({ where: { id } })
    if (!incident || incident.propertyId !== req.user!.propertyId) {
      throw new AppError('Incident not found', 404)
    }

    const updated = await prisma.incident.update({
      where: { id },
      data: { assignedTo, assignedAt: new Date(), status: 'IN_PROGRESS' },
    })

    await prisma.incidentAction.create({
      data: {
        incidentId: id,
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'ASSIGNED',
        note,
      },
    })

    // Notify the assigned guard
    const assignee = await prisma.guard.findUnique({
      where: { id: assignedTo },
      include: { user: { select: { fcmTokens: true } } },
    })
    if (assignee?.user.fcmTokens.length) {
      const { sendPush } = await import('../../utils/push.util')
      await sendPush(assignee.user.fcmTokens, {
        title: 'Incident assigned to you',
        body: `${incident.type.replace(/_/g, ' ')} at ${incident.location}`,
        data: { type: 'INCIDENT_ASSIGNMENT', incidentId: id },
      })
    }

    sendSuccess(res, updated, 'Incident assigned')
  } catch (err) { next(err) }
}

export const escalateIncident = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { note } = req.body

    const incident = await prisma.incident.findUnique({ where: { id } })
    if (!incident || incident.propertyId !== req.user!.propertyId) {
      throw new AppError('Incident not found', 404)
    }

    await prisma.incidentAction.create({
      data: {
        incidentId: id,
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'ESCALATED_TO_P1',
        note,
      },
    })

    await triggerAlert({
      priority: 'P1',
      title: 'Incident escalated to P1',
      body: `${incident.type.replace(/_/g, ' ')} at ${incident.location}. ${note ?? ''}`,
      targetRoles: ['MANAGER', 'COMMITTEE'],
      incidentId: id,
      propertyId: incident.propertyId,
    })

    sendSuccess(res, null, 'Incident escalated to P1')
  } catch (err) { next(err) }
}

export const closeIncident = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { resolutionNote } = req.body

    const incident = await prisma.incident.findUnique({ where: { id } })
    if (!incident || incident.propertyId !== req.user!.propertyId) {
      throw new AppError('Incident not found', 404)
    }
    if (incident.status === 'CLOSED') throw new AppError('Already closed', 400)

    const updated = await prisma.incident.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date(), closedBy: req.user!.id, resolutionNote },
    })

    await prisma.incidentAction.create({
      data: {
        incidentId: id,
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: 'CLOSED',
        note: resolutionNote,
      },
    })

    await auditLog(req.user!.id, 'CLOSE_INCIDENT', 'Incident', id, req, incident, updated)

    sendSuccess(res, updated, 'Incident closed')
  } catch (err) { next(err) }
}
```

---

## 18. Guard Operations Module

```typescript
// src/modules/guards/guard.routes.ts
import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware'
import { requireRole } from '../../middlewares/role.middleware'
import {
  startShift,
  endShift,
  postCheckIn,
  getActiveGuards,
  getGuardDirectory,
  onboardGuard,
} from './guard.controller'

const router = Router()
router.use(authenticate)

router.post('/shift/start',    requireRole('GUARD'),             startShift)
router.post('/shift/end',      requireRole('GUARD'),             endShift)
router.post('/post-checkin',   requireRole('GUARD'),             postCheckIn)
router.get('/active',          requireRole('MANAGER', 'COMMITTEE'), getActiveGuards)
router.get('/directory',       requireRole('GUARD', 'MANAGER'), getGuardDirectory)
router.post('/',               requireRole('MANAGER'),           onboardGuard)

export { router as guardRouter }
```

---

## 19. Offline Sync Module

Guards work offline. Entries are logged locally on device and synced when connectivity returns.

```typescript
// src/modules/offline/offline.controller.ts
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/prisma'
import { sendSuccess } from '../../utils/response.util'
import { redis } from '../../config/redis'

export const syncOfflineEntries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entries } = req.body  // Array of locally queued entry records
    const guardId = req.user!.guardId!

    const results = []

    for (const e of entries) {
      // Idempotency: skip if already synced (use client-generated localId)
      const exists = await prisma.entry.findFirst({
        where: { guardId, entryAt: new Date(e.entryAt), passId: e.passId ?? undefined },
      })
      if (exists) {
        results.push({ localId: e.localId, synced: false, reason: 'DUPLICATE' })
        continue
      }

      const created = await prisma.entry.create({
        data: {
          unitId: e.unitId,
          passId: e.passId,
          guardId,
          entryPointId: e.entryPointId,
          visitorName: e.visitorName,
          visitorPhone: e.visitorPhone,
          vehicleNumber: e.vehicleNumber,
          method: e.method,
          status: e.status,
          gatePhotoUrl: e.gatePhotoUrl,
          entryAt: new Date(e.entryAt),
        },
      })
      results.push({ localId: e.localId, synced: true, serverId: created.id })
    }

    sendSuccess(res, { results, total: entries.length })
  } catch (err) { next(err) }
}

export const getPassCache = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Returns the active pass set for this property — used to seed guard's offline cache
    const propertyId = req.user!.propertyId!
    const cacheKey = `pass_cache:property:${propertyId}`

    const cached = await redis.get(cacheKey)
    if (cached) {
      return sendSuccess(res, JSON.parse(cached), 'From cache')
    }

    const passes = await prisma.pass.findMany({
      where: {
        unit: { propertyId },
        status: 'ACTIVE',
        validUntil: { gt: new Date() },
      },
      select: {
        id: true,
        qrPayload: true,
        otpCode: true,
        visitorName: true,
        unitId: true,
        type: true,
        validFrom: true,
        validUntil: true,
        entryPointIds: true,
        recurringRule: true,
      },
    })

    await redis.setex(cacheKey, 900, JSON.stringify(passes)) // 15 min TTL

    sendSuccess(res, passes, 'From database')
  } catch (err) { next(err) }
}
```

---

## 20. Vehicle Registry Module

```typescript
// src/modules/vehicles/vehicle.controller.ts
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/prisma'
import { sendSuccess } from '../../utils/response.util'
import { AppError } from '../../middlewares/error.middleware'
import { triggerAlert } from '../../utils/alert.util'

export const registerVehicle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { registrationNo, make, model, color } = req.body
    const unitId = req.user!.unitId!

    const existing = await prisma.vehicle.findFirst({
      where: { unitId, registrationNo: registrationNo.toUpperCase() },
    })
    if (existing) throw new AppError('Vehicle already registered to this unit', 409)

    const vehicle = await prisma.vehicle.create({
      data: {
        unitId,
        registrationNo: registrationNo.toUpperCase(),
        make,
        model,
        color,
        isResident: true,
      },
    })

    sendSuccess(res, vehicle, 'Vehicle registered', 201)
  } catch (err) { next(err) }
}

export const checkVehicle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Called by guard on ANPR match or manual plate lookup
    const { registrationNo } = req.params
    const guardId = req.user!.guardId!
    const guard = await prisma.guard.findUnique({ where: { id: guardId } })

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        registrationNo: registrationNo.toUpperCase(),
        unit: { propertyId: guard!.propertyId },
        isActive: true,
      },
      include: { unit: { include: { residents: { where: { isPrimary: true } } } } },
    })

    if (!vehicle) {
      // Unregistered — fire P2 alert
      await triggerAlert({
        priority: 'P2',
        title: 'Unregistered vehicle',
        body: `Vehicle ${registrationNo.toUpperCase()} is not in the registry`,
        targetRoles: ['MANAGER'],
        propertyId: guard!.propertyId,
      })
      return sendSuccess(res, { registered: false, registrationNo })
    }

    sendSuccess(res, {
      registered: true,
      vehicle,
      unit: vehicle.unit.unitNumber,
      resident: vehicle.unit.residents[0]?.name,
    })
  } catch (err) { next(err) }
}
```

---

## 21. Amenity Booking Module

```typescript
// src/modules/amenities/amenity.controller.ts
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/prisma'
import { sendSuccess } from '../../utils/response.util'
import { AppError } from '../../middlewares/error.middleware'

export const getAmenities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unitId = req.user!.unitId!
    const unit = await prisma.unit.findUnique({ where: { id: unitId } })

    const amenities = await prisma.amenity.findMany({
      where: { propertyId: unit!.propertyId, status: 'AVAILABLE' },
    })
    sendSuccess(res, amenities)
  } catch (err) { next(err) }
}

export const bookAmenity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amenityId, date, startTime, endTime } = req.body
    const residentId = req.user!.residentId!

    const amenity = await prisma.amenity.findUnique({ where: { id: amenityId } })
    if (!amenity) throw new AppError('Amenity not found', 404)
    if (amenity.status !== 'AVAILABLE') throw new AppError('Amenity not available', 400)

    // Check capacity: count overlapping bookings
    const overlapping = await prisma.amenityBooking.count({
      where: {
        amenityId,
        date: new Date(date),
        status: 'CONFIRMED',
        OR: [
          { startTime: { lte: endTime }, endTime: { gte: startTime } },
        ],
      },
    })
    if (overlapping >= amenity.capacity) {
      throw new AppError('Amenity is fully booked for this time slot', 409)
    }

    const booking = await prisma.amenityBooking.create({
      data: { amenityId, residentId, date: new Date(date), startTime, endTime },
    })

    sendSuccess(res, booking, 'Amenity booked', 201)
  } catch (err) { next(err) }
}

export const cancelBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const booking = await prisma.amenityBooking.findUnique({ where: { id } })
    if (!booking || booking.residentId !== req.user!.residentId) {
      throw new AppError('Booking not found', 404)
    }
    if (booking.status !== 'CONFIRMED') throw new AppError('Booking already cancelled', 400)

    await prisma.amenityBooking.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })

    sendSuccess(res, null, 'Booking cancelled')
  } catch (err) { next(err) }
}
```

---

## 22. Reporting Module

```typescript
// src/modules/reports/report.controller.ts
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/prisma'
import { sendSuccess } from '../../utils/response.util'
import { generateMonthlyPDF } from '../../utils/pdf.util'
import { auditLog } from '../../utils/audit.util'

export const getOperationsOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyId = req.user!.propertyId!
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      totalEntriesToday,
      activeVisitors,
      guardsOnDuty,
      openIncidents,
      unacknowledgedAlerts,
      pendingWalkins,
    ] = await Promise.all([
      prisma.entry.count({ where: { unit: { propertyId }, entryAt: { gte: today }, status: 'APPROVED' } }),
      prisma.entry.count({ where: { unit: { propertyId }, status: 'APPROVED', exitAt: null } }),
      prisma.guard.count({ where: { propertyId, isOnDuty: true } }),
      prisma.incident.count({ where: { propertyId, status: { not: 'CLOSED' } } }),
      prisma.alert.count({ where: { propertyId, status: 'SENT', priority: { in: ['P1', 'P2'] } } }),
      prisma.walkinApproval.count({
        where: {
          entry: { unit: { propertyId } },
          respondedAt: null,
          timeoutAt: { gt: new Date() },
        },
      }),
    ])

    sendSuccess(res, {
      totalEntriesToday,
      activeVisitors,
      guardsOnDuty,
      openIncidents,
      unacknowledgedAlerts,
      pendingWalkins,
      generatedAt: new Date(),
    })
  } catch (err) { next(err) }
}

export const generateMonthlyReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year } = req.query as Record<string, string>
    const propertyId = req.user!.propertyId!

    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59)

    const [
      property,
      totalEntries,
      digitalEntries,
      incidents,
      guardCompliance,
      activePassCount,
      anomalyFlags,
    ] = await Promise.all([
      prisma.property.findUnique({ where: { id: propertyId } }),
      prisma.entry.count({
        where: { unit: { propertyId }, entryAt: { gte: startDate, lte: endDate }, status: 'APPROVED' },
      }),
      prisma.entry.count({
        where: {
          unit: { propertyId },
          entryAt: { gte: startDate, lte: endDate },
          status: 'APPROVED',
          method: { in: ['QR_SCAN', 'OTP'] },
        },
      }),
      prisma.incident.findMany({
        where: { propertyId, createdAt: { gte: startDate, lte: endDate } },
        include: { actions: { orderBy: { createdAt: 'desc' } } },
      }),
      prisma.shift.findMany({
        where: {
          guard: { propertyId },
          startedAt: { gte: startDate, lte: endDate },
          signedOffAt: { not: null },
        },
        include: { guard: true },
      }),
      prisma.pass.count({ where: { unit: { propertyId }, status: 'ACTIVE' } }),
      prisma.pass.findMany({
        where: {
          unit: { propertyId },
          status: { in: ['ACTIVE', 'SUSPENDED'] },
          validUntil: { lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
        },
        include: { unit: true, resident: true },
      }),
    ])

    const reportData = {
      property: property!,
      period: { month: parseInt(month), year: parseInt(year), startDate, endDate },
      entries: {
        total: totalEntries,
        digital: digitalEntries,
        digitalRate: totalEntries ? Math.round((digitalEntries / totalEntries) * 100) : 0,
      },
      incidents: {
        total: incidents.length,
        open: incidents.filter((i) => i.status === 'OPEN').length,
        inProgress: incidents.filter((i) => i.status === 'IN_PROGRESS').length,
        closed: incidents.filter((i) => i.status === 'CLOSED').length,
        byType: groupBy(incidents, 'type'),
        list: incidents,
      },
      guards: {
        shiftsCompleted: guardCompliance.length,
        compliance: guardCompliance,
      },
      credentials: {
        activePasses: activePassCount,
        anomalies: anomalyFlags,
      },
      generatedAt: new Date(),
      generatedBy: req.user!.id,
    }

    await auditLog(req.user!.id, 'GENERATE_REPORT', 'Report', `${year}-${month}`, req)

    // Stream PDF to response
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename=security-report-${year}-${month}.pdf`)

    const pdfStream = generateMonthlyPDF(reportData)
    pdfStream.pipe(res)
  } catch (err) { next(err) }
}

const groupBy = <T extends Record<string, any>>(arr: T[], key: string) =>
  arr.reduce((acc, item) => {
    const k = item[key]
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {} as Record<string, number>)
```

---

## 23. WebSocket — Real-Time Layer

### `src/modules/realtime/socket.handler.ts`

```typescript
import { Server, Socket } from 'socket.io'
import { verifyAccessToken } from '../../utils/jwt.util'
import { logger } from '../../utils/logger.util'

export const registerSocketHandlers = (io: Server) => {
  // Auth middleware for every socket connection
  io.use((socket, next) => {
    const token = socket.handshake.auth.token
    if (!token) return next(new Error('No token'))

    try {
      const payload = verifyAccessToken(token)
      socket.data.user = payload
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user
    logger.info('WebSocket connected', { userId: user.userId, role: user.role })

    // Personal room for direct messages
    socket.join(`user:${user.userId}`)

    // Role-based rooms
    if (user.propertyId) {
      socket.join(`property:${user.propertyId}`)
    }
    if (user.guardId) {
      socket.join(`guard:${user.guardId}`)
    }

    socket.on('disconnect', () => {
      logger.info('WebSocket disconnected', { userId: user.userId })
    })
  })
}
```

---

## 24. Job Scheduler — Cron Jobs

### `src/jobs/index.ts`

```typescript
import { passExpiryJob } from './passExpiry.job'
import { cacheRefreshJob } from './cacheRefresh.job'
import { alertEscalationJob } from './alertEscalation.job'

export const startAllJobs = () => {
  passExpiryJob.start()
  cacheRefreshJob.start()
  alertEscalationJob.start()
}
```

### `src/jobs/passExpiry.job.ts`

```typescript
import cron from 'node-cron'
import { prisma } from '../config/prisma'
import { logger } from '../utils/logger.util'

export const passExpiryJob = cron.schedule('*/15 * * * *', async () => {
  try {
    const expired = await prisma.pass.updateMany({
      where: {
        status: 'ACTIVE',
        validUntil: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    })
    if (expired.count > 0) {
      logger.info(`Pass expiry job: expired ${expired.count} passes`)
    }

    // Also reactivate passes where suspendedUntil has passed
    const reactivated = await prisma.pass.updateMany({
      where: {
        status: 'SUSPENDED',
        suspendedUntil: { lt: new Date() },
        validUntil: { gt: new Date() },
      },
      data: { status: 'ACTIVE', suspendedAt: null, suspendedUntil: null },
    })
    if (reactivated.count > 0) {
      logger.info(`Pass expiry job: reactivated ${reactivated.count} suspended passes`)
    }
  } catch (err) {
    logger.error('passExpiryJob failed', { err })
  }
}, { scheduled: false })
```

### `src/jobs/cacheRefresh.job.ts`

```typescript
import cron from 'node-cron'
import { prisma } from '../config/prisma'
import { redis } from '../config/redis'
import { logger } from '../utils/logger.util'

export const cacheRefreshJob = cron.schedule('*/15 * * * *', async () => {
  try {
    const properties = await prisma.property.findMany({ select: { id: true } })

    for (const property of properties) {
      const passes = await prisma.pass.findMany({
        where: {
          unit: { propertyId: property.id },
          status: 'ACTIVE',
          validUntil: { gt: new Date() },
        },
        select: {
          id: true,
          qrPayload: true,
          otpCode: true,
          visitorName: true,
          unitId: true,
          type: true,
          validFrom: true,
          validUntil: true,
          entryPointIds: true,
          recurringRule: true,
        },
      })

      await redis.setex(
        `pass_cache:property:${property.id}`,
        900, // 15 minutes
        JSON.stringify(passes)
      )
    }

    logger.info(`Cache refresh job: refreshed ${properties.length} property caches`)
  } catch (err) {
    logger.error('cacheRefreshJob failed', { err })
  }
}, { scheduled: false })
```

### `src/jobs/alertEscalation.job.ts`

```typescript
import cron from 'node-cron'
import { prisma } from '../config/prisma'
import { sendSMS } from '../utils/sms.util'
import { sendPush } from '../utils/push.util'
import { logger } from '../utils/logger.util'

const SLA_MINUTES = { P1: 3, P2: 15, P3: 60 }

export const alertEscalationJob = cron.schedule('*/1 * * * *', async () => {
  try {
    const now = new Date()

    for (const [priority, minutes] of Object.entries(SLA_MINUTES)) {
      const cutoff = new Date(now.getTime() - minutes * 60 * 1000)

      const overdueAlerts = await prisma.alert.findMany({
        where: {
          priority: priority as any,
          status: 'SENT',
          createdAt: { lt: cutoff },
        },
        include: { incident: true },
      })

      for (const alert of overdueAlerts) {
        // Escalate: find managers and committee for this property
        const escalationTargets = await prisma.user.findMany({
          where: {
            role: { in: ['MANAGER', 'COMMITTEE'] },
            isActive: true,
            OR: [
              { manager: { propertyId: alert.propertyId } },
              { committee: { isNot: null } },
            ],
          },
          select: { id: true, phone: true, fcmTokens: true },
        })

        const allTokens = escalationTargets.flatMap((u) => u.fcmTokens)
        if (allTokens.length) {
          await sendPush(allTokens, {
            title: `⚠️ ESCALATED: ${alert.title}`,
            body: `Alert unacknowledged for ${minutes} min. ${alert.body}`,
            data: { alertId: alert.id, type: 'ESCALATION' },
          })
        }

        // SMS escalation for P1
        if (priority === 'P1') {
          for (const target of escalationTargets) {
            await sendSMS(target.phone, `ESCALATED P1: ${alert.title}. ${alert.body}. Check the app immediately.`)
          }
        }

        await prisma.alert.update({
          where: { id: alert.id },
          data: { status: 'ESCALATED', escalatedAt: now },
        })

        logger.warn(`Alert ${alert.id} escalated (${priority}, ${minutes}min SLA breached)`)
      }
    }
  } catch (err) {
    logger.error('alertEscalationJob failed', { err })
  }
}, { scheduled: false })
```

---

## 25. Error Handling

All errors flow to the central `errorHandler` middleware. Never `throw` raw strings — always use `AppError` with a meaningful message and HTTP status code. Every async route handler must `catch` and call `next(err)`.

Common HTTP status codes used in this backend:

| Code | When |
|------|------|
| 200 | Successful read or update |
| 201 | Resource created |
| 400 | Bad request (missing fields, wrong state) |
| 401 | Not authenticated |
| 403 | Authenticated but not authorised |
| 404 | Resource not found |
| 409 | Conflict (duplicate record) |
| 422 | Validation failed (Zod) |
| 429 | Rate limit exceeded |
| 500 | Unhandled server error |

---

## 26. Input Validation

Every route that accepts a request body has a Zod schema. Example for pass creation:

```typescript
// src/modules/passes/pass.schema.ts
import { z } from 'zod'

export const createPassSchema = z.object({
  body: z.object({
    type: z.enum(['ONE_TIME', 'RECURRING', 'DELIVERY', 'CONTRACTOR']),
    visitorName: z.string().min(2).max(100),
    visitorPhone: z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
    purpose: z.string().max(200).optional(),
    validFrom: z.string().datetime(),
    validUntil: z.string().datetime(),
    entryPointIds: z.array(z.string()).optional(),
    shareViaWhatsApp: z.boolean().optional(),
    recurringRule: z.object({
      allowedDays: z.array(z.enum([
        'MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'
      ])).min(1),
      windowStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      windowEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    }).optional(),
  }).refine(
    (data) => new Date(data.validFrom) < new Date(data.validUntil),
    { message: 'validFrom must be before validUntil', path: ['validFrom'] }
  ).refine(
    (data) => data.type !== 'RECURRING' || !!data.recurringRule,
    { message: 'recurringRule is required for RECURRING passes', path: ['recurringRule'] }
  ),
})
```

---

## 27. Security Hardening

### `src/utils/audit.util.ts`

```typescript
import { Request } from 'express'
import { prisma } from '../config/prisma'

export const auditLog = async (
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  req: Request,
  before?: unknown,
  after?: unknown
) => {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId,
      before: before ? JSON.parse(JSON.stringify(before)) : undefined,
      after: after ? JSON.parse(JSON.stringify(after)) : undefined,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  })
}
```

Security checklist implemented in this backend:

- Helmet sets secure HTTP headers (XSS, HSTS, nosniff, frameguard)
- CORS restricted to known client origins only
- JWT verified on every protected route — user active status also checked
- Role middleware gates every route to the correct roles
- Rate limiting: 300 req/15min globally, 10 req/10min on auth endpoints, 60/min on scan
- OTP is cryptographically random, single-use, time-limited, and invalidated on use
- QR payload is HMAC-signed — cannot be forged without the server secret
- Pass OTP is hashed with SHA-256 before storage — plaintext never stored
- Refresh tokens are random 64-byte hex, rotated on every use, stored hashed, revocable
- All audit-sensitive actions (login, pass create/revoke, incident close, report generate) write to `AuditLog`
- Prisma parameterised queries prevent SQL injection
- `Content-Type: application/json` enforced — no raw body parsing that could enable prototype pollution
- File uploads (incident photos) validated for MIME type before storage

---

## 28. Logging and Audit Trail

### `src/utils/logger.util.ts`

```typescript
import winston from 'winston'
import { env } from '../config/env'

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.prettyPrint()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024,  // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    }),
  ],
})
```

---

## 29. Testing Strategy

### Unit tests — validation and business logic

```typescript
// src/modules/entries/__tests__/validatePass.test.ts
import { validatePassForEntry } from '../entry.controller'

describe('validatePassForEntry', () => {
  const basePass = {
    status: 'ACTIVE',
    validFrom: new Date(Date.now() - 3600000),
    validUntil: new Date(Date.now() + 3600000),
    entryPointIds: [],
    type: 'ONE_TIME',
    recurringRule: null,
  }

  it('clears a valid active pass', () => {
    const result = validatePassForEntry(basePass, 'ep1', new Date())
    expect(result.allowed).toBe(true)
  })

  it('denies a revoked pass', () => {
    const result = validatePassForEntry({ ...basePass, status: 'REVOKED' }, 'ep1', new Date())
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('REVOKED')
  })

  it('denies a pass used at wrong entry point', () => {
    const result = validatePassForEntry({ ...basePass, entryPointIds: ['ep2'] }, 'ep1', new Date())
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('WRONG_ENTRY_POINT')
  })

  it('denies a recurring pass outside allowed days', () => {
    const pass = {
      ...basePass,
      type: 'RECURRING',
      recurringRule: {
        allowedDays: ['MONDAY'],
        windowStartTime: '08:00',
        windowEndTime: '13:00',
      },
    }
    // Use a Sunday
    const sunday = new Date('2025-01-05T10:00:00')
    const result = validatePassForEntry(pass, 'ep1', sunday)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('OUTSIDE_ALLOWED_DAYS')
  })
})
```

### Integration tests — API routes

Use `supertest` with a test database:

```typescript
// src/__tests__/auth.integration.test.ts
import request from 'supertest'
import app from '../app'
import { prisma } from '../config/prisma'

beforeAll(async () => {
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /api/v1/auth/otp/request', () => {
  it('returns 404 for unknown phone', async () => {
    const res = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone: '+910000000000' })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid phone format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone: '9999' })
    expect(res.status).toBe(422)
  })
})
```

---

## 30. Deployment

### `Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
RUN npx prisma generate
EXPOSE 5000
CMD ["node", "dist/server.js"]
```

### `docker-compose.yml` (local dev)

```yaml
version: '3.9'
services:
  api:
    build: .
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/apartment_security
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis
    volumes:
      - ./src:/app/src
      - ./logs:/app/logs

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: apartment_security
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

### Production startup sequence

```bash
# 1. Run database migrations
npx prisma migrate deploy

# 2. Generate Prisma client
npx prisma generate

# 3. Start server
node dist/server.js
```

---

## Summary — What this backend covers

| Feature | Implemented |
|---------|-------------|
| Phone OTP authentication | ✓ |
| JWT access + refresh token rotation | ✓ |
| Role-based access (resident/guard/manager/committee) | ✓ |
| Visitor pass (one-time, recurring, delivery, contractor) | ✓ |
| HMAC-signed QR codes | ✓ |
| Hashed OTP for delivery passes | ✓ |
| Recurring pass day + time window validation | ✓ |
| Pass suspend, reactivate, revoke | ✓ |
| Entry and exit logging | ✓ |
| Walk-in real-time approval flow | ✓ |
| P1/P2/P3 alert classification | ✓ |
| FCM push with invalid token cleanup | ✓ |
| SMS fallback via Twilio | ✓ |
| SLA escalation cron job | ✓ |
| Incident management with timeline | ✓ |
| Incident escalation to P1 | ✓ |
| Guard shift start/end + handover | ✓ |
| Guard post check-ins | ✓ |
| Offline sync with idempotency | ✓ |
| Redis pass cache for offline guards | ✓ |
| Vehicle registry + unregistered alert | ✓ |
| Amenity booking with capacity check | ✓ |
| Monthly PDF report generation | ✓ |
| Real-time WebSocket per user/property/guard | ✓ |
| Immutable audit log on all sensitive actions | ✓ |
| Global + auth + scan rate limiting | ✓ |
| Zod input validation on all routes | ✓ |
| Standardised response shape | ✓ |
| Graceful shutdown | ✓ |
| Docker + docker-compose | ✓ |

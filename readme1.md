# 🛡️ SecureGate — Manager Website (Manager Portal) Feature Documentation

Welcome to the feature documentation for the **SecureGate Manager Website**. The Manager Portal is an enterprise-grade, real-time command center designed for Facility Managers, Society Administrators, and Management Committee members to monitor, secure, and administer residential societies and gated communities.

---

## 📋 Table of Contents
- [🏢 Overview](#-overview)
- [📊 1. Executive Dashboard](#-1-executive-dashboard)
- [🛡️ 2. Guard & Workforce Management](#️-2-guard--workforce-management)
- [👥 3. Resident Directory & Occupancy](#-3-resident-directory--occupancy)
- [🚪 4. Expected Visitors & Access Control](#-4-expected-visitors--access-control)
- [🚗 5. Parking & Vehicle Security](#-5-parking--vehicle-security)
- [🚨 6. Emergency SOS & Alert Escalation](#-6-emergency-sos--alert-escalation)
- [📹 7. CCTV Monitoring & Video Surveillance](#-7-cctv-monitoring--video-surveillance)
- [⏱️ 8. Event Timeline & System Audit Log](#️-8-event-timeline--system-audit-log)
- [🎉 9. Community Events & Venue Booking](#-9-community-events--venue-booking)
- [🔧 10. Maintenance & Ticket Management](#-10-maintenance--ticket-management)
- [💰 11. Fund & Financial Management](#-11-fund--financial-management)
- [📢 12. Community Control & Notice Board](#-12-community-control--notice-board)
- [📈 13. Reports & Analytics](#-13-reports--analytics)
- [⚙️ 14. System Settings & Customization](#️-14-system-settings--customization)
- [💻 Technical & Security Highlights](#-technical--security-highlights)

---

## 🏢 Overview

The Manager Website serves as the central control plane connecting guards at entry gates, residents in their units, and management personnel. Built using **React**, **TypeScript**, **Vite**, and **Socket.IO**, it provides real-time state synchronization, live stream video feeds, immediate panic alert notifications, and extensive administrative controls.

---

## 📊 1. Executive Dashboard (`/dashboard`)

The central operational nerve center providing real-time visibility into all society activities:

* **Real-time Metric Counters:**
  * **Active Guards on Duty** (Live status & roster count)
  * **Residents Currently on Premises**
  * **Today's Total Visitors & Entries Count**
  * **Pending Walk-in Approvals** requiring manager action
  * **Open Emergency Alerts** needing immediate resolution
  * **Total Gate Entry/Exit Events Today**
* **Guard Post Status Cards:** Visual health indicators showing whether guards at designated gates are *On Duty*, *On Break*, or *Overdue for Post Check-In*.
* **Pending Approvals Queue:** Quick approval/denial of pending guest walk-ins, delivery agents, or service workers.
* **Active Security Alerts Panel:** Real-time stream of active panic alarms, unauthorized entry flags, or system alerts with 1-click acknowledgment.
* **Live Gate Activity Feed:** Live activity stream powered by WebSockets showing visitor QR scans, guard check-ins, and pass creations.
* **Active Visitor Board:** Interactive table of all visitors currently inside the property, including host unit details, gate entry point, and entry timestamps.

---

## 🛡️ 2. Guard & Workforce Management (`/guards` & `/workforce`)

Comprehensive tools to schedule, track, and manage gate security personnel:

* **Guard Roster Directory:** Detailed directory of all security personnel with Badge IDs, contact details, assigned gates, shift schedules, and security clearances.
* **Shift Scheduling & Rostering:**
  * Flexible shift configuration (Morning, Evening, Night shifts).
  * Duty assignment per gate/post (Main Gate, Service Gate, Tower Lobbies, Parking).
* **Live Duty Monitoring:** Track guard check-ins, post compliance, and real-time status (On Post, On Break, Offline).
* **Guard Leave & Absence Management:**
  * Review and approve/reject leave requests.
  * View leave balances and assign replacement guards to prevent understaffed posts.
* **Attendance & Biometric Logs:** View historical clock-in/clock-out records and check-in timeliness.
* **Guard Profile Drill-down:** View full guard profiles including performance history, assigned equipment, ID verification documents, and audit logs.
* **Security Incident Log:** Track incidents logged by guards with severity levels (Low, Medium, High) and resolution workflows.

---

## 👥 3. Resident Directory & Occupancy (`/residents`)

A centralized database of society residents and occupancy records:

* **Comprehensive Resident Master Data:** Filterable directory organized by Tower/Block, Flat/Villa number, owner vs. tenant occupancy status, and primary contact info.
* **Co-Occupants & Family Members:** Manage list of registered family members and secondary occupants associated with each unit.
* **Move-In / Move-Out Management:** Onboard new residents and offboard departing tenants with automated access revoked upon move-out.
* **Emergency Contacts:** Store emergency contact details for each apartment unit for quick manager outreach during crises.
* **Resident Access Rights:** Control resident permissions, emergency broadcast opt-ins, and visitor auto-approval settings.

---

## 🚪 4. Expected Visitors & Access Control (`/expected`)

Complete oversight of guest access, frequent visitors, and gate passes:

* **Pre-Approved Visitor Passes:** Monitor resident-generated digital passes for guests, cabs (Uber/Ola), deliveries (Zomato/Amazon), and service providers.
* **Verification Method Tracking:** Verification breakdown via Digital QR Code scans, OTP verification, or Guard Gatekeeper manual approval.
* **Frequent Visitor & Staff Passes:** Manage daily service staff directory (housekeepers, cooks, drivers, gardeners) with recurring gate passes and entry time windows.
* **Overstaying & Unverified Visitor Alerts:** Automated flags for visitors who remain on premises past expected departure hours.
* **Searchable Access Logs:** Full historical search and filtering of all entry/exit records by visitor name, phone number, vehicle number, or host unit.

---

## 🚗 5. Parking & Vehicle Security (`/parking`)

Efficient parking allocation and automated vehicle entry tracking:

* **Registered Resident Vehicle Database:** Directory of resident vehicles mapped to specific license plate numbers, vehicle types (2-wheeler / 4-wheeler), RFID tags, and assigned parking slot IDs.
* **Visitor Vehicle Allocation:** Track visitor vehicles parked in designated guest bays and monitor parking slot availability in real time.
* **ANPR & RFID Integration:** Integration readiness with Automatic Number Plate Recognition (ANPR) cameras and RFID barrier gates.
* **Unauthorized & Overstaying Parking Alerts:** Flag unregistered vehicles or visitor vehicles exceeding permitted parking durations.
* **Parking Slot Map & Bay Monitoring:** Visual layout of parking bays (Basement, Ground Level) showing occupied vs. free spaces.

---

## 🚨 6. Emergency SOS & Alert Escalation (`/alerts`)

Instant panic response and real-time emergency management:

* **Real-time SOS Alarms Feed:** Live WebSocket feed receiving emergency triggers from residents or guards (Medical Emergency, Fire Alarm, Intruder Alert, Lift Trapped, Gate Bypass).
* **Priority Classification:** Categorization by priority level (**CRITICAL**, **HIGH**, **MEDIUM**, **LOW**) with distinct visual color codes and audio alerts.
* **One-Click Incident Escalation:** Instantly dispatch on-duty guards to the alert location or notify emergency services.
* **Resolution Lifecycle & Acknowledgment:** Track alert status from `SENT` → `ACKNOWLEDGED` → `RESOLVED` with timestamps and manager signatures.
* **Emergency Audit Log:** Complete audit trail of incident response times and resolution notes.

---

## 📹 7. CCTV Monitoring & Video Surveillance (`/cctv`)

Centralized camera monitoring interface for perimeter and gate security:

* **Multi-Camera Live Feeds:** Monitor real-time camera streams across key security zones (Main Gate, Service Gate, Perimeter Fences, Parking Basements, Clubhouse).
* **Camera Health & Operational Status:** Live indicators showing camera status (**Online**, **Offline**, **Maintenance Required**).
* **Multi-Grid Layout Switcher:** Toggle between single camera view (1x1), quad view (2x2), or multi-camera grid (3x3).
* **PTZ & Playback Controls:** Simulated Pan-Tilt-Zoom (PTZ) controls and historic footage playback for security audits.

---

## ⏱️ 8. Event Timeline & System Audit Log (`/timeline`)

An immutable chronological record of all actions across the society ecosystem:

* **Comprehensive Activity Stream:** Audit trail logging gate entries, visitor scans, guard shift transitions, resident onboardings, and system configuration updates.
* **Advanced Multi-Filter:** Filter audit logs by date/time range, event category, gate number, or user role (Manager, Guard, Resident).
* **Manager Override Log:** Specialized audit trail recording manager overrides (e.g., manual gate clearance, force-approving stuck walk-ins, credential suspensions) with mandatory reason codes.

---

## 🎉 9. Community Events & Venue Booking (`/events`)

Streamlining society gatherings and amenity reservations:

* **Event Management:** Create and publish society events (Annual General Meetings, festival celebrations, sports events, workshops).
* **Amenity & Venue Booking:** Manage bookings for society facilities such as the Clubhouse, Party Hall, Tennis Court, and BBQ Lawn.
* **Bulk Event Guest Passes:** Generate bulk visitor passes for event attendees, enabling seamless gate entry during large community events.

---

## 🔧 10. Maintenance & Ticket Management (`/maintenance`)

Helpdesk system for resident complaints and infrastructure upkeep:

* **Resident Complaint Tracking:** Centralized ticket board for issues regarding Plumbing, Electrical work, Elevator maintenance, Cleaning, and Security.
* **Ticket Workflow Lifecycle:** Move tickets across stages: `Open` ➔ `Assigned` ➔ `In Progress` ➔ `Resolved` ➔ `Closed`.
* **Vendor & Technician Assignment:** Assign internal staff or external maintenance contractors to specific tickets with scheduled resolution SLAs.
* **Asset Maintenance Schedule:** Track recurring preventative maintenance schedules for society assets (Generators, Water Pumps, Lifts, CCTV systems).

---

## 💰 11. Fund & Financial Management (`/funds`)

High-level oversight of society dues, billing, and expenditures:

* **Maintenance Fee Tracking:** Monitor resident maintenance fee collection status (**Paid**, **Pending**, **Overdue**).
* **Automated Billing & Statements:** View billing cycles, payment receipts, and outstanding dues summaries per unit.
* **Expense Tracking & Financial Overview:** Record society maintenance expenses and view monthly income vs. expenditure summaries.

---

## 📢 12. Community Control & Notice Board (`/community`)

Direct communication channel with society residents:

* **Digital Notice Board:** Publish digital notices and announcements directly to the resident mobile app (Maintenance downtime, Rule updates, Emergency alerts).
* **Community Rule Enforcement:** Broadcast community guidelines regarding pet policies, noise control, parking rules, and renovation hours.
* **Polls & Surveys:** Conduct resident polls for society decision-making and gather community feedback.

---

## 📈 13. Reports & Analytics (`/reports`)

Data-driven insights and exportable compliance documentation:

* **Operational Reports:** Peak visitor entry hours, gate traffic distribution, guard post check-in compliance, and visitor stay durations.
* **Security & Incident Analytics:** Incident frequency by type, average emergency alert response times, and unauthorized entry trends.
* **Financial & Maintenance Reports:** Maintenance collection percentages and ticket resolution turnaround times.
* **Data Export:** Export detailed reports in **PDF** or **CSV/Excel** formats for executive committee meetings and safety audits.

---

## ⚙️ 14. System Settings & Customization (`/settings` & `/profile`)

Configuration options for platform behavior and security controls:

* **Single Active Session Lock:** Enterprise security feature ensuring only one active manager session per account at a time, instantly revoking stale sessions.
* **Theme Switcher:** Instant toggle between Dark Mode and Light Mode with client-side cached theme persistence.
* **Security & Credentials:** Password updates, two-factor authentication (2FA) setup, and active session management.
* **Notification Preferences:** Customize alert channels for SMS, Email, and Socket push notifications based on alert severity.

---

## 💻 Technical & Security Highlights

| Feature | Technical Implementation |
|---|---|
| **Frontend Framework** | React 18, TypeScript, Vite |
| **Styling** | Modern CSS Design System (Custom properties, dark theme support, clean cards & modals) |
| **Real-Time Engine** | Socket.IO Client for instant SOS alerts, visitor scan updates, & guard status |
| **Auth & Security** | Bearer JWT Authentication, Single-Active-Session Lock, Silent automatic session expiration handling |
| **Data Integrity** | Structured audit logging with reason codes (`RC-101`, etc.) for manager overrides |

---
*Created for the SecureGate Society Security & Management Suite.*

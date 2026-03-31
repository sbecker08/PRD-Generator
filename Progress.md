# IS Intake Assistant — Epic Breakdown

## Current State

The app has a basic foundation:
- Next.js 16 + Tailwind CSS + PostgreSQL (`requests` and `messages` tables)
- AI chatbot intake conversation (Claude via Vercel AI SDK)
- Dashboard listing all requests
- Request detail page showing conversation history
- PRD generation and markdown download

**Not yet built:** authentication, roles, request statuses, PRD approval, IS review/Q&A, epic breakdown, build tracking, change requests, admin features.

---

## Epic 1: Database Schema & Request Lifecycle Statuses
**Requirements:** REQ-016, REQ-017, BR-001 through BR-006
**Goal:** Establish the full data model and status machine that all subsequent epics depend on.

- [ ] Design and apply schema migrations:
  - `requests` table: add `status` (enum: Draft, PRD Generated, Business Approved, IS Review, Q&A Sent, Epic Planning, In Progress, Complete), `classification` (New Application | Feature Enhancement), `application_name` (nullable, for enhancements)
  - `epics` table: `id`, `request_id`, `title`, `description`, `status` (Not Started | In Progress | Complete), `version`, `created_at`, `updated_at`
  - `epic_history` table: `id`, `epic_id`, `title`, `description`, `status`, `changed_at`, `change_reason`
  - `questions` table: `id`, `request_id`, `asked_by_user_id`, `question`, `answer`, `sent_at`, `answered_at`, `created_at`
  - `change_requests` table: `id`, `request_id`, `conversation_history` (jsonb), `status`, `created_at`
  - `users` table: `id`, `entra_id`, `name`, `email`, `created_at`
  - `user_roles` table: `user_id`, `role` (Business Requester | IS Reviewer | IS Engineer | Admin)
- [ ] Create a status transition helper that enforces valid transitions (BR-002, BR-005, BR-006)
- [ ] Add status and classification columns to the dashboard list view
- [ ] Add timestamps to all status changes for cycle time tracking

---

## Epic 2: Authentication & Role-Based Access Control
**Requirements:** REQ-023, REQ-024, REQ-025, BR-009, BR-010
**Goal:** Secure the app with Microsoft Entra SSO and enforce role-based permissions.

- [ ] Integrate Microsoft Entra SSO (NextAuth.js / Auth.js with Azure AD provider)
- [ ] Create session middleware that attaches user + roles to every request
- [ ] Protect all API routes — reject unauthenticated requests
- [ ] Build role-checking utility: `hasRole(user, 'IS Reviewer')` etc.
- [ ] Gate UI actions by role (e.g., only IS Reviewers see review actions)
- [ ] Admin page: list users, assign/remove roles (REQ-023, REQ-024)

---

## Epic 3: Intake Conversation Enhancements
**Requirements:** REQ-001 through REQ-005, BR-001, BR-011
**Goal:** Complete the guided intake experience with classification, auto-save, and resume.

- [ ] Update chatbot system prompt to classify requests as New Application or Feature Enhancement during conversation (BR-001)
- [ ] When classified as Feature Enhancement, prompt user to identify which application (REQ-004)
- [ ] Persist classification and application name to the `requests` table
- [ ] Ensure every user message + assistant response is saved immediately (REQ-005, BR-011) — already partially implemented, verify completeness
- [ ] Allow users to resume an in-progress conversation by navigating to the request detail page and continuing to chat
- [ ] Set request status to "Draft" on creation, auto-advance to "PRD Generated" when PRD is produced

---

## Epic 4: PRD Approval by Business Requester
**Requirements:** REQ-006, REQ-007, BR-002
**Goal:** Let the business requester formally approve the generated PRD.

- [ ] After PRD is generated, show an "Approve PRD" button on the request detail page (visible only to the original requester)
- [ ] On approval, transition status from "PRD Generated" to "Business Approved"
- [ ] Record approval timestamp and approving user
- [ ] Show approval status badge on the dashboard and detail pages

---

## Epic 5: IS Review & Q&A Cycle
**Requirements:** REQ-008 through REQ-012, BR-003, BR-004
**Goal:** Enable IS Reviewers to ask clarifying questions and business users to respond, in repeatable cycles.

- [ ] IS Review queue page: list all requests in "Business Approved" or "Q&A Sent" status
- [ ] Request review view: show the PRD and a panel to add questions (REQ-009)
- [ ] Questions are draft/private until the reviewer clicks "Send to Requester" (BR-003, REQ-010)
- [ ] Business requester sees questions and can provide answers inline (REQ-011)
- [ ] After all questions are answered, IS Reviewer can either send more questions or mark review as complete (REQ-012, BR-004)
- [ ] On review complete, transition status to "Epic Planning"
- [ ] Full Q&A history visible on the request detail page (REQ-017)

---

## Epic 6: AI-Assisted Epic Breakdown
**Requirements:** REQ-013, REQ-014, REQ-015, BR-005, BR-006
**Goal:** Generate and refine buildable epics from the approved PRD.

- [ ] When a request reaches "Epic Planning" status, provide a "Generate Epics" button (IS Engineer only)
- [ ] Call AI to break the PRD into suggested epics with titles and descriptions (REQ-013)
- [ ] Display epics in an editable list — IS Engineer can edit titles/descriptions, add new epics, remove epics (REQ-014)
- [ ] "Approve Epic Breakdown" button finalizes the epics and transitions status to "In Progress" (REQ-015, BR-006)
- [ ] Save approved epics to the `epics` table with initial status "Not Started"

---

## Epic 7: Build Tracking & Epic Status Management
**Requirements:** REQ-016, REQ-017, REQ-018
**Goal:** Track progress through the build phase at the epic level.

- [ ] Request detail page: show epic list with current status (Not Started / In Progress / Complete)
- [ ] IS Engineer can update individual epic statuses (REQ-018)
- [ ] Show overall progress indicator (e.g., "3 of 7 epics complete")
- [ ] Full request timeline view: conversation, PRD, Q&A, epics, all status changes with timestamps (REQ-017)
- [ ] Determine completion: when all epics are marked Complete, prompt to mark request as Complete (open question #2 — default to explicit action)

---

## Epic 8: Change Requests
**Requirements:** REQ-019 through REQ-022, BR-007, BR-008, BR-012
**Goal:** Support mid-build requirement changes with intelligent epic impact handling.

- [ ] "Submit Change Request" button on in-progress requests (Business Requester only)
- [ ] Change request follows guided conversation flow similar to original intake (REQ-020)
- [ ] Change request goes through its own approval cycle
- [ ] AI analyzes which epics are impacted by the change
- [ ] For "Not Started" epics: fold changes into existing epic, preserve original content in `epic_history` (BR-007)
- [ ] For "In Progress" or "Complete" epics: create new epics for the changed behavior (BR-008)
- [ ] No limit on number of change requests per project (BR-012)
- [ ] Change request history visible on the request detail page

---

## Epic 9: Dashboard & Reporting
**Requirements:** REQ-016, Section 7 (Data & Reporting)
**Goal:** Provide visibility into request pipeline and cycle times.

- [ ] Status overview dashboard: requests grouped/filterable by current status
- [ ] Cycle time metrics: time spent in each status, total intake-to-completion time
- [ ] Epic progress summary per request
- [ ] Filter/sort by requester, date, classification, status
- [ ] Individual request detail view consolidating full history (already partially built — enhance)

---

## Epic 10: Polish & Non-Functional Requirements
**Requirements:** Section 9 (Non-Functional Requirements)
**Goal:** Production readiness — performance, security hardening, and UX polish.

- [ ] Performance: ensure chatbot responses stream without noticeable lag
- [ ] Security: verify RBAC enforcement on all API routes, no anonymous access
- [ ] Input validation and error handling on all API endpoints
- [ ] Responsive design for common screen sizes
- [ ] Loading states, error states, and empty states throughout the UI
- [ ] Accessibility basics (keyboard navigation, labels, contrast)

---

## Dependency Graph

```
Epic 1 (Schema) ──► Epic 2 (Auth) ──► Epic 3 (Intake Enhancements)
                                   ──► Epic 4 (PRD Approval)
                                   ──► Epic 5 (IS Review & Q&A)
                                          │
                                          ▼
                                   Epic 6 (Epic Breakdown)
                                          │
                                          ▼
                                   Epic 7 (Build Tracking) ──► Epic 8 (Change Requests)
                                                           ──► Epic 9 (Dashboard & Reporting)

Epic 10 (Polish) — runs in parallel throughout
```

## Build Order (Recommended)

| Phase | Epics | Rationale |
|-------|-------|-----------|
| 1 | Epic 1 | Foundation — everything depends on the schema |
| 2 | Epic 2 | Auth gates all role-based features |
| 3 | Epic 3, Epic 4 | Intake + approval can be built in parallel |
| 4 | Epic 5 | Q&A cycle unlocks epic planning |
| 5 | Epic 6 | Epic breakdown unlocks build tracking |
| 6 | Epic 7, Epic 8 | Build tracking + change requests can be built in parallel |
| 7 | Epic 9 | Reporting is most valuable once data flows through the pipeline |
| 8 | Epic 10 | Final hardening pass |

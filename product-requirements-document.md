# Product Requirements Document
## IS Intake Assistant
**Version:** 1.1 | **Date:** 2025-01-24 | **Status:** Draft

---

## 1. Executive Summary
The IS Intake Assistant is a chatbot-driven application that guides business users through a structured conversation to capture product requirements for new applications and feature enhancements. By replacing the current shallow intake form with an intelligent, conversational experience, the tool draws out detailed requirements upfront — dramatically reducing the back-and-forth cycles between business teams and the IS Group.

The application manages the full lifecycle of a request: from initial intake through PRD generation, business approval, IS review with collaborative Q&A, architectural epic breakdown, and build tracking. Change requests are also supported after a build has started, with intelligence to fold changes into unstarted epics or create new ones as needed.

The tool is designed for non-technical business users — executives, department heads, and individual contributors — who need a friendly, jargon-free experience. For the IS Group, it brings consistency, transparency, and measurable cycle time data to a process that currently lacks all three.

## 2. Problem Statement
### Current Situation
The IS Group currently uses an intake form to receive requests from the business. While functional, these submissions are typically very high-level concepts that lack the detail needed to begin work. The IS team must conduct multiple rounds of follow-up conversations to flesh out actual requirements, which slows down the entire process and creates frustration on both sides. There are no good metrics on how long this cycle takes today.

### Proposed Solution
An AI-powered chatbot application that conducts a guided conversation with business users, asking smart follow-up questions to capture comprehensive requirements. The tool generates a structured PRD from the conversation, facilitates a review and Q&A cycle between the business and IS team, breaks approved requirements into buildable epics, and tracks progress through completion — including handling change requests mid-build.

## 3. Target Users
### Primary Users
- **Business Requesters**: Department heads, executives, and business users across the organization. Not tech-savvy. They need a friendly, conversational experience that doesn't require technical knowledge. They submit requests, answer follow-up questions, approve PRDs, and submit change requests.

### Secondary Users
- **IS Reviewers**: Members of the IS Group who review generated PRDs, ask clarifying questions, and ensure requirements are complete and actionable.
- **IS Engineers**: IS team members responsible for breaking approved PRDs into epics and managing the completion of those epics during the build phase.
- **Admins**: System administrators who manage users, roles, and system settings.

## 4. Scope
### In Scope (MVP)
- AI chatbot-guided intake conversation
- Automatic classification of requests as new application or feature enhancement
- PRD generation from chatbot conversation
- Business approval of PRD
- IS review with Q&A cycle back to business
- AI-assisted epic breakdown with engineer review and editing
- Status tracking across the full request lifecycle
- Change request process after build has started
- Role-based access control (Business Requester, IS Reviewer, IS Engineer, Admin)
- SSO authentication via Microsoft Entra
- Conversation auto-save at each interaction
- Full request history visible to all roles involved

### Out of Scope
- Email or push notifications (users will check the app)
- Integrations with external project management, ticketing, or other systems
- Detailed epic tracking (effort estimates, assignments, due dates)
- Customizable PRD prompt/template
- Data import or migration from existing intake form

## 5. Functional Requirements

### Chatbot-Guided Intake
- **[REQ-001]** As a Business Requester, I want to start a new intake request and be guided through a chatbot conversation so that I can describe what I need without knowing technical terminology
- **[REQ-002]** As a Business Requester, I want the chatbot to ask me smart follow-up questions based on my answers so that the requirements are thoroughly fleshed out
- **[REQ-003]** As a Business Requester, I want the chatbot to determine whether my request is for a new application or a feature enhancement so that it follows the appropriate workflow
- **[REQ-004]** As a Business Requester, I want to clarify which existing application my feature enhancement is for during the conversation so that the IS team knows what system is affected
- **[REQ-005]** As a Business Requester, I want my conversation to be saved after each interaction so that I can leave and pick up where I left off without losing progress

### PRD Generation & Approval
- **[REQ-006]** As a Business Requester, I want the chatbot to generate a structured PRD from our conversation so that I can review a clear summary of my requirements
- **[REQ-007]** As a Business Requester, I want to review and approve the generated PRD so that I can confirm it accurately captures what I'm asking for

### IS Review & Q&A Cycle
- **[REQ-008]** As an IS Reviewer, I want to view business-approved PRDs so that I can assess the requirements for completeness and feasibility
- **[REQ-009]** As an IS Reviewer, I want to add questions to a request so that I can capture everything that needs clarification
- **[REQ-010]** As an IS Reviewer, I want to send all accumulated questions back to the business user with one action so that the requester can see and respond to them
- **[REQ-011]** As a Business Requester, I want to see questions from the IS team and provide answers so that we can resolve any gaps in the requirements
- **[REQ-012]** As an IS Reviewer, I want to repeat the Q&A cycle as many times as necessary so that all questions are resolved before moving forward

### Epic Breakdown
- **[REQ-013]** As an IS Engineer, I want the AI to generate a suggested breakdown of the approved PRD into epics so that I have a starting point for planning
- **[REQ-014]** As an IS Engineer, I want to review, edit, add, and remove AI-suggested epics so that the breakdown accurately reflects how the work should be structured
- **[REQ-015]** As an IS Engineer, I want to approve the final epic breakdown so that the work can move into the build phase

### Status Tracking
- **[REQ-016]** As any user, I want to see the current status of a request so that I know where it stands in the process
- **[REQ-017]** As any user, I want to see the full history of a request including the chatbot conversation, PRD, Q&A exchanges, epic breakdown, and status changes so that I have complete transparency
- **[REQ-018]** As an IS Engineer, I want to update the status of individual epics (Not Started / In Progress / Complete) so that progress is visible to everyone

### Change Requests
- **[REQ-019]** As a Business Requester, I want to submit a change request on a project that is already in progress so that I can adjust requirements when business needs evolve
- **[REQ-020]** As a Business Requester, I want the change request to follow the same guided conversation and approval process as the original request so that changes are properly documented
- **[REQ-021]** As an IS Engineer, I want changes that only affect unstarted epics to be incorporated into those existing epics while preserving the original epic content in history so that unnecessary new work items are avoided and the change trail is maintained
- **[REQ-022]** As an IS Engineer, I want changes that affect already-started or completed epics to generate new epics so that the change in behavior is tracked separately

### User & Role Management
- **[REQ-023]** As an Admin, I want to manage users and assign roles so that the right people have access to the right capabilities
- **[REQ-024]** As an Admin, I want to assign multiple roles to a single user so that team members who wear multiple hats can perform all of their responsibilities
- **[REQ-025]** As any user, I want to log in using my Microsoft Entra SSO credentials so that I don't need a separate username and password

## 6. Business Rules
- **[BR-001]** A request must be classified as either "New Application" or "Feature Enhancement" during the intake conversation
- **[BR-002]** A PRD can only move to IS Review after the Business Requester has approved it
- **[BR-003]** The IS team's questions are not visible to the Business Requester until an IS Reviewer explicitly sends them back
- **[BR-004]** The Q&A cycle between IS Review and Business can repeat an unlimited number of times
- **[BR-005]** Epic breakdown can only occur after IS Review is complete (Epic Planning status)
- **[BR-006]** A request moves to "In Progress" only after the IS Engineer approves the epic breakdown
- **[BR-007]** Change requests that impact only "Not Started" epics should be folded into those existing epics while preserving the original epic content in history
- **[BR-008]** Change requests that impact "In Progress" or "Complete" epics must result in new epics being created
- **[BR-009]** Users can only perform actions permitted by their assigned role(s)
- **[BR-010]** A user may hold multiple roles simultaneously
- **[BR-011]** Chatbot conversations are auto-saved after each user interaction
- **[BR-012]** There is no limit to the number of change requests that can be submitted per project
- **[BR-013]** No additional approval gate exists between Epic Planning and In Progress beyond the IS Engineer's approval of the epic breakdown

## 7. Data & Reporting Requirements
### Data to Track
- Request details (requester, date submitted, classification, associated application for enhancements)
- Full chatbot conversation history
- Generated PRD content
- All Q&A exchanges between IS and business
- Status changes with timestamps
- Epic details (title, description, status) including historical versions when modified by change requests
- Change request history and associated epic modifications
- User roles and activity

### Reports & Dashboards
- Request status overview dashboard (all requests by current status)
- Cycle time tracking (time spent in each status, total time from submission to completion)
- Individual request detail view with full history
- Epic progress summary per request

## 8. Integration Requirements
- **Microsoft Entra**: SSO authentication for all users. No additional integrations required for MVP.

## 9. Non-Functional Requirements
- **Performance**: The chatbot should respond conversationally without noticeable delays — similar to a normal chat experience
- **Security**: Role-based access control enforced across all features; SSO via Microsoft Entra; no anonymous access
- **Availability**: Available during business hours at minimum; since users check the app on their own schedule, brief maintenance windows are acceptable
- **Scalability**: Low volume of requests expected; system should comfortably handle the current IS Group's workload with room for organic growth

## 10. Success Metrics
| Metric | Current Baseline | Target | Timeframe |
|--------|-----------------|--------|-----------|
| Cycle time from intake to approved PRD | Unknown (no current tracking) | Establish baseline, then reduce by 50% | 6 months after launch |
| Quality of initial requirements (follow-up rounds needed) | Multiple follow-up cycles typical | Reduce follow-up cycles by at least 50% | 3 months after launch |
| Percentage of requests with complete requirements at intake | Low (most require significant follow-up) | 75%+ of requests require ≤1 Q&A cycle | 6 months after launch |
| Business user satisfaction with intake process | No current measurement | Establish baseline via feedback | 3 months after launch |

## 11. Open Questions & Assumptions
### Open Questions
1. What specific questions or topic areas should the chatbot cover during intake for new applications vs. feature enhancements? Should these differ significantly?
2. How should "Complete" status be determined — when all epics are marked complete, does it require explicit sign-off, or both?

### Assumptions
1. The volume of intake requests is low enough that concurrent editing conflicts are not a concern for MVP
2. Users will check the application proactively for updates; no notification system is needed for MVP
3. Internet connectivity is reliable for all users; offline capability is not required
4. The AI chatbot will use a standard PRD template; customizable prompts are deferred to a future release
5. Epic tracking is limited to status only (Not Started / In Progress / Complete) for MVP; detailed project management features are deferred
6. The existing application list does not need to be maintained in the system; business users will identify applications by name during conversation
7. All roles can view the full history of any request they are involved with; no information is restricted by role
8. There is no limit to the number of change requests that can be submitted per project
9. When a change request is folded into an existing unstarted epic, the original epic content is preserved in history
10. A user can hold multiple roles simultaneously (e.g., IS Reviewer and IS Engineer)
11. No additional approval gate exists between Epic Planning and In Progress beyond the IS Engineer's approval of the epic breakdown

---
*This document was created with Product Intake. Review with stakeholders before development begins.*

---
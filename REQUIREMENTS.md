## Overview

An internal engagement-management tool where Peter and his clients (starting with Jess Rebelo) collaborate on and track client projects. This is a private, invite-only tool — not a public product, not something marketed or sold to the open market. It captures structured engagement data (requirements, decisions, status, outcome metrics) and enforces a data-use waiver before any client's data can be used across clients.

**Email-first by design.** Clients are not required to log in. A client signs up once (email + waiver), then can keep communicating by email as they already do. Their emails are captured and organized in the platform, where Peter works from them. Logging into the platform is optional for the client.

Full context, decisions, and rationale live in the Engagement Platform PRD (Word doc) and the AI Analysis Tool PRD — read both before starting.

## Visual Direction / Branding

This platform must use the same brand identity as the main carepracticestudio.com site, not a default/unbranded look:

- **Colors:** emerald green #065F46 (headings/primary), emerald/teal #10B981 (accent), black body text, white background.
- **Fonts:** Lato (headings/UI), Playfair Display (body copy) — same pairing as the main site.
- **UI pattern:** Linear-inspired interface (kanban/list views for tasks and projects), rebuilt in the above colors and fonts, not Linear's own color scheme. Peter will provide reference screenshots of the specific Linear views to model — request these if not yet provided rather than guessing at the layout.
- Applies everywhere a client or Peter sees the interface, including the branded magic-link emails (see the "Brand the Supabase project and magic-link emails" ticket) and the outbound reply emails.

## Tech Stack

- **Framework:** Next.js (App Router, TypeScript).
- **Backend/Database/Auth:** Supabase (Postgres, with `pgvector` enabled from the start — data will be vectorized in a later phase, so the schema should be designed with that migration path in mind, not retrofitted later). Use Supabase Auth for authentication (magic-link/invite-based, not public sign-up).
- **Hosting:** Vercel.
- **Domain:** platform.carepracticestudio.com. DNS is managed in Cloudflare (nameservers already point there); add a CNAME record pointing this subdomain to Vercel. Do not modify DNS records for the main carepracticestudio.com site except as required for email (below).
- **Email:** inbound and outbound email for `request@carepracticestudio.com` (see Email Requirements). The domain's email currently runs on Cloudflare Email Routing (`help@carepracticestudio.com` forwards to Peter's inbox). **That existing help@ forwarding must keep working unchanged.** Do not replace the domain's MX records in a way that breaks it. Choose an inbound approach that coexists with it (e.g. a Cloudflare Email Worker on the request@ address that both forwards to Peter's inbox and posts to the platform's webhook, or an inbound-email provider on a subdomain) and document the choice and why. Outbound uses a transactional email provider configured with SPF, DKIM, and DMARC for the domain.
- **Database access control:** Postgres Row Level Security (RLS) is mandatory for every table containing client or project data. Application-level checks alone are not sufficient — see the Waiver Gate and Visibility requirements below.

## Site Structure

- **Admin view (Peter):** all clients and projects, plus a header message icon with an unread count and a dropdown of new messages. Opening a message opens that client's page, which is a working canvas (see Admin Client Page).
- **Client area (optional for clients):** a per-client, invite-only login. If a client logs in they see a discussion board, their documents, and the tasks Peter has created. A client who never logs in still has their full engagement captured.
- No public-facing marketing pages on this subdomain — that content lives on the main site.

## Data Model

- **Clients**: one record per client (e.g. Jess Rebelo), with a `waiver_signed` boolean/timestamp field, and one or more **registered email addresses** used to verify inbound mail.
- **Projects**: one record per project, belonging to a client. A client can have multiple projects (e.g. Jess has a site-updates project and a possible custom-build project) — always separate project records under the same client, never merged.
- **Messages (email log)**: every inbound and outbound email, stored per client with sender, recipients, timestamp, subject, body, direction, and the headers needed for threading (`Message-ID`, `In-Reply-To`, `References`). Messages attach to a **client**; a project is assigned when a task is created from the message, not required up front.
- **Review queue**: inbound mail that could not be safely filed (unregistered sender, failed SPF/DKIM, client without a signed waiver). Held for Peter to approve, assign, or discard. Never auto-filed to a client record.
- **Tasks**: title, short description, status (`To do`, `In progress`, `Blocked`, `Completed`), expected completion date, belongs to a project, may reference the source message. Each task has its own comment thread (comments by Peter and, if logged in, the client).
- **Internal notes**: written by Peter, attached to a client (optionally a project). **Never visible to a client.**
- **Documents**: files attached to a client/project. Email attachments are filed here automatically. Clients can also upload files if they log in.
- **Per-project fields**: requirements and decisions (dated), start date, target/actual end date, outcome metric (baseline value + date, follow-up value + date), scope-change count, direction-change/variability count, deliverable count (planned vs. shipped).
- **Admin scratch workspace**: a persistent text area per client where Peter can paste or copy message content and work from it.
- No patient information, protected health information (PHI), or any patient-identifying data is ever stored. No schema field should be designed to hold it.

## Functional Requirements (Must-Have)

### Core

1. **Waiver gate, enforced at the database layer, not just in the application.** No project, task, message, document, or note data can be inserted for a client unless that client's `waiver_signed` field is true. Implement as a Postgres RLS policy (or equivalent database-level constraint) — it must be impossible to insert this data for a client who hasn't signed, even via a direct database query.
2. **Invite-only authentication.** No public sign-up. Clients are invited by Peter (magic link or equivalent), consistent with Supabase Auth's invite flow.
3. **Multi-project data model.** Each client can have multiple, separate project records. The UI must clearly distinguish between a client's projects — never merge their data into one view by default.
4. **Free-text warning rule.** No free-text field is shown to any client without a clear, visible warning not to include patient names or identifying details. Prefer structured fields over open text wherever possible. This applies to every text input a client can see or use: the discussion board, task comments, and upload descriptions. Outbound emails from the platform also carry the same warning line in the footer.
5. **Task-level collaboration threads**, one per task, not a single project-wide thread.
6. **Peter's admin view** shows all clients and their projects, with the standard metrics (below) visible per project.
7. **Standard metrics tracked for every project, regardless of type:** engagement duration (planned vs. actual), scope-change count, the outcome metric (baseline + follow-up, with dates), client satisfaction check-in at close, deliverable count (planned vs. shipped), and the variability/direction-change count.
8. **De-identified view for any future cross-client feature.** Cross-client analysis is out of scope for this build (see Non-Goals), but the schema must support a de-identified view (excluding client name, email, and other direct identifiers) from day one so it doesn't require a later migration. Do not build any feature that uses this view yet.

### Email Requirements (Slice A)

9. **Intake address.** Email sent to `request@carepracticestudio.com` must reach **both** Peter's company inbox (so his phone still alerts him, as today) **and** the platform.
10. **Sender verification.** An inbound email is filed to a client only if the sender matches one of that client's registered addresses **and** the message passes SPF/DKIM checks **and** that client's waiver is signed. Anything else goes to the review queue.
11. **Threading.** Replies are grouped into threads using `In-Reply-To`/`References`, so a back-and-forth reads as one conversation.
12. **Notification.** A message icon in the admin header shows an unread count. Its dropdown lists new messages as "New message from [sender email]". Clicking one opens that client's page and marks it read.
13. **Attachments.** Attachments are stored and linked to the message they arrived with and appear in the client's Documents section. Enforce a file-type allowlist, a maximum size, and a malware scan before a file becomes downloadable.
14. **Safe rendering.** Email bodies are sanitized before display (no script execution; remote images and content not loaded by default).

### Admin Client Page (Slice B)

15. **Canvas layout.** Opening a client shows a working canvas containing: the message view, the scratch workspace, the tasks list, internal notes, the email log, and the documents section.
16. **Tasks.** Peter can create tasks from message content: title, short description, status (`To do` / `In progress` / `Blocked` / `Completed`), and expected completion date. On creation, Peter assigns the task to one of the client's projects.
17. **Internal notes** are separate from tasks, attached to the client or a project, and never visible to the client.
18. **Email log.** Peter can view the full history of emails sent and received for the client, threaded.
19. **Reply.** Peter can reply to a client from inside the platform. The reply is sent from `request@carepracticestudio.com` as a normal email that continues the same thread. An optional template places Peter's message on top, followed by the client's current tasks and their statuses. The task list is toggled on or off per reply and includes **client-visible fields only**.

### Client Side (Slice C, optional for the client to use)

20. **Optional login.** Logging in is never required. A client who never logs in still has their full engagement captured.
21. **Discussion board.** A logged-in client can message Peter and see the back-and-forth history.
22. **Documents.** A logged-in client can review documents from their emails and upload new ones.
23. **Tasks and comments.** A logged-in client can see the tasks Peter has created and comment on them.
24. **Visibility is enforced in the database.** Client-role users can never read internal notes, review-queue items, or any record flagged internal — even via a direct query. This is verified the same way as the waiver gate.

## Build Slices

Build and demonstrate in this order. Each slice must meet its success criteria before the next begins.

- **Slice A — Inbound:** request@ intake to both inbox and platform, sender verification and review queue, threading, message icon and notification dropdown, attachment storage, email log storage. (Requirements 9–14)
- **Slice B — Admin canvas:** client page, scratch workspace, tasks, internal notes, documents section, reply with optional task-list template. (Requirements 15–19)
- **Slice C — Client side:** optional login, discussion board, document upload, task visibility and comments, visibility enforcement. (Requirements 20–24)

The core requirements (1–8) apply across all slices.

## Portability (vendor lock-in discipline)

Supabase and Vercel were chosen deliberately, but avoid deepening lock-in beyond what's necessary:

- Keep business logic in the Next.js application layer. Do not implement core logic as Supabase Edge Functions or other Supabase-proprietary compute — Supabase should be used as Postgres + Auth + storage, not as a place where app logic lives.
- Avoid Vercel-specific platform features (their KV store, Blob storage, Edge Config, platform-specific cron) unless there's a strong, specific reason. Prefer standard Next.js patterns that would run on any Node host.
- The inbound email handler is a normal webhook route in the Next.js app, not provider-specific logic. Keep file storage behind a thin interface so it can move off Supabase Storage.
- The database is standard Postgres with the pgvector extension — no Supabase-proprietary data formats. RLS policies are native Postgres and should be written as such.
- Document any point where a Supabase- or Vercel-specific feature is used and why, so a future migration has a clear list of what would need to change.

## Non-Goals (explicitly out of scope for this build)

- Cross-client comparison, analysis, or any feature that reads more than one client's data at once.
- **AI features on emails or messages** (summaries, task suggestions, draft replies) and any AI/sentiment analysis of collaboration text. These are separate, gated future tickets (see the AI Analysis Tool PRD). Build ingestion, organization, and manual reply first.
- HIPAA/PHI compliance work (BAA, required safeguards). It is planned as a separate major future update. Until then, no patient information is stored, and the client agreement and warnings say so.
- Payments.
- Public sign-up or any client-facing marketing content on this subdomain.
- Automated actions taken without Peter's review. Nothing is ever sent to a client automatically.

## Success Criteria (must be demonstrated, not asserted)

### Core

- [ ] A client cannot have project, task, message, document, or note data inserted unless `waiver_signed` is true — demonstrated by attempting the insert directly via the database (not just through the app UI) for a client with `waiver_signed = false`, and confirming the RLS policy itself rejects it.
- [ ] Jess can be invited, log in via the invite flow, and see only her own client record and projects — never another client's data (verify with a second dummy client to confirm isolation).
- [ ] A client with two separate projects (simulate this for Jess) sees them as distinct records, not merged.
- [ ] Every free-text input visible to a client displays the required warning text, verified by checking each such field individually, and outbound emails carry the warning line in the footer.
- [ ] Task-level comment threads are scoped to their individual task, not shared across a whole project.
- [ ] The standard metrics fields exist on the project schema and are visible in Peter's admin view.
- [ ] A de-identified view/query exists at the database level (client name, email, and other direct identifiers excluded) and returns correct results when tested, even though nothing in the app currently uses it.
- [ ] The site is live and reachable at platform.carepracticestudio.com, with Cloudflare DNS correctly pointing the subdomain to the Vercel deployment.
- [ ] The app's colors and fonts match the main site's brand identity (#065F46, #10B981, Lato, Playfair Display) — verified visually across every screen, not just the login page.
- [ ] pgvector is enabled on the Supabase database (confirmed via a test query), even though no vector data is populated yet.

### Slice A — Inbound

- [ ] An email sent to request@carepracticestudio.com from a registered client address arrives in Peter's company inbox **and** appears in the platform under the correct client — demonstrated with a real test email.
- [ ] `help@carepracticestudio.com` still forwards to Peter's inbox after the email changes — demonstrated with a real test email.
- [ ] An email from an unregistered address, or one failing SPF/DKIM, lands in the review queue and is not filed to any client.
- [ ] An email from a registered client whose waiver is **not** signed lands in the review queue, not the client record.
- [ ] A reply to an existing thread is grouped into the same thread.
- [ ] The header icon shows the correct unread count; the dropdown reads "New message from [sender email]"; clicking opens that client's page and clears the unread state.
- [ ] An email with an attachment stores the file and lists it in the Documents section; a disallowed file type, an oversized file, and a test malware file (e.g. the EICAR test string) are each rejected or quarantined.
- [ ] An email body containing script/HTML is displayed safely, with no script execution and no remote content loaded.

### Slice B — Admin canvas

- [ ] From an open message, Peter can create a task with title, description, status (all four statuses selectable), expected completion date, and project assignment.
- [ ] Internal notes can be created and are visible to Peter only.
- [ ] The email log shows the full threaded history for the client.
- [ ] A reply sent from the platform arrives in the client's inbox from request@carepracticestudio.com, continues the same thread, and includes the warning footer.
- [ ] The reply template's optional task list appears only when toggled on, and lists client-visible fields only.

### Slice C — Client side

- [ ] A client who has never logged in still has all their emails captured and organized.
- [ ] A logged-in client can message Peter on the board, see documents from their emails, upload a document, see the tasks Peter created, and comment on them.
- [ ] A client-role user cannot read internal notes or review-queue items — demonstrated by a direct database query as that role, not just by looking at the UI.

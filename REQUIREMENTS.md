# Requirements — platform.carepracticestudio.com (Engagement Platform)

## Overview

An internal engagement-management tool where Peter and his clients (starting with Jess Rebelo) collaborate on and track client projects. This is a private, invite-only tool — not a public product, not something marketed or sold to the open market. It captures structured engagement data (requirements, decisions, status, outcome metrics) and enforces a data-use waiver before any client's data can be used across clients.

Full context, decisions, and rationale live in the Engagement Platform PRD (Word doc) and the AI Analysis Tool PRD — read both before starting.

## Visual Direction / Branding

This platform must use the same brand identity as the main carepracticestudio.com site, not a default/unbranded look:

- **Colors:** emerald green #065F46 (headings/primary), emerald/teal #10B981 (accent), black body text, white background.
- **Fonts:** Lato (headings/UI), Playfair Display (body copy) — same pairing as the main site.
- **UI pattern:** Linear-inspired interface (kanban/list views for tasks and projects), rebuilt in the above colors and fonts, not Linear's own color scheme. Peter will provide reference screenshots of the specific Linear views to model — request these if not yet provided rather than guessing at the layout.
- Applies everywhere a client or Peter sees the interface, including the branded magic-link emails (see the "Brand the Supabase project and magic-link emails" ticket).

## Tech Stack

- **Framework:** Next.js (App Router, TypeScript).
- **Backend/Database/Auth:** Supabase (Postgres, with `pgvector` enabled from the start — data will be vectorized in a later phase, so the schema should be designed with that migration path in mind, not retrofitted later). Use Supabase Auth for authentication (magic-link/invite-based, not public sign-up).
- **Hosting:** Vercel.
- **Domain:** platform.carepracticestudio.com. DNS is managed in Cloudflare (nameservers already point there); add a CNAME record pointing this subdomain to Vercel. Do not modify DNS records for the main carepracticestudio.com site.
- **Database access control:** Postgres Row Level Security (RLS) is mandatory for every table containing client or project data. Application-level checks alone are not sufficient — see the Waiver Gate requirement below.

## Site Structure

- Authenticated client area (per-client, invite-only login).
- Peter's admin view (all clients, all projects).
- No public-facing marketing pages on this subdomain — that content lives on the main site.

## Data Model

- **Clients**: one record per client (e.g. Jess Rebelo), with a `waiver_signed` boolean/timestamp field.
- **Projects**: one record per project, belonging to a client. A client can have multiple projects (e.g. Jess has a site-updates project and a possible custom-build project) — these are always separate project records under the same client, never merged.
- **Per-project fields**: requirements and decisions (dated), status/tasks, start date, target/actual end date, outcome metric (baseline value + date, follow-up value + date), scope-change count, direction-change/variability count, deliverable count (planned vs. shipped).
- **Task-level collaboration**: each task has its own comment/discussion thread (not one project-wide thread).
- No patient information, protected health information (PHI), or any patient-identifying data is ever stored. No schema field should be designed to hold it.

## Functional Requirements (Must-Have)

1. **Waiver gate, enforced at the database layer, not just in the application.** A client record cannot have any project created, and no project data can be inserted, unless that client's `waiver_signed` field is true. Implement this as a Postgres RLS policy (or equivalent database-level constraint) — it must be impossible to insert project data for a client who hasn't signed, even via a direct database query, not just through the app's UI.
2. **Invite-only authentication.** No public sign-up. Clients are invited by Peter (magic link or equivalent), consistent with Supabase Auth's invite flow.
3. **Multi-project data model.** Each client can have multiple, separate project records. The UI must clearly distinguish between a client's different projects — never merge their data into one view by default.
4. **No free-text field is shown to any client without a clear, visible warning not to include patient names or any identifying details.** Prefer structured fields (dropdowns, short labeled inputs) over open text wherever the same information can be captured that way. This applies to every text input a client can see or use, including the task-level comment threads.
5. **Task-level collaboration threads**, one per task, not a single project-wide thread.
6. **Peter's admin view** shows all clients and all their projects, with the standard metrics (below) visible per project.
7. **Standard metrics tracked for every project, regardless of type:** engagement duration (planned vs. actual), scope-change count, the outcome metric (baseline + follow-up, with dates), client satisfaction check-in at close, deliverable count (planned vs. shipped), and the variability/direction-change count.
8. **De-identified view for any future cross-client feature.** Even though cross-client analysis is out of scope for this build (see Non-Goals), the database schema must support a de-identified view (a query/view that excludes client name, email, and other direct identifiers) from day one, so this doesn't require a schema migration later. Do not build any feature that uses this view yet — just ensure the view can exist cleanly.

## Portability (vendor lock-in discipline)

Supabase and Vercel were chosen deliberately, but avoid deepening lock-in beyond what's necessary:

- Keep business logic in the Next.js application layer. Do not implement core logic as Supabase Edge Functions or other Supabase-proprietary compute — Supabase should be used as Postgres + Auth + storage, not as a place where app logic lives.
- Avoid Vercel-specific platform features (their KV store, Blob storage, Edge Config, platform-specific cron) unless there's a strong, specific reason. Prefer standard Next.js patterns that would run on any Node host.
- The database is standard Postgres with the pgvector extension — no Supabase-proprietary data formats. RLS policies are native Postgres and should be written as such.
- Document any point where a Supabase- or Vercel-specific feature is used and why, so a future migration has a clear list of what would need to change.

## Non-Goals (explicitly out of scope for this build)

- Cross-client comparison, analysis, or any feature that reads more than one client's data at once.
- Any AI/sentiment analysis of collaboration text (this is a separate, gated future project — see the AI Analysis Tool PRD).
- Payments.
- Public sign-up or any client-facing marketing content on this subdomain.
- Automated actions taken without Peter's review.

## Success Criteria (must be demonstrated, not asserted)

- [ ] A client cannot be created with any project data attached unless `waiver_signed` is true — demonstrated by attempting to insert project data directly via the database (not just through the app UI) for a client with `waiver_signed = false`, and confirming it is rejected by the RLS policy itself.
- [ ] Jess can be invited, log in via the invite flow, and see only her own client record and projects — never another client's data (verify this once a second test client exists, even a dummy one, to confirm isolation).
- [ ] A client with two separate projects (simulate this for Jess) sees them as distinct records, not merged.
- [ ] Every free-text input visible to a client displays the required warning text, verified by checking each such field individually, not sampling one and assuming the rest match.
- [ ] Task-level comment threads are scoped to their individual task, not shared across a whole project.
- [ ] The standard metrics fields exist on the project schema and are visible in Peter's admin view.
- [ ] A de-identified view/query exists at the database level (client name, email, and other direct identifiers excluded) and returns correct results when tested, even though nothing in the app currently uses it.
- [ ] The site is live and reachable at platform.carepracticestudio.com, with Cloudflare DNS correctly pointing the subdomain to the Vercel deployment.
- [ ] The app's colors and fonts match the main site's brand identity (#065F46, #10B981, Lato, Playfair Display) — verified visually across every screen, not just the login page.
- [ ] pgvector is enabled on the Supabase database (confirmed via a test query), even though no vector data is populated yet.

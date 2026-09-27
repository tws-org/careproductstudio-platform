# Process

You should follow this process to build the entire project:

1. Read everything first: REQUIREMENTS.md (success criteria are the contract), SELF_IMPROVE.md, README.md, .devcontainer/ (ports, installed tools), and any skills available to you.
2. Build the entire project as documented in REQUIREMENTS.md, phase by phase.
3. Ensure all success criteria are met — demonstrated, not asserted.
4. Use your product_review subagent to check the final product.
5. Incorporate the review feedback (fix real issues; consciously skip out-of-scope nice-to-haves).
6. IMPORTANT: follow the instructions in SELF_IMPROVE.md to improve yourself.

You must complete step 6 (self-improvement) before you stop.

## Context

This is the Care Practice Studio Engagement Platform, an internal tool for running client engagements (deployed at platform.carepracticestudio.com, a subdomain of the already-live marketing site). It is separate from, and has a different tech stack than, the main marketing site — do not reuse or reference the Astro site's codebase.

## Build Phases & Progress

### Phase 1: Project Scaffolding & Configuration — COMPLETE
- [x] Next.js project initialized with TypeScript, Tailwind CSS
- [x] Supabase SSR client libraries (browser + server)
- [x] Auth utilities (getCurrentUser, requireAuth, requireAdmin)
- [x] Middleware for route protection (/admin, /client)
- [x] Environment configuration template (.env.example)

### Phase 2: Database Schema with RLS — COMPLETE
- [x] pgvector extension enabled
- [x] Clients table (with waiver_signed, waiver_signed_at)
- [x] Projects table (all metrics: duration, scope changes, direction changes, deliverables, outcome metrics, satisfaction check-in)
- [x] Tasks table (status, due date, per-project)
- [x] Comments table (task-level threads)
- [x] De-identified view (deidentified_projects) — excludes client name/email
- [x] RLS enabled on all tables
- [x] Waiver gate RLS policy on projects INSERT
- [x] Users can only see their own client/projects/tasks/comments
- [x] Indexes on foreign keys
- [x] Updated_at triggers

### Phase 3: Client-Facing Application — COMPLETE
- [x] Login page with magic link (invite-only, no public sign-up)
- [x] Auth callback route (exchange code for session)
- [x] Client dashboard — lists user's projects (only their own via RLS)
- [x] Project detail page — tasks with per-task comment threads
- [x] WarningText component — shown on ALL client-facing free-text fields (comment inputs)
- [x] Task-level comments scoped to individual tasks (not project-wide)
- [x] Client can never see another client's data (RLS enforced)
- [x] Multi-project support — projects shown as distinct records

### Phase 4: Admin (Peter's) View — COMPLETE
- [x] Admin layout with navigation
- [x] Admin dashboard — all clients, all projects with standard metrics
- [x] Admin clients page — manage clients and waiver status
- [x] Admin projects page — all projects with full metrics table
- [x] Admin access controlled by ADMIN_EMAIL env var + middleware

### Phase 5: Verification & Deployment — IN PROGRESS
- [x] Install dependencies and verify build compiles
- [x] User provides Supabase credentials
- [x] Database migration applied to Supabase (001_initial schema)
- [x] Environment variables configured
- [x] Build passes with no errors
- [x] Deploy to Vercel
- [x] Cloudflare DNS CNAME record for platform.carepracticestudio.com
- [x] SSL certificate provisioned
- [x] Brand identity applied (emerald colors, Lato + Playfair Display)
- [x] Admin management pages (Manage Admins, Create Client)
- [x] Forced password change flow for new clients
- [x] Committed and pushed to git
- [ ] Migration 002 (admins table) applied
- [ ] Migration 003 (must_change_password) applied
- [ ] Test data inserted (Brian Fallon client, projects, tasks, comments)
- [ ] Verify all success criteria (see below)

## Success Criteria Verification Checklist

- [ ] Waiver gate: RLS policy prevents project insert for clients with waiver_signed=false (enforced at DB layer, not just app)
- [ ] Client isolation: Jess sees only her data, never another client's (verified with second test client)
- [ ] Multi-project: Client with two separate projects sees them as distinct records
- [ ] Free-text warnings: Every client-facing free-text input displays the PHI warning (WarningText component on all comment inputs)
- [ ] Task-level threads: Comments scoped to individual tasks, not shared project-wide
- [ ] Standard metrics: All metric fields exist on project schema and visible in admin view
- [ ] De-identified view: deidentified_projects view exists and returns correct results
- [ ] Site live at platform.carepracticestudio.com with Cloudflare DNS → Vercel
- [ ] pgvector enabled on Supabase (confirmed via test query)

## Notes for the product_review subagent

Pay special attention to the waiver-gate requirement in REQUIREMENTS.md. This must be verified as an actual enforced database rule (Row Level Security or equivalent), not merely an application-level check that could be bypassed by a direct database query. Also verify no free-text field is ever rendered to a client without its required warning label — check every client-facing text input, not just the ones mentioned by name in REQUIREMENTS.md.

When reviewing, check against REQUIREMENTS.md's Success Criteria section item by item. A criterion is only satisfied if it can be demonstrated, not because the relevant code exists somewhere in the repo.

## Self-Improvement Log

### 2026-09-26 — Initial build
- Built complete Next.js + Supabase engagement platform
- Key learning: RLS policies on Supabase require careful attention to the auth.jwt() claims — email must be available in the JWT for client identification
- Key learning: The de-identified view should be created in the initial migration, not added later, to satisfy the success criteria
- Key learning: Task-level comment threads require a separate comments table with task_id FK, not a project-level comments field
- Key learning: When providing SQL to users, always include LIMIT 1 in subqueries to prevent "more than one row" errors from duplicate data
- Key learning: Test for CHECK constraint violations before providing INSERT statements — verify allowed enum values match the data being inserted
- Key learning: When users run SQL manually, provide queries one at a time rather as a single batch to make debugging easier
- Key learning: Duplicate data is a common issue when users run INSERT statements multiple times after failures — always provide cleanup/fix SQL alongside the original
- Key learning: MIN() does not work on UUID columns in Postgres — use DISTINCT ON with ORDER BY instead
- Key learning: When subqueries return no results, fall back to direct UUID-based INSERTs with step-by-step diagnostic queries
- Key learning: Duplicate cleanup queries can accidentally delete all rows instead of keeping one — always verify with a SELECT before running DELETE
- Key learning: When a subquery-based INSERT fails, break it into smaller steps: first SELECT the IDs, then INSERT using those IDs directly
- Key learning: Always verify that referenced data exists before writing INSERT statements with foreign key dependencies
- Key learning: When a subquery-based INSERT fails, break it into smaller steps: first SELECT the IDs, then INSERT using those IDs directly
- Key learning: Always verify that referenced data exists before writing INSERT statements with foreign key dependencies

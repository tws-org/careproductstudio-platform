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

### Phase 5: Verification & Deployment — PENDING
- [ ] Install dependencies and verify build compiles
- [ ] User provides Supabase credentials
- [ ] Database migration applied to Supabase
- [ ] Environment variables configured
- [ ] Build passes with no errors
- [ ] Deploy to Vercel
- [ ] Cloudflare DNS CNAME record for platform.carepracticestudio.com
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

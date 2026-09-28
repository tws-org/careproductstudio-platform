# Care Practice Studio — Engagement Platform

Internal engagement-management platform for tracking client projects, tasks, and collaboration. Deployed at `platform.carepracticestudio.com`.

## Tech Stack

- **Framework:** Next.js 14 (App Router, TypeScript)
- **Backend/Database/Auth:** Supabase (Postgres + Auth + pgvector)
- **Hosting:** Vercel
- **Styling:** Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (with pgvector enabled)

### Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ADMIN_EMAIL=peter@yourdomain.com
```

### Database Setup

Apply the migration in `supabase/migrations/001_initial_schema.sql` to your Supabase project via the Supabase SQL editor or CLI.

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
supabase/migrations/    # Database schema with RLS policies
src/
  app/
    admin/              # Peter's admin dashboard (all clients/projects)
    client/             # Client-facing pages (own projects only)
    login/              # Magic-link login page
    auth/callback/      # Auth callback route
  components/           # React components (TaskCard, WarningText)
  lib/                  # Supabase clients, auth utilities, types
  middleware.ts         # Route protection (admin/client)
```

## Key Features

- **Waiver gate** — enforced at the database layer via RLS; no project data can be inserted for a client who hasn't signed
- **Invite-only auth** — no public sign-up; clients receive magic links
- **Multi-project** — each client can have multiple separate project records
- **Task-level comments** — each task has its own discussion thread
- **PHI warnings** — every client-facing free-text field displays a warning about patient data
- **De-identified view** — `deidentified_projects` view exists for future cross-client analysis
- **pgvector enabled** — ready for future vectorization phase
- **Email-first intake** — client email to `request@carepracticestudio.com` is captured in the platform and forwarded to Peter's inbox; sender verification + review queue; threaded message log; attachment scanning

## Slice A Setup (email intake) — manual steps

The platform side is built. These steps wire up email (Cloudflare, keys,
migration). **Do them in order; the platform pauses here until they're done.**

1. **Supabase — apply migration 004.** In the Supabase dashboard SQL editor, run
   the contents of `supabase/migrations/004_email_intake.sql` (creates
   `client_email_addresses`, `messages`, `review_queue`, `documents`, the
   `documents` storage bucket, RLS policies, indexes).
2. **Supabase — copy the service role key.** Project Settings → API →
   `service_role` (secret). Add it as `SUPABASE_SERVICE_ROLE_KEY` to:
   - Vercel → project → Settings → Environment Variables
   - your local `.env.local`
3. **Add the webhook secret.** Generate one value and use it in **both** places:
   - `EMAIL_WEBHOOK_SECRET` in Vercel env vars (and `.env.local`).
     A value has already been generated for this project:
     `2eae78141b0195425d9c0d98b1e6c9b0095df1e2e05ca3921c3aa0ce8427e566`
     (reuse it, or generate a fresh one with `openssl rand -hex 32` — just keep
     both sides in sync).
   - The Worker secret (step 5).
4. **Redeploy the Vercel app** (git push, or dashboard redeploy) so the new env
   vars take effect. Verify: `curl https://platform.carepracticestudio.com/api/email/inbound -X POST`
   should return `401 Unauthorized` (endpoint live, signature required).
5. **Deploy the Email Worker** (Cloudflare). Two options:
   - **Wrangler CLI** (recommended — creates the routing rule automatically):
     ```bash
     cd email-worker
     npm install
     npx wrangler secret put INBOUND_WEBHOOK_URL     # https://platform.carepracticestudio.com/api/email/inbound
     npx wrangler secret put INBOUND_WEBHOOK_SECRET  # same value as step 3
     npx wrangler secret put FORWARD_TO              # Peter's inbox address (the verified Email Routing destination that help@ forwards to)
     npx wrangler deploy
     ```
     `wrangler.toml` already lists `addresses = ["request@carepracticestudio.com"]`,
     so deploy creates the "Send to a Worker" rule for that address.
   - **Dashboard:** create a Worker, paste `email-worker/src/index.ts`, add the
     `postal-mime` dependency, set the three secrets above as Worker secrets,
     add the `email` handler binding, then in **Compute → Email Service → Email
     Routing → Routing Rules** create rule `request` @ `carepracticestudio.com`
     with Action = "Send to a Worker".
6. **Verify the routing rule is active** (dashboard → Email Routing). Note: rules
   stay disabled until the destination is verified — Peter's inbox address is
   already a verified destination (help@ forwards there), so this is done.
7. **Tell the platform you're done** — it will run the automated webhook test
   suite, then the real-email tests (send a real email to `request@` from a
   registered client address; confirm it lands in Peter's inbox AND the
   platform; send a real email to `help@` and confirm forwarding still works).

Full design notes: [EMAIL_INTAKE.md](EMAIL_INTAKE.md).
Automated tests: `npx tsx scripts/test-inbound.ts`

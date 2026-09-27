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

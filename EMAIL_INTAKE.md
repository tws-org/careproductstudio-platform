# Email Intake — Slice A Design & Operations

## Inbound approach (the documented choice)

**Cloudflare Email Routing rule `request@carepracticestudio.com` → "Send to a Worker" → Email Worker → platform webhook.**

Flow:

```
client → request@carepracticestudio.com
          ↓ Cloudflare MX (unchanged — Email Routing already handles the domain)
          ↓ Routing rule: "Send to a Worker"  (no DNS/MX change; help@ rule untouched)
          ↓
     Email Worker (email-worker/src/index.ts)
          ├─(1) message.forward(Peter's inbox)   ← his phone keeps alerting, as today
          └─(2) POST parsed email → https://platform.carepracticestudio.com/api/email/inbound
                    (HMAC-SHA256 signed with EMAIL_WEBHOOK_SECRET)
          ↓
     Platform webhook (/api/email/inbound)
          ├─ verify HMAC signature
          ├─ sender registered to a client?  (client_email_addresses)
          ├─ SPF + DKIM pass?                (Authentication-Results header)
          ├─ client waiver signed?
          ├─ ALL PASS → file to messages (threaded), attachments → documents
          └─ ANY FAIL → review_queue (never auto-filed)
```

### Why this approach

- **Coexists with the existing setup.** The domain already uses Cloudflare Email
  Routing (`help@` forwards to Peter's inbox). Adding a `request@` rule with the
  "Send to a Worker" action requires **no DNS, MX, or email-routing changes** —
  the `help@` rule keeps working exactly as before.
- **Peter's inbox is not bypassed.** The worker forwards every message to his
  verified destination address first, so his phone alerts keep working even if
  the platform is down. Nothing the client sends gets lost.
- **The platform stays portable.** The inbound handler is a normal Next.js
  route (`/api/email/inbound`), not provider-specific logic. The worker is a
  thin transport: parse MIME, forward, POST. All business logic (verification,
  filing, threading, attachment scanning) lives in the app layer, per the
  portability rules in REQUIREMENTS.md.
- **Full MIME access.** The worker sees headers (Message-ID, In-Reply-To,
  References, Authentication-Results, DKIM-Signature), bodies, and attachments —
  everything needed for threading, verification, and safe filing.

### SPF/DKIM verification

Cloudflare Email Routing checks inbound mail and stamps `Authentication-Results`
headers on the message. The worker forwards those headers to the webhook,
which requires `spf=pass` **and** `dkim=pass`. **Fail closed:** if no
Authentication-Results header is present, the message is held for review.

### Outbound email (Slice B, later)

Platform replies (Requirement 19) will use a transactional email provider
configured with SPF/DKIM/DMARC for the domain. That is a separate manual step
(provider account + DNS records) and is **not** part of Slice A. The worker's
forward in Slice A is inbound routing, not platform outbound.

## Attachment pipeline (Requirement 13)

Every attachment goes through, in order:

1. **Size limit** — `MAX_ATTACHMENT_MB` (default 3 MB; constrained by Vercel's
   4.5 MB serverless request-body limit since attachments travel base64-encoded
   in the webhook payload). Oversized → `rejected`, not stored.
2. **Type allowlist** — extension + MIME must match (pdf, txt, csv, md, rtf,
   doc/docx, xls/xlsx, ppt/pptx, png/jpg/jpeg/gif). Anything else → `rejected`.
3. **Malware scan** — signature scan (EICAR test string, MZ executable header,
   script shebang) always on; ClamAV via `CLAMAV_HOST` when configured.
   Detected → `quarantined` (stored under `quarantine/`, never downloadable).
4. Clean → stored under `{client_id}/`, downloadable via signed URL.

## Data model (migration 004)

- `client_email_addresses` — registered sender addresses per client
- `messages` — email log (inbound + outbound), threading headers, `is_read`
- `review_queue` — held mail with reason; **no client-role RLS policies**
  (clients can never read it, even via direct query — Slice C criterion 24)
- `documents` — files incl. email attachments, with `scan_status`
- Storage bucket `documents` (private; signed URLs)

## Manual setup steps (do these once)

See README → "Slice A setup" for the numbered list. In short:

1. Run `supabase/migrations/004_email_intake.sql` in the Supabase SQL editor.
2. Add env vars to Vercel + `.env.local`: `SUPABASE_SERVICE_ROLE_KEY`,
   `EMAIL_WEBHOOK_SECRET` (generated), `MAX_ATTACHMENT_MB`.
3. Deploy the Email Worker (`email-worker/`) and set its secrets.
4. The worker's `wrangler.toml` creates the `request@` routing rule on deploy
   (or create it manually in the Cloudflare dashboard).
5. Redeploy the Vercel app so the new env vars take effect.

## Testing

- `npx tsx scripts/test-inbound.ts` — full webhook scenario suite (filing,
  review queue, threading, attachments, EICAR, sanitization, HMAC).
- Real-email tests: send to `request@` from a registered address (must arrive
  in Peter's inbox AND the platform), send to `help@` (must still forward).

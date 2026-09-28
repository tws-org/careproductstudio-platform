/**
 * Slice A — inbound email intake test suite.
 *
 * Runs real HTTP calls against the webhook and verifies results against
 * the real database. Does not assert — every scenario checks actual
 * state (message filed or not, review queue rows, documents, threads,
 * unread flags).
 *
 * Usage:
 *   npx tsx scripts/test-inbound.ts
 *
 * Env (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   EMAIL_WEBHOOK_SECRET, WEBHOOK_URL (optional, defaults to production)
 */
import { createHmac, randomUUID } from "crypto";
import { resolve } from "path";
import { sanitizeEmailHtml } from "../src/lib/email-sanitize";

// Load .env.local when running outside Next.js (tsx does not load it).
try {
  (process as any).loadEnvFile(resolve(process.cwd(), ".env.local"));
} catch {
  /* no .env.local — rely on the shell environment */
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SECRET = process.env.EMAIL_WEBHOOK_SECRET || "";
const WEBHOOK_URL =
  process.env.WEBHOOK_URL ||
  "https://platform.carepracticestudio.com/api/email/inbound";

const TEST_CLIENT_A = "Email Test Client"; // waiver signed, registered
const TEST_CLIENT_B = "Waiver Pending Test Client"; // waiver NOT signed
const ADDR_A = "tester-a@example.com";
const ADDR_B = "tester-b@example.com";

const EICAR =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    failures.push(name + (detail ? ` — ${detail}` : ""));
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const headers = () => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
});

async function dbSelect<T = any>(table: string, query: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`DB select ${table} failed: ${await res.text()}`);
  return res.json();
}

async function dbInsert(table: string, row: unknown): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`DB insert ${table} failed: ${await res.text()}`);
  return res.json();
}

async function dbDelete(table: string, query: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: headers(),
  });
}

async function sendWebhook(payload: object): Promise<any> {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", SECRET).update(body).digest("hex");
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Signature": `sha256=${signature}`,
    },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body: json, text };
}

function emailPayload(overrides: Record<string, unknown>): any {
  return {
    from: ADDR_A,
    envelope_from: ADDR_A,
    to: "request@carepracticestudio.com",
    subject: `Test ${new Date().toISOString()}`,
    date: new Date().toISOString(),
    headers: {
      "message-id": `<${randomUUID()}@example.com>`,
      "authentication-results":
        "mx.google.com; spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com",
    },
    text: "Hello from the test suite.",
    html: "<p>Hello from the test suite.</p>",
    attachments: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
async function setup() {
  console.log("\n== Setup: test clients ==");
  // Clean previous run (scoped to test data only)
  const oldA = await dbSelect<{ id: string }>(
    "clients",
    `select=id&name=eq.${encodeURIComponent(TEST_CLIENT_A)}`
  );
  const oldB = await dbSelect<{ id: string }>(
    "clients",
    `select=id&name=eq.${encodeURIComponent(TEST_CLIENT_B)}`
  );
  for (const c of [...oldA, ...oldB]) {
    await dbDelete("client_email_addresses", `client_id=eq.${c.id}`);
    await dbDelete("documents", `client_id=eq.${c.id}`);
    await dbDelete("messages", `client_id=eq.${c.id}`);
    await dbDelete("clients", `id=eq.${c.id}`);
  }
  // Review items created by earlier test runs (identifiable by sender)
  await dbDelete("review_queue", `sender=in.(${ADDR_A},${ADDR_B},not-registered@example.com)`);

  const [clientA] = await dbInsert("clients", [
    {
      name: TEST_CLIENT_A,
      email: "etest-contact@example.com",
      waiver_signed: true,
      waiver_signed_at: new Date().toISOString(),
      must_change_password: false,
    },
  ]);
  const [clientB] = await dbInsert("clients", [
    {
      name: TEST_CLIENT_B,
      email: "wtest-contact@example.com",
      waiver_signed: false,
      waiver_signed_at: null,
      must_change_password: false,
    },
  ]);
  await dbInsert("client_email_addresses", [
    { client_id: clientA.id, email: ADDR_A },
    { client_id: clientB.id, email: ADDR_B },
  ]);
  console.log(`  Client A (waiver signed): ${clientA.id}`);
  console.log(`  Client B (waiver NOT signed): ${clientB.id}`);
  return { clientA: clientA.id, clientB: clientB.id };
}

// ---------------------------------------------------------------------------
async function main() {
  if (!SERVICE_KEY || !SECRET) {
    console.error(
      "SUPABASE_SERVICE_ROLE_KEY and EMAIL_WEBHOOK_SECRET are required. Add them to .env.local and Vercel."
    );
    process.exit(1);
  }

  const { clientA, clientB } = await setup();

  // --- 1. Happy path: registered sender, waiver signed, SPF/DKIM pass ---
  console.log("\n== 1. Registered sender + waiver signed + SPF/DKIM pass → filed ==");
  const p1 = emailPayload({});
  const r1 = await sendWebhook(p1);
  check("webhook returns filed=true", r1.body?.filed === true, JSON.stringify(r1.body));
  const msg1 = await dbSelect<any>(
    "messages",
    `select=*&client_id=eq.${clientA}&sender=eq.${encodeURIComponent(ADDR_A)}&order=created_at.desc&limit=1`
  );
  check("message filed to client A", msg1.length === 1);
  const message1Id = r1.body?.message_id;
  check("message has thread_id (its own Message-ID)", !!msg1[0]?.thread_id);

  // --- 2. Reply threads into the same conversation ---
  console.log("\n== 2. Reply with In-Reply-To → same thread ==");
  const p2 = emailPayload({
    subject: `Re: ${p1.subject}`,
    headers: {
      "message-id": `<${randomUUID()}@example.com>`,
      "in-reply-to": p1.headers["message-id"],
      references: p1.headers["message-id"],
      "authentication-results":
        "mx.google.com; spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com",
    },
  });
  const r2 = await sendWebhook(p2);
  check("reply filed", r2.body?.filed === true, JSON.stringify(r2.body));
  const msg2 = await dbSelect<any>(
    "messages",
    `select=*&id=eq.${r2.body?.message_id}`
  );
  check(
    "reply shares thread_id with original",
    msg2[0]?.thread_id === msg1[0]?.thread_id,
    `reply thread=${msg2[0]?.thread_id} original thread=${msg1[0]?.thread_id}`
  );
  check("original and reply are 2 distinct messages in DB", msg1.length === 1 && msg2.length === 1);

  // --- 3. Unregistered sender → review queue ---
  console.log("\n== 3. Unregistered sender → review queue ==");
  const p3 = emailPayload({ from: "not-registered@example.com", envelope_from: "not-registered@example.com" });
  const r3 = await sendWebhook(p3);
  check("webhook returns filed=false", r3.body?.filed === false, JSON.stringify(r3.body));
  check("reason mentions unregistered sender", (r3.body?.reason || "").includes("unregistered sender"), r3.body?.reason);
  const review3 = await dbSelect<any>("review_queue", `select=*&id=eq.${r3.body?.review_id}`);
  check("review queue row exists with status pending", review3[0]?.status === "pending");
  const filed3 = await dbSelect<any>(
    "messages",
    `select=*&sender=eq.${encodeURIComponent("not-registered@example.com")}`
  );
  check("no message filed for unregistered sender", filed3.length === 0);

  // --- 4. SPF failure → review queue ---
  console.log("\n== 4. SPF fail → review queue ==");
  const p4 = emailPayload({
    headers: {
      "message-id": `<${randomUUID()}@example.com>`,
      "authentication-results": "mx.google.com; spf=fail smtp.mailfrom=example.com; dkim=pass header.d=example.com",
    },
  });
  const r4 = await sendWebhook(p4);
  check("SPF fail → filed=false", r4.body?.filed === false, JSON.stringify(r4.body));
  check("reason mentions SPF", (r4.body?.reason || "").includes("SPF"), r4.body?.reason);

  // --- 5. DKIM failure → review queue ---
  console.log("\n== 5. DKIM fail → review queue ==");
  const p5 = emailPayload({
    headers: {
      "message-id": `<${randomUUID()}@example.com>`,
      "authentication-results": "mx.google.com; spf=pass smtp.mailfrom=example.com; dkim=fail header.d=example.com",
    },
  });
  const r5 = await sendWebhook(p5);
  check("DKIM fail → filed=false", r5.body?.filed === false, JSON.stringify(r5.body));
  check("reason mentions DKIM", (r5.body?.reason || "").includes("DKIM"), r5.body?.reason);

  // --- 6. Registered sender, waiver NOT signed → review queue ---
  console.log("\n== 6. Waiver not signed → review queue ==");
  const p6 = emailPayload({ from: ADDR_B, envelope_from: ADDR_B });
  const r6 = await sendWebhook(p6);
  check("waiver-not-signed → filed=false", r6.body?.filed === false, JSON.stringify(r6.body));
  check("reason mentions waiver", (r6.body?.reason || "").includes("waiver"), r6.body?.reason);
  const filed6 = await dbSelect<any>("messages", `select=*&client_id=eq.${clientB}`);
  check("nothing filed to client B", filed6.length === 0);

  // --- 7. Allowed attachment → stored + listed as document ---
  console.log("\n== 7. Allowed attachment (.txt) → stored, scan clean ==");
  const p7 = emailPayload({
    attachments: [
      {
        filename: "notes.txt",
        content_type: "text/plain",
        size: 11,
        data_base64: Buffer.from("hello world").toString("base64"),
      },
    ],
  });
  const r7 = await sendWebhook(p7);
  check("filed with attachment", r7.body?.filed === true, JSON.stringify(r7.body));
  const doc7 = await dbSelect<any>(
    "documents",
    `select=*&message_id=eq.${r7.body?.message_id}`
  );
  check("document row created", doc7.length === 1);
  check("document scan_status=clean", doc7[0]?.scan_status === "clean");
  check("document has storage_path", !!doc7[0]?.storage_path);
  // Verify the file is actually in storage and downloadable
  if (doc7[0]?.storage_path) {
    const obj = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${doc7[0].storage_path}`,
      { headers: headers() }
    );
    check(
      "file exists in storage with correct content",
      obj.ok && (await obj.text()) === "hello world"
    );
  }

  // --- 8. Disallowed file type → rejected ---
  console.log("\n== 8. Disallowed attachment (.exe) → rejected ==");
  const p8 = emailPayload({
    attachments: [
      {
        filename: "evil.exe",
        content_type: "application/octet-stream",
        size: 4,
        data_base64: Buffer.from("MZxx").toString("base64"),
      },
    ],
  });
  const r8 = await sendWebhook(p8);
  const doc8 = await dbSelect<any>("documents", `select=*&message_id=eq.${r8.body?.message_id}`);
  check("rejected document row exists", doc8.length === 1);
  check("scan_status=rejected", doc8[0]?.scan_status === "rejected");
  check("reason = file type not allowed", (doc8[0]?.rejection_reason || "").includes("File type"));
  check("no storage_path for rejected file", !doc8[0]?.storage_path);

  // --- 9. Oversized attachment → rejected ---
  console.log("\n== 9. Oversized attachment (5 MB) → rejected ==");
  const big = Buffer.alloc(5 * 1024 * 1024, "a");
  const p9 = emailPayload({
    attachments: [
      {
        filename: "big.bin",
        content_type: "application/octet-stream",
        size: big.length,
        data_base64: big.toString("base64"),
      },
    ],
  });
  const r9 = await sendWebhook(p9);
  const doc9 = await dbSelect<any>("documents", `select=*&message_id=eq.${r9.body?.message_id}`);
  check("oversized document row exists", doc9.length === 1);
  check("scan_status=rejected", doc9[0]?.scan_status === "rejected");
  check("reason mentions size limit", (doc9[0]?.rejection_reason || "").includes("maximum attachment size"));

  // --- 10. EICAR malware file → quarantined ---
  console.log("\n== 10. EICAR test file → quarantined ==");
  const eicarBuf = Buffer.from(EICAR + "\n");
  const p10 = emailPayload({
    attachments: [
      {
        filename: "eicar.txt",
        content_type: "text/plain",
        size: eicarBuf.length,
        data_base64: eicarBuf.toString("base64"),
      },
    ],
  });
  const r10 = await sendWebhook(p10);
  const doc10 = await dbSelect<any>("documents", `select=*&message_id=eq.${r10.body?.message_id}`);
  check("quarantined document row exists", doc10.length === 1);
  check("scan_status=quarantined", doc10[0]?.scan_status === "quarantined");
  check("reason mentions EICAR", (doc10[0]?.rejection_reason || "").includes("EICAR"));
  check(
    "quarantined file stored under quarantine/ prefix",
    (doc10[0]?.storage_path || "").startsWith("quarantine/")
  );

  // --- 11. Script/HTML body → sanitized rendering ---
  console.log("\n== 11. HTML body sanitized (no script, no remote content) ==");
  const dirty = `<html><body><p>Hello</p><script>alert('xss')</script><img src="http://evil.example.com/track.png"><iframe src="http://evil.example.com"></iframe><a href="javascript:alert(1)">click</a><div onerror="alert(1)" style="background:url(javascript:alert(1))">x</div><style>body{background:url(http://evil)}</style></body></html>`;
  const clean = sanitizeEmailHtml(dirty);
  check("no <script> in sanitized output", !/<script/i.test(clean));
  check("no <img> in sanitized output", !/<img/i.test(clean));
  check("no <iframe> in sanitized output", !/<iframe/i.test(clean));
  check("no onerror handler", !/onerror/i.test(clean));
  check("no javascript: protocol", !/javascript:/i.test(clean));
  check("no <style> tag", !/<style/i.test(clean));
  check("safe paragraph content preserved", clean.includes("Hello"));
  const p11 = emailPayload({ html: dirty, text: null });
  const r11 = await sendWebhook(p11);
  check("message with dirty HTML still filed", r11.body?.filed === true, JSON.stringify(r11.body));
  const msg11 = await dbSelect<any>("messages", `select=*&id=eq.${r11.body?.message_id}`);
  const reSanitized = sanitizeEmailHtml(msg11[0]?.body_html || "");
  check("stored body renders without script execution", !/<script/i.test(reSanitized));

  // --- 12. Unread state (DB level; API verified in browser demo) ---
  console.log("\n== 12. Unread messages counted ==");
  const unread = await dbSelect<any>(
    "messages",
    `select=id&client_id=eq.${clientA}&is_read=eq.false&direction=eq.inbound`
  );
  // Scenarios 1, 2, 7, 11 filed messages to client A (4 unread)
  check("4 unread messages on client A", unread.length === 4, `got ${unread.length}`);

  // --- 13. HMAC rejection ---
  console.log("\n== 13. Unsigned request rejected ==");
  const rawBody = JSON.stringify(emailPayload({}));
  const res13 = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  });
  check("request without signature → 401", res13.status === 401, `got ${res13.status}`);
  const res13b = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Signature": "sha256=deadbeef",
    },
    body: rawBody,
  });
  check("request with bad signature → 401", res13b.status === 401, `got ${res13b.status}`);

  // ---------------------------------------------------------------------------
  console.log(`\n== Results: ${passed} passed, ${failed} failed ==`);
  if (failed > 0) {
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("All Slice A webhook scenarios passed.");
}

main().catch((err) => {
  console.error("Test suite crashed:", err);
  process.exit(1);
});

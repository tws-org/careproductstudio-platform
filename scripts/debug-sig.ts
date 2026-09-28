import { createHmac, randomUUID } from "crypto";
import { resolve } from "path";

try {
  (process as any).loadEnvFile(resolve(process.cwd(), ".env.local"));
} catch {
  /* ignore */
}

async function main() {
  const SECRET = process.env.EMAIL_WEBHOOK_SECRET || "";
  console.log("secret length:", SECRET.length, "first 8:", SECRET.slice(0, 8));

  // Mimic the test suite's payload shape exactly
  const payload = {
    from: "tester-a@example.com",
    envelope_from: "tester-a@example.com",
    to: "request@carepracticestudio.com",
    subject: "Test debug",
    date: new Date().toISOString(),
    headers: {
      "message-id": `<${randomUUID()}@example.com>`,
      "authentication-results":
        "mx.google.com; spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com",
    },
    text: "Hello from the test suite.",
    html: "<p>Hello from the test suite.</p>",
    attachments: [],
  };

  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", SECRET).update(body).digest("hex");
  console.log("signature:", signature);

  const res = await fetch(
    "https://platform.carepracticestudio.com/api/email/inbound",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": `sha256=${signature}`,
      },
      body,
    }
  );
  console.log("status:", res.status);
  console.log("body:", await res.text());
}

main();

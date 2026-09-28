import { createHmac } from "crypto";
import { resolve } from "path";

try {
  (process as any).loadEnvFile(resolve(process.cwd(), ".env.local"));
} catch {
  /* ignore */
}

async function main() {
  const secret = process.env.EMAIL_WEBHOOK_SECRET || "";
  const body = JSON.stringify({ test: true });
  const sig = createHmac("sha256", secret).update(body).digest("hex");

  const res = await fetch(
    "https://platform.carepracticestudio.com/api/email/inbound",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": `sha256=${sig}`,
      },
      body,
    }
  );

  console.log("status:", res.status);
  console.log("body:", await res.text());
}

main();

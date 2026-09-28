import { createAdminSupabaseClient } from "./supabase-admin";

/**
 * Thin file-storage interface (portability: the app depends on this
 * module, not on Supabase Storage directly). To move off Supabase
 * Storage, reimplement these four functions against another object
 * store — no caller changes needed.
 */

const BUCKET = "documents";

export async function putFile(
  path: string,
  data: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, data, {
      contentType,
      upsert: false,
    });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function createSignedUrl(
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw new Error(`Storage signed URL failed: ${error.message}`);
  return data.signedUrl;
}

export function isQuarantinedPath(storagePath: string | null): boolean {
  return !!storagePath && storagePath.startsWith("quarantine/");
}

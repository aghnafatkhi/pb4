import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Klien service-role HANYA untuk server (API routes). Dibuat malas supaya
// build tidak meledak saat env belum diatur.
let cached: SupabaseClient | null = null;

export function getServiceSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diatur di environment Vercel.');
  }
  if (!cached) {
    cached = createClient(url, key);
  }
  return cached;
}

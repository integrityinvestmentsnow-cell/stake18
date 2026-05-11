// Server-only Supabase client that uses the service-role key. Bypasses RLS.
//
// Use this ONLY in API routes after you've already done your own auth check.
// It is the "trusted writer" client — anything you do with it executes with
// full database privileges, so the calling code is solely responsible for
// validating that the request should be allowed.
//
// NEVER import this from a client component or otherwise expose it in the
// browser bundle. The key it carries grants total access to the project.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// We don't have generated Database types in this project, so use `any` for
// the schema generic to keep the writer's query builder permissive. This
// matches how the SSR client (which has `any` baked in) behaves in practice.
let cached: SupabaseClient | null = null;

export function createServiceClient(): SupabaseClient {
  if (cached) return cached;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. The service-role client cannot be created."
    );
  }
  cached = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

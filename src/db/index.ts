import { createClient } from "@/lib/supabase/server";

// Helper to get a Supabase client for DB operations in API routes
export async function getDb() {
  return await createClient();
}

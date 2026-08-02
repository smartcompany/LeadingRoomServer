import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

let adminClient: SupabaseClient | undefined;

export function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;
  adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

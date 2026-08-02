import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';
let adminClient;
export function getAdminClient() {
    if (adminClient)
        return adminClient;
    adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    return adminClient;
}

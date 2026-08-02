import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');
const envLocal = resolve(root, '.env.local');
const envFallback = resolve(root, '.env');
if (existsSync(envLocal)) {
    config({ path: envLocal });
}
else if (existsSync(envFallback)) {
    config({ path: envFallback });
}
else {
    config();
}
function required(name) {
    const value = process.env[name];
    if (value === undefined || value === '') {
        throw new Error(`Missing required env: ${name}`);
    }
    return value;
}
export const env = {
    port: Number(process.env.PORT ?? '8787'),
    supabaseUrl: required('SUPABASE_URL'),
    supabasePublishableKey: required('SUPABASE_PUBLISHABLE_KEY'),
    supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    geminiApiKey: process.env.GEMINI_API_KEY ?? '',
    /** GitHub Actions → POST /api/poll 보호용. 비어 있으면 로컬 전용(미검증). */
    pollSecret: process.env.POLL_SECRET ?? '',
};

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
/** Lazy so Vercel build/import analysis does not require secrets at module load. */
let cached;
export const env = {
    get port() {
        return Number(process.env.PORT ?? '8787');
    },
    get supabaseUrl() {
        return load().supabaseUrl;
    },
    get supabasePublishableKey() {
        return load().supabasePublishableKey;
    },
    get supabaseServiceRoleKey() {
        return load().supabaseServiceRoleKey;
    },
    get geminiApiKey() {
        return load().geminiApiKey;
    },
    get pollSecret() {
        return load().pollSecret;
    },
};
function load() {
    if (cached)
        return cached;
    cached = {
        port: Number(process.env.PORT ?? '8787'),
        supabaseUrl: required('SUPABASE_URL'),
        supabasePublishableKey: required('SUPABASE_PUBLISHABLE_KEY'),
        supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
        geminiApiKey: process.env.GEMINI_API_KEY ?? '',
        pollSecret: process.env.POLL_SECRET ?? '',
    };
    return cached;
}

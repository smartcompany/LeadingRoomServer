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
} else if (existsSync(envFallback)) {
  config({ path: envFallback });
} else {
  config();
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

/** Public bootstrap — service role 불필요. */
let cachedPublic: {
  supabaseUrl: string;
  supabasePublishableKey: string;
} | undefined;

/** Server-only secrets. */
let cachedPrivate: {
  supabaseServiceRoleKey: string;
  geminiApiKey: string;
  pollSecret: string;
} | undefined;

export const env = {
  get port() {
    return Number(process.env.PORT ?? '8787');
  },
  get supabaseUrl() {
    return loadPublic().supabaseUrl;
  },
  get supabasePublishableKey() {
    return loadPublic().supabasePublishableKey;
  },
  get supabaseServiceRoleKey() {
    return loadPrivate().supabaseServiceRoleKey;
  },
  get geminiApiKey() {
    return loadPrivate().geminiApiKey;
  },
  get pollSecret() {
    return loadPrivate().pollSecret;
  },
};

function loadPublic() {
  if (cachedPublic) return cachedPublic;
  cachedPublic = {
    supabaseUrl: required('SUPABASE_URL'),
    supabasePublishableKey: required('SUPABASE_PUBLISHABLE_KEY'),
  };
  return cachedPublic;
}

function loadPrivate() {
  if (cachedPrivate) return cachedPrivate;
  cachedPrivate = {
    supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    geminiApiKey: process.env.GEMINI_API_KEY ?? '',
    pollSecret: process.env.POLL_SECRET ?? '',
  };
  return cachedPrivate;
}

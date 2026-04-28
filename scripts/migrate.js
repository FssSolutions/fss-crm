#!/usr/bin/env node
// Run: node scripts/migrate.js
// Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually (no dotenv dependency needed)
function loadEnv() {
  try {
    const env = readFileSync(join(__dir, '../.env.local'), 'utf8');
    for (const line of env.split('\n')) {
      const [k, ...v] = line.split('=');
      if (k && v.length) process.env[k.trim()] = v.join('=').trim();
    }
  } catch {
    console.error('No .env.local found. Copy .env.example to .env.local and fill in values.');
    process.exit(1);
  }
}

loadEnv();

const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const sql = readFileSync(join(__dir, '../supabase/migrations/001_initial_schema.sql'), 'utf8');

console.log('Running FSS CRM migrations against', VITE_SUPABASE_URL, '...');

const res = await fetch(`${VITE_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ sql }),
}).catch(() => null);

// Fallback: use the Supabase SQL endpoint directly
if (!res || !res.ok) {
  console.log('\n⚠  The automatic migration could not be run via REST.');
  console.log('   Please run the SQL manually in the Supabase SQL Editor:\n');
  console.log('   app.supabase.com → SQL Editor → paste contents of:');
  console.log('   supabase/migrations/001_initial_schema.sql\n');
  console.log('   The file is ready to copy-paste.');
} else {
  console.log('✓ Migration complete! All FSS CRM tables created.');
}

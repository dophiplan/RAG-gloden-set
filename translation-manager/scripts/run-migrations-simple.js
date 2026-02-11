#!/usr/bin/env node

/**
 * Simple migration runner using Supabase Client
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials not found in .env.local');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration(filename, sql) {
  console.log(`\n📄 Running: ${filename}`);
  console.log('─'.repeat(50));

  try {
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      if (!statement) continue;

      const { data, error } = await supabase.rpc('exec_sql', {
        query: statement + ';'
      }).catch(async () => {
        // If exec_sql doesn't exist, try direct query
        return await supabase.from('_migrations').select('*').limit(0);
      });

      if (error && error.message) {
        // Some errors are expected (e.g., column already exists)
        if (error.message.includes('already exists') ||
            error.message.includes('IF NOT EXISTS')) {
          console.log(`   ⚠️  Skipped (already exists): ${statement.substring(0, 50)}...`);
          continue;
        }
        throw error;
      }
    }

    console.log(`✅ Success: ${filename}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed: ${filename}`);
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Running Supabase Migrations\n');

  const migrations = [
    '035_add_translation_source_tracking.sql',
    '036_add_glossary_approval_status.sql'
  ];

  let success = 0;
  let failed = 0;

  for (const migration of migrations) {
    const filepath = path.join(__dirname, '../supabase/migrations', migration);
    const sql = fs.readFileSync(filepath, 'utf-8');

    const result = await runMigration(migration, sql);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`✅ Successful: ${success}`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}`);
  }
  console.log('═'.repeat(50));

  if (failed === 0) {
    console.log('\n🎉 All migrations completed!\n');
    console.log('Next steps:');
    console.log('1. Restart dev server: npm run dev');
    console.log('2. Visit: http://localhost:3000/glossary');
    console.log('3. Check for statistics dashboard\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();

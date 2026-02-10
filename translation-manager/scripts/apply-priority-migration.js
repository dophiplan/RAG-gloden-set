const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('🔧 Applying priority and notes migration...\n');

  try {
    // Add priority column
    console.log('1. Adding priority column...');
    const { error: priorityError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.translations
          ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT '중'
          CHECK (priority IN ('긴급', '상', '중', '하'));
      `
    });

    if (priorityError) {
      console.log('Note: Column may already exist or using alternative method');
    } else {
      console.log('✓ Priority column added');
    }

    // Add notes column
    console.log('\n2. Adding notes column...');
    const { error: notesError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.translations
          ADD COLUMN IF NOT EXISTS notes TEXT;
      `
    });

    if (notesError) {
      console.log('Note: Column may already exist or using alternative method');
    } else {
      console.log('✓ Notes column added');
    }

    // Update existing records
    console.log('\n3. Updating existing records...');
    const { error: updateError } = await supabase
      .from('translations')
      .update({ priority: '중' })
      .is('priority', null);

    if (updateError) {
      console.log('Note:', updateError.message);
    } else {
      console.log('✓ Existing records updated');
    }

    console.log('\n✅ Migration completed!');
    console.log('\nPlease restart your dev server:');
    console.log('  npm run dev\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n⚠️  Please run the SQL manually in Supabase Dashboard:');
    console.log(`
ALTER TABLE public.translations
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT '중'
  CHECK (priority IN ('긴급', '상', '중', '하'));

ALTER TABLE public.translations
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE public.translations
SET priority = '중'
WHERE priority IS NULL;
    `);
  }
}

applyMigration();

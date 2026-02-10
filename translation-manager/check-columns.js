const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
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

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkColumns() {
  console.log('🔍 Checking translations table columns...\n');

  const columnsToCheck = ['priority', 'notes', 'scope'];

  for (const col of columnsToCheck) {
    try {
      const { data, error } = await supabase
        .from('translations')
        .select(col)
        .limit(1);

      if (error && error.code === '42703') {
        console.log(`❌ Column "${col}" does NOT exist`);
      } else if (!error) {
        console.log(`✅ Column "${col}" exists`);
      } else {
        console.log(`⚠️  Column "${col}" - error:`, error.message);
      }
    } catch (e) {
      console.log(`❌ Column "${col}" - error:`, e.message);
    }
  }

  console.log('\n');
}

checkColumns();

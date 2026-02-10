const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1];
const SERVICE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1];

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkSchema() {
  console.log('🔍 Checking translations table schema...\n');

  // Get column info using information_schema
  const { data, error } = await supabase
    .from('translations')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    console.log('Current columns:', columns);

    const requiredColumns = ['scope', 'work_scope', 'dev_code', 'notes', 'completion_rate', 'platform_completions'];
    const missingColumns = requiredColumns.filter(col => !columns.includes(col));

    if (missingColumns.length > 0) {
      console.log('\n❌ Missing columns:', missingColumns);
      console.log('\n📋 You need to apply migration: 006_comprehensive_update.sql');
      console.log('   Run this in Supabase SQL Editor:\n');
      console.log('   https://lviuhkfoaqpunudjmvol.supabase.co/project/lviuhkfoaqpunudjmvol/sql');
    } else {
      console.log('\n✅ All required columns exist!');
    }
  }
}

checkSchema();

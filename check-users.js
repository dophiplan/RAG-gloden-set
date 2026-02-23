const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1];
const SERVICE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1];

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkUsers() {
  console.log('🔍 Checking users in database...');
  const { data, error, count } = await supabase
    .from('users')
    .select('id, email, name', { count: 'exact' })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } else {
    console.log(`✅ Found ${count} total users`);
    if (data.length > 0) {
      console.log('First user:', data[0]);
    } else {
      console.log('⚠️  No users found! This is likely the problem.');
      console.log('   You need to create a master user account.');
    }
  }
}

checkUsers().then(() => process.exit(0));

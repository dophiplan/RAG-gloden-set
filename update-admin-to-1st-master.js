const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1];
const SERVICE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function updateAdminAccount() {
  console.log('🔍 Checking admin@example.com account...\n');

  // Find admin@example.com user
  const { data: users, error: findError } = await supabase
    .from('users')
    .select('id, email, name, account_level, roles')
    .eq('email', 'admin@example.com');

  if (findError) {
    console.error('❌ Error finding user:', findError);
    return;
  }

  if (!users || users.length === 0) {
    console.log('❌ admin@example.com user not found in DB');
    console.log('\n💡 Checking all users in DB...\n');
    
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, email, name, account_level')
      .limit(10);
    
    console.log('Available users:');
    allUsers?.forEach(u => {
      console.log(`  - ${u.email} (account_level: ${u.account_level || 'null'})`);
    });
    return;
  }

  const user = users[0];
  console.log('✅ Found user:', {
    id: user.id,
    email: user.email,
    name: user.name,
    current_account_level: user.account_level,
    roles: user.roles,
  });

  // Update to 1st_master
  console.log('\n📝 Updating account_level to 1st_master...\n');
  
  const { data: updated, error: updateError } = await supabase
    .from('users')
    .update({ 
      account_level: '1st_master',
      roles: ['1st_master']  // Also update roles for consistency
    })
    .eq('id', user.id)
    .select();

  if (updateError) {
    console.error('❌ Update failed:', updateError);
    return;
  }

  console.log('✅ Successfully updated!');
  console.log('New account_level:', updated?.[0]?.account_level);
  console.log('New roles:', updated?.[0]?.roles);
  console.log('\n🔄 Please refresh the browser to see the changes.');
}

// Also check for nhkim@rsupport.com
async function checkNhkimAccount() {
  console.log('\n🔍 Checking nhkim@rsupport.com account...\n');
  
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, name, account_level')
    .eq('email', 'nhkim@rsupport.com');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!users || users.length === 0) {
    console.log('❌ nhkim@rsupport.com NOT found in DB');
    console.log('\n💡 You may need to create this account or sign up with it.');
  } else {
    console.log('✅ Found nhkim@rsupport.com:', users[0]);
  }
}

async function main() {
  await updateAdminAccount();
  await checkNhkimAccount();
}

main().catch(console.error);

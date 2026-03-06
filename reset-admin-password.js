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

async function resetAdminPassword() {
  const NEW_PASSWORD = '111111';
  
  console.log('🔍 Finding admin@example.com user...\n');

  // Find user by email
  const { data: users, error: findError } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', 'admin@example.com');

  if (findError) {
    console.error('❌ Error finding user:', findError);
    return;
  }

  if (!users || users.length === 0) {
    console.error('❌ admin@example.com user not found');
    return;
  }

  const userId = users[0].id;
  console.log('✅ Found user ID:', userId);
  console.log('\n🔑 Resetting password to: 111111...\n');

  // Update password using admin API
  const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
    userId,
    { password: NEW_PASSWORD }
  );

  if (updateError) {
    console.error('❌ Password reset failed:', updateError);
    return;
  }

  console.log('✅ Password reset successful!');
  console.log('\n📧 Email: admin@example.com');
  console.log('🔑 Password: 111111');
  console.log('\n🎉 You can now login with these credentials.');
}

resetAdminPassword().catch(console.error);

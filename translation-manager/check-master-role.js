const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local
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

async function checkMasterRole() {
  console.log('🔍 Checking master user role...\n');

  try {
    // Check nhkim@rsupport.com user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, roles, permissions')
      .eq('email', 'nhkim@rsupport.com')
      .single();

    if (error) {
      console.error('❌ Error fetching user:', error.message);
      if (error.code === 'PGRST116') {
        console.log('\n⚠️  User not found in users table!');
        console.log('   This user exists in auth but not in users table.');
        console.log('   Need to create user record.\n');
      }
      return;
    }

    console.log('✅ User found:');
    console.log('   ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Name:', user.name);
    console.log('   Roles:', user.roles);
    console.log('   Permissions:', user.permissions);

    // Check if has master role
    const hasMaster = user.roles && user.roles.includes('master');

    if (hasMaster) {
      console.log('\n✅ User HAS master role!');
      console.log('   The 401 error might be due to a different issue.');
      console.log('   Checking session...\n');
    } else {
      console.log('\n❌ User DOES NOT have master role!');
      console.log('   Current roles:', user.roles);
      console.log('   Need to add master role.\n');

      // Update to add master role
      console.log('🔧 Adding master role...');
      const { error: updateError } = await supabase
        .from('users')
        .update({
          roles: ['master', 'user'],
          permissions: ['master', 'translator', 'reviewer', 'requester', 'deployer']
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('❌ Error updating roles:', updateError.message);
      } else {
        console.log('✅ Master role added successfully!');
        console.log('   Please refresh your browser (F5)\n');
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

checkMasterRole();

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

async function updateMasterUser() {
  try {
    console.log('Updating master user...');

    // Get master user from auth
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('Error listing users:', listError);
      return;
    }

    const masterUser = users.find(u => u.email === 'nhkim@rsupport.com');

    if (!masterUser) {
      console.log('Master user nhkim@rsupport.com not found');
      return;
    }

    console.log('✓ Master user found:', masterUser.id);

    // Update user record (try with permissions first, fallback without if column doesn't exist)
    let updatedUser, updateError;

    // Try with permissions
    const result = await supabase
      .from('users')
      .update({
        name: '김난희',
        roles: ['master', 'user'],
        permissions: ['master', 'translator', 'reviewer', 'requester', 'deployer'],
        work_products: [],
        updated_at: new Date().toISOString()
      })
      .eq('id', masterUser.id)
      .select()
      .single();

    if (result.error && result.error.message.includes('permissions')) {
      console.log('Permissions column not found, updating without it...');
      // Try with just name
      const result2 = await supabase
        .from('users')
        .update({
          name: '김난희'
        })
        .eq('id', masterUser.id)
        .select()
        .single();

      updatedUser = result2.data;
      updateError = result2.error;
    } else {
      updatedUser = result.data;
      updateError = result.error;
    }

    if (updateError) {
      console.error('✗ Error updating master user:', updateError);
      return;
    }

    console.log('✓ Master user updated successfully!');
    console.log('  ID:', updatedUser.id);
    console.log('  Email:', updatedUser.email);
    console.log('  Name:', updatedUser.name);
    console.log('  Permissions:', updatedUser.permissions);
    console.log('  Roles:', updatedUser.roles);
  } catch (error) {
    console.error('✗ Unexpected error:', error);
  }
}

updateMasterUser();

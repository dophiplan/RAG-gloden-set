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

async function ensureMasterUser() {
  try {
    console.log('Checking for master user...');

    // Get master user from auth
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('Error listing users:', listError);
      return;
    }

    const masterUser = users.find(u => u.email === 'nhkim@rsupport.com');

    if (!masterUser) {
      console.log('Master user nhkim@rsupport.com not found in auth');
      return;
    }

    console.log('✓ Master user found in auth:', masterUser.id);

    // Check if exists in users table
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', masterUser.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching user:', fetchError);
      return;
    }

    if (existingUser) {
      console.log('✓ Master user already exists in users table');
      console.log('  Name:', existingUser.name);
      console.log('  Permissions:', existingUser.permissions);
      return;
    }

    console.log('Creating master user in users table...');

    // Insert master user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        id: masterUser.id,
        email: masterUser.email,
        name: '김난희',
        roles: ['master', 'user'],
        permissions: ['master', 'translator', 'reviewer', 'requester', 'deployer'],
        work_products: []
      })
      .select()
      .single();

    if (insertError) {
      console.error('✗ Error inserting master user:', insertError);
      return;
    }

    console.log('✓ Master user created successfully!');
    console.log('  ID:', newUser.id);
    console.log('  Email:', newUser.email);
    console.log('  Name:', newUser.name);
    console.log('  Permissions:', newUser.permissions);
  } catch (error) {
    console.error('✗ Unexpected error:', error);
  }
}

ensureMasterUser();

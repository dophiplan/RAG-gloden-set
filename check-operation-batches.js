const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1];
const SERVICE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkOperationBatches() {
  console.log('🔍 Checking operation_batches table...\n');

  try {
    // Check if table exists
    const { data, error } = await supabase
      .from('operation_batches')
      .select('id')
      .limit(1);

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.log('❌ operation_batches table does NOT exist!');
        console.log('\n📋 Migration file: 045_add_rollback_system.sql');
        console.log('\n⚡ Options:');
        console.log('   1. Run in Supabase SQL Editor:');
        console.log(`      ${SUPABASE_URL.replace('.co', '.co/project')}/sql`);
        console.log('\n   2. Apply via Supabase CLI');
        console.log('\n   3. Run the migration SQL manually');
        
        // Show migration SQL
        const migrationPath = path.join(__dirname, 'supabase/migrations/045_add_rollback_system.sql');
        if (fs.existsSync(migrationPath)) {
          console.log('\n📄 Migration SQL content:\n');
          console.log('─'.repeat(60));
          console.log(fs.readFileSync(migrationPath, 'utf8'));
          console.log('─'.repeat(60));
        }
        return false;
      }
      throw error;
    }

    console.log('✅ operation_batches table exists!');
    
    // Check table structure
    const { data: columns, error: colError } = await supabase
      .rpc('get_table_columns', { table_name: 'operation_batches' });
    
    if (colError) {
      console.log('\n⚠️  Could not fetch column details (RPC not available)');
    } else {
      console.log('\n📊 Table structure:', columns);
    }
    
    // Check row count
    const { count, error: countError } = await supabase
      .from('operation_batches')
      .select('*', { count: 'exact', head: true });
    
    if (!countError) {
      console.log(`📈 Current row count: ${count || 0}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error checking table:', error.message);
    return false;
  }
}

async function applyMigration() {
  console.log('\n⚡ Applying migration...\n');
  
  const migrationPath = path.join(__dirname, 'supabase/migrations/045_add_rollback_system.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  // Split SQL into statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const statement of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
      if (error) {
        // Try alternative: direct query
        console.log(`⚠️  RPC failed, trying direct query...`);
        break;
      }
    } catch (e) {
      console.log(`⚠️  Statement skipped: ${statement.substring(0, 50)}...`);
    }
  }
  
  console.log('\n📋 Please apply the migration manually in Supabase SQL Editor:');
  console.log(`   ${SUPABASE_URL.replace('.co', '.co/project')}/sql`);
}

checkOperationBatches().then(exists => {
  if (!exists) {
    console.log('\n' + '═'.repeat(60));
    console.log('🚨 MIGRATION REQUIRED');
    console.log('═'.repeat(60));
    process.exit(1);
  } else {
    console.log('\n✅ All good! No migration needed.');
    process.exit(0);
  }
});

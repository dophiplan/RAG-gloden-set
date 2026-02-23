const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

console.log('📦 Loading environment variables...\n');

// Read .env.local
const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local file not found');
  process.exit(1);
}

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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('✅ Connected to:', supabaseUrl);
console.log('🔧 Starting migration...\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function addColumns() {
  try {
    // Step 1: Check if priority column exists
    console.log('1️⃣  Checking if priority column exists...');
    const { data: columns, error: checkError } = await supabase
      .from('translations')
      .select('priority')
      .limit(1);

    if (checkError && checkError.code === '42703') {
      console.log('   ℹ️  Priority column does not exist, will add it\n');

      // Use raw SQL via Supabase admin
      console.log('2️⃣  Adding priority column...');
      // Since Supabase client doesn't support ALTER TABLE directly,
      // we need to guide the user to run SQL manually
      console.log('\n⚠️  Cannot add columns via JavaScript client.');
      console.log('   Please run the following SQL in Supabase Dashboard:\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`
-- Add priority column
ALTER TABLE public.translations
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT '중'
  CHECK (priority IN ('긴급', '상', '중', '하'));

-- Add notes column
ALTER TABLE public.translations
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index
CREATE INDEX IF NOT EXISTS idx_translations_priority
  ON public.translations(priority);

-- Update existing records
UPDATE public.translations
SET priority = '중'
WHERE priority IS NULL;
`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('📋 Steps:');
      console.log('   1. Open https://supabase.com');
      console.log('   2. Go to SQL Editor');
      console.log('   3. Copy & paste the SQL above');
      console.log('   4. Click "Run" button\n');

    } else if (!checkError) {
      console.log('   ✅ Priority column already exists!');

      // Check notes column
      console.log('\n3️⃣  Checking if notes column exists...');
      const { error: notesCheckError } = await supabase
        .from('translations')
        .select('notes')
        .limit(1);

      if (notesCheckError && notesCheckError.code === '42703') {
        console.log('   ℹ️  Notes column does not exist');
        console.log('\n⚠️  Please add notes column via Supabase Dashboard:');
        console.log('\nALTER TABLE public.translations ADD COLUMN IF NOT EXISTS notes TEXT;\n');
      } else if (!notesCheckError) {
        console.log('   ✅ Notes column already exists!');
        console.log('\n✅ All columns are ready!');
        console.log('   You can now refresh your browser (F5)\n');
      }
    } else {
      console.error('❌ Error checking columns:', checkError);
    }

  } catch (error) {
    console.error('❌ Migration error:', error.message);
  }
}

addColumns();

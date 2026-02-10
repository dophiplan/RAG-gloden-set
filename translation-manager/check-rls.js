const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1];
const SERVICE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1];

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function testInsert() {
  console.log('🧪 Testing translation insert...\n');

  const userId = '3c23720f-2660-46c5-bf1e-b6743b68b627';

  // Step 1: Create a translation
  console.log('Step 1: Creating translation...');
  const { data: translation, error: transError } = await supabase
    .from('translations')
    .insert({
      source_text: 'Test translation ' + Date.now(),
      user_id: userId,
      status: 'pending'
    })
    .select()
    .single();

  if (transError) {
    console.error('❌ Translation insert failed:', transError);
    return;
  }

  console.log('✅ Translation created:', translation.id);

  // Step 2: Create translation_products record
  console.log('\nStep 2: Creating translation_products...');
  const { data: transProd, error: prodError } = await supabase
    .from('translation_products')
    .insert({
      translation_id: translation.id,
      product_code: 'Rfice'
    })
    .select();

  if (prodError) {
    console.error('❌ Translation_products insert failed:', prodError);
    console.error('This is the RLS policy issue!');

    // Clean up
    await supabase.from('translations').delete().eq('id', translation.id);
    process.exit(1);
  }

  console.log('✅ Translation_products created');

  // Clean up
  console.log('\nCleaning up...');
  await supabase.from('translations').delete().eq('id', translation.id);
  console.log('✅ Test passed! RLS policies are working correctly.');
}

testInsert().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

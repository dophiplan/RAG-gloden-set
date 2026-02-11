import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// Security: Verify user is master
async function verifyMasterUser(supabase: SupabaseClient): Promise<{ authorized: boolean; userId?: string }> {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { authorized: false };
  }

  // Check if user has master or 1st_master role
  const { data: userProfile } = await supabase
    .from('users')
    .select('roles')
    .eq('id', user.id)
    .single();

  const isMaster = userProfile?.roles?.includes('master') || userProfile?.roles?.includes('1st_master');

  return {
    authorized: isMaster,
    userId: user.id
  };
}

/**
 * POST - Create a single user (master only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { authorized } = await verifyMasterUser(supabase);

    if (!authorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Master access required' },
        { status: 401 }
      );
    }
    const adminClient = createAdminClient();
    const body = await request.json();
    const { email, name, password, products, accountLevel, permissions, translatorLanguages } = body;

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: '이메일, 이름, 비밀번호는 필수입니다.' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: '이미 등록된 이메일 주소입니다.' },
        { status: 400 }
      );
    }

    // Try to create auth user
    let { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
      },
    });

    // If auth user creation fails due to duplicate, try to clean up and retry
    if (authError && authError.message?.includes('User already registered')) {
      // Get the existing auth user
      const { data: { users: existingAuthUsers } } = await adminClient.auth.admin.listUsers();
      const existingAuthUser = existingAuthUsers?.find(u => u.email === email);

      if (existingAuthUser) {
        // Check if profile exists
        const { data: profile } = await adminClient
          .from('users')
          .select('id')
          .eq('id', existingAuthUser.id)
          .single();

        if (!profile) {
          // Orphaned auth user - delete and retry
          console.log('Found orphaned auth user, cleaning up:', existingAuthUser.id);
          await adminClient.auth.admin.deleteUser(existingAuthUser.id);

          // Retry creating auth user
          const retryResult = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name },
          });

          if (retryResult.error) throw retryResult.error;
          if (!retryResult.data.user) throw new Error('Failed to create auth user on retry');

          // Use the retry data
          authData = retryResult.data;
          authError = null;
        } else {
          // Profile exists, this is a real duplicate
          return NextResponse.json(
            { error: '이미 등록된 이메일 주소입니다.' },
            { status: 400 }
          );
        }
      } else {
        throw authError;
      }
    } else if (authError) {
      throw authError;
    }

    if (!authData?.user) throw new Error('Failed to create auth user');

    // Fetch products from database
    const { data: productsData } = await adminClient.from('products').select('code, name');
    const productsMap = (productsData || []).reduce((acc, p) => { acc[p.code] = p.name; return acc; }, {} as Record<string, string>);

    // Create user profile
    // roles array will contain only the primary account level
    const roles = [accountLevel || 'user'];

    // Master and 1st_master users get all products and permissions automatically
    const workProducts = (accountLevel === 'master' || accountLevel === '1st_master')
      ? Object.keys(productsMap)
      : (products || []);

    const workPermissions = (accountLevel === 'master' || accountLevel === '1st_master')
      ? ['reviewer', 'requester', 'deployer']
      : (permissions || []);

    // Use upsert to handle any orphaned records
    const { error: profileError } = await adminClient
      .from('users')
      .upsert({
        id: authData.user.id,
        email,
        name,
        roles: roles,
        work_products: workProducts,
        permissions: workPermissions,
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      // Clean up: Delete the auth user if profile creation fails
      console.error('Profile creation failed, cleaning up auth user:', profileError);
      await adminClient.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    // Insert translator languages if provided
    if (translatorLanguages && Array.isArray(translatorLanguages) && translatorLanguages.length > 0) {
      const languageEntries = translatorLanguages.map((lang: string) => ({
        user_id: authData.user.id,
        language_code: lang,
      }));

      const { error: languagesError } = await adminClient
        .from('translator_languages')
        .insert(languageEntries);

      if (languagesError) {
        console.error('Error inserting translator languages:', languagesError);
        // Don't throw - this is not critical
      }
    }

    return NextResponse.json({
      success: true,
      message: '사용자가 생성되었습니다.',
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

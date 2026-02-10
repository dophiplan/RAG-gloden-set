import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Security: Verify user is master
async function verifyMasterUser(supabase: any): Promise<{ authorized: boolean; userId?: string }> {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { authorized: false };
  }

  // Check if user has master role
  const { data: userProfile } = await supabase
    .from('users')
    .select('roles')
    .eq('id', user.id)
    .single();

  const isMaster = userProfile?.roles?.includes('master');

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
    const { email, name, password, products, accountLevel, permissions } = body;

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: '이메일, 이름, 비밀번호는 필수입니다.' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: '이미 등록된 이메일 주소입니다.' },
        { status: 400 }
      );
    }

    // Create auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create auth user');

    // Create user profile
    // roles array will contain the account level (master, manager, or user)
    const roles = [accountLevel || 'user'];

    const { error: profileError } = await adminClient
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        name,
        roles: roles,
        work_products: products || [],
        permissions: permissions || [],
      });

    if (profileError) throw profileError;

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

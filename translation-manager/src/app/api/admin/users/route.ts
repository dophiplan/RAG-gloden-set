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
 * GET - Get all users (master only)
 */
export async function GET(request: NextRequest) {
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

    const { data: users, error } = await adminClient
      .from('users')
      .select('id, email, name, roles, permissions, work_products, created_at')
      .order('name', { ascending: true, nullsFirst: false });

    if (error) throw error;

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

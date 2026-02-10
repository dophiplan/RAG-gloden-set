import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// Security: Verify admin secret
function verifyAdminSecret(request: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret && process.env.NODE_ENV === 'production') {
    return false;
  }
  if (!adminSecret && process.env.NODE_ENV === 'development') {
    console.warn('⚠️  ADMIN_SECRET not set - admin endpoint accessible in development mode');
    return true;
  }
  const headerSecret = request.headers.get('x-admin-secret');
  return headerSecret === adminSecret;
}

/**
 * PATCH - Update user permissions
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!verifyAdminSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing admin secret' },
      { status: 401 }
    );
  }

  try {
    const { id } = params;
    const body = await request.json();
    const { permissions } = body;

    if (!permissions || !Array.isArray(permissions)) {
      return NextResponse.json(
        { error: 'permissions 배열이 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Update user permissions
    const { error } = await supabase
      .from('users')
      .update({
        permissions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: '권한이 업데이트되었습니다.',
    });
  } catch (error) {
    console.error('Error updating permissions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

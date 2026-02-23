import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const MASTER_EMAIL = 'nhkim@rsupport.com';
const DEFAULT_PASSWORD = '111111';

// Security: This endpoint requires a secret key to prevent unauthorized password resets
function verifyAdminSecret(request: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;

  // If ADMIN_SECRET is not set, block the endpoint entirely in production
  if (!adminSecret && process.env.NODE_ENV === 'production') {
    return false;
  }

  // In development without ADMIN_SECRET, allow access
  if (!adminSecret && process.env.NODE_ENV === 'development') {
    console.warn('⚠️  ADMIN_SECRET not set - admin endpoint accessible in development mode');
    return true;
  }

  // Verify the secret from request headers or body
  const headerSecret = request.headers.get('x-admin-secret');
  return headerSecret === adminSecret;
}

/**
 * POST - Reset master account password to default
 */
export async function POST(request: NextRequest) {
  // Security check: Verify admin secret
  if (!verifyAdminSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing admin secret' },
      { status: 401 }
    );
  }

  try {
    const supabase = createAdminClient();

    // Get master user from database
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', MASTER_EMAIL)
      .single();

    if (!user) {
      return NextResponse.json(
        { error: 'Master account not found' },
        { status: 404 }
      );
    }

    // Reset password using Supabase Admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: DEFAULT_PASSWORD }
    );

    if (updateError) throw updateError;

    // Set password_reset_required back to true
    await supabase
      .from('users')
      .update({ password_reset_required: true })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      message: 'Master account password reset successfully',
      email: MASTER_EMAIL,
      password: DEFAULT_PASSWORD,
      note: 'Password reset to "111111". You will be prompted to change it on next login.',
    });
  } catch (error: unknown) {
    console.error('Error resetting master password:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MASTER_EMAIL = 'nhkim@rsupport.com';
const DEFAULT_PASSWORD = '111111';

/**
 * POST - Reset master account password to default
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

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
  } catch (error: any) {
    console.error('Error resetting master password:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reset password' },
      { status: 500 }
    );
  }
}

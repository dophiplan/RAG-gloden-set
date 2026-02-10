import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const MASTER_EMAIL = 'nhkim@rsupport.com';
const DEFAULT_PASSWORD = '111111';

// Security: This endpoint requires a secret key to prevent unauthorized admin account creation
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

    const { data: existingUser } = await supabase
      .from('users')
      .select('email')
      .eq('email', MASTER_EMAIL)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: 'Master account already exists', email: MASTER_EMAIL },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: MASTER_EMAIL,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: 'Nanhee Kim',
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create auth user');

    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: MASTER_EMAIL,
        name: 'Nanhee Kim',
        roles: ['master'],
        password_reset_required: true,
      });

    if (profileError) throw profileError;

    return NextResponse.json({
      success: true,
      message: 'Master account created successfully',
      email: MASTER_EMAIL,
      note: 'Please login with password "111111" and change it immediately',
    });
  } catch (error: unknown) {
    console.error('Error creating master account:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Security check: Verify admin secret
  if (!verifyAdminSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing admin secret' },
      { status: 401 }
    );
  }

  try {
    const supabase = createAdminClient();
    const { data: user } = await supabase
      .from('users')
      .select('email, name, roles')
      .eq('email', MASTER_EMAIL)
      .single();

    if (user) {
      return NextResponse.json({
        exists: true,
        email: user.email,
        name: user.name,
        is_master: user.roles?.includes('master'),
      });
    }

    return NextResponse.json({
      exists: false,
      message: 'Master account not found. Use POST to create it.',
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '알 수 없는 오류' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

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

interface UserImportRow {
  담당제품: string;
  이름: string;
  이메일주소: string;
  초기비밀번호: string;
}

export async function POST(request: NextRequest) {
  // Security check
  if (!verifyAdminSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing admin secret' },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: '파일이 필요합니다.' },
        { status: 400 }
      );
    }

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: UserImportRow[] = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: '엑셀 파일에 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const results: {
      success: Array<{ email: string; action: 'created' | 'updated' }>;
      errors: Array<{ email: string; error: string }>;
    } = {
      success: [],
      errors: [],
    };

    // Group by email to handle multiple products per user
    const usersByEmail: Map<string, { name: string; password: string; products: string[] }> = new Map();

    for (const row of data) {
      if (!row.이메일주소 || !row.이름 || !row.초기비밀번호) {
        results.errors.push({
          email: row.이메일주소 || 'unknown',
          error: '필수 필드가 누락되었습니다.',
        });
        continue;
      }

      const email = row.이메일주소.trim().toLowerCase();
      const existing = usersByEmail.get(email);

      if (existing) {
        // Add product to existing user
        if (row.담당제품) {
          existing.products.push(row.담당제품.trim());
        }
      } else {
        // Create new user entry
        usersByEmail.set(email, {
          name: row.이름.trim(),
          password: row.초기비밀번호.trim(),
          products: row.담당제품 ? [row.담당제품.trim()] : [],
        });
      }
    }

    // Process each user
    for (const [email, userData] of usersByEmail.entries()) {
      try {
        // Check if user exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single();

        if (existingUser) {
          // Update existing user - add products
          const { error: updateError } = await supabase
            .from('users')
            .update({
              name: userData.name,
              work_products: userData.products,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingUser.id);

          if (updateError) throw updateError;

          results.success.push({ email, action: 'updated' });
        } else {
          // Create new user
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password: userData.password,
            email_confirm: true,
            user_metadata: {
              name: userData.name,
            },
          });

          if (authError) throw authError;
          if (!authData.user) throw new Error('Failed to create auth user');

          // Create user profile
          const { error: profileError } = await supabase
            .from('users')
            .insert({
              id: authData.user.id,
              email,
              name: userData.name,
              roles: ['user'],
              work_products: userData.products,
              permissions: [],
            });

          if (profileError) throw profileError;

          results.success.push({ email, action: 'created' });
        }
      } catch (error) {
        results.errors.push({
          email,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        });
      }
    }

    return NextResponse.json({
      message: '사용자 가져오기 완료',
      summary: {
        total: usersByEmail.size,
        created: results.success.filter(r => r.action === 'created').length,
        updated: results.success.filter(r => r.action === 'updated').length,
        failed: results.errors.length,
      },
      details: results,
    });
  } catch (error) {
    console.error('Error importing users:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isMaster } from '@/lib/permissions';
import * as XLSX from 'xlsx';
import { ProductCode, UserRole } from '@/types';

const MAX_USERS = 500;

interface ExcelRow {
  '담당제품': string;
  '작업범위': string;
  '이름': string;
  '이메일': string;
  '권한': string;
  '작업언어': string;
}

// POST - Bulk upload users from Excel
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Get current user with roles
    const { data: currentUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    // Only masters can bulk upload users
    if (!isMaster(currentUser)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Excel 파일을 업로드해주세요.' }, { status: 400 });
    }

    // Check file extension
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json({ error: 'Excel 파일(.xlsx, .xls)만 업로드 가능합니다.' }, { status: 400 });
    }

    // Parse Excel file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

    if (rows.length === 0) {
      return NextResponse.json({ error: '유효한 데이터가 없습니다.' }, { status: 400 });
    }

    if (rows.length > MAX_USERS) {
      return NextResponse.json(
        { error: `최대 ${MAX_USERS}명까지 업로드 가능합니다. (현재: ${rows.length}명)` },
        { status: 400 }
      );
    }

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Parse roles mapping (Korean labels to role codes)
    const roleMapping: Record<string, UserRole[]> = {
      // Korean labels
      '마스터': ['master'],
      '일본어 번역': ['translator_ja'],
      '중국어 번역': ['translator_zh'],
      '영어 번역': ['translator_en'],
      '요청': ['requester'],
      '반영': ['deployer'],
      '일본어 검수': ['reviewer_ja'],
      '중국어 검수': ['reviewer_zh'],
      '영어 검수': ['reviewer_en'],
      // English labels (backward compatibility)
      'Master': ['master'],
      'Requester': ['requester'],
      'PM': ['pm'],
      'PL': ['pl'],
      'Deployer': ['deployer'],
      'Translator_JA': ['translator_ja'],
      'Translator_ZH': ['translator_zh'],
      'Translator_EN': ['translator_en'],
      'Reviewer_JA': ['reviewer_ja'],
      'Reviewer_ZH': ['reviewer_zh'],
      'Reviewer_EN': ['reviewer_en'],
    };

    for (const row of rows) {
      try {
        const email = row['이메일']?.trim();
        const name = row['이름']?.trim();
        const roleStr = row['권한']?.trim() || '';
        const workProductsStr = row['담당제품']?.trim() || '';
        const workScopeStr = row['작업범위']?.trim() || '';
        const workLanguagesStr = row['작업언어']?.trim() || '';

        // Validate required fields
        if (!email) {
          results.errors.push(`행 ${results.created + results.updated + results.skipped + 1}: 이메일이 필요합니다.`);
          results.skipped++;
          continue;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          results.errors.push(`${email}: 유효하지 않은 이메일 형식입니다.`);
          results.skipped++;
          continue;
        }

        // Parse roles (comma-separated)
        const roles: UserRole[] = [];
        if (roleStr) {
          const roleList = roleStr.split(',').map(r => r.trim());
          for (const roleName of roleList) {
            const mappedRoles = roleMapping[roleName];
            if (mappedRoles) {
              roles.push(...mappedRoles);
            }
          }
        }

        // Parse work products (comma-separated)
        const workProducts: ProductCode[] = [];
        if (workProductsStr) {
          const productList = workProductsStr.split(',').map(p => p.trim());
          for (const product of productList) {
            if (product) {
              workProducts.push(product as ProductCode);
            }
          }
        }

        // Parse work scope (comma-separated)
        const workScope: string[] = [];
        if (workScopeStr) {
          const scopeList = workScopeStr.split(',').map(s => s.trim());
          workScope.push(...scopeList.filter(Boolean));
        }

        // Parse work languages (comma-separated)
        const workLanguages: string[] = [];
        if (workLanguagesStr) {
          const langList = workLanguagesStr.split(',').map(l => l.trim());
          workLanguages.push(...langList.filter(Boolean));
        }

        // Check if user already exists by email
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, email')
          .eq('email', email)
          .single();

        if (existingUser) {
          // Update existing user
          const { error: updateError } = await supabase
            .from('users')
            .update({
              name: name || existingUser.email,
              roles,
              work_products: workProducts,
              work_scope: workScope,
              work_languages: workLanguages,
            })
            .eq('id', existingUser.id);

          if (updateError) {
            console.error('Error updating user:', updateError);
            results.errors.push(`${email}: 업데이트 실패 - ${updateError.message}`);
            results.skipped++;
          } else {
            results.updated++;
          }
        } else {
          // Create new user record (without auth)
          // Note: This creates a user profile without an auth account
          // The user will need to sign up through the normal flow
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              email,
              name: name || email,
              roles,
              work_products: workProducts,
              work_scope: workScope,
              work_languages: workLanguages,
            });

          if (insertError) {
            // Check if it's a duplicate email error
            if (insertError.code === '23505') {
              results.errors.push(`${email}: 이미 존재하는 이메일입니다.`);
            } else {
              console.error('Error inserting user:', insertError);
              results.errors.push(`${email}: 생성 실패 - ${insertError.message}`);
            }
            results.skipped++;
          } else {
            results.created++;
          }
        }
      } catch (error: any) {
        console.error('Error processing row:', error);
        results.errors.push(`행 ${results.created + results.updated + results.skipped + 1}: ${error.message}`);
        results.skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      total: rows.length,
    });
  } catch (error: any) {
    console.error('Error bulk uploading users:', error);
    return NextResponse.json(
      { error: error.message || '대량 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canManageAccounts } from '@/lib/permissions';
import * as XLSX from 'xlsx';
import { ProductCode, UserRole } from '@/types';

const MAX_USERS = 500;

interface UserRow {
  email: string;
  name?: string;
  roles?: string;
  work_products?: string;
  work_scope?: string;
  work_languages?: string;
}

// POST - Bulk upload users from Excel/CSV
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

    // Check permission
    if (!canManageAccounts(currentUser)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: '파일을 업로드해주세요.' },
        { status: 400 }
      );
    }

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel/CSV file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      blankrows: false,
    });

    if (rawData.length < 2) {
      return NextResponse.json(
        { error: '파일에 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    // Parse header row
    const headers = rawData[0] as string[];
    const emailIndex = headers.findIndex((h) =>
      ['email', 'Email', '이메일'].includes(h?.trim())
    );

    if (emailIndex === -1) {
      return NextResponse.json(
        { error: 'email 열을 찾을 수 없습니다.' },
        { status: 400 }
      );
    }

    // Parse data rows
    const userRows: UserRow[] = [];
    const seenEmails = new Set<string>();

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i] as any[];
      const email = row[emailIndex]?.toString().trim().toLowerCase();

      if (!email || !email.includes('@')) {
        continue; // Skip invalid emails
      }

      // Auto-remove duplicates within the file
      if (seenEmails.has(email)) {
        continue;
      }
      seenEmails.add(email);

      const userRow: UserRow = {
        email,
      };

      // Parse other columns
      headers.forEach((header, index) => {
        const normalizedHeader = header?.trim().toLowerCase();
        const value = row[index]?.toString().trim();

        if (!value) return;

        switch (normalizedHeader) {
          case 'name':
          case '이름':
            userRow.name = value;
            break;
          case 'roles':
          case '권한':
            userRow.roles = value;
            break;
          case 'work_products':
          case '제품':
          case 'products':
            userRow.work_products = value;
            break;
          case 'work_scope':
          case '작업범위':
          case '작업 범위':
          case 'scope':
            userRow.work_scope = value;
            break;
          case 'work_languages':
          case '언어':
          case 'languages':
            userRow.work_languages = value;
            break;
        }
      });

      userRows.push(userRow);
    }

    // Enforce 500 user limit
    if (userRows.length > MAX_USERS) {
      return NextResponse.json(
        { error: `최대 ${MAX_USERS}명까지 업로드 가능합니다. (현재: ${userRows.length}명)` },
        { status: 400 }
      );
    }

    if (userRows.length === 0) {
      return NextResponse.json(
        { error: '유효한 사용자 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    // Process each user
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const userRow of userRows) {
      try {
        // Check if user already exists in database (auto-remove duplicates)
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, email')
          .eq('email', userRow.email)
          .single();

        if (existingUser) {
          // User exists, update their information
          const updateData: any = {};

          if (userRow.name) updateData.name = userRow.name;

          if (userRow.roles) {
            const rolesArray = userRow.roles
              .split(',')
              .map((r) => r.trim())
              .filter(Boolean);
            updateData.roles = rolesArray as UserRole[];
          }

          if (userRow.work_products) {
            const productsArray = userRow.work_products
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean);
            updateData.work_products = productsArray as ProductCode[];
          }

          if (userRow.work_scope) {
            const scopeArray = userRow.work_scope
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            updateData.work_scope = scopeArray;
          }

          if (userRow.work_languages) {
            const languagesArray = userRow.work_languages
              .split(',')
              .map((l) => l.trim())
              .filter(Boolean);
            updateData.work_languages = languagesArray;
          }

          const { error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', existingUser.id);

          if (updateError) throw updateError;

          results.success++;
        } else {
          // User doesn't exist, create auth account with default password
          const DEFAULT_PASSWORD = '111111';

          // Create auth user with Supabase Admin API
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: userRow.email,
            password: DEFAULT_PASSWORD,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
              name: userRow.name || '',
            },
          });

          if (authError) throw authError;
          if (!authData.user) throw new Error('Failed to create auth user');

          // Create user profile record
          const insertData: any = {
            id: authData.user.id,
            email: userRow.email,
            password_reset_required: true, // Force password change on first login
          };

          if (userRow.name) insertData.name = userRow.name;

          if (userRow.roles) {
            const rolesArray = userRow.roles
              .split(',')
              .map((r) => r.trim())
              .filter(Boolean);
            insertData.roles = rolesArray as UserRole[];
          }

          if (userRow.work_products) {
            const productsArray = userRow.work_products
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean);
            insertData.work_products = productsArray as ProductCode[];
          }

          if (userRow.work_scope) {
            const scopeArray = userRow.work_scope
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            insertData.work_scope = scopeArray;
          }

          if (userRow.work_languages) {
            const languagesArray = userRow.work_languages
              .split(',')
              .map((l) => l.trim())
              .filter(Boolean);
            insertData.work_languages = languagesArray;
          }

          const { error: insertError } = await supabase
            .from('users')
            .insert(insertData);

          if (insertError) throw insertError;

          results.success++;
        }
      } catch (error) {
        console.error(`Error processing user ${userRow.email}:`, error);
        results.failed++;
        results.errors.push(
          `${userRow.email}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
        );
      }
    }

    return NextResponse.json({
      success: results.success,
      failed: results.failed,
      errors: results.errors,
    });
  } catch (error) {
    console.error('Error in bulk upload:', error);
    return NextResponse.json(
      { error: '업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

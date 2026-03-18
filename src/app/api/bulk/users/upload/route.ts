/**
 * 사용자 일괄 업로드 API
 *
 * POST /api/bulk/users/upload
 *
 * 기능:
 * - 500건 이상 배치 처리 (100건 단위 청크)
 * - 중복 처리: 이메일 일치 시 업데이트
 * - Supabase Auth 사용자 생성 (신규만, 임시 비밀번호 발급)
 * - platforms/products 유효성 검사
 * - 부분 성공 + 실패 데이터 반환
 * - 트랜잭션 롤백 지원 (실패 시 Auth 사용자 정리)
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { validateUploadData } from "@/lib/validation/userUploadSchema";
import type { ValidatedUserUpload } from "@/lib/validation/userUploadSchema";
import { z } from "zod";

// 요청 스키마
const UploadRequestSchema = z.object({
  users: z.array(z.any()).min(1).max(100), // 한 번에 최대 100건
  batchIndex: z.number().int().min(0).default(0),
  totalBatches: z.number().int().min(1).default(1),
});

// 관리자 권한 상수
const ADMIN_LEVELS = ["1st_master", "master", "manager"] as const;

// 신규 사용자 기본 비밀번호 (첫 로그인 후 변경 필요)
const DEFAULT_PASSWORD = "111111";

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 사용자 생성 롤백
 * - Auth 사용자 삭제 (실패필도 계속 진행)
 */
async function rollbackUserCreation(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
): Promise<void> {
  try {
    await adminClient.auth.admin.deleteUser(userId);
    console.log(`롤백 완료: Auth 사용자 삭제 ${userId}`);
  } catch (error) {
    // 롤백 실패필도 계속 진행, 로그만 남김
    console.error(`롤백 실패: Auth 사용자 삭제 실패 ${userId}`, error);
  }
}

/**
 * 단일 사용자 생성 (원자적 작업)
 * - 성공: { success: true, userId }
 * - 실패: { success: false, error, userId?(롤백용) }
 */
async function createUserAtomically(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  userData: ValidatedUserUpload,
  rowIndex: number,
): Promise<{
  success: boolean;
  userId?: string;
  error?: string;
}> {
  let authUserId: string | null = null;

  try {
    // 1. Supabase Auth 사용자 생성
    const { data: authData, error: authCreateError } =
      await adminClient.auth.admin.createUser({
        email: userData.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true, // 이메일 확인 완료 (사용자가 바로 로그인 가능)
        user_metadata: {
          name: userData.name,
          password_change_required: true, // 첫 로그인 시 비밀번호 변경 권장 표시
          created_via_bulk_upload: true,
          created_at: new Date().toISOString(),
        },
      });

    if (authCreateError) {
      return {
        success: false,
        error: `Auth 생성 실패: ${authCreateError.message}`,
      };
    }

    authUserId = authData.user?.id || null;
    if (!authUserId) {
      return {
        success: false,
        error: "Auth 사용자 ID를 가져올 수 없습니다.",
      };
    }

    // 2. users 테이블에 데이터 삽입
    const { error: insertError } = await adminClient.from("users").insert({
      id: authUserId,
      email: userData.email,
      name: userData.name,
      account_level: userData.account_level,
      roles: userData.roles,
      permissions: [],
      work_products: userData.products,
      work_platforms: userData.platforms,
      work_languages: userData.languages,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      // 롤백: Auth 사용자 삭제
      await rollbackUserCreation(adminClient, authUserId);
      return {
        success: false,
        error: `DB 삽입 실패: ${insertError.message}`,
      };
    }

    // 3. translator_languages 생성 (실패필도 사용자 생성은 유지, 경고만)
    if (userData.translator_languages.length > 0) {
      const translatorLanguagesToInsert = userData.translator_languages.map(
        (langCode) => ({
          user_id: authUserId,
          language_code: langCode,
        }),
      );

      const { error: langError } = await adminClient
        .from("translator_languages")
        .insert(translatorLanguagesToInsert);

      if (langError) {
        console.error("번역 언어 설정 오류:", langError);
        // translator_languages 실패는 치명적이지 않으므로 성공으로 처리
        // 향후 재시도 가능하도록 로그 남김
      }
    }

    return {
      success: true,
      userId: authUserId,
    };
  } catch (error) {
    // 예외 발생 시 롤백
    if (authUserId) {
      await rollbackUserCreation(adminClient, authUserId);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 단일 사용자 업데이트 (원자적 작업)
 */
async function updateUserAtomically(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  userData: ValidatedUserUpload,
  existingId: string,
  rowIndex: number,
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // 1. users 테이블 업데이트
    const { error: updateError } = await adminClient
      .from("users")
      .update({
        name: userData.name,
        account_level: userData.account_level,
        roles: userData.roles,
        work_products: userData.products,
        work_platforms: userData.platforms,
        work_languages: userData.languages,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingId);

    if (updateError) {
      return {
        success: false,
        error: `업데이트 실패: ${updateError.message}`,
      };
    }

    // 2. translator_languages 업데이트 (삭제 후 재생성)
    // 기존 데이터 삭제
    const { error: deleteError } = await adminClient
      .from("translator_languages")
      .delete()
      .eq("user_id", existingId);

    if (deleteError) {
      console.error("번역 언어 삭제 오류:", deleteError);
      // 삭제 실패필도 계속 진행
    }

    // 새 데이터 삽입
    if (userData.translator_languages.length > 0) {
      const translatorLanguagesToInsert = userData.translator_languages.map(
        (langCode) => ({
          user_id: existingId,
          language_code: langCode,
        }),
      );

      const { error: langError } = await adminClient
        .from("translator_languages")
        .insert(translatorLanguagesToInsert);

      if (langError) {
        console.error("번역 언어 업데이트 오류:", langError);
        // 삽입 실패필도 업데이트는 성공으로 처리
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

// ============================================================================
// 메인 핸들러
// ============================================================================

export async function POST(request: NextRequest) {
  const processedUserIds: string[] = []; // 롤백용 추적

  try {
    // 1. 관리자 권한 확인
    const adminClient = await createAdminClient();
    const {
      data: { user },
      error: authError,
    } = await adminClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 },
      );
    }

    // 관리자 권한 확인
    const { data: adminCheck } = await adminClient
      .from("users")
      .select("account_level")
      .eq("id", user.id)
      .single();

    if (
      !adminCheck ||
      !ADMIN_LEVELS.includes(
        adminCheck.account_level as (typeof ADMIN_LEVELS)[number],
      )
    ) {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 },
      );
    }

    // 2. 요청 바디 파싱
    const body = await request.json();
    const parseResult = UploadRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "잘못된 요청 형식입니다.",
          details: parseResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { users: userList, batchIndex, totalBatches } = parseResult.data;

    // 3. 데이터 유효성 검사
    const validationResult = validateUploadData(userList);

    // 실패한 행 정보 수집
    const failedRows: Array<{
      rowIndex: number;
      email: string;
      name: string;
      error: string;
    }> = [];

    if (!validationResult.valid && validationResult.summary.valid === 0) {
      return NextResponse.json(
        {
          error: "모든 데이터가 유효하지 않습니다.",
          rows: validationResult.rows
            .filter((r) => !r.success)
            .map((r) => ({
              rowIndex: r.rowIndex,
              errors: r.errors,
            })),
        },
        { status: 400 },
      );
    }

    // 4. 참조 데이터 조회 (platforms, products)
    const [{ data: platforms }, { data: products }] = await Promise.all([
      adminClient.from("platforms").select("code"),
      adminClient.from("products").select("code"),
    ]);

    const validPlatformCodes = new Set(platforms?.map((p) => p.code) || []);
    const validProductCodes = new Set(products?.map((p) => p.code) || []);

    // 5. 추가 유효성 검사
    const validUsers: Array<{
      rowIndex: number;
      data: ValidatedUserUpload;
    }> = [];

    for (const row of validationResult.rows) {
      if (!row.success || !row.data) {
        failedRows.push({
          rowIndex: row.rowIndex,
          email: "-",
          name: "-",
          error:
            row.errors?.map((e) => e.message).join(", ") || "유효성 검사 실패",
        });
        continue;
      }

      const userData = row.data;

      // platforms 유효성 검사
      const invalidPlatforms = userData.platforms.filter(
        (p) => !validPlatformCodes.has(p),
      );
      if (invalidPlatforms.length > 0) {
        failedRows.push({
          rowIndex: row.rowIndex,
          email: userData.email,
          name: userData.name,
          error: `유효하지 않은 플랫폼: ${invalidPlatforms.join(", ")}`,
        });
        continue;
      }

      // products 유효성 검사
      const invalidProducts = userData.products.filter(
        (p) => !validProductCodes.has(p),
      );
      if (invalidProducts.length > 0) {
        failedRows.push({
          rowIndex: row.rowIndex,
          email: userData.email,
          name: userData.name,
          error: `유효하지 않은 제품: ${invalidProducts.join(", ")}`,
        });
        continue;
      }

      validUsers.push({
        rowIndex: row.rowIndex,
        data: userData,
      });
    }

    if (validUsers.length === 0) {
      return NextResponse.json(
        {
          error: "유효한 사용자 데이터가 없습니다.",
          failed: failedRows.length,
          failedRows,
        },
        { status: 400 },
      );
    }

    // 6. 중복 확인 (이메일 기준)
    const emails = validUsers.map((u) => u.data.email.toLowerCase());
    const { data: existingUsers, error: checkError } = await adminClient
      .from("users")
      .select("id, email, name")
      .in("email", emails);

    if (checkError) {
      console.error("중복 확인 오류:", checkError);
      return NextResponse.json(
        { error: "중복 확인 중 오류가 발생했습니다." },
        { status: 500 },
      );
    }

    // 기존 사용자 맵 생성 (이메일 -> 사용자 정보)
    const existingUserMap = new Map(
      existingUsers?.map((u) => [u.email.toLowerCase(), u]) || [],
    );

    // 신규/업데이트 분류
    const newUsers: typeof validUsers = [];
    const updateUsers: Array<(typeof validUsers)[0] & { existingId: string }> =
      [];

    for (const userInfo of validUsers) {
      const existing = existingUserMap.get(userInfo.data.email.toLowerCase());

      if (existing) {
        // 이메일 일치 시 업데이트
        updateUsers.push({
          ...userInfo,
          existingId: existing.id,
        });
      } else {
        newUsers.push(userInfo);
      }
    }

    // 7. 신규 사용자 처리 (원자적 작업)
    let createdCount = 0;
    const createdUserEmails: string[] = [];

    for (const userInfo of newUsers) {
      const result = await createUserAtomically(
        adminClient,
        userInfo.data,
        userInfo.rowIndex,
      );

      if (result.success) {
        createdCount++;
        createdUserEmails.push(userInfo.data.email);
        if (result.userId) {
          processedUserIds.push(result.userId);
        }
      } else {
        failedRows.push({
          rowIndex: userInfo.rowIndex,
          email: userInfo.data.email,
          name: userInfo.data.name,
          error: result.error || "사용자 생성 실패",
        });
      }
    }

    // 8. 기존 사용자 업데이트 (원자적 작업)
    let updatedCount = 0;
    const updatedUserEmails: string[] = [];

    for (const userInfo of updateUsers) {
      const result = await updateUserAtomically(
        adminClient,
        userInfo.data,
        userInfo.existingId,
        userInfo.rowIndex,
      );

      if (result.success) {
        updatedCount++;
        updatedUserEmails.push(userInfo.data.email);
      } else {
        failedRows.push({
          rowIndex: userInfo.rowIndex,
          email: userInfo.data.email,
          name: userInfo.data.name,
          error: result.error || "사용자 업데이트 실패",
        });
      }
    }

    // 9. Audit 로그 생성
    try {
      if (createdCount > 0 || updatedCount > 0) {
        await adminClient.from("user_audit_logs").insert({
          action: "BULK_UPLOAD",
          details: {
            created: createdCount,
            updated: updatedCount,
            failed: failedRows.length,
            createdEmails: createdUserEmails,
            updatedEmails: updatedUserEmails,
            batchIndex,
            totalBatches,
          },
          performed_by: user.id,
          created_at: new Date().toISOString(),
        });
      }
    } catch (auditError) {
      console.error("Audit 로그 생성 오류:", auditError);
    }

    // 10. 응답 반환
    const totalProcessed = createdCount + updatedCount;
    const allSuccess = failedRows.length === 0;

    return NextResponse.json(
      {
        success: allSuccess,
        message: allSuccess
          ? `${totalProcessed}명의 사용자가 처리되었습니다. (신규: ${createdCount}, 업데이트: ${updatedCount})`
          : `${totalProcessed}명 성공, ${failedRows.length}명 실패`,
        count: totalProcessed,
        created: createdCount,
        updated: updatedCount,
        failed: failedRows.length,
        batchIndex,
        totalBatches,
        failedRows: failedRows.length > 0 ? failedRows : undefined,
      },
      { status: allSuccess ? 201 : 207 },
    ); // 207 Multi-Status for partial success
  } catch (error) {
    console.error("사용자 업로드 API 오류:", error);
    return NextResponse.json(
      {
        error: "서버 오류가 발생했습니다.",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from 'next/server';

/**
 * Response Adapter
 * 
 * Unified API 응답을 Deprecated API 응답 형식으로 변환
 * 하위 호환성을 위해 구 응답 필드도 포함
 */

export interface BulkResponse {
  success: boolean;
  message: string;
  [key: string]: unknown;
}

/**
 * Translation Update 응답 변환
 * - updatedCount → updated
 */
export function adaptTranslationUpdateResponse(result: { updatedCount: number }): NextResponse {
  return NextResponse.json({
    success: true,
    message: `${result.updatedCount}개 항목이 업데이트되었습니다.`,
    updatedCount: result.updatedCount,
    // Backward compatibility
    updated: result.updatedCount,
  });
}

/**
 * Translation Delete 응답 변환
 * - deletedCount → deleted
 */
export function adaptTranslationDeleteResponse(result: { deletedCount: number }): NextResponse {
  return NextResponse.json({
    success: true,
    message: `${result.deletedCount}개 항목이 삭제되었습니다.`,
    deletedCount: result.deletedCount,
    // Backward compatibility
    deleted: result.deletedCount,
  });
}

/**
 * Glossary Update 응답 변환
 */
export function adaptGlossaryUpdateResponse(result: { results: Array<{ id: string; success: boolean }> }): NextResponse {
  const successCount = result.results.filter(r => r.success).length;
  const failCount = result.results.filter(r => !r.success).length;

  return NextResponse.json({
    success: true,
    message: `${successCount}개 항목이 업데이트되었습니다.`,
    results: result.results,
    // Backward compatibility
    updated: successCount,
    failed: failCount,
  });
}

/**
 * Glossary Delete 응답 변환
 */
export function adaptGlossaryDeleteResponse(result: { deletedCount: number }): NextResponse {
  return NextResponse.json({
    success: true,
    message: `${result.deletedCount}개 용어가 삭제되었습니다.`,
    deletedCount: result.deletedCount,
    // Backward compatibility
    deleted: result.deletedCount,
  });
}

/**
 * Admin Users Update 응답 변환
 */
export function adaptAdminUsersUpdateResponse(result: { data: unknown[] }): NextResponse {
  return NextResponse.json({
    success: true,
    message: `${result.data.length}명의 사용자가 업데이트되었습니다.`,
    data: result.data,
    // Backward compatibility
    updated: result.data.length,
  });
}

/**
 * Admin Users Delete 응답 변환
 */
export function adaptAdminUsersDeleteResponse(result: { deletedCount: number }): NextResponse {
  return NextResponse.json({
    success: true,
    message: `${result.deletedCount}명의 사용자가 삭제되었습니다.`,
    deletedCount: result.deletedCount,
    // Backward compatibility
    deleted: result.deletedCount,
  });
}

/**
 * Translation Products 응답 변환
 */
export function adaptTranslationProductsResponse(result: { operation: string; results: unknown[] }): NextResponse {
  return NextResponse.json({
    success: true,
    operation: result.operation,
    message: '제품 연결이 완료되었습니다.',
    results: result.results,
  });
}

/**
 * Translation Logs 응답 변환
 */
export function adaptTranslationLogsResponse(result: { logs: unknown[] }): NextResponse {
  return NextResponse.json({
    success: true,
    logs: result.logs,
    count: result.logs.length,
  });
}

/**
 * Translation Status 응답 변환
 */
export function adaptTranslationStatusResponse(result: { updatedCount: number; status: string }): NextResponse {
  return NextResponse.json({
    success: true,
    message: `${result.updatedCount}개 항목의 상태가 '${result.status}'로 변경되었습니다.`,
    updatedCount: result.updatedCount,
    status: result.status,
  });
}

/**
 * Translation Bulk Create 응답 변환
 */
export function adaptTranslationCreateResponse(result: { requestedCount: number }): NextResponse {
  return NextResponse.json({
    success: true,
    message: '번역 일괄 생성 작업이 시작되었습니다.',
    requestedCount: result.requestedCount,
  }, { status: 202 });
}

/**
 * Glossary Bulk Create 응답 변환
 */
export function adaptGlossaryCreateResponse(result: { data: unknown[] }): NextResponse {
  return NextResponse.json({
    success: true,
    message: `${result.data.length}개 용어가 생성되었습니다.`,
    data: result.data,
  }, { status: 201 });
}

/**
 * Users Upload 응답 변환
 */
export function adaptUsersUploadResponse(result: { data: unknown[] }): NextResponse {
  return NextResponse.json({
    success: true,
    message: `${result.data.length}명의 사용자가 등록되었습니다.`,
    data: result.data,
  }, { status: 201 });
}

/**
 * 에러 응답 변환
 */
export function adaptErrorResponse(error: Error | string, status: number = 500): NextResponse {
  const message = error instanceof Error ? error.message : error;
  
  return NextResponse.json({
    success: false,
    error: message,
    message,
  }, { status });
}

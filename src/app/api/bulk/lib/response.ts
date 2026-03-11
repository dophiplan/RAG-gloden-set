import { NextResponse } from 'next/server';

/**
 * Response Utilities
 * 
 * 공통 응답 유틸리티
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  console.error('Unhandled error:', error);
  return NextResponse.json(
    { error: '서버 오류가 발생했습니다.' },
    { status: 500 }
  );
}

export function successResponse(data: Record<string, unknown>, status: number = 200): NextResponse {
  return NextResponse.json(
    { success: true, ...data },
    { status }
  );
}

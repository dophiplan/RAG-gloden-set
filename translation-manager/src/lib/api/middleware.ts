/**
 * API Middleware
 * Reusable middleware functions for API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

/**
 * Authentication context passed to handlers
 */
export interface AuthContext {
  user: {
    id: string;
    email?: string;
    aud?: string;
    role?: string;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
    created_at?: string;
  };
  profile?: {
    id: string;
    email: string;
    name: string | null;
    roles: string[];
    password_reset_required: boolean;
    created_at: string;
    updated_at: string;
  } | null;
  supabase: SupabaseClient;
}

/**
 * API Handler function type
 */
export type ApiHandler = (
  req: NextRequest,
  ctx: AuthContext
) => Promise<NextResponse>;

/**
 * Check if user has master or 1st_master role
 */
export function isMaster(profile?: AuthContext['profile'] | null): boolean {
  return (profile?.roles?.includes('master') || profile?.roles?.includes('1st_master')) ?? false;
}

/**
 * Authentication middleware
 * Ensures the user is authenticated before calling the handler
 */
export function withAuth(handler: ApiHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        return unauthorized();
      }

      // Fetch user profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      const ctx: AuthContext = { user, profile, supabase };
      return await handler(req, ctx);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return serverError();
    }
  };
}

/**
 * Master role middleware
 * Ensures the user has the master role
 */
export function withMasterRole(handler: ApiHandler) {
  return withAuth(async (req, ctx) => {
    if (!isMaster(ctx.profile)) {
      return forbidden('권한이 없습니다. 관리자 권한이 필요합니다.');
    }
    return handler(req, ctx);
  });
}

/**
 * Validation middleware
 * Validates request body against a Zod schema
 */
export function withValidation<T>(
  schema: z.ZodSchema<T>,
  handler: (req: NextRequest, ctx: AuthContext, body: T) => Promise<NextResponse>
) {
  return withAuth(async (req, ctx) => {
    try {
      const body = await req.json();
      const result = schema.safeParse(body);

      if (!result.success) {
        return badRequest('잘못된 요청입니다.', result.error.issues, 'VALIDATION_ERROR');
      }

      return handler(req, ctx, result.data);
    } catch (error) {
      return badRequest('요청 본문을 파싱할 수 없습니다.', undefined, 'INVALID_JSON');
    }
  });
}

/**
 * Error handling wrapper
 * Catches and formats errors consistently
 */
export function withErrorHandling(handler: ApiHandler) {
  return withAuth(async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      console.error('API error:', error);

      if (error instanceof z.ZodError) {
        return badRequest('유효성 검사 실패', error.issues, 'VALIDATION_ERROR');
      }

      return serverError(
        error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        'INTERNAL_ERROR'
      );
    }
  });
}

/**
 * Combined middleware: Auth + Validation + Error Handling
 */
export function withApiMiddleware<T>(
  schema: z.ZodSchema<T>,
  handler: (req: NextRequest, ctx: AuthContext, body: T) => Promise<NextResponse>
) {
  return withErrorHandling(
    withAuth(async (req, ctx) => {
      const body = await req.json();
      const result = schema.safeParse(body);

      if (!result.success) {
        return badRequest('잘못된 요청입니다.', result.error.issues, 'VALIDATION_ERROR');
      }

      return handler(req, ctx, result.data);
    })
  );
}

/**
 * Helper to create success response
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Standard API error response format
 */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Helper to create standardized error response
 */
export function errorResponse(
  code: string,
  message: string,
  status: number = 500,
  details?: unknown
): NextResponse {
  const response: ApiError = {
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };
  return NextResponse.json(response, { status });
}

/**
 * Standard error response helpers
 */
export function unauthorized(message = '인증이 필요합니다.', code = 'UNAUTHORIZED'): NextResponse {
  return errorResponse(code, message, 401);
}

export function forbidden(message = '권한이 없습니다.', code = 'FORBIDDEN'): NextResponse {
  return errorResponse(code, message, 403);
}

export function badRequest(message: string, details?: unknown, code = 'BAD_REQUEST'): NextResponse {
  return errorResponse(code, message, 400, details);
}

export function notFound(message = '요청한 리소스를 찾을 수 없습니다.', code = 'NOT_FOUND'): NextResponse {
  return errorResponse(code, message, 404);
}

export function conflict(message: string, code = 'CONFLICT'): NextResponse {
  return errorResponse(code, message, 409);
}

export function serverError(message = '서버 오류가 발생했습니다.', code = 'INTERNAL_SERVER_ERROR'): NextResponse {
  return errorResponse(code, message, 500);
}

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
  return profile?.roles?.includes('master') || profile?.roles?.includes('1st_master') ?? false;
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
        return NextResponse.json(
          { error: '인증이 필요합니다.' },
          { status: 401 }
        );
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
      return NextResponse.json(
        { error: '서버 오류가 발생했습니다.' },
        { status: 500 }
      );
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
      return NextResponse.json(
        { error: '권한이 없습니다. 관리자 권한이 필요합니다.' },
        { status: 403 }
      );
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
        return NextResponse.json(
          {
            error: '잘못된 요청입니다.',
            details: result.error.issues,
          },
          { status: 400 }
        );
      }

      return handler(req, ctx, result.data);
    } catch (error) {
      return NextResponse.json(
        { error: '요청 본문을 파싱할 수 없습니다.' },
        { status: 400 }
      );
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
        return NextResponse.json(
          {
            error: '유효성 검사 실패',
            details: error.issues,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
        { status: 500 }
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
        return NextResponse.json(
          {
            error: '잘못된 요청입니다.',
            details: result.error.issues,
          },
          { status: 400 }
        );
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
 * Helper to create error response
 */
export function errorResponse(
  error: string,
  status: number = 500,
  details?: unknown
): NextResponse {
  return NextResponse.json({ error, details }, { status });
}

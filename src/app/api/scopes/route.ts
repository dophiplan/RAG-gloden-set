import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, isErrorResponse } from "@/lib/api/auth-middleware";
import {
  scopeCreateSchema,
  validateAndSanitize,
} from "@/lib/validation/schemas";
import {
  apiCachedSuccess,
  apiSuccess,
  apiUnauthorized,
  apiInternalError,
  apiBadRequest,
  apiConflict,
} from "@/lib/api/response";
import { isSQLiteMode, getSQLiteConnection } from "@/lib/api/sqlite-helper";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // Cache for 1 hour

/**
 * GET /api/scopes
 * Fetch all scope types (optionally filtered by product)
 * Query params:
 *   - productCode: 제품 코드 (선택). 해당 제품의 기본 분류 + 추가 분류 반환
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productCode = searchParams.get("productCode");

    // SQLite mode
    if (isSQLiteMode()) {
      const db = await getSQLiteConnection();

      interface Scope {
        id: string;
        code: string;
        name: string;
        description: string | null;
        sort_order: number;
        is_active: boolean;
      }

      // 기본 4개 분류는 항상 포함
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scopes = db.all<any>(`
        SELECT * FROM scopes 
        WHERE is_active = 1 
        ORDER BY sort_order ASC
      `) as Scope[];

      // 특정 제품이 지정된 경우, 해당 제품의 추가 분류도 포함
      if (productCode) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const additionalScopes = db.all<any>(
          `
          SELECT s.* FROM scopes s
          INNER JOIN product_scopes ps ON s.code = ps.scope_code
          WHERE ps.product_code = ? AND s.is_active = 1
          ORDER BY s.sort_order ASC
        `,
          [productCode],
        ) as Scope[];

        // 중복 제거하고 병합
        const scopeCodes = new Set(scopes.map((s) => s.code));
        for (const scope of additionalScopes) {
          if (!scopeCodes.has(scope.code)) {
            scopes.push(scope);
          }
        }
        // 다시 sort_order로 정렬
        scopes.sort((a, b) => a.sort_order - b.sort_order);
      }

      return apiSuccess({ scopes: scopes || [] });
    }

    // Supabase mode
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // Development: Allow bypass for reference data
    if ((authError || !user) && process.env.ALLOW_AUTH_BYPASS !== "true") {
      return apiUnauthorized();
    }

    if (productCode) {
      // 제품별 분류 조회: 기본 분류 + 해당 제품의 추가 분류
      const { data: scopes, error } = await supabase
        .from("scopes")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      // 추가 분류 조회
      const { data: additionalScopes, error: psError } = await supabase
        .from("product_scopes")
        .select("scopes(*)")
        .eq("product_code", productCode);

      if (psError) throw psError;

      // 병합 및 중복 제거
      const allScopes = [...(scopes || [])];
      const scopeCodes = new Set(
        allScopes.map((s: { code: string }) => s.code),
      );

      for (const item of additionalScopes || []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scopeData = (item as any).scopes as {
          code: string;
          sort_order: number;
        } | null;
        if (scopeData && !scopeCodes.has(scopeData.code)) {
          allScopes.push(scopeData as (typeof allScopes)[0]);
        }
      }

      // 정렬
      allScopes.sort((a, b) => a.sort_order - b.sort_order);

      return apiCachedSuccess({ scopes: allScopes });
    } else {
      // 모든 분류 조회
      const { data: scopes, error } = await supabase
        .from("scopes")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      return apiCachedSuccess({ scopes });
    }
  } catch (error) {
    console.error("Error fetching scopes:", error);
    return apiInternalError("분류 목록을 불러오는데 실패했습니다.");
  }
}

/**
 * POST - Create a new scope (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin permission
    const auth = await requireAdmin();
    if (isErrorResponse(auth)) return auth.error;

    const { supabase } = auth.context;

    // Parse and validate
    const rawBody = await request.json();
    const validation = validateAndSanitize(scopeCreateSchema, rawBody);

    if (!validation.success) {
      return apiBadRequest(validation.error, "VALIDATION_ERROR");
    }

    const body = validation.data;
    const { code, name, description, sort_order } = body;

    // Check if code already exists
    const { data: existing } = await supabase
      .from("scopes")
      .select("id")
      .eq("code", code)
      .single();

    if (existing) {
      return apiConflict("이미 존재하는 분류 코드입니다.");
    }

    // Insert new scope
    const { data: scope, error } = await supabase
      .from("scopes")
      .insert({
        code,
        name,
        description: description || null,
        sort_order,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return apiSuccess({ scope });
  } catch (error) {
    console.error("Error creating scope:", error);
    return apiInternalError("분류 생성에 실패했습니다.");
  }
}

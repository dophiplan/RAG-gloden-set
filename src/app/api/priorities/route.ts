import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin, isErrorResponse } from "@/lib/api/auth-middleware";
import {
  priorityCreateSchema,
  validateAndSanitize,
} from "@/lib/validation/schemas";
import {
  apiCachedSuccess,
  apiSuccess,
  apiInternalError,
  apiBadRequest,
  apiConflict,
} from "@/lib/api/response";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // Cache for 1 hour

/**
 * GET /api/priorities
 * 활성화된 우선순위 목록 조회 (sort_order 내림차순)
 */
export async function GET() {
  try {
    const supabase = await createAdminClient();

    const { data: priorities, error } = await supabase
      .from("priority_levels")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: false });

    if (error) {
      console.error("[Priorities API] Fetch error:", error.message);
      return apiInternalError("우선순위 목록을 불러오는데 실패했습니다.");
    }

    return apiCachedSuccess({ priorities: priorities || [] });
  } catch (error) {
    console.error("[Priorities API] Unexpected error:", error);
    return apiInternalError("우선순위 목록을 불러오는데 실패했습니다.");
  }
}

/**
 * POST - Create a new priority (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin permission
    const auth = await requireAdmin();
    if (isErrorResponse(auth)) return auth.error;

    const { supabase } = auth.context;

    // Parse and validate
    const rawBody = await request.json();
    const validation = validateAndSanitize(priorityCreateSchema, rawBody);

    if (!validation.success) {
      return apiBadRequest(validation.error, "VALIDATION_ERROR");
    }

    const body = validation.data;
    const { code, label, color, sort_order } = body;

    // Check duplicate code
    const { data: existing, error: checkError } = await supabase
      .from("priority_levels")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    if (checkError) {
      console.error(
        "[Priorities API] Duplicate check error:",
        checkError.message,
      );
      return apiInternalError("중복 검사 중 오류가 발생했습니다.");
    }

    if (existing) {
      return apiConflict("이미 존재하는 우선순위 코드입니다.");
    }

    // Insert new priority
    const { data: priority, error } = await supabase
      .from("priority_levels")
      .insert({
        code,
        label,
        color,
        sort_order,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return apiSuccess({ priority });
  } catch (error) {
    console.error("[Priorities API] Create error:", error);
    return apiInternalError("우선순위 생성에 실패했습니다.");
  }
}

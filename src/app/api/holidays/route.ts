import { createAdminClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api/response";

/**
 * GET /api/holidays
 *
 * Reference data 조회 - KR, JP 국가의 휴일 목록 반환
 * 오늘 이후 휴일을 오름차순으로 정렬
 */
export async function GET() {
  try {
    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .from("holidays")
      .select("*")
      .in("country_code", ["KR", "JP"])
      .gte("holiday_date", new Date().toISOString().split("T")[0])
      .order("holiday_date", { ascending: true });

    if (error) {
      console.warn("[Holidays API] Table error:", error.message);
      return apiSuccess({ data: [] });
    }

    return apiSuccess({ data: data || [] });
  } catch (error) {
    console.error("[Holidays API] Error:", error);
    return apiError(
      "HOLIDAYS_FETCH_ERROR",
      "휴일 정보를 불러오는데 실패했습니다",
      500,
    );
  }
}

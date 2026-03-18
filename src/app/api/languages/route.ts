import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin, isErrorResponse } from "@/lib/api/auth-middleware";
import {
  languageCreateSchema,
  validateAndSanitize,
} from "@/lib/validation/schemas";
import {
  apiSuccess,
  apiInternalError,
  apiBadRequest,
  apiConflict,
} from "@/lib/api/response";
import { isSQLiteMode, getSQLiteConnection } from "@/lib/api/sqlite-helper";

/**
 * GET - List all languages
 */
/**
 * GET /api/languages
 * 모든 언어 목록을 조회합니다. (공개 API)
 * @param _request - Next.js request 객체 (미사용)
 * @returns 언어 목록
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_: NextRequest) {
  try {
    // SQLite mode
    if (isSQLiteMode()) {
      const db = await getSQLiteConnection();
      const languages = db.all(
        "SELECT * FROM languages ORDER BY display_order ASC, name ASC",
      );
      return apiSuccess({ languages: languages || [] });
    }

    // Supabase mode: admin client로 언어 목록 조회
    const adminClient = createAdminClient();
    const { data: languages, error } = await adminClient
      .from("languages")
      .select("*")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;
    return apiSuccess({ languages });
  } catch (error) {
    console.error("Error fetching languages:", error);
    return apiInternalError("언어 목록을 불러오는데 실패했습니다.");
  }
}

/**
 * POST /api/languages
 * 새 언어를 생성합니다. (관리자 전용)
 * @param request - Next.js request 객체
 * @returns 생성된 언어 정보
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate (공통)
    const rawBody = await request.json();
    const validation = validateAndSanitize(languageCreateSchema, rawBody);
    if (!validation.success) {
      return apiBadRequest(validation.error, "VALIDATION_ERROR");
    }
    const body = validation.data;
    const { code, name, description, display_order } = body;

    // SQLite mode
    if (isSQLiteMode()) {
      const db = await getSQLiteConnection();

      // Check duplicate
      const existing = db.get("SELECT id FROM languages WHERE code = ?", [
        code,
      ]);
      if (existing) {
        return apiConflict("이미 존재하는 언어 코드입니다.");
      }

      // Insert
      const id = crypto.randomUUID();
      db.run(
        "INSERT INTO languages (id, code, name, description, display_order) VALUES (?, ?, ?, ?, ?)",
        [id, code, name, description || null, display_order || 0],
      );

      const language = db.get("SELECT * FROM languages WHERE id = ?", [id]);
      return apiSuccess({ language });
    }

    // Supabase mode (기존 코드)
    const auth = await requireAdmin();
    if (isErrorResponse(auth)) return auth.error;
    // admin context에서 supabase client만 사용 (user는 인증 확인용으로 이미 검증됨)
    const { supabase } = auth.context;

    // Check duplicate
    const { data: existing } = await supabase
      .from("languages")
      .select("id")
      .eq("code", code)
      .single();
    if (existing) {
      return apiConflict("이미 존재하는 언어 코드입니다.");
    }

    // Insert
    const { data: language, error } = await supabase
      .from("languages")
      .insert({
        code,
        name,
        description: description || null,
        display_order: display_order || 0,
      })
      .select()
      .single();
    if (error) throw error;
    return apiSuccess({ language });
  } catch (error) {
    console.error("Error creating language:", error);
    return apiInternalError("언어 생성에 실패했습니다.");
  }
}

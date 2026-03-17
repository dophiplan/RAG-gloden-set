import { NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdmin, isErrorResponse } from "@/lib/api/auth-middleware";
import {
  platformCreateSchema,
  validateAndSanitize,
} from "@/lib/validation/schemas";
import {
  apiSuccess,
  apiUnauthorized,
  apiInternalError,
  apiBadRequest,
  apiConflict,
} from "@/lib/api/response";
import { isSQLiteMode, getSQLiteConnection } from "@/lib/api/sqlite-helper";

/**
 * GET - List all platforms
 */
export async function GET() {
  try {
    // SQLite mode
    if (isSQLiteMode()) {
      const db = await getSQLiteConnection();
      const platforms = db.all(
        "SELECT * FROM platforms ORDER BY display_order ASC, name ASC",
      );
      return apiSuccess({ platforms: platforms || [] });
    }

    // Supabase mode (기존 코드)
    const adminClient = createAdminClient();
    const { data: platforms, error } = await adminClient
      .from("platforms")
      .select("*")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;
    return apiSuccess({ platforms });
  } catch (error) {
    console.error("Error fetching platforms:", error);
    return apiInternalError("플랫폼 목록을 불러오는데 실패했습니다.");
  }
}

/**
 * POST - Create a new platform (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate (공통)
    const rawBody = await request.json();
    const validation = validateAndSanitize(platformCreateSchema, rawBody);
    if (!validation.success) {
      return apiBadRequest(validation.error, "VALIDATION_ERROR");
    }
    const body = validation.data;
    const { code, name, description, display_order } = body;

    // SQLite mode
    if (isSQLiteMode()) {
      const db = await getSQLiteConnection();

      // Check duplicate
      const existing = db.get("SELECT id FROM platforms WHERE code = ?", [
        code,
      ]);
      if (existing) {
        return apiConflict("이미 존재하는 플랫폼 코드입니다.");
      }

      // Insert
      const id = crypto.randomUUID();
      db.run(
        "INSERT INTO platforms (id, code, name, description, display_order) VALUES (?, ?, ?, ?, ?)",
        [id, code, name, description || null, display_order ?? 0],
      );

      const platform = db.get("SELECT * FROM platforms WHERE id = ?", [id]);
      return apiSuccess({ platform });
    }

    // Supabase mode (기존 코드)
    const auth = await requireAdmin();
    if (isErrorResponse(auth)) return auth.error;
    const { user, supabase } = auth.context;

    // Check duplicate
    const { data: existing } = await supabase
      .from("platforms")
      .select("id")
      .eq("code", code)
      .single();
    if (existing) {
      return apiConflict("이미 존재하는 플랫폼 코드입니다.");
    }

    // Insert
    const { data: platform, error } = await supabase
      .from("platforms")
      .insert({
        code,
        name,
        description: description || null,
        display_order: display_order ?? 0,
      })
      .select()
      .single();
    if (error) throw error;
    return apiSuccess({ platform });
  } catch (error) {
    console.error("Error creating platform:", error);
    return apiInternalError("플랫폼 생성에 실패했습니다.");
  }
}

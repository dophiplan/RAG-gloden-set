import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin, isErrorResponse } from "@/lib/api/auth-middleware";
import {
  productCreateSchema,
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
 * GET - List all products
 */
/**
 * GET - 모든 제품 목록 조회
 * @param _request - Next.js 요청 객체 (사용하지 않음)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    // SQLite mode
    if (isSQLiteMode()) {
      const db = await getSQLiteConnection();
      const products = db.all(
        "SELECT * FROM products ORDER BY display_order ASC, name ASC",
      );
      return apiSuccess({ products: products || [] });
    }

    // Supabase mode (기존 코드)
    const adminClient = createAdminClient();
    const { data: products, error } = await adminClient
      .from("products")
      .select("*")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;
    return apiSuccess({ products });
  } catch (error) {
    console.error("Error fetching products:", error);
    return apiInternalError("제품 목록을 불러오는데 실패했습니다.");
  }
}

/**
 * POST - Create a new product (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate (공통)
    const rawBody = await request.json();
    const validation = validateAndSanitize(productCreateSchema, rawBody);
    if (!validation.success) {
      return apiBadRequest(validation.error, "VALIDATION_ERROR");
    }
    const body = validation.data;
    const { code, name, description, display_order } = body;

    // SQLite mode
    if (isSQLiteMode()) {
      const db = await getSQLiteConnection();

      // Check duplicate
      const existing = db.get("SELECT id FROM products WHERE code = ?", [code]);
      if (existing) {
        return apiConflict("이미 존재하는 제품 코드입니다.");
      }

      // Insert (DEFAULT 값 있는 컬럼은 제외)
      const id = crypto.randomUUID();
      db.run(
        "INSERT INTO products (id, code, name, description, display_order) VALUES (?, ?, ?, ?, ?)",
        [id, code, name, description || null, display_order || 0],
      );

      const product = db.get("SELECT * FROM products WHERE id = ?", [id]);
      return apiSuccess({ product });
    }

    // Supabase mode (기존 코드)
    const auth = await requireAdmin();
    if (isErrorResponse(auth)) return auth.error;
    // 인증된 관리자 정보에서 supabase 클라이언트 추출
    const { supabase } = auth.context;

    // Check duplicate
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("code", code)
      .single();
    if (existing) {
      return apiConflict("이미 존재하는 제품 코드입니다.");
    }

    // Insert
    const { data: product, error } = await supabase
      .from("products")
      .insert({
        code,
        name,
        description: description || null,
        display_order: display_order || 0,
      })
      .select()
      .single();
    if (error) throw error;
    return apiSuccess({ product });
  } catch (error) {
    console.error("Error creating product:", error);
    return apiInternalError("제품 생성에 실패했습니다.");
  }
}

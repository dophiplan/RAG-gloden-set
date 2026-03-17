import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireAdmin, isErrorResponse } from '@/lib/api/auth-middleware';
import { languageCreateSchema, validateAndSanitize } from '@/lib/validation/schemas';
import { apiSuccess, apiUnauthorized, apiInternalError, apiBadRequest, apiConflict } from '@/lib/api/response';
import { isSQLiteMode, getSQLiteConnection } from '@/lib/api/sqlite-helper';

/**
 * GET - List all languages
 */
export async function GET(request: NextRequest) {
  try {
    // SQLite mode
    if (isSQLiteMode()) {
      const db = await getSQLiteConnection();
      const languages = db.all('SELECT * FROM languages ORDER BY display_order ASC');
      return apiSuccess({ languages: languages || [] });
    }
    
    // Supabase mode (기존 코드)
    const adminClient = createAdminClient();
    const { data: languages, error } = await adminClient
      .from('languages')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;
    return apiSuccess({ languages });
  } catch (error) {
    console.error('Error fetching languages:', error);
    return apiInternalError('언어 목록을 불러오는데 실패했습니다.');
  }
}

/**
 * POST - Create a new language (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate (공통)
    const rawBody = await request.json();
    const validation = validateAndSanitize(languageCreateSchema, rawBody);
    if (!validation.success) {
      return apiBadRequest(validation.error, 'VALIDATION_ERROR');
    }
    const body = validation.data;
    const { code, name, description, display_order } = body;

    // SQLite mode
    if (isSQLiteMode()) {
      const db = await getSQLiteConnection();
      
      // Check duplicate
      const existing = db.get('SELECT id FROM languages WHERE code = ?', [code]);
      if (existing) {
        return apiConflict('이미 존재하는 언어 코드입니다.');
      }
      
      // Insert
      const id = crypto.randomUUID();
      db.run(
        'INSERT INTO languages (id, code, name, description, display_order) VALUES (?, ?, ?, ?, ?)',
        [id, code, name, description || null, display_order || 0]
      );
      
      const language = db.get('SELECT * FROM languages WHERE id = ?', [id]);
      return apiSuccess({ language });
    }
    
    // Supabase mode (기존 코드)
    const auth = await requireAdmin();
    if (isErrorResponse(auth)) return auth.error;
    const { user, supabase } = auth.context;
    
    // Check duplicate
    const { data: existing } = await supabase
      .from('languages')
      .select('id')
      .eq('code', code)
      .single();
    if (existing) {
      return apiConflict('이미 존재하는 언어 코드입니다.');
    }
    
    // Insert
    const { data: language, error } = await supabase
      .from('languages')
      .insert({ code, name, description: description || null, display_order: display_order || 0 })
      .select()
      .single();
    if (error) throw error;
    return apiSuccess({ language });
  } catch (error) {
    console.error('Error creating language:', error);
    return apiInternalError('언어 생성에 실패했습니다.');
  }
}

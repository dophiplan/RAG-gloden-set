import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { apiSuccess, apiUnauthorized, apiForbidden, apiNotFound, apiBadRequest, apiInternalError } from '@/lib/api/response';
import { isSQLiteMode, getSQLiteConnection } from '@/lib/api/sqlite-helper';

/**
 * PATCH - Update a language (master only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { code, name, description, display_order } = body;

    // SQLite mode
    if (isSQLiteMode()) {
      const db = await getSQLiteConnection();
      
      // Get current language
      const currentLanguage = db.get<{ code: string }>('SELECT code FROM languages WHERE id = ?', [id]);
      if (!currentLanguage) {
        return apiNotFound('언어');
      }
      
      // Check if code is being changed
      const isCodeChanging = code !== undefined && code !== currentLanguage.code;
      
      if (isCodeChanging) {
        // Check duplicate code
        const existing = db.get('SELECT id FROM languages WHERE code = ? AND id != ?', [code, id]);
        if (existing) {
          return apiBadRequest('이미 사용 중인 언어 코드입니다.');
        }
        
        // Cascade update related tables
        db.run('UPDATE translation_results SET language_code = ? WHERE language_code = ?', [code, currentLanguage.code]);
        db.run('UPDATE glossary SET language_code = ? WHERE language_code = ?', [code, currentLanguage.code]);
      }
      
      // Build update SQL
      const updates: string[] = [];
      const values: any[] = [];
      
      if (code !== undefined) { updates.push('code = ?'); values.push(code); }
      if (name !== undefined) { updates.push('name = ?'); values.push(name); }
      if (description !== undefined) { updates.push('description = ?'); values.push(description); }
      if (display_order !== undefined) { updates.push('display_order = ?'); values.push(display_order); }
      
      if (updates.length > 0) {
        values.push(id);
        // FK 제약 일시 비활성화 (코드 변경 시 연계 테이블 FK 위한 방지)
        db.run('PRAGMA foreign_keys = OFF');
        try {
          db.run(`UPDATE languages SET ${updates.join(', ')} WHERE id = ?`, values);
        } finally {
          db.run('PRAGMA foreign_keys = ON');
        }
      }
      
      const language = db.get('SELECT * FROM languages WHERE id = ?', [id]);
      return apiSuccess({ language });
    }
    
    // Supabase mode (기존 코드 그대로 유지)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiUnauthorized();
    }

    // Check if user is master
    const adminClient = createAdminClient();
    const { data: userProfile } = await adminClient
      .from('users')
      .select('roles')
      .eq('id', user.id)
      .single();

    const isMaster = userProfile?.roles?.includes('master') || userProfile?.roles?.includes('1st_master');

    if (!isMaster) {
      return apiForbidden('권한이 없습니다.');
    }

    // Get current language to check if code is changing
    const { data: currentLanguage } = await adminClient
      .from('languages')
      .select('code')
      .eq('id', id)
      .single();

    if (!currentLanguage) {
      return apiNotFound('언어');
    }

    // Check if code is being changed
    const isCodeChanging = code !== undefined && code !== currentLanguage.code;
    const is1stMaster = userProfile?.roles?.includes('1st_master');

    if (isCodeChanging) {
      // Check if code is in use (only if not 1st_master)
      if (!is1stMaster) {
        const [translationCheck, glossaryCheck] = await Promise.all([
          adminClient
            .from('translation_results')
            .select('id')
            .eq('language_code', currentLanguage.code)
            .limit(1),
          adminClient
            .from('glossary')
            .select('id')
            .eq('language_code', currentLanguage.code)
            .limit(1)
        ]);

        const isUsed = (translationCheck.data && translationCheck.data.length > 0) ||
                       (glossaryCheck.data && glossaryCheck.data.length > 0);

        if (isUsed) {
          return apiBadRequest('사용 중인 언어 코드는 수정할 수 없습니다.');
        }
      }

      // If allowed (1st_master or not in use), cascade update
      const [translationUpdate, glossaryUpdate] = await Promise.all([
        adminClient
          .from('translation_results')
          .update({ language_code: code })
          .eq('language_code', currentLanguage.code),
        adminClient
          .from('glossary')
          .update({ language_code: code })
          .eq('language_code', currentLanguage.code)
      ]);

      if (translationUpdate.error || glossaryUpdate.error) {
        console.error('Error cascading language code update:', translationUpdate.error || glossaryUpdate.error);
        return apiInternalError('언어 코드 업데이트 중 오류가 발생했습니다.');
      }
    }

    interface LanguageUpdateData {
      code?: string;
      name?: string;
      description?: string | null;
      display_order?: number;
    }

    const updateData: LanguageUpdateData = {};
    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (display_order !== undefined) updateData.display_order = display_order;

    const { data: language, error } = await adminClient
      .from('languages')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return apiSuccess({ language });
  } catch (error) {
    console.error('Error updating language:', error);
    return apiInternalError('언어 수정에 실패했습니다.');
  }
}

/**
 * DELETE - Delete a language (master only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // SQLite mode
    if (isSQLiteMode()) {
      const db = await getSQLiteConnection();
      
      // Get language info
      const language = db.get<{ code: string }>('SELECT code FROM languages WHERE id = ?', [id]);
      if (!language) {
        return apiNotFound('언어');
      }
      
      // Check related data
      const translationResults = db.get<{ count: number }>('SELECT COUNT(*) as count FROM translation_results WHERE language_code = ?', [language.code]);
      const hasRelatedData = (translationResults?.count ?? 0) > 0;
      
      if (hasRelatedData) {
        return apiBadRequest('사용 중인 언어는 삭제할 수 없습니다. 관련 데이터를 먼저 삭제하세요.');
      }
      
      // Delete language
      db.run('DELETE FROM languages WHERE id = ?', [id]);
      
      return apiSuccess({ 
        success: true,
        deleted: { language: language.code }
      });
    }
    
    // Supabase mode (기존 코드 그대로 유지)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiUnauthorized();
    }

    // Check if user is master
    const adminClient = createAdminClient();
    const { data: userProfile } = await adminClient
      .from('users')
      .select('roles')
      .eq('id', user.id)
      .single();

    const isMaster = userProfile?.roles?.includes('master') || userProfile?.roles?.includes('1st_master');

    if (!isMaster) {
      return apiForbidden('권한이 없습니다.');
    }

    // Get language info
    const { data: language } = await adminClient
      .from('languages')
      .select('code')
      .eq('id', id)
      .single();

    if (!language) {
      return apiNotFound('언어');
    }

    // Check if language is used in translation_results
    const { data: usedInTranslations } = await adminClient
      .from('translation_results')
      .select('id')
      .eq('language_code', language.code)
      .limit(1);

    if (usedInTranslations && usedInTranslations.length > 0) {
      return apiBadRequest('사용 중인 언어는 삭제할 수 없습니다.');
    }

    const { error } = await adminClient
      .from('languages')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return apiSuccess({ 
      success: true,
      deleted: { language: language.code }
    });
  } catch (error) {
    console.error('Error deleting language:', error);
    return apiInternalError('언어 삭제에 실패했습니다.');
  }
}

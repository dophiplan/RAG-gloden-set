import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { apiSuccess, apiUnauthorized, apiNotFound, apiBadRequest, apiInternalError } from '@/lib/api/response';
import { isSQLiteMode, getSQLiteConnection } from '@/lib/api/sqlite-helper';

/**
 * PATCH - Update a platform
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { code, name, description } = body;

    // SQLite mode
    if (isSQLiteMode()) {
      const db = await getSQLiteConnection();
      
      // Get current platform
      const currentPlatform = db.get<{ code: string }>('SELECT code FROM platforms WHERE id = ?', [id]);
      if (!currentPlatform) {
        return apiNotFound('플랫폼');
      }
      
      // Check if code is being changed
      const isCodeChanging = code !== undefined && code !== currentPlatform.code;
      
      if (isCodeChanging) {
        // Check duplicate code
        const existing = db.get('SELECT id FROM platforms WHERE code = ? AND id != ?', [code, id]);
        if (existing) {
          return apiBadRequest('이미 사용 중인 플랫폼 코드입니다.');
        }
        
        // Check if code is in use in translations
        const translationsWithPlatform = db.all<{ id: string; platform_completions: string; work_scope: string }>(
          'SELECT id, platform_completions, work_scope FROM translations WHERE platform_completions IS NOT NULL OR work_scope IS NOT NULL'
        );
        
        let isUsed = false;
        for (const t of translationsWithPlatform || []) {
          const completions = t.platform_completions ? JSON.parse(t.platform_completions) : {};
          const workScope = t.work_scope ? JSON.parse(t.work_scope) : [];
          if (currentPlatform.code in completions || workScope.includes(currentPlatform.code)) {
            isUsed = true;
            break;
          }
        }
        
        if (isUsed) {
          return apiBadRequest('사용 중인 플랫폼 코드는 수정할 수 없습니다.');
        }
      }
      
      // Build update SQL
      const updates: string[] = [];
      const values: any[] = [];
      
      if (code !== undefined) { updates.push('code = ?'); values.push(code); }
      if (name !== undefined) { updates.push('name = ?'); values.push(name); }
      if (description !== undefined) { updates.push('description = ?'); values.push(description); }
      
      if (updates.length > 0) {
        values.push(id);
        // FK 제약 일시 비활성화 (코드 변경 시 연계 테이블 FK 위한 방지)
        db.run('PRAGMA foreign_keys = OFF');
        try {
          db.run(`UPDATE platforms SET ${updates.join(', ')} WHERE id = ?`, values);
        } finally {
          db.run('PRAGMA foreign_keys = ON');
        }
      }
      
      const platform = db.get('SELECT * FROM platforms WHERE id = ?', [id]);
      return apiSuccess({ platform });
    }
    
    // Supabase mode (기존 코드)
    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return apiUnauthorized();
    }

    if (!code || !name) {
      return apiBadRequest('플랫폼 코드와 이름은 필수입니다.');
    }

    // Get current platform to check if code is changing
    const { data: currentPlatform } = await supabase
      .from('platforms')
      .select('code')
      .eq('id', id)
      .single();

    if (!currentPlatform) {
      return apiNotFound('플랫폼');
    }

    // Get user profile to check role
    const { data: userProfile } = await supabase
      .from('users')
      .select('roles, email')
      .eq('id', user.id)
      .single();

    const is1stMaster = userProfile?.email?.endsWith('@rsupport.com') ||
                        userProfile?.roles?.includes('1st_master');

    // Check if code is being changed
    const isCodeChanging = code !== currentPlatform.code;

    if (isCodeChanging) {
      // Check if code is in use (only if not 1st_master)
      if (!is1stMaster) {
        // Check in platform_completions (as JSON key)
        const { data: usedInPlatformCompletions } = await supabase
          .from('translations')
          .select('id, platform_completions')
          .not('platform_completions', 'eq', '{}')
          .limit(1000);

        interface TranslationWithPlatformCompletions {
          id: string;
          platform_completions: Record<string, { completed: boolean; completed_at?: string; completed_by?: string }> | null;
        }

        const isUsedInCompletions = usedInPlatformCompletions?.some((t: TranslationWithPlatformCompletions) =>
          t.platform_completions && currentPlatform.code in t.platform_completions
        );

        // Check in work_scope (as array element)
        const { data: usedInWorkScope } = await supabase
          .from('translations')
          .select('id')
          .contains('work_scope', [currentPlatform.code])
          .limit(1);

        if (isUsedInCompletions || (usedInWorkScope && usedInWorkScope.length > 0)) {
          return apiBadRequest('사용 중인 플랫폼 코드는 수정할 수 없습니다.');
        }
      }

      // If allowed (1st_master or not in use), cascade update
      // Get all translations that use this platform code
      const { data: affectedTranslations } = await supabase
        .from('translations')
        .select('id, platform_completions, work_scope')
        .or(`work_scope.cs.{${currentPlatform.code}},not.platform_completions.eq.{}`);

      if (affectedTranslations && affectedTranslations.length > 0) {
        interface TranslationUpdateData {
          platform_completions?: Record<string, { completed: boolean; completed_at?: string; completed_by?: string }>;
          work_scope?: string[];
        }

        for (const translation of affectedTranslations) {
          const updates: TranslationUpdateData = {};

          // Update platform_completions if it contains the old code
          if (translation.platform_completions && currentPlatform.code in translation.platform_completions) {
            const newCompletions = { ...translation.platform_completions };
            newCompletions[code] = newCompletions[currentPlatform.code];
            delete newCompletions[currentPlatform.code];
            updates.platform_completions = newCompletions;
          }

          // Update work_scope if it contains the old code
          if (translation.work_scope && translation.work_scope.includes(currentPlatform.code)) {
            const newWorkScope = translation.work_scope.map((p: string) =>
              p === currentPlatform.code ? code : p
            );
            updates.work_scope = newWorkScope;
          }

          if (Object.keys(updates).length > 0) {
            await supabase
              .from('translations')
              .update(updates)
              .eq('id', translation.id);
          }
        }
      }
    }

    const { data, error } = await supabase
      .from('platforms')
      .update({
        code,
        name,
        description: description || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return apiSuccess(data);
  } catch (error) {
    console.error('Error updating platform:', error);
    return apiInternalError('플랫폼 수정에 실패했습니다.');
  }
}

/**
 * DELETE - Delete a platform
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
      
      // Get platform info
      const platform = db.get<{ code: string }>('SELECT code FROM platforms WHERE id = ?', [id]);
      if (!platform) {
        return apiNotFound('플랫폼');
      }
      
      // Check if platform is in use in translations
      const translationsWithPlatform = db.all<{ id: string; platform_completions: string; work_scope: string }>(
        'SELECT id, platform_completions, work_scope FROM translations WHERE platform_completions IS NOT NULL OR work_scope IS NOT NULL'
      );
      
      let isUsed = false;
      for (const t of translationsWithPlatform || []) {
        const completions = t.platform_completions ? JSON.parse(t.platform_completions) : {};
        const workScope = t.work_scope ? JSON.parse(t.work_scope) : [];
        if (platform.code in completions || workScope.includes(platform.code)) {
          isUsed = true;
          break;
        }
      }
      
      if (isUsed) {
        return apiBadRequest('사용 중인 플랫폼은 삭제할 수 없습니다. 관련 데이터를 먼저 삭제하세요.');
      }
      
      // Delete platform
      db.run('DELETE FROM platforms WHERE id = ?', [id]);
      
      return apiSuccess({ success: true });
    }
    
    // Supabase mode (기존 코드)
    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return apiUnauthorized();
    }

    const { error } = await supabase
      .from('platforms')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return apiSuccess({ success: true });
  } catch (error) {
    console.error('Error deleting platform:', error);
    return apiInternalError('플랫폼 삭제에 실패했습니다.');
  }
}

// Helper function for Supabase mode
async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

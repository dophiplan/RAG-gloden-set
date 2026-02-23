import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { apiSuccess, apiUnauthorized, apiForbidden, apiNotFound, apiBadRequest, apiInternalError } from '@/lib/api/response';

/**
 * PATCH - Update a language (master only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id } = await params;
    const body = await request.json();
    const { code, name, description, display_order } = body;

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

    const { id } = await params;

    // Check if language is used in translation_results
    const { data: usedInTranslations } = await adminClient
      .from('translation_results')
      .select('id')
      .eq('language_code', id)
      .limit(1);

    if (usedInTranslations && usedInTranslations.length > 0) {
      return apiBadRequest('사용 중인 언어는 삭제할 수 없습니다.');
    }

    const { error } = await adminClient
      .from('languages')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return apiSuccess({ success: true });
  } catch (error) {
    console.error('Error deleting language:', error);
    return apiInternalError('언어 삭제에 실패했습니다.');
  }
}

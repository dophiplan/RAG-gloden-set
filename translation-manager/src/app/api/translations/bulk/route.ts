import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TranslationStatus, ProductCode } from '@/types';

interface BulkUpdateInput {
  ids: string[];
  status: TranslationStatus;
}

interface BulkCreateInput {
  texts: string[];
  context?: string;
  version?: string;
  product_code?: ProductCode;
}

// POST - Bulk create translations
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Get user profile for audit log
    const { data: userProfile } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    const body: BulkCreateInput = await request.json();

    if (!body.texts || body.texts.length === 0) {
      return NextResponse.json(
        { error: '텍스트 목록은 필수입니다.' },
        { status: 400 }
      );
    }

    const versionUpdatedAt = body.version ? new Date().toISOString() : null;

    const translations = body.texts
      .filter((text) => text.trim())
      .map((text) => ({
        source_text: text.trim(),
        context: body.context?.trim() || null,
        version: body.version?.trim() || null,
        version_updated_at: versionUpdatedAt,
        product_code: body.product_code || null,
        user_id: user.id,
        status: 'pending' as const,
      }));

    const { data, error } = await supabase
      .from('translations')
      .insert(translations)
      .select();

    if (error) throw error;

    // Create audit logs for all created translations
    if (data && data.length > 0) {
      const auditLogs = data.map((t) => ({
        translation_id: t.id,
        user_id: user.id,
        user_name: userProfile?.name,
        user_email: userProfile?.email || user.email,
        action: 'create' as const,
        new_value: t.source_text,
      }));

      await supabase.from('translation_audit_logs').insert(auditLogs);
    }

    return NextResponse.json({
      success: true,
      created: data.length,
      translations: data,
    }, { status: 201 });
  } catch (error) {
    console.error('Error bulk creating translations:', error);
    return NextResponse.json(
      { error: '번역을 일괄 생성하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// PATCH - Bulk update status
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Get user profile for audit log
    const { data: userProfile } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    const body: BulkUpdateInput = await request.json();

    if (!body.ids || body.ids.length === 0) {
      return NextResponse.json(
        { error: 'ID 목록은 필수입니다.' },
        { status: 400 }
      );
    }

    if (!['pending', 'reviewed', 'deployed'].includes(body.status)) {
      return NextResponse.json(
        { error: '유효하지 않은 상태입니다.' },
        { status: 400 }
      );
    }

    // Get old values for audit log
    const { data: oldData } = await supabase
      .from('translations')
      .select('id, status')
      .in('id', body.ids);

    const { data, error } = await supabase
      .from('translations')
      .update({ status: body.status })
      .in('id', body.ids)
      .select();

    if (error) throw error;

    // Create audit logs
    if (data && data.length > 0 && oldData) {
      const auditLogs = data.map((t) => {
        const old = oldData.find((o) => o.id === t.id);
        return {
          translation_id: t.id,
          user_id: user.id,
          user_name: userProfile?.name,
          user_email: userProfile?.email || user.email,
          action: 'update' as const,
          field_name: 'status',
          old_value: old?.status,
          new_value: body.status,
        };
      });

      await supabase.from('translation_audit_logs').insert(auditLogs);
    }

    return NextResponse.json({
      success: true,
      updated: data.length,
    });
  } catch (error) {
    console.error('Error bulk updating translations:', error);
    return NextResponse.json(
      { error: '번역 상태를 일괄 변경하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

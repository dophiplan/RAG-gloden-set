import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { TranslationStatus, ProductCode, LanguageCode } from '@/types';
import { getAuthUser } from '@/lib/api-auth';

interface BulkUpdateInput {
  ids: string[];
  status: TranslationStatus;
}

interface BulkCreateInput {
  texts: string[];
  context?: string;
  version?: string;
  product_code?: ProductCode;
  scope?: 'SaaS' | 'Solution';
  priority?: string;
  languages?: LanguageCode[];
}

// POST - Bulk create translations
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, adminClient: authAdminClient } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Always use admin client to bypass RLS for bulk operations
    console.log('🔧 Creating admin client for bulk operations...');
    let adminClient;
    try {
      adminClient = authAdminClient || createAdminClient();
      console.log('✅ Admin client created successfully');
    } catch (adminError) {
      console.error('❌ Failed to create admin client:', adminError);
      throw new Error('Failed to create admin client: ' + (adminError instanceof Error ? adminError.message : 'Unknown error'));
    }
    const db = adminClient;

    // Get user profile for audit log
    const { data: userProfile } = await db
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
        scope: body.scope || null,
        priority: body.priority || '중',
        user_id: user.id,
        status: 'pending' as const,
      }));

    console.log('Attempting to insert translations:', {
      count: translations.length,
      sample: translations[0],
      product_code: body.product_code,
      usingAdminClient: !!adminClient,
    });

    const { data, error } = await db
      .from('translations')
      .insert(translations)
      .select();

    if (error) {
      console.error('Bulk insert error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.error('Bulk insert returned no data');
      return NextResponse.json(
        { error: '번역 항목 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    console.log('Bulk insert success:', {
      requested: translations.length,
      created: data.length,
    });

    // Create translation_products records if product_code is provided
    if (body.product_code && data && data.length > 0) {
      const translationProducts = data.map((t) => ({
        translation_id: t.id,
        product_code: body.product_code as ProductCode,
        version: body.version?.trim() || null,
        version_updated_at: versionUpdatedAt,
      }));

      const { error: productsError } = await db
        .from('translation_products')
        .insert(translationProducts);

      if (productsError) {
        console.error('Error creating translation_products:', productsError);
        // Don't fail the entire request, but log the error
      } else {
        console.log('Created translation_products records:', translationProducts.length);
      }
    }

    // Create translation_results for selected languages
    if (body.languages && body.languages.length > 0 && data && data.length > 0) {
      const translationResults = data.flatMap(translation =>
        body.languages!.map(lang => ({
          translation_id: translation.id,
          language_code: lang,
          translated_text: '',  // Empty initially
        }))
      );

      const { error: resultsError } = await db
        .from('translation_results')
        .insert(translationResults);

      if (resultsError) {
        console.error('Error creating translation results:', resultsError);
        // Don't fail the whole operation, just log
      } else {
        console.log('Created translation_results records:', translationResults.length);
      }
    }

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

      await db.from('translation_audit_logs').insert(auditLogs);
    }

    return NextResponse.json({
      success: true,
      created: data.length,
      translations: data,
    }, { status: 201 });
  } catch (error) {
    console.error('❌ Error bulk creating translations:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    });
    return NextResponse.json(
      {
        error: '번역을 일괄 생성하는데 실패했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PATCH - Bulk update status
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

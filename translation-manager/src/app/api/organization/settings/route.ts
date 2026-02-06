import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isMaster } from '@/lib/permissions';

const RSUPPORT_DOMAIN = 'rsupport.com';

// GET - Retrieve organization settings
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Get current user with roles
    const { data: currentUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    // Only masters can access organization settings
    if (!isMaster(currentUser)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    // Get organization settings for rsupport.com
    const { data: orgSettings, error } = await supabase
      .from('organization_settings')
      .select('*')
      .eq('domain', RSUPPORT_DOMAIN)
      .single();

    if (error) {
      // If not found, create default settings
      if (error.code === 'PGRST116') {
        const { data: newSettings, error: insertError } = await supabase
          .from('organization_settings')
          .insert({
            domain: RSUPPORT_DOMAIN,
            openai_api_key: null,
            settings: {},
          })
          .select()
          .single();

        if (insertError) throw insertError;

        return NextResponse.json({ settings: newSettings });
      }
      throw error;
    }

    return NextResponse.json({ settings: orgSettings });

  } catch (error: any) {
    console.error('Error fetching organization settings:', error);
    return NextResponse.json(
      { error: error.message || '조직 설정 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PATCH - Update organization settings
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Get current user with roles
    const { data: currentUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    // Only masters can update organization settings
    if (!isMaster(currentUser)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { openai_api_key, settings } = body as {
      openai_api_key?: string | null;
      settings?: Record<string, any>;
    };

    // Validate OpenAI API key format if provided
    if (openai_api_key !== undefined && openai_api_key !== null) {
      if (typeof openai_api_key !== 'string' || !openai_api_key.startsWith('sk-')) {
        return NextResponse.json(
          { error: '유효한 OpenAI API 키 형식이 아닙니다.' },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (openai_api_key !== undefined) {
      updateData.openai_api_key = openai_api_key;
    }

    if (settings !== undefined) {
      // Merge with existing settings
      const { data: existingSettings } = await supabase
        .from('organization_settings')
        .select('settings')
        .eq('domain', RSUPPORT_DOMAIN)
        .single();

      updateData.settings = {
        ...(existingSettings?.settings || {}),
        ...settings,
      };
    }

    // Prevent empty updates
    if (Object.keys(updateData).length === 1) {
      return NextResponse.json(
        { error: '업데이트할 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    // Upsert organization settings
    const { data: updatedSettings, error } = await supabase
      .from('organization_settings')
      .upsert(
        {
          domain: RSUPPORT_DOMAIN,
          ...updateData,
        },
        {
          onConflict: 'domain',
        }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ settings: updatedSettings });

  } catch (error: any) {
    console.error('Error updating organization settings:', error);
    return NextResponse.json(
      { error: error.message || '조직 설정 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

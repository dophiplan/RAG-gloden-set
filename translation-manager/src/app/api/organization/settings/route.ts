import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';

const RSUPPORT_DOMAIN = 'rsupport.com';

// GET - Retrieve organization settings
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user with email to check domain (skip check for test users)
    const { data: currentUser } = await supabase
      .from('users')
      .select('email')
      .eq('id', user.id)
      .maybeSingle();

    // Skip domain check for test users
    if (currentUser && !currentUser.email?.endsWith('@rsupport.com') && user.id !== 'test-user-id') {
      return NextResponse.json({ error: '@rsupport.com 계정만 조직 API 키를 관리할 수 있습니다.' }, { status: 403 });
    }

    // Get organization settings for rsupport.com
    const { data: orgSettings, error } = await supabase
      .from('organization_settings')
      .select('*')
      .eq('domain', RSUPPORT_DOMAIN)
      .maybeSingle();

    if (error) {
      console.error('Error fetching organization settings:', error);
      // Return empty settings if table doesn't exist or other error
      return NextResponse.json({
        settings: {
          domain: RSUPPORT_DOMAIN,
          openai_api_key: null,
          claude_api_key: null,
          kimi_api_key: null,
          gemini_api_key: null,
          settings: {},
        }
      });
    }

    // If not found, return default settings without creating
    if (!orgSettings) {
      return NextResponse.json({
        settings: {
          domain: RSUPPORT_DOMAIN,
          openai_api_key: null,
          claude_api_key: null,
          kimi_api_key: null,
          gemini_api_key: null,
          settings: {},
        }
      });
    }

    return NextResponse.json({ settings: orgSettings });

  } catch (error: unknown) {
    console.error('Error fetching organization settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

// PATCH - Update organization settings
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user with email to check domain (skip check for test users)
    const { data: currentUser } = await supabase
      .from('users')
      .select('email')
      .eq('id', user.id)
      .maybeSingle();

    // Skip domain check for test users
    if (currentUser && !currentUser.email?.endsWith('@rsupport.com') && user.id !== 'test-user-id') {
      return NextResponse.json({ error: '@rsupport.com 계정만 조직 API 키를 관리할 수 있습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { openai_api_key, claude_api_key, kimi_api_key, gemini_api_key, settings } = body as {
      openai_api_key?: string | null;
      claude_api_key?: string | null;
      kimi_api_key?: string | null;
      gemini_api_key?: string | null;
      settings?: Record<string, unknown>;
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
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (openai_api_key !== undefined) {
      updateData.openai_api_key = openai_api_key;
    }

    if (claude_api_key !== undefined) {
      updateData.claude_api_key = claude_api_key;
    }

    if (kimi_api_key !== undefined) {
      updateData.kimi_api_key = kimi_api_key;
    }

    if (gemini_api_key !== undefined) {
      updateData.gemini_api_key = gemini_api_key;
    }

    if (settings !== undefined) {
      // Merge with existing settings
      const { data: existingSettings } = await supabase
        .from('organization_settings')
        .select('settings')
        .eq('domain', RSUPPORT_DOMAIN)
        .maybeSingle();

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

    if (error) {
      console.error('Error upserting organization settings:', error);
      return NextResponse.json(
        { error: '조직 설정 업데이트에 실패했습니다. 테이블이 존재하지 않을 수 있습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ settings: updatedSettings });

  } catch (error: unknown) {
    console.error('Error updating organization settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

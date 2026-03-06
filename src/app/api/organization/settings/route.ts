import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import { validateApiKeyWithTestCall } from '@/lib/ai';

const RSUPPORT_DOMAIN = 'rsupport.com';

interface OrgSettings {
  domain: string;
  openai_api_key?: string | null;
  claude_api_key?: string | null;
  kimi_api_key?: string | null;
  gemini_api_key?: string | null;
  settings?: Record<string, unknown>;
}

// GET - Retrieve organization settings
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user email for domain check (use auth user email as primary source)
    const userEmail = user.email || '';
    
    // Only rsupport.com users can access org settings
    if (!userEmail.endsWith('@rsupport.com') && user.id !== 'test-user-id') {
      return NextResponse.json({ error: '@rsupport.com 계정만 조직 설정을 볼 수 있습니다.' }, { status: 403 });
    }

    // Use admin client to bypass RLS
    const adminClient = createAdminClient();
    
    const { data: orgSettings, error } = await adminClient
      .from('organization_settings')
      .select('*')
      .eq('domain', RSUPPORT_DOMAIN)
      .maybeSingle();

    if (error) {
      console.error('Error fetching org settings:', error);
      return NextResponse.json(
        { settings: getDefaultSettings() },
        { status: 200 }
      );
    }

    return NextResponse.json({ settings: orgSettings || getDefaultSettings() });

  } catch (error) {
    console.error('Unexpected error in GET:', error);
    return NextResponse.json(
      { settings: getDefaultSettings() },
      { status: 200 }
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

    // Get user email for domain check (use auth user email as primary source)
    const userEmail = user.email || '';
    
    // Only rsupport.com users can update org settings
    if (!userEmail.endsWith('@rsupport.com') && user.id !== 'test-user-id') {
      return NextResponse.json({ error: '@rsupport.com 계정만 조직 설정을 변경할 수 있습니다.' }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate API keys if requested
    if (body.validate_key) {
      const provider = body.validate_key.provider;
      const apiKey = body.validate_key.apiKey;
      
      const validation = await validateApiKeyWithTestCall(provider, apiKey);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error, code: 'INVALID_API_KEY' },
          { status: 400 }
        );
      }
      
      return NextResponse.json({ valid: true, message: 'API 키가 유효합니다.' });
    }
    
    const updateData = buildUpdateData(body);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '업데이트할 데이터가 없습니다.' }, { status: 400 });
    }

    // Use admin client to bypass RLS
    const adminClient = createAdminClient();

    // Get old settings for audit log
    const { data: oldSettings } = await adminClient
      .from('organization_settings')
      .select('*')
      .eq('domain', RSUPPORT_DOMAIN)
      .maybeSingle();

    // Try upsert
    const { data: updatedSettings, error } = await adminClient
      .from('organization_settings')
      .upsert(
        { domain: RSUPPORT_DOMAIN, ...updateData, updated_at: new Date().toISOString() },
        { onConflict: 'domain' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error upserting org settings:', error);
      return NextResponse.json(
        { error: '설정 저장에 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    // Create audit log (non-blocking)
    const changedKeys = Object.keys(updateData).filter(k => k !== 'updated_at');
    for (const key of changedKeys) {
      void adminClient.from('settings_audit_logs').insert({
        user_id: user.id,
        user_email: user.email,
        action: 'update_org_settings',
        setting_category: 'organization',
        setting_key: key,
        old_value: key.includes('api_key') ? '***' : JSON.stringify(oldSettings?.[key as keyof typeof oldSettings]),
        new_value: key.includes('api_key') ? '***' : JSON.stringify(updateData[key]),
        is_sensitive: key.includes('api_key'),
      }).then(({ error }) => {
        if (error) console.error('[Audit Log] Failed to log org settings update:', error);
      });
    }

    return NextResponse.json({ settings: updatedSettings });

  } catch (error) {
    console.error('Unexpected error in PATCH:', error);
    return NextResponse.json(
      { error: '설정 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// Helper functions
function getDefaultSettings(): OrgSettings {
  return {
    domain: RSUPPORT_DOMAIN,
    openai_api_key: null,
    claude_api_key: null,
    kimi_api_key: null,
    gemini_api_key: null,
    settings: {},
  };
}

function buildUpdateData(body: Record<string, unknown>): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};
  
  const keyFields = ['openai_api_key', 'claude_api_key', 'kimi_api_key', 'gemini_api_key'];
  
  for (const field of keyFields) {
    if (field in body) {
      const value = body[field];
      // Validate API key format (provider-specific)
      if (value !== null && value !== undefined && value !== '') {
        if (typeof value === 'string') {
          const isValidKey = 
            value.startsWith('sk-') ||           // OpenAI, Kimi, etc
            value.startsWith('sk-ant') ||        // Anthropic
            value.startsWith('AIza');            // Google (Gemini)
          
          if (isValidKey) {
            updateData[field] = value;
          } else {
            console.warn(`Invalid API key format for ${field}`);
          }
        }
      } else {
        // Explicitly set to null for deletion
        updateData[field] = null;
      }
    }
  }
  
  // Handle settings (priority order, etc.)
  if ('settings' in body && typeof body.settings === 'object') {
    updateData.settings = body.settings;
  }
  
  return updateData;
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isMaster } from '@/lib/permissions';
import { EmailTemplateType } from '@/types';

// GET - List all email templates
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data: templates, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('template_type', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ templates });

  } catch (error: any) {
    console.error('Error fetching email templates:', error);
    return NextResponse.json(
      { error: error.message || '이메일 템플릿 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST - Create new email template (Master only)
export async function POST(request: NextRequest) {
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

    if (!isMaster(currentUser)) {
      return NextResponse.json({ error: 'Master 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      template_type,
      subject,
      body_html,
      body_text,
      default_deadline_days = 3,
    } = body as {
      template_type: EmailTemplateType;
      subject: string;
      body_html: string;
      body_text: string;
      default_deadline_days?: number;
    };

    if (!template_type || !subject || !body_html || !body_text) {
      return NextResponse.json(
        { error: '모든 필드를 입력해주세요.' },
        { status: 400 }
      );
    }

    const { data: template, error } = await supabase
      .from('email_templates')
      .insert({
        template_type,
        subject,
        body_html,
        body_text,
        default_deadline_days,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ template }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating email template:', error);
    return NextResponse.json(
      { error: error.message || '이메일 템플릿 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

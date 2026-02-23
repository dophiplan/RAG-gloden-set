import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EmailTemplateType } from '@/types';
import { renderTemplate, buildTemplateVariables, buildLanguageList } from '@/lib/emails/template-renderer';
import { determineRecipients } from '@/lib/emails/recipients';
import { calculateDeadline, formatDeadlineWithDay } from '@/shared/date_time/holiday_checker';

// POST - Preview email before sending
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const {
      template_type,
      translation_ids,
      custom_message = '',
      deadline_days,
      language_codes = [],
    } = body as {
      template_type: EmailTemplateType;
      translation_ids: string[];
      custom_message?: string;
      deadline_days?: number;
      language_codes?: string[];
    };

    if (!template_type || !translation_ids || translation_ids.length === 0) {
      return NextResponse.json(
        { error: '템플릿 타입과 번역 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // Get email template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_type', template_type)
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: '이메일 템플릿을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Get translations
    const { data: translations, error: translationsError } = await supabase
      .from('translations')
      .select(`
        *,
        translation_results (*),
        translation_products (*)
      `)
      .in('id', translation_ids);

    if (translationsError || !translations || translations.length === 0) {
      return NextResponse.json(
        { error: '번역 데이터를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Determine recipients
    const recipients = await determineRecipients(
      supabase,
      template_type,
      translation_ids,
      language_codes
    );

    // Calculate deadline if needed
    let deadline: string | null = null;
    if (deadline_days !== undefined && deadline_days > 0) {
      const { data: holidays } = await supabase
        .from('holidays')
        .select('*')
        .gte('holiday_date', new Date().toISOString().split('T')[0]);

      const deadlineDate = calculateDeadline(
        new Date(),
        deadline_days,
        holidays || []
      );

      deadline = formatDeadlineWithDay(deadlineDate);
    }

    // Build template variables
    const variables = buildTemplateVariables(translations, {
      customMessage: custom_message,
      deadline: deadline || '',
      completedAt: new Date().toISOString(),
    });

    // Add language-specific variables
    if (language_codes.length > 0) {
      variables.language_list = buildLanguageList(language_codes);
      variables.language = variables.language_list;
    }

    // Render email subject and body
    const subject = renderTemplate(template.subject, variables);
    const bodyHtml = renderTemplate(template.body_html, variables);
    const bodyText = renderTemplate(template.body_text, variables);

    return NextResponse.json({
      template_type,
      recipients,
      subject,
      body_html: bodyHtml,
      body_text: bodyText,
      deadline,
      variables,
    });

  } catch (error: unknown) {
    console.error('Error previewing email:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EmailTemplateType } from '@/types';
import { canSendEmail } from '@/lib/permissions';
import { getEmailService } from '@/lib/emails/email-service';
import { determineRecipients } from '@/lib/emails/recipients';
import { renderTemplate, buildTemplateVariables, buildLanguageList } from '@/lib/emails/template-renderer';
import { calculateDeadline, formatDeadlineWithDay } from '@/shared/date_time/holiday_checker';

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

    if (!canSendEmail(currentUser)) {
      return NextResponse.json({ error: '메일 발송 권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      template_type,
      translation_ids,
      custom_message = '',
      deadline_days,
      language_codes = [],
      recipients_override, // Optional: manually override recipients
    } = body as {
      template_type: EmailTemplateType;
      translation_ids: string[];
      custom_message?: string;
      deadline_days?: number;
      language_codes?: string[];
      recipients_override?: { to: string[]; cc: string[] };
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
    const recipients = recipients_override || await determineRecipients(
      supabase,
      template_type,
      translation_ids,
      language_codes
    );

    if (recipients.to.length === 0) {
      return NextResponse.json(
        { error: '수신자를 찾을 수 없습니다. 역할이 할당된 사용자가 있는지 확인하세요.' },
        { status: 400 }
      );
    }

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

    // Send email
    const emailService = getEmailService();
    const sendResult = await emailService.send({
      to: recipients.to,
      cc: recipients.cc,
      subject,
      html: bodyHtml,
      text: bodyText,
    });

    // Log email
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        template_type,
        translation_ids,
        sender_id: user.id,
        recipients: recipients,
        subject,
        body_html: bodyHtml,
        custom_message,
        deadline: deadline ? deadline.split(' ')[0] : null, // Store date only
        sent_at: sendResult.success ? new Date().toISOString() : null,
        status: sendResult.success ? 'sent' : 'failed',
        error_message: sendResult.error || null,
      });

    if (logError) {
      console.error('Failed to log email:', logError);
    }

    if (!sendResult.success) {
      return NextResponse.json(
        { error: sendResult.error || '메일 발송에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      recipients,
      subject,
      deadline,
    });

  } catch (error: unknown) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

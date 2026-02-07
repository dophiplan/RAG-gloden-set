// Email types
export type EmailTemplateType =
  | 'translation_request'
  | 'review_request'
  | 'translation_complete'
  | 'deployment_complete';

export interface EmailTemplate {
  id: string;
  template_type: EmailTemplateType;
  subject: string;
  body_html: string;
  body_text: string;
  default_deadline_days: number;
  created_at: string;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  template_type: EmailTemplateType;
  translation_ids: string[];
  sender_id: string | null;
  recipients: {
    to: string[];
    cc: string[];
  };
  subject: string;
  body_html: string | null;
  custom_message: string | null;
  deadline: string | null;
  sent_at: string | null;
  status: 'pending' | 'sent' | 'failed';
  error_message: string | null;
  created_at: string;
}

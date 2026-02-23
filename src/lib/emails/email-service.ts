/**
 * Email Service Interface and Implementations
 * Supports mock (for development) and real email providers (SMTP, SendGrid)
 */

export interface EmailParams {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  text?: string;
}

export interface EmailService {
  send(params: EmailParams): Promise<{ success: boolean; error?: string }>;
}

/**
 * Mock Email Service - Logs emails to console
 * Used during development or when EMAIL_PROVIDER=mock
 */
export class MockEmailService implements EmailService {
  async send(params: EmailParams): Promise<{ success: boolean; error?: string }> {
    console.log('='.repeat(80));
    console.log('MOCK EMAIL SENT');
    console.log('='.repeat(80));
    console.log('To:', params.to.join(', '));
    if (params.cc && params.cc.length > 0) {
      console.log('CC:', params.cc.join(', '));
    }
    console.log('Subject:', params.subject);
    console.log('-'.repeat(80));
    console.log('HTML Body:');
    console.log(params.html);
    if (params.text) {
      console.log('-'.repeat(80));
      console.log('Text Body:');
      console.log(params.text);
    }
    console.log('='.repeat(80));

    // Simulate success
    return { success: true };
  }
}

/**
 * SMTP Email Service - For future implementation
 */
export class SMTPEmailService implements EmailService {
  async send(params: EmailParams): Promise<{ success: boolean; error?: string }> {
    // TODO: Implement SMTP email sending
    // Use nodemailer or similar library
    console.warn('SMTP Email Service not implemented yet, using mock');
    return new MockEmailService().send(params);
  }
}

/**
 * SendGrid Email Service - For future implementation
 */
export class SendGridEmailService implements EmailService {
  async send(params: EmailParams): Promise<{ success: boolean; error?: string }> {
    // TODO: Implement SendGrid email sending
    // Use @sendgrid/mail library
    console.warn('SendGrid Email Service not implemented yet, using mock');
    return new MockEmailService().send(params);
  }
}

/**
 * Get the appropriate email service based on environment configuration
 */
export function getEmailService(): EmailService {
  const provider = process.env.EMAIL_PROVIDER || 'mock';

  switch (provider.toLowerCase()) {
    case 'smtp':
      return new SMTPEmailService();
    case 'sendgrid':
      return new SendGridEmailService();
    case 'mock':
    default:
      return new MockEmailService();
  }
}

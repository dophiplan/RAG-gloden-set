/**
 * Email Service Interface and Implementations
 * Supports mock (for development), SMTP, and SendGrid providers
 */

import nodemailer from 'nodemailer';

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

    return { success: true };
  }
}

/**
 * SMTP Email Service - Production-ready SMTP implementation
 */
export class SMTPEmailService implements EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === 'true';

    if (!host || !user || !pass) {
      console.warn('[SMTP] Missing required environment variables. Falling back to mock.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      // Connection pool settings
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      // Timeout settings
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  }

  async send(params: EmailParams): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      console.warn('[SMTP] Transporter not initialized. Using mock.');
      return new MockEmailService().send(params);
    }

    try {
      const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com';
      const fromName = process.env.SMTP_FROM_NAME || 'Translation Manager';

      const result = await this.transporter.sendMail({
        from: `"${fromName}" <${from}>`,
        to: params.to.join(', '),
        cc: params.cc?.join(', '),
        subject: params.subject,
        text: params.text,
        html: params.html,
      });

      console.log('[SMTP] Email sent:', result.messageId);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SMTP] Failed to send email:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }
}

/**
 * SendGrid Email Service - Production-ready SendGrid implementation
 */
export class SendGridEmailService implements EmailService {
  private sgMail: typeof import('@sendgrid/mail') | null = null;

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;

    if (!apiKey) {
      console.warn('[SendGrid] SENDGRID_API_KEY not set. Falling back to mock.');
      return;
    }

    try {
      // Dynamic import to avoid loading if not used
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(apiKey);
      this.sgMail = sgMail;
    } catch (error) {
      console.warn('[SendGrid] Failed to initialize. Falling back to mock:', error);
    }
  }

  async send(params: EmailParams): Promise<{ success: boolean; error?: string }> {
    if (!this.sgMail) {
      console.warn('[SendGrid] Not initialized. Using mock.');
      return new MockEmailService().send(params);
    }

    try {
      const from = process.env.SENDGRID_FROM || process.env.SMTP_FROM || 'noreply@example.com';
      const fromName = process.env.SENDGRID_FROM_NAME || process.env.SMTP_FROM_NAME || 'Translation Manager';

      const msg = {
        to: params.to,
        cc: params.cc,
        from: { email: from, name: fromName },
        subject: params.subject,
        text: params.text,
        html: params.html,
      };

      await this.sgMail.send(msg);
      console.log('[SendGrid] Email sent to:', params.to.join(', '));
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SendGrid] Failed to send email:', errorMessage);
      
      // SendGrid specific error handling
      if (error && typeof error === 'object' && 'response' in error) {
        const sgError = error as { response?: { body?: { errors?: Array<{ message: string }> } } };
        const sgErrors = sgError.response?.body?.errors;
        if (sgErrors && sgErrors.length > 0) {
          console.error('[SendGrid] Errors:', sgErrors.map(e => e.message).join(', '));
        }
      }
      
      return { success: false, error: errorMessage };
    }
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

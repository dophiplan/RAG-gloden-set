'use client';

import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { EmailTemplateType, Translation, SUPPORTED_LANGUAGES, LanguageCode } from '@/types';
import { TIMEOUTS } from '@/lib/constants';
import { apiPost } from '@/lib/api-utils';

interface EmailTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateType?: EmailTemplateType;
  selectedTranslations: Translation[];
  onSend?: () => Promise<void>;
}

interface EmailPreview {
  subject: string;
  body_html: string;
  recipients: {
    to: string[];
    cc: string[];
  };
  deadline: string | null;
}

const templateTypeLabels: Record<EmailTemplateType, string> = {
  translation_request: 'Translation Request',
  review_request: 'Review Request',
  translation_complete: 'Translation Complete',
  deployment_complete: 'Deployment Complete',
};

export default function EmailTemplateModal({
  isOpen,
  onClose,
  templateType,
  selectedTranslations,
}: EmailTemplateModalProps) {
  const [selectedTemplateType, setSelectedTemplateType] = useState<EmailTemplateType>(templateType || 'translation_request');
  const [recipients, setRecipients] = useState({ to: '', cc: '' });
  const [customMessage, setCustomMessage] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<LanguageCode[]>([]);
  const [deadline, setDeadline] = useState('');
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Template type options
  const templateOptions = [
    { value: 'translation_request', label: templateTypeLabels.translation_request },
    { value: 'review_request', label: templateTypeLabels.review_request },
    { value: 'translation_complete', label: templateTypeLabels.translation_complete },
    { value: 'deployment_complete', label: templateTypeLabels.deployment_complete },
  ];

  // Language options for request emails
  const languageOptions = Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
    value: code,
    label: name,
  }));

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTemplateType(templateType || 'translation_request');
      setCustomMessage('');
      setError(null);
      setPreview(null);
      loadPreview();
    }
  }, [isOpen, templateType]);

  // Load email preview
  const loadPreview = async () => {
    if ((selectedTranslations || []).length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const data = await apiPost<EmailPreview>('/api/emails/preview', {
        template_type: selectedTemplateType,
        translation_ids: (selectedTranslations || []).map((t) => t.id),
        custom_message: customMessage || undefined,
        language_codes: (selectedLanguages || []).length > 0 ? selectedLanguages : undefined,
      });
      setPreview(data);
      setRecipients({
        to: data.recipients.to.join(', '),
        cc: data.recipients.cc.join(', '),
      });
      setDeadline(data.deadline || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  // Reload preview when template type, languages, or custom message changes
  useEffect(() => {
    if (isOpen) {
      const debounce = setTimeout(() => {
        loadPreview();
      }, TIMEOUTS.PREVIEW_DEBOUNCE_DELAY_MS);
      return () => clearTimeout(debounce);
    }
  }, [selectedTemplateType, selectedLanguages, customMessage]);

  // Send email
  const handleSend = async () => {
    if (!preview) return;

    setSending(true);
    setError(null);

    try {
      await apiPost('/api/emails/send', {
        template_type: selectedTemplateType,
        translation_ids: selectedTranslations.map((t) => t.id),
        recipients: {
          to: recipients.to.split(',').map((email) => email.trim()).filter(Boolean),
          cc: recipients.cc.split(',').map((email) => email.trim()).filter(Boolean),
        },
        custom_message: customMessage || undefined,
        deadline: deadline || undefined,
        language_codes: (selectedLanguages || []).length > 0 ? selectedLanguages : undefined,
      });

      // Success - close modal
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleLanguageToggle = (langCode: LanguageCode) => {
    setSelectedLanguages((prev) =>
      prev.includes(langCode)
        ? prev.filter((code) => code !== langCode)
        : [...prev, langCode]
    );
  };

  const showLanguageSelection =
    selectedTemplateType === 'translation_request' ||
    selectedTemplateType === 'review_request';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send Email" size="xl">
      <div className="space-y-4">
        {/* Template Type Selection */}
        <Select
          label="Email Template"
          value={selectedTemplateType}
          onChange={(e) => setSelectedTemplateType(e.target.value as EmailTemplateType)}
          options={templateOptions}
        />

        {/* Language Selection (for request emails) */}
        {showLanguageSelection && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Languages
            </label>
            <div className="flex flex-wrap gap-2">
              {languageOptions.map((lang) => (
                <button
                  key={lang.value}
                  type="button"
                  onClick={() => handleLanguageToggle(lang.value as LanguageCode)}
                  className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                    selectedLanguages.includes(lang.value as LanguageCode)
                      ? 'bg-blue-100 border-blue-500 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recipients */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To (comma-separated)
            </label>
            <input
              type="text"
              value={recipients.to}
              onChange={(e) => setRecipients({ ...recipients, to: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="email1@example.com, email2@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CC (comma-separated)
            </label>
            <input
              type="text"
              value={recipients.cc}
              onChange={(e) => setRecipients({ ...recipients, cc: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="email1@example.com, email2@example.com"
            />
          </div>
        </div>

        {/* Deadline */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Deadline (auto-calculated, excludes holidays)
          </label>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Custom Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Custom Message (optional)
          </label>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Add a custom message to include in the email..."
          />
        </div>

        {/* Email Preview */}
        {loading && (
          <div className="text-center py-4 text-gray-500">
            Loading preview...
          </div>
        )}

        {preview && !loading && (
          <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Email Preview</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-600">Subject:</span>{' '}
                <span className="text-gray-800">{preview.subject}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Body:</span>
                <div
                  className="mt-1 p-3 bg-white border border-gray-200 rounded max-h-60 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: preview.body_html }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSend}
            loading={sending}
            disabled={!preview || loading || sending}
          >
            Send Email
          </Button>
        </div>
      </div>
    </Modal>
  );
}

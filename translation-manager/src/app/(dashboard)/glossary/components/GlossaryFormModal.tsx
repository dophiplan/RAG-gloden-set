'use client';

import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { SUPPORTED_LANGUAGES, LanguageCode, ProductCode } from '@/types';
import { PRODUCT_SELECT_OPTIONS } from '@/lib/constants';

interface GlossaryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  formTerm: string;
  setFormTerm: (value: string) => void;
  formTranslation: string;
  setFormTranslation: (value: string) => void;
  formLanguage: LanguageCode;
  setFormLanguage: (value: LanguageCode) => void;
  formContext: string;
  setFormContext: (value: string) => void;
  formProductCode: ProductCode | '';
  setFormProductCode: (value: ProductCode | '') => void;
  onSubmit: () => void;
  submitLabel: string;
  showLanguageSelect?: boolean;
  editingLanguage?: string;
}

export default function GlossaryFormModal({
  isOpen,
  onClose,
  title,
  formTerm,
  setFormTerm,
  formTranslation,
  setFormTranslation,
  formLanguage,
  setFormLanguage,
  formContext,
  setFormContext,
  formProductCode,
  setFormProductCode,
  onSubmit,
  submitLabel,
  showLanguageSelect = true,
  editingLanguage,
}: GlossaryFormModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <Select
          label="제품"
          value={formProductCode}
          onChange={(e) => setFormProductCode(e.target.value as ProductCode | '')}
          options={PRODUCT_SELECT_OPTIONS}
        />
        <Input
          label="용어 *"
          value={formTerm}
          onChange={(e) => setFormTerm(e.target.value)}
          placeholder={showLanguageSelect ? '예: Login' : undefined}
        />
        {showLanguageSelect ? (
          <Select
            label="언어 *"
            value={formLanguage}
            onChange={(e) => setFormLanguage(e.target.value as LanguageCode)}
            options={Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
              value: code,
              label: name,
            }))}
          />
        ) : (
          <div className="text-sm text-gray-500">
            언어: {editingLanguage}
          </div>
        )}
        <Input
          label="번역 *"
          value={formTranslation}
          onChange={(e) => setFormTranslation(e.target.value)}
          placeholder={showLanguageSelect ? '예: 로그인' : undefined}
        />
        <Input
          label="문맥/설명"
          value={formContext}
          onChange={(e) => setFormContext(e.target.value)}
          placeholder={showLanguageSelect ? '이 용어가 사용되는 상황을 설명하세요' : undefined}
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={onSubmit}>{submitLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}

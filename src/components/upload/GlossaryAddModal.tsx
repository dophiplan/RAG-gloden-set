'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown';
import { useProducts, useLanguages } from '@/hooks/useReferenceData';
import { apiFetch } from '@/lib/api-utils';
import { showSuccess, showError } from '@/lib/notifications';
import type { GlossaryAddModalProps, GlossaryCreateResponse } from '@/types/upload';

export default function GlossaryAddModal({
  isOpen,
  onClose,
  text,
  productCode,
  languageCodes,
  onSuccess,
}: GlossaryAddModalProps) {
  const { products } = useProducts();
  const { languages } = useLanguages();
  
  // 폼 상태
  const [translation, setTranslation] = useState('');
  const [context, setContext] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string>(productCode || '');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(languageCodes || []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 모달이 열릴 때 초기값 설정
  useEffect(() => {
    if (isOpen) {
      setTranslation('');
      setContext('');
      setSelectedProduct(productCode || '');
      setSelectedLanguages(languageCodes?.filter(lang => lang !== 'ko') || []);
    }
  }, [isOpen, productCode, languageCodes]);

  // 제품 옵션 생성
  const productOptions = [
    { value: '', label: '제품 선택...' },
    ...products.map(p => ({ value: p.code, label: p.name })),
  ];

  // 언어 옵션 생성 (한국어 제외)
  const languageOptions = languages
    .filter(lang => lang.code !== 'ko')
    .map(lang => ({ value: lang.code, label: lang.name }));

  const handleSubmit = async () => {
    if (!translation.trim()) {
      showError('번역을 입력해주세요.');
      return;
    }

    if (selectedLanguages.length === 0) {
      showError('최소 하나의 언어를 선택해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 용어집 API 호출 (MigrationClassifyTable와 동일한 패턴)
      const result = await apiFetch<GlossaryCreateResponse>('/api/glossary', {
        method: 'POST',
        body: JSON.stringify({
          sourceText: text,
          translation: translation.trim(),
          context: context.trim() || undefined,
          product_code: selectedProduct || null,
          product_codes: selectedProduct ? [selectedProduct] : [],
          targetLanguages: selectedLanguages,
        }),
      });

      showSuccess('용어집에 추가되었습니다.');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('용어집 추가 실패:', error);
      showError(error instanceof Error ? error.message : '용어집 추가에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="용어집 추가" size="lg">
      <div className="space-y-4">
        {/* 원문 (읽기 전용) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            원문
          </label>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
            {text}
          </div>
        </div>

        {/* 번역 입력 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            번역 <span className="text-red-500">*</span>
          </label>
          <Input
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
            placeholder="번역을 입력하세요"
            disabled={isSubmitting}
          />
        </div>

        {/* 제품 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            제품
          </label>
          <Select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            options={productOptions}
            disabled={isSubmitting}
          />
        </div>

        {/* 언어 다중 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            언어 <span className="text-red-500">*</span>
          </label>
          <MultiSelectDropdown
            options={languageOptions}
            selected={selectedLanguages}
            onChange={setSelectedLanguages}
            placeholder="언어 선택..."
            disabled={isSubmitting}
          />
          <p className="mt-1 text-xs text-gray-500">
            선택한 언어로 용어집이 생성됩니다
          </p>
        </div>

        {/* 설명 (선택) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            설명 (선택)
          </label>
          <Input
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="용어에 대한 추가 설명을 입력하세요"
            disabled={isSubmitting}
          />
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || !translation.trim() || selectedLanguages.length === 0}
          >
            저장
          </Button>
        </div>
      </div>
    </Modal>
  );
}

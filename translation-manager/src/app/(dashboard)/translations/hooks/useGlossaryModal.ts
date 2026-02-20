import { useState, useCallback } from 'react';
import { LanguageCode, ProductCode } from '@/types';
import { showSuccess, showError } from '@/lib/notifications';

export function useGlossaryModal() {
  const [isGlossaryModalOpen, setIsGlossaryModalOpen] = useState(false);
  const [glossaryTerm, setGlossaryTerm] = useState('');
  const [glossaryTranslation, setGlossaryTranslation] = useState('');
  const [glossaryLanguage, setGlossaryLanguage] = useState<LanguageCode>('en');
  const [glossaryContext, setGlossaryContext] = useState('');
  const [glossaryProductCodes, setGlossaryProductCodes] = useState<ProductCode[]>([]);

  const openGlossaryModal = useCallback(() => {
    setIsGlossaryModalOpen(true);
  }, []);

  const handleAddToGlossary = useCallback((sourceText: string) => {
    setGlossaryTerm(sourceText);
    setGlossaryTranslation('');
    setGlossaryLanguage('en');
    setGlossaryContext('');
    setGlossaryProductCodes([]);
    setIsGlossaryModalOpen(true);
  }, []);

  const handleGlossaryCreate = useCallback(async () => {
    if (!glossaryTerm.trim() || !glossaryTranslation.trim()) {
      showError('용어와 번역은 필수입니다.');
      return false;
    }

    try {
      const response = await fetch('/api/glossary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: glossaryTerm,
          translation: glossaryTranslation,
          language_code: glossaryLanguage,
          context: glossaryContext || undefined,
          product_codes: glossaryProductCodes.length > 0 ? glossaryProductCodes : undefined,
        }),
      });

      if (response.ok) {
        setIsGlossaryModalOpen(false);
        setGlossaryTerm('');
        setGlossaryTranslation('');
        setGlossaryLanguage('en');
        setGlossaryContext('');
        setGlossaryProductCodes([]);
        showSuccess('용어집에 추가되었습니다!');
        return true;
      } else {
        const data = await response.json();
        showError(data.error || '용어 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error creating glossary term:', error);
      showError('용어 추가 중 오류가 발생했습니다.');
    }
    return false;
  }, [glossaryTerm, glossaryTranslation, glossaryLanguage, glossaryContext, glossaryProductCodes]);

  const toggleGlossaryProduct = useCallback((productCode: ProductCode) => {
    setGlossaryProductCodes((prev) =>
      prev.includes(productCode)
        ? prev.filter((p) => p !== productCode)
        : [...prev, productCode]
    );
  }, []);

  const closeGlossaryModal = useCallback(() => {
    setIsGlossaryModalOpen(false);
  }, []);

  return {
    isGlossaryModalOpen,
    glossaryTerm,
    setGlossaryTerm,
    glossaryTranslation,
    setGlossaryTranslation,
    glossaryLanguage,
    setGlossaryLanguage,
    glossaryContext,
    setGlossaryContext,
    glossaryProductCodes,
    toggleGlossaryProduct,
    openGlossaryModal,
    handleAddToGlossary,
    handleOpenModal: openGlossaryModal, // Alias
    handleGlossaryCreate,
    closeGlossaryModal,
  };
}

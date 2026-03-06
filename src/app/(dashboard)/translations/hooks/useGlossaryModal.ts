import { useState, useCallback } from 'react';
import { LanguageCode, ProductCode, Translation } from '@/types';
import { showSuccess, showError } from '@/lib/notifications';
import { apiPost } from '@/lib/api-utils';

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

  const handleAddToGlossary = useCallback((translation: Translation) => {
    setGlossaryTerm(translation.source_text);
    setGlossaryTranslation('');
    setGlossaryLanguage('en');
    setGlossaryContext(translation.context || '');
    setGlossaryProductCodes([]);
    setIsGlossaryModalOpen(true);
  }, [])

  const handleGlossaryCreate = useCallback(async () => {
    if (!glossaryTerm.trim() || !glossaryTranslation.trim()) {
      showError('용어와 번역은 필수입니다.');
      return false;
    }

    try {
      await apiPost('/api/glossary', {
        term: glossaryTerm,
        translation: glossaryTranslation,
        language_code: glossaryLanguage,
        context: glossaryContext || undefined,
        product_codes: glossaryProductCodes.length > 0 ? glossaryProductCodes : undefined,
      });

      setIsGlossaryModalOpen(false);
      setGlossaryTerm('');
      setGlossaryTranslation('');
      setGlossaryLanguage('en');
      setGlossaryContext('');
      setGlossaryProductCodes([]);
      showSuccess('용어집에 추가되었습니다!');
      return true;
    } catch (error) {
      console.error('Error creating glossary term:', error);
      showError(error instanceof Error ? error.message : '용어 추가 중 오류가 발생했습니다.');
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

import { useState, useEffect, useCallback } from 'react';
import { GlossaryTerm, SUPPORTED_LANGUAGES, LanguageCode, ProductCode } from '@/types';
import { showError, showConfirm, showSuccess } from '@/lib/notifications';

export function useGlossaryData() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [languageFilter, setLanguageFilter] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<ProductCode | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [suggestionCount, setSuggestionCount] = useState(0);

  // Form state
  const [formTerm, setFormTerm] = useState('');
  const [formTranslation, setFormTranslation] = useState('');
  const [formLanguage, setFormLanguage] = useState<LanguageCode>('ko');
  const [formContext, setFormContext] = useState('');
  const [formProductCode, setFormProductCode] = useState<ProductCode | ''>('');

  const fetchTerms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (languageFilter) params.set('language', languageFilter);
      if (selectedProduct) params.set('product_code', selectedProduct);
      if (searchTerm) params.set('search', searchTerm);

      const response = await fetch(`/api/glossary?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTerms(data.terms);
      }
    } catch (error) {
      console.error('Error fetching glossary:', error);
    } finally {
      setLoading(false);
    }
  }, [languageFilter, selectedProduct, searchTerm]);

  useEffect(() => {
    fetchTerms();
    fetchSuggestionCount();
  }, [fetchTerms]);

  const fetchSuggestionCount = async () => {
    try {
      const response = await fetch('/api/glossary/suggest?limit=100');
      if (response.ok) {
        const data = await response.json();
        setSuggestionCount(data.suggestions.length);
      }
    } catch (error) {
      console.error('Error fetching suggestion count:', error);
    }
  };

  const resetForm = () => {
    setFormTerm('');
    setFormTranslation('');
    setFormLanguage('ko');
    setFormContext('');
    setFormProductCode('');
  };

  const handleCreate = async () => {
    if (!formTerm.trim() || !formTranslation.trim()) return;

    try {
      const response = await fetch('/api/glossary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: formTerm,
          translation: formTranslation,
          language_code: formLanguage,
          context: formContext || undefined,
          product_code: formProductCode || undefined,
        }),
      });

      if (response.ok) {
        setIsModalOpen(false);
        resetForm();
        fetchTerms();
        showSuccess('용어가 추가되었습니다.');
      } else {
        const data = await response.json();
        showError(data.error || '용어 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error creating glossary term:', error);
      showError('용어 추가 중 오류가 발생했습니다.');
    }
  };

  const handleUpdate = async () => {
    if (!editingTerm || !formTerm.trim() || !formTranslation.trim()) return;

    try {
      const response = await fetch(`/api/glossary/${editingTerm.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: formTerm,
          translation: formTranslation,
          context: formContext || undefined,
          product_code: formProductCode || undefined,
        }),
      });

      if (response.ok) {
        setEditingTerm(null);
        resetForm();
        fetchTerms();
        showSuccess('용어가 수정되었습니다.');
      } else {
        showError('용어 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error updating glossary term:', error);
      showError('용어 수정 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!showConfirm('정말 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/glossary/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTerms((prev) => prev.filter((t) => t.id !== id));
        showSuccess('용어가 삭제되었습니다.');
      } else {
        showError('용어 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error deleting glossary term:', error);
      showError('용어 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleAIReview = async () => {
    setIsReviewing(true);
    try {
      showError('AI 일관성 검사 기능은 번역 관리 페이지에서 개별 번역에 대해 사용할 수 있습니다.');
    } finally {
      setIsReviewing(false);
    }
  };

  const openEditModal = (term: GlossaryTerm) => {
    setEditingTerm(term);
    setFormTerm(term.term);
    setFormTranslation(term.translation);
    setFormLanguage(term.language_code as LanguageCode);
    setFormContext(term.context || '');
    setFormProductCode(term.product_code || '');
  };

  // Group terms by language
  const groupedTerms = terms.reduce<Record<string, GlossaryTerm[]>>((acc, term) => {
    const lang = term.language_code;
    if (!acc[lang]) acc[lang] = [];
    acc[lang].push(term);
    return acc;
  }, {});

  return {
    terms,
    loading,
    languageFilter,
    setLanguageFilter,
    selectedProduct,
    setSelectedProduct,
    searchTerm,
    setSearchTerm,
    isModalOpen,
    setIsModalOpen,
    editingTerm,
    setEditingTerm,
    isReviewing,
    suggestionCount,
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
    resetForm,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleAIReview,
    openEditModal,
    groupedTerms,
  };
}

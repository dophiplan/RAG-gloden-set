import { useState, useEffect, useCallback, useMemo } from 'react';
import { GlossaryTerm, SUPPORTED_LANGUAGES, LanguageCode, ProductCode } from '@/types';
import { showError, showConfirm, showSuccess } from '@/lib/notifications';
import { PAGINATION } from '@/lib/constants';
import { buildApiUrl } from '@/lib/api/query-builder';

export function useGlossaryData() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [languageFilter, setLanguageFilter] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<ProductCode | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('');
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<string>('');
  const [importedAfter, setImportedAfter] = useState<string>('');
  const [importedBefore, setImportedBefore] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('term');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [suggestionCount, setSuggestionCount] = useState(0);
  // 표시할 언어 컬럼 (기본값: 한국어만)
  const [selectedLanguageColumns, setSelectedLanguageColumns] = useState<LanguageCode[]>(['ko']);

  // Form state
  const [formTerm, setFormTerm] = useState('');
  const [formTranslation, setFormTranslation] = useState('');
  const [formLanguage, setFormLanguage] = useState<LanguageCode>('ko');
  const [formContext, setFormContext] = useState('');
  const [formProductCode, setFormProductCode] = useState<ProductCode | ''>('');

  const fetchTerms = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const url = buildApiUrl('/api/glossary', {
        language: languageFilter,
        product_code: selectedProduct,
        search: searchTerm,
        source_type: sourceTypeFilter,
        approval_status: approvalStatusFilter,
        imported_after: importedAfter,
        imported_before: importedBefore,
        sort: sortBy,
      });

      const response = await fetch(url, { signal });
      if (response.ok) {
        const data = await response.json();

        // Only update state if not aborted
        if (!signal?.aborted) {
          setTerms(data.terms);
        }
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error fetching glossary:', error);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [languageFilter, selectedProduct, searchTerm, sourceTypeFilter, approvalStatusFilter, importedAfter, importedBefore, sortBy]);

  const fetchSuggestionCount = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/glossary/suggest?limit=${PAGINATION.GLOSSARY_SUGGESTION_LIMIT}`, { signal });
      if (response.ok) {
        const data = await response.json();

        // Only update state if not aborted
        if (!signal?.aborted) {
          setSuggestionCount(data.suggestions.length);
        }
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error fetching suggestion count:', error);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchTerms(controller.signal);
    fetchSuggestionCount(controller.signal);

    return () => {
      // Cancel fetches on unmount or dependency change
      controller.abort();
    };
  }, [fetchTerms, fetchSuggestionCount]);

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

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch(`/api/glossary/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });

      if (response.ok) {
        fetchTerms();
        showSuccess('용어가 승인되었습니다.');
      } else {
        showError('용어 승인에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error approving glossary term:', error);
      showError('용어 승인 중 오류가 발생했습니다.');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const response = await fetch(`/api/glossary/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });

      if (response.ok) {
        fetchTerms();
        showSuccess('용어가 거부되었습니다.');
      } else {
        showError('용어 거부에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error rejecting glossary term:', error);
      showError('용어 거부 중 오류가 발생했습니다.');
    }
  };

  const handleBulkApprove = async (ids: string[]) => {
    try {
      const response = await fetch('/api/glossary/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action: 'approve' }),
      });

      if (response.ok) {
        const data = await response.json();
        fetchTerms();
        showSuccess(`${data.updated}개 용어가 승인되었습니다.`);
      } else {
        showError('일괄 승인에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error bulk approving glossary terms:', error);
      showError('일괄 승인 중 오류가 발생했습니다.');
    }
  };

  const handleBulkReject = async (ids: string[]) => {
    try {
      const response = await fetch('/api/glossary/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action: 'reject' }),
      });

      if (response.ok) {
        const data = await response.json();
        fetchTerms();
        showSuccess(`${data.updated}개 용어가 거부되었습니다.`);
      } else {
        showError('일괄 거부에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error bulk rejecting glossary terms:', error);
      showError('일괄 거부 중 오류가 발생했습니다.');
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

  // Group terms by language (for legacy view)
  const groupedTerms = useMemo(() => {
    return terms.reduce<Record<string, GlossaryTerm[]>>((acc, term) => {
      const lang = term.language_code;
      if (!acc[lang]) acc[lang] = [];
      acc[lang].push(term);
      return acc;
    }, {});
  }, [terms]);

  // Group terms by term name (for horizontal view with all languages in one row)
  interface GroupedByTerm {
    term: string;
    translations: Record<string, GlossaryTerm>;
    context?: string;
    product_code?: string | null;
    glossary_products?: { product_code: string }[];
    source_type: string;
    approval_status: string;
    hit_count: number;
    imported_at?: string;
  }

  const groupedByTerm = useMemo(() => {
    const termsByName = terms.reduce<Record<string, GroupedByTerm>>((acc, t) => {
      if (!acc[t.term]) {
        acc[t.term] = {
          term: t.term,
          translations: {},
          context: t.context ?? undefined,
          product_code: t.product_code,
          glossary_products: t.glossary_products,
          source_type: t.source_type,
          approval_status: t.approval_status,
          hit_count: t.hit_count || 0,
          imported_at: t.imported_at ?? undefined,
        };
      }
      acc[t.term].translations[t.language_code] = t;
      // Update hit_count to sum of all languages
      acc[t.term].hit_count = Math.max(acc[t.term].hit_count, t.hit_count || 0);
      return acc;
    }, {});

    return Object.values(termsByName);
  }, [terms]);

  // Quick filter functions
  const setQuickFilter = (filterType: 'today' | 'this_week' | 'this_month' | 'frequently_used' | 'unused' | 'pending') => {
    const now = new Date();
    if (filterType === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      setImportedAfter(todayStart.toISOString().split('T')[0]);
      setImportedBefore('');
      setSortBy('imported_at');
      setApprovalStatusFilter('');
    } else if (filterType === 'this_week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setImportedAfter(weekAgo.toISOString().split('T')[0]);
      setImportedBefore('');
      setSortBy('imported_at');
      setApprovalStatusFilter('');
    } else if (filterType === 'this_month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      setImportedAfter(monthStart.toISOString().split('T')[0]);
      setImportedBefore('');
      setSortBy('imported_at');
      setApprovalStatusFilter('');
    } else if (filterType === 'frequently_used') {
      setImportedAfter('');
      setImportedBefore('');
      setSortBy('hit_count');
      setApprovalStatusFilter('');
    } else if (filterType === 'unused') {
      setImportedAfter('');
      setImportedBefore('');
      setSortBy('term');
      setApprovalStatusFilter('');
      // Note: We can't filter by hit_count=0 via API, but sorted view will show them first
    } else if (filterType === 'pending') {
      setImportedAfter('');
      setImportedBefore('');
      setSortBy('imported_at');
      setApprovalStatusFilter('pending');
    }
  };

  const resetFilters = () => {
    setLanguageFilter('');
    setSelectedProduct(null);
    setSearchTerm('');
    setSourceTypeFilter('');
    setApprovalStatusFilter('');
    setImportedAfter('');
    setImportedBefore('');
    setSortBy('term');
  };

  // Direct update handlers for inline editing
  const handleTermInlineUpdate = useCallback(async (id: string, newTerm: string) => {
    const term = terms.find(t => t.id === id);
    if (!term) return;

    // Optimistic update
    setTerms(prev => prev.map(t => t.id === id ? { ...t, term: newTerm } : t));

    try {
      const response = await fetch(`/api/glossary/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: newTerm }),
      });

      if (response.ok) {
        showSuccess('용어가 수정되었습니다.');
      } else {
        // Rollback on failure
        setTerms(prev => prev.map(t => t.id === id ? term : t));
        showError('용어 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error updating term:', error);
      setTerms(prev => prev.map(t => t.id === id ? term : t));
      showError('용어 수정 중 오류가 발생했습니다.');
    }
  }, [terms]);

  const handleTranslationInlineUpdate = useCallback(async (id: string, newTranslation: string) => {
    const term = terms.find(t => t.id === id);
    if (!term) return;

    // Optimistic update
    setTerms(prev => prev.map(t => t.id === id ? { ...t, translation: newTranslation } : t));

    try {
      const response = await fetch(`/api/glossary/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ translation: newTranslation }),
      });

      if (response.ok) {
        showSuccess('번역이 수정되었습니다.');
      } else {
        // Rollback on failure
        setTerms(prev => prev.map(t => t.id === id ? term : t));
        showError('번역 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error updating translation:', error);
      setTerms(prev => prev.map(t => t.id === id ? term : t));
      showError('번역 수정 중 오류가 발생했습니다.');
    }
  }, [terms]);

  const handleContextInlineUpdate = useCallback(async (id: string, newContext: string) => {
    const term = terms.find(t => t.id === id);
    if (!term) return;

    // Optimistic update
    setTerms(prev => prev.map(t => t.id === id ? { ...t, context: newContext || null } : t));

    try {
      const response = await fetch(`/api/glossary/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: newContext || null }),
      });

      if (response.ok) {
        showSuccess('문맥이 수정되었습니다.');
      } else {
        // Rollback on failure
        setTerms(prev => prev.map(t => t.id === id ? term : t));
        showError('문맥 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error updating context:', error);
      setTerms(prev => prev.map(t => t.id === id ? term : t));
      showError('문맥 수정 중 오류가 발생했습니다.');
    }
  }, [terms]);

  return {
    terms,
    loading,
    languageFilter,
    setLanguageFilter,
    selectedProduct,
    setSelectedProduct,
    searchTerm,
    setSearchTerm,
    sourceTypeFilter,
    setSourceTypeFilter,
    approvalStatusFilter,
    setApprovalStatusFilter,
    importedAfter,
    setImportedAfter,
    importedBefore,
    setImportedBefore,
    sortBy,
    setSortBy,
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
    handleApprove,
    handleReject,
    handleBulkApprove,
    handleBulkReject,
    handleAIReview,
    openEditModal,
    groupedTerms,
    groupedByTerm,
    selectedLanguageColumns,
    setSelectedLanguageColumns,
    setQuickFilter,
    resetFilters,
    handleTermInlineUpdate,
    handleTranslationInlineUpdate,
    handleContextInlineUpdate,
  };
}

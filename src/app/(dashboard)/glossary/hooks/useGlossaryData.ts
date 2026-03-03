import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { GlossaryTerm, SUPPORTED_LANGUAGES, LanguageCode, ProductCode } from '@/types';
import { showError, showConfirm, showSuccess } from '@/lib/notifications';
import { PAGINATION } from '@/lib/constants';
import { buildApiUrl } from '@/lib/api/query-builder';
import { apiFetch, apiGet, apiPost, apiPatch, ApiError } from '@/lib/api-utils';

export function useGlossaryData() {
  const router = useRouter();
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
  // 표시할 언어 컬럼 (기본값: 영어)
  const [selectedLanguageColumns, setSelectedLanguageColumns] = useState<LanguageCode[]>(['en']);
  // 통계 정보
  const [stats, setStats] = useState<{
    total_terms: number;
    approved_terms: number;
    pending_terms: number;
    rejected_terms: number;
    not_used_terms: number;
  }>({
    total_terms: 0,
    approved_terms: 0,
    pending_terms: 0,
    rejected_terms: 0,
    not_used_terms: 0,
  });

  // Form state (simplified for new AI translation flow)
  const [formSourceText, setFormSourceText] = useState('');
  const [formContext, setFormContext] = useState('');
  const [formProductCodes, setFormProductCodes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStatusChanging, setIsStatusChanging] = useState(false);
  const [isRetranslating, setIsRetranslating] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  
  // Legacy form state for edit mode (single language)
  const [formTerm, setFormTerm] = useState('');
  const [formTranslation, setFormTranslation] = useState('');
  const [formLanguage, setFormLanguage] = useState<LanguageCode>('ko');

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

      const result = await apiFetch<{ data?: { terms?: GlossaryTerm[] }; terms?: GlossaryTerm[] }>(url, { signal });
      const data = result.data || result;

      // Only update state if not aborted
      if (!signal?.aborted) {
        setTerms(data.terms || []);
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      // 401 Unauthorized - redirect to login
      if (error instanceof ApiError && error.status === 401) {
        router.push('/login');
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
      const result = await apiFetch<{ data?: { suggestions?: unknown[] }; suggestions?: unknown[] }>(`/api/glossary/suggest?limit=${PAGINATION.GLOSSARY_SUGGESTION_LIMIT}`, { signal });
      const data = result.data || result;

      // Only update state if not aborted
      if (!signal?.aborted) {
        setSuggestionCount(data.suggestions?.length || 0);
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      // 401 Unauthorized - redirect to login
      if (error instanceof ApiError && error.status === 401) {
        router.push('/login');
        return;
      }
      // Silently ignore other errors to prevent console spam
      setSuggestionCount(0);
    }
  }, [router]);

  // 통계 정보 가져오기
  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedProduct) params.append('product', selectedProduct);
      
      type StatsResponse = { total_terms: number; approved_terms: number; pending_terms: number; rejected_terms: number; not_used_terms: number };
      const result = await apiGet<{ data?: StatsResponse } & StatsResponse>(`/api/glossary/stats?${params.toString()}`);
      const data = (result.data || result) as StatsResponse;
      setStats({
        total_terms: data.total_terms || 0,
        approved_terms: data.approved_terms || 0,
        pending_terms: data.pending_terms || 0,
        rejected_terms: data.rejected_terms || 0,
        not_used_terms: data.not_used_terms || 0,
      });
    } catch (error) {
      // 401 Unauthorized - redirect to login
      if (error instanceof ApiError && error.status === 401) {
        router.push('/login');
        return;
      }
      console.error('Error fetching stats:', error);
    }
  }, [selectedProduct, router]);

  useEffect(() => {
    const controller = new AbortController();
    fetchTerms(controller.signal);
    fetchSuggestionCount(controller.signal);
    fetchStats();

    return () => {
      // Cancel fetches on unmount or dependency change
      controller.abort();
    };
  }, [fetchTerms, fetchSuggestionCount, fetchStats]);

  const resetForm = () => {
    setFormSourceText('');
    setFormContext('');
    setFormProductCodes([]);
    setFormTerm('');
    setFormTranslation('');
  };

  const handleCreate = async () => {
    // Prevent duplicate submissions
    if (isSubmitting) return;
    
    if (!formSourceText.trim()) {
      showError('원문을 입력해주세요.');
      return;
    }

    // Determine target languages from selected columns, fallback to all except Korean
    const targetLanguages = selectedLanguageColumns.length > 0 
      ? selectedLanguageColumns.filter(lang => lang !== 'ko')
      : Object.keys(SUPPORTED_LANGUAGES).filter(lang => lang !== 'ko') as LanguageCode[];

    if (targetLanguages.length === 0) {
      showError('번역할 언어를 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost('/api/glossary', {
        sourceText: formSourceText,
        context: formContext || undefined,
        product_codes: formProductCodes.length > 0 ? formProductCodes : undefined,
        targetLanguages,
      });

      setIsModalOpen(false);
      resetForm();
      fetchTerms();
      showSuccess(`${targetLanguages.length}개 언어로 용어가 추가되었습니다.`);
    } catch (error) {
      console.error('Error creating glossary term:', error);
      showError(error instanceof Error ? error.message : '용어 추가에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingTerm || !formTerm.trim() || !formTranslation.trim()) return;

    try {
      await apiPatch(`/api/glossary/${editingTerm.id}`, {
        term: formTerm,
        translation: formTranslation,
        context: formContext || undefined,
        product_codes: formProductCodes.length > 0 ? formProductCodes : undefined,
      });

      setEditingTerm(null);
      resetForm();
      fetchTerms();
      showSuccess('용어가 수정되었습니다.');
    } catch (error) {
      console.error('Error updating glossary term:', error);
      showError(error instanceof Error ? error.message : '용어 수정에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (isDeleting) return;
    if (!showConfirm('정말 삭제하시겠습니까?')) return;

    setIsDeleting(true);
    try {
      await apiFetch(`/api/glossary/${id}`, { method: 'DELETE' });

      setTerms((prev) => prev.filter((t) => t.id !== id));
      await fetchStats();
      showSuccess('용어가 삭제되었습니다.');
    } catch (error) {
      console.error('Error deleting glossary term:', error);
      showError(error instanceof Error ? error.message : '용어 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await apiPatch(`/api/glossary/${id}/approve`, {
        action: 'approve',
      });

      fetchTerms();
      showSuccess('용어가 승인되었습니다.');
    } catch (error) {
      console.error('Error approving glossary term:', error);
      showError(error instanceof Error ? error.message : '용어 승인에 실패했습니다.');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await apiPatch(`/api/glossary/${id}/approve`, {
        action: 'reject',
      });

      fetchTerms();
      showSuccess('용어가 거부되었습니다.');
    } catch (error) {
      console.error('Error rejecting glossary term:', error);
      showError(error instanceof Error ? error.message : '용어 거부에 실패했습니다.');
    }
  };

  const handleStatusChange = async (id: string, status: 'pending' | 'approved' | 'rejected' | 'not_used') => {
    if (isStatusChanging) return;
    setIsStatusChanging(true);
    
    try {
      // Use bulk-update API for all status changes (including not_used)
      await apiPatch('/api/glossary/bulk-update', {
        glossary_ids: [id],
        approval_status: status,
      });

      await fetchTerms();
      await fetchStats(); // 통계 새로고침
      const statusLabels = { pending: '검수대기', approved: '검수완료', rejected: '보류', not_used: '사용안함' };
      showSuccess(`상태가 "${statusLabels[status]}"(으)로 변경되었습니다.`);
    } catch (error) {
      console.error('Error changing status:', error);
      showError(error instanceof Error ? error.message : '상태 변경에 실패했습니다.');
    } finally {
      setIsStatusChanging(false);
    }
  };

  const handleRetranslate = async (sourceText: string, context: string, languages: LanguageCode[]): Promise<void> => {
    if (isRetranslating) throw new Error('이미 재번역 중입니다.');
    setIsRetranslating(true);
    
    try {
      await apiPost('/api/glossary/retranslate', {
        sourceText,
        context: context || undefined,
        targetLanguages: languages,
      });

      await fetchTerms();
    } catch (error) {
      console.error('Retranslate error:', error);
      throw error;
    } finally {
      setIsRetranslating(false);
    }
  };

  const handleBulkApprove = async (ids: string[]) => {
    if (isBulkProcessing) return;
    setIsBulkProcessing(true);
    
    try {
      const result = await apiPatch<{ data?: { updated: number }; updated?: number }>('/api/glossary/bulk', {
        ids,
        action: 'approve',
      });

      const data = result.data || result;
      await fetchTerms();
      await fetchStats(); // 통계 새로고침
      showSuccess(`${data.updated}개 용어가 승인되었습니다.`);
    } catch (error) {
      console.error('Error bulk approving glossary terms:', error);
      showError(error instanceof Error ? error.message : '일괄 승인에 실패했습니다.');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkReject = async (ids: string[]) => {
    if (isBulkProcessing) return;
    setIsBulkProcessing(true);
    
    try {
      const result = await apiPatch<{ data?: { updated: number }; updated?: number }>('/api/glossary/bulk', {
        ids,
        action: 'reject',
      });

      const data = result.data || result;
      await fetchTerms();
      await fetchStats(); // 통계 새로고침
      showSuccess(`${data.updated}개 용어가 거부되었습니다.`);
    } catch (error) {
      console.error('Error bulk rejecting glossary terms:', error);
      showError(error instanceof Error ? error.message : '일괄 거부에 실패했습니다.');
    } finally {
      setIsBulkProcessing(false);
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
    setFormProductCodes(term.product_code ? [term.product_code] : []);
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
    if (updatingIds.has(id)) return;
    
    const term = terms.find(t => t.id === id);
    if (!term) return;
    if (term.term === newTerm) return; // 값이 같으면 API 호출 안 함

    setUpdatingIds(prev => new Set(prev).add(id));
    
    // Optimistic update
    setTerms(prev => prev.map(t => t.id === id ? { ...t, term: newTerm } : t));

    try {
      await apiPatch(`/api/glossary/${id}`, {
        term: newTerm,
      });

      showSuccess('용어가 수정되었습니다.');
    } catch (error) {
      // Rollback on failure
      setTerms(prev => prev.map(t => t.id === id ? term : t));
      console.error('Error updating term:', error);
      showError(error instanceof Error ? error.message : '용어 수정에 실패했습니다.');
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [terms, updatingIds]);

  const handleTranslationInlineUpdate = useCallback(async (id: string, newTranslation: string) => {
    if (updatingIds.has(id)) return;
    
    const term = terms.find(t => t.id === id);
    if (!term) return;
    if (term.translation === newTranslation) return;

    setUpdatingIds(prev => new Set(prev).add(id));
    
    // Optimistic update
    setTerms(prev => prev.map(t => t.id === id ? { ...t, translation: newTranslation } : t));

    try {
      await apiPatch(`/api/glossary/${id}`, {
        translation: newTranslation,
      });

      showSuccess('번역이 수정되었습니다.');
    } catch (error) {
      // Rollback on failure
      setTerms(prev => prev.map(t => t.id === id ? term : t));
      console.error('Error updating translation:', error);
      showError(error instanceof Error ? error.message : '번역 수정에 실패했습니다.');
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [terms, updatingIds]);

  const handleContextInlineUpdate = useCallback(async (id: string, newContext: string) => {
    if (updatingIds.has(id)) return;
    
    const term = terms.find(t => t.id === id);
    if (!term) return;
    if (term.context === newContext) return;

    setUpdatingIds(prev => new Set(prev).add(id));
    
    // Optimistic update
    setTerms(prev => prev.map(t => t.id === id ? { ...t, context: newContext || null } : t));

    try {
      await apiPatch(`/api/glossary/${id}`, {
        context: newContext || null,
      });

      showSuccess('문맥이 수정되었습니다.');
    } catch (error) {
      // Rollback on failure
      setTerms(prev => prev.map(t => t.id === id ? term : t));
      console.error('Error updating context:', error);
      showError(error instanceof Error ? error.message : '문맥 수정에 실패했습니다.');
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [terms, updatingIds]);

  return {
    terms,
    loading,
    fetchTerms,
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
    stats,
    fetchStats,
    formSourceText,
    setFormSourceText,
    formContext,
    setFormContext,
    formProductCodes,
    setFormProductCodes,
    formTerm,
    setFormTerm,
    formTranslation,
    setFormTranslation,
    formLanguage,
    setFormLanguage,
    isSubmitting,
    isDeleting,
    isStatusChanging,
    isRetranslating,
    isBulkProcessing,
    updatingIds,
    resetForm,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleApprove,
    handleReject,
    handleStatusChange,
    handleRetranslate,
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

import { useState, useEffect } from 'react';
import { TermSuggestion } from '@/lib/glossary/term-detector';
import { ProductCode } from '@/types';
import { showSuccess, showError, showConfirm } from '@/lib/notifications';

export interface SuggestionWithUI extends TermSuggestion {
  selected: boolean;
  context: string;
  product_codes: ProductCode[];
  showSamples: boolean;
  generating: boolean;
}

export function useSuggestionData() {
  const [suggestions, setSuggestions] = useState<SuggestionWithUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [filterLanguage, setFilterLanguage] = useState<string>('all');
  const [filterProduct, setFilterProduct] = useState<string>('all');
  const [filterConfidence, setFilterConfidence] = useState<string>('all');

  // 제안 목록 가져오기
  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterLanguage !== 'all') params.append('language', filterLanguage);
      if (filterProduct !== 'all') params.append('product_code', filterProduct);
      params.append('limit', '50');

      const response = await fetch(`/api/glossary/suggest?${params}`);
      if (!response.ok) throw new Error('Failed to fetch suggestions');

      const data = await response.json();
      setSuggestions(
        (data.suggestions || []).map((s: TermSuggestion) => ({
          ...s,
          selected: false,
          context: '',
          product_codes: [],
          showSamples: false,
          generating: false,
        }))
      );
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      showError('제안 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [filterLanguage, filterProduct]);

  // 신뢰도 필터 적용
  const filteredSuggestions = suggestions.filter((s) => {
    if (filterConfidence === 'high') return s.confidence >= 0.8;
    if (filterConfidence === 'medium') return s.confidence >= 0.6 && s.confidence < 0.8;
    if (filterConfidence === 'low') return s.confidence < 0.6;
    return true;
  });

  // 전체 선택/해제
  const toggleSelectAll = () => {
    const allSelected = filteredSuggestions.every((s) => s.selected);
    setSuggestions(
      suggestions.map((s) => ({
        ...s,
        selected: !allSelected,
      }))
    );
  };

  // 개별 선택 토글
  const toggleSelect = (index: number) => {
    setSuggestions(
      suggestions.map((s, i) =>
        i === index ? { ...s, selected: !s.selected } : s
      )
    );
  };

  // Context 입력
  const updateContext = (index: number, context: string) => {
    setSuggestions(
      suggestions.map((s, i) =>
        i === index ? { ...s, context } : s
      )
    );
  };

  // 제품 선택
  const updateProducts = (index: number, productCode: ProductCode) => {
    setSuggestions(
      suggestions.map((s, i) => {
        if (i === index) {
          const newProducts = s.product_codes.includes(productCode)
            ? s.product_codes.filter((p) => p !== productCode)
            : [...s.product_codes, productCode];
          return { ...s, product_codes: newProducts };
        }
        return s;
      })
    );
  };

  // AI로 Context 생성
  const generateContext = async (index: number) => {
    const suggestion = suggestions[index];

    // 생성 중 상태로 변경
    setSuggestions(
      suggestions.map((s, i) =>
        i === index ? { ...s, generating: true } : s
      )
    );

    try {
      const response = await fetch('/api/glossary/generate-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: suggestion.term,
          translation: suggestion.translation,
          language_code: suggestion.language_code,
          sample_contexts: suggestion.sample_contexts,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate context');

      const data = await response.json();
      updateContext(index, data.context);
    } catch (error) {
      console.error('Error generating context:', error);
      showError('설명 생성에 실패했습니다. OpenAI API 키가 설정되어 있는지 확인해주세요.');
    } finally {
      // 생성 완료 상태로 변경
      setSuggestions(
        suggestions.map((s, i) =>
          i === index ? { ...s, generating: false } : s
        )
      );
    }
  };

  // 샘플 토글
  const toggleSamples = (index: number) => {
    setSuggestions(
      suggestions.map((s, i) =>
        i === index ? { ...s, showSamples: !s.showSamples } : s
      )
    );
  };

  // 선택 항목 승인
  const approveSelected = async () => {
    const selected = suggestions.filter((s) => s.selected);
    if (selected.length === 0) {
      showError('승인할 용어를 선택해주세요.');
      return;
    }

    setApproving(true);
    try {
      const response = await fetch('/api/glossary/suggest/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestions: selected.map((s) => ({
            term: s.term,
            translation: s.translation,
            language_code: s.language_code,
            context: s.context || undefined,
            product_codes: s.product_codes.length > 0 ? s.product_codes : undefined,
          })),
        }),
      });

      if (!response.ok) throw new Error('Failed to approve suggestions');

      const data = await response.json();
      showSuccess(`${data.added}개의 용어가 추가되었습니다.`);

      // 승인된 항목 제거
      setSuggestions(suggestions.filter((s) => !s.selected));
    } catch (error) {
      console.error('Error approving suggestions:', error);
      showError('용어 승인에 실패했습니다.');
    } finally {
      setApproving(false);
    }
  };

  // 선택 항목 거부
  const rejectSelected = () => {
    const confirmed = showConfirm('선택한 제안을 거부하시겠습니까?');
    if (confirmed) {
      setSuggestions(suggestions.filter((s) => !s.selected));
    }
  };

  const selectedCount = suggestions.filter((s) => s.selected).length;

  return {
    suggestions,
    loading,
    approving,
    filterLanguage,
    setFilterLanguage,
    filterProduct,
    setFilterProduct,
    filterConfidence,
    setFilterConfidence,
    filteredSuggestions,
    fetchSuggestions,
    toggleSelectAll,
    toggleSelect,
    updateContext,
    updateProducts,
    generateContext,
    toggleSamples,
    approveSelected,
    rejectSelected,
    selectedCount,
  };
}

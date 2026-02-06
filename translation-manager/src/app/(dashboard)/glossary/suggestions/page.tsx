'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { TermSuggestion } from '@/lib/glossary/term-detector';
import { SUPPORTED_LANGUAGES, PRODUCTS, LanguageCode, ProductCode } from '@/types';

interface SuggestionWithUI extends TermSuggestion {
  selected: boolean;
  context: string;
  product_codes: ProductCode[];
  showSamples: boolean;
  generating: boolean;
}

const languageOptions = [
  { value: 'all', label: '모든 언어' },
  ...Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
    value: code,
    label: name,
  })),
];

const productOptions = [
  { value: 'all', label: '모든 제품' },
  ...Object.entries(PRODUCTS).map(([code, name]) => ({
    value: code,
    label: name,
  })),
];

const confidenceOptions = [
  { value: 'all', label: '모든 신뢰도' },
  { value: 'high', label: '높음 (80% 이상)' },
  { value: 'medium', label: '보통 (60-80%)' },
  { value: 'low', label: '낮음 (60% 미만)' },
];

export default function GlossarySuggestionsPage() {
  const router = useRouter();
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
      alert('제안 목록을 불러오는데 실패했습니다.');
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
      alert('설명 생성에 실패했습니다. OpenAI API 키가 설정되어 있는지 확인해주세요.');
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
      alert('승인할 용어를 선택해주세요.');
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
      alert(`${data.added}개의 용어가 추가되었습니다.`);

      // 승인된 항목 제거
      setSuggestions(suggestions.filter((s) => !s.selected));
    } catch (error) {
      console.error('Error approving suggestions:', error);
      alert('용어 승인에 실패했습니다.');
    } finally {
      setApproving(false);
    }
  };

  // 선택 항목 거부
  const rejectSelected = () => {
    const confirmed = confirm('선택한 제안을 거부하시겠습니까?');
    if (confirmed) {
      setSuggestions(suggestions.filter((s) => !s.selected));
    }
  };

  const selectedCount = suggestions.filter((s) => s.selected).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/glossary')}
              >
                ← 돌아가기
              </Button>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">용어집 제안</h1>
            <p className="text-gray-600 mt-1">
              번역 기록에서 자동으로 감지된 용어들을 검토하고 승인하세요.
            </p>
          </div>
          <Button onClick={fetchSuggestions} variant="secondary">
            🔄 새로고침
          </Button>
        </div>

        {/* 필터 */}
        <Card>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[150px]">
              <Select
                value={filterLanguage}
                onChange={(e) => setFilterLanguage(e.target.value)}
                options={languageOptions}
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <Select
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
                options={productOptions}
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <Select
                value={filterConfidence}
                onChange={(e) => setFilterConfidence(e.target.value)}
                options={confidenceOptions}
              />
            </div>
          </div>
        </Card>

        {/* 액션 버튼 */}
        {filteredSuggestions.length > 0 && (
          <Card>
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {selectedCount > 0 ? `${selectedCount}개 선택됨` : '선택된 항목 없음'}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={toggleSelectAll}
                  variant="secondary"
                  size="sm"
                >
                  전체 선택
                </Button>
                <Button
                  onClick={rejectSelected}
                  disabled={selectedCount === 0}
                  variant="secondary"
                  size="sm"
                >
                  선택 항목 거부
                </Button>
                <Button
                  onClick={approveSelected}
                  disabled={selectedCount === 0 || approving}
                  loading={approving}
                  size="sm"
                >
                  선택 항목 승인
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* 제안 목록 */}
        <Card padding="none">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              로딩 중...
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="font-medium">제안된 용어가 없습니다.</p>
              <p className="text-sm mt-2">
                번역 작업을 더 진행하면 자동으로 용어가 감지됩니다.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredSuggestions.map((suggestion, index) => {
                const actualIndex = suggestions.indexOf(suggestion);
                return (
                  <div
                    key={actualIndex}
                    className={`p-6 ${suggestion.selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex gap-4">
                      {/* 체크박스 */}
                      <div className="flex-shrink-0 pt-1">
                        <input
                          type="checkbox"
                          checked={suggestion.selected}
                          onChange={() => toggleSelect(actualIndex)}
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </div>

                      <div className="flex-1 min-w-0 space-y-4">
                        {/* 용어 정보 */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                          <div>
                            <label className="text-xs font-medium text-gray-500">용어 (한국어)</label>
                            <div className="text-sm font-medium text-gray-900 mt-1">
                              {suggestion.term}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500">번역</label>
                            <div className="text-sm font-medium text-blue-600 mt-1">
                              {suggestion.translation}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500">언어</label>
                            <div className="text-sm text-gray-700 mt-1">
                              {SUPPORTED_LANGUAGES[suggestion.language_code as LanguageCode] || suggestion.language_code}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500">빈도</label>
                            <div className="text-sm text-gray-700 mt-1">
                              {suggestion.frequency}회
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500">신뢰도</label>
                            <div className="text-sm text-gray-700 mt-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                suggestion.confidence >= 0.8
                                  ? 'bg-green-100 text-green-800'
                                  : suggestion.confidence >= 0.6
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {Math.round(suggestion.confidence * 100)}%
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 사용 예시 */}
                        <div>
                          <button
                            onClick={() => toggleSamples(actualIndex)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {suggestion.showSamples
                              ? '예시 숨기기'
                              : `사용 예시 ${suggestion.sample_contexts.length}개 보기`}
                          </button>
                          {suggestion.showSamples && (
                            <div className="mt-2 space-y-1">
                              {suggestion.sample_contexts.map((ctx, i) => (
                                <div
                                  key={i}
                                  className="text-xs text-gray-600 pl-3 border-l-2 border-gray-300 py-1"
                                >
                                  {ctx}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 설명 입력 */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <label className="text-xs font-medium text-gray-700">
                              설명 (선택사항)
                            </label>
                            <button
                              onClick={() => generateContext(actualIndex)}
                              disabled={suggestion.generating}
                              className="text-xs text-blue-600 hover:underline disabled:text-gray-400"
                            >
                              {suggestion.generating ? '생성 중...' : '💡 AI 생성'}
                            </button>
                          </div>
                          <textarea
                            value={suggestion.context}
                            onChange={(e) => updateContext(actualIndex, e.target.value)}
                            placeholder="이 용어를 어떻게 사용해야 하는지 설명해주세요..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={2}
                          />
                        </div>

                        {/* 제품 선택 */}
                        <div>
                          <label className="text-xs font-medium text-gray-700 mb-2 block">
                            적용 제품 (선택사항)
                          </label>
                          <div className="flex flex-wrap gap-3">
                            {Object.entries(PRODUCTS).map(([code, name]) => (
                              <label
                                key={code}
                                className="inline-flex items-center cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={suggestion.product_codes.includes(code as ProductCode)}
                                  onChange={() => updateProducts(actualIndex, code as ProductCode)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">
                                  {name}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}

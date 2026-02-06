'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import ProductTabs from '@/components/ProductTabs';
import { GlossaryTerm, SUPPORTED_LANGUAGES, LanguageCode, ProductCode, PRODUCTS } from '@/types';

const languageOptions = [
  { value: '', label: '모든 언어' },
  ...Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
    value: code,
    label: name,
  })),
];

const productOptions = [
  { value: '', label: '제품 선택' },
  ...Object.entries(PRODUCTS).map(([code, name]) => ({
    value: code,
    label: name,
  })),
];

export default function GlossaryPage() {
  const router = useRouter();
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
      } else {
        const data = await response.json();
        alert(data.error || '용어 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error creating glossary term:', error);
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
      }
    } catch (error) {
      console.error('Error updating glossary term:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/glossary/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTerms((prev) => prev.filter((t) => t.id !== id));
      }
    } catch (error) {
      console.error('Error deleting glossary term:', error);
    }
  };

  const handleAIReview = async () => {
    setIsReviewing(true);
    try {
      alert('AI 일관성 검사 기능은 번역 관리 페이지에서 개별 번역에 대해 사용할 수 있습니다.');
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">용어집</h1>
            <p className="text-gray-600 mt-1">
              번역 일관성을 위한 용어집을 관리합니다.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleAIReview}
              loading={isReviewing}
            >
              AI 일관성 검사
            </Button>
            <Button onClick={() => setIsModalOpen(true)}>용어 추가</Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              className="border-b-2 border-blue-500 py-4 px-1 text-sm font-medium text-blue-600"
            >
              용어 목록
            </button>
            <button
              onClick={() => router.push('/glossary/suggestions')}
              className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 flex items-center gap-2"
            >
              제안된 용어
              {suggestionCount > 0 && (
                <Badge variant="info">{suggestionCount}</Badge>
              )}
            </button>
          </nav>
        </div>

        {/* Product Tabs */}
        <ProductTabs
          selectedProduct={selectedProduct}
          onProductChange={setSelectedProduct}
        />

        {/* Filters */}
        <Card>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="용어 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                options={languageOptions}
              />
            </div>
          </div>
        </Card>

        {/* Terms List */}
        {loading ? (
          <Card>
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          </Card>
        ) : terms.length === 0 ? (
          <Card>
            <div className="p-8 text-center text-gray-500">
              <p>등록된 용어가 없습니다.</p>
              <p className="text-sm mt-2">용어를 추가하여 번역 일관성을 유지하세요.</p>
            </div>
          </Card>
        ) : languageFilter ? (
          // Single language view
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      용어
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      번역
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      문맥
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      제품
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {terms.map((term) => (
                    <tr key={term.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {term.term}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {term.translation}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {term.context || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {term.product_code ? (
                          <Badge variant="info">{PRODUCTS[term.product_code]}</Badge>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(term)}
                          >
                            수정
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(term.id)}
                          >
                            삭제
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          // Grouped by language view
          <div className="space-y-6">
            {Object.entries(groupedTerms).map(([langCode, langTerms]) => (
              <Card key={langCode}>
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="info">
                    {SUPPORTED_LANGUAGES[langCode as LanguageCode]}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    {langTerms.length}개 용어
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">
                          용어
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">
                          번역
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">
                          문맥
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">
                          제품
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">
                          작업
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {langTerms.map((term) => (
                        <tr key={term.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            {term.term}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            {term.translation}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {term.context || '-'}
                          </td>
                          <td className="px-4 py-2">
                            {term.product_code ? (
                              <Badge variant="info">{PRODUCTS[term.product_code]}</Badge>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditModal(term)}
                              >
                                수정
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(term.id)}
                              >
                                삭제
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            resetForm();
          }}
          title="용어 추가"
        >
          <div className="space-y-4">
            <Select
              label="제품"
              value={formProductCode}
              onChange={(e) => setFormProductCode(e.target.value as ProductCode | '')}
              options={productOptions}
            />
            <Input
              label="용어 *"
              value={formTerm}
              onChange={(e) => setFormTerm(e.target.value)}
              placeholder="예: Login"
            />
            <Select
              label="언어 *"
              value={formLanguage}
              onChange={(e) => setFormLanguage(e.target.value as LanguageCode)}
              options={Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
                value: code,
                label: name,
              }))}
            />
            <Input
              label="번역 *"
              value={formTranslation}
              onChange={(e) => setFormTranslation(e.target.value)}
              placeholder="예: 로그인"
            />
            <Input
              label="문맥/설명"
              value={formContext}
              onChange={(e) => setFormContext(e.target.value)}
              placeholder="이 용어가 사용되는 상황을 설명하세요"
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
              >
                취소
              </Button>
              <Button onClick={handleCreate}>추가</Button>
            </div>
          </div>
        </Modal>

        {/* Edit Modal */}
        <Modal
          isOpen={!!editingTerm}
          onClose={() => {
            setEditingTerm(null);
            resetForm();
          }}
          title="용어 수정"
        >
          <div className="space-y-4">
            <Select
              label="제품"
              value={formProductCode}
              onChange={(e) => setFormProductCode(e.target.value as ProductCode | '')}
              options={productOptions}
            />
            <Input
              label="용어 *"
              value={formTerm}
              onChange={(e) => setFormTerm(e.target.value)}
            />
            <div className="text-sm text-gray-500">
              언어: {editingTerm && SUPPORTED_LANGUAGES[editingTerm.language_code as LanguageCode]}
            </div>
            <Input
              label="번역 *"
              value={formTranslation}
              onChange={(e) => setFormTranslation(e.target.value)}
            />
            <Input
              label="문맥/설명"
              value={formContext}
              onChange={(e) => setFormContext(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingTerm(null);
                  resetForm();
                }}
              >
                취소
              </Button>
              <Button onClick={handleUpdate}>저장</Button>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}

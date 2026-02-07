'use client';

import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import ProductTabs from '@/components/ProductTabs';
import { SUPPORTED_LANGUAGES, LanguageCode, PRODUCTS } from '@/types';
import { LANGUAGE_SELECT_OPTIONS } from '@/lib/constants';
import { useGlossaryData } from './hooks/useGlossaryData';
import GlossaryFormModal from './components/GlossaryFormModal';

export default function GlossaryPage() {
  const router = useRouter();
  const {
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
  } = useGlossaryData();

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
                options={LANGUAGE_SELECT_OPTIONS}
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
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">용어</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">번역</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">문맥</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">제품</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {terms.map((term) => (
                    <tr key={term.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{term.term}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{term.translation}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{term.context || '-'}</td>
                      <td className="px-4 py-3">
                        {term.product_code ? (
                          <Badge variant="info">{PRODUCTS[term.product_code]}</Badge>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openEditModal(term)}>수정</Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(term.id)}>삭제</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
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
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">용어</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">번역</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">문맥</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">제품</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">작업</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {langTerms.map((term) => (
                        <tr key={term.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">{term.term}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{term.translation}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{term.context || '-'}</td>
                          <td className="px-4 py-2">
                            {term.product_code ? (
                              <Badge variant="info">{PRODUCTS[term.product_code]}</Badge>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openEditModal(term)}>수정</Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDelete(term.id)}>삭제</Button>
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
        <GlossaryFormModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            resetForm();
          }}
          title="용어 추가"
          formTerm={formTerm}
          setFormTerm={setFormTerm}
          formTranslation={formTranslation}
          setFormTranslation={setFormTranslation}
          formLanguage={formLanguage}
          setFormLanguage={setFormLanguage}
          formContext={formContext}
          setFormContext={setFormContext}
          formProductCode={formProductCode}
          setFormProductCode={setFormProductCode}
          onSubmit={handleCreate}
          submitLabel="추가"
          showLanguageSelect={true}
        />

        {/* Edit Modal */}
        <GlossaryFormModal
          isOpen={!!editingTerm}
          onClose={() => {
            setEditingTerm(null);
            resetForm();
          }}
          title="용어 수정"
          formTerm={formTerm}
          setFormTerm={setFormTerm}
          formTranslation={formTranslation}
          setFormTranslation={setFormTranslation}
          formLanguage={formLanguage}
          setFormLanguage={setFormLanguage}
          formContext={formContext}
          setFormContext={setFormContext}
          formProductCode={formProductCode}
          setFormProductCode={setFormProductCode}
          onSubmit={handleUpdate}
          submitLabel="저장"
          showLanguageSelect={false}
          editingLanguage={editingTerm ? SUPPORTED_LANGUAGES[editingTerm.language_code as LanguageCode] : undefined}
        />
      </div>
    </DashboardLayout>
  );
}

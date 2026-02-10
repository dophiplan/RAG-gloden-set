'use client';

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
    <DashboardLayout
      title="용어집"
      subtitle="여기에 등록된 번역 문구 기준으로 일관성 있게 번역 됩니다."
    >
      <div className="space-y-6">
        {/* Product Tabs */}
        <ProductTabs
          selectedProduct={selectedProduct}
          onProductChange={setSelectedProduct}
        />

        {/* Filters */}
        <Card>
          <div className="flex flex-wrap gap-4">
            {/* 모든 언어 */}
            <div className="w-40">
              <Select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                options={LANGUAGE_SELECT_OPTIONS}
              />
            </div>
            {/* 검색 */}
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="용어 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            onClick={handleAIReview}
            loading={isReviewing}
          >
            AI 일관성 검사
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>용어 추가</Button>
        </div>

        {/* Terms List */}
        {loading ? (
          <Card>
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#818CF8]"></div>
              <p className="mt-4 text-[#64748B]">로딩 중...</p>
            </div>
          </Card>
        ) : languageFilter ? (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>용어</th>
                    <th>번역</th>
                    <th>문맥</th>
                    <th>제품</th>
                    <th style={{ textAlign: 'right' }}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {terms.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        등록된 용어가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    terms.map((term) => (
                      <tr key={term.id}>
                        <td className="font-semibold">{term.term}</td>
                        <td>{term.translation}</td>
                        <td className="text-[#64748B]">{term.context || '-'}</td>
                        <td>
                          {term.product_code ? (
                            <Badge variant="info">{PRODUCTS[term.product_code]}</Badge>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openEditModal(term)}>수정</Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(term.id)}>삭제</Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ) : terms.length === 0 ? (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>용어</th>
                    <th>번역</th>
                    <th>문맥</th>
                    <th>제품</th>
                    <th style={{ textAlign: 'right' }}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={5}>
                      등록된 용어가 없습니다.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTerms).map(([langCode, langTerms]) => (
              <Card key={langCode} padding="none">
                <div className="px-6 py-4 border-b border-[#E2E8F0] bg-white/60 flex items-center gap-3">
                  <Badge variant="info">
                    {SUPPORTED_LANGUAGES[langCode as LanguageCode]}
                  </Badge>
                  <span className="text-sm text-[#64748B] font-medium">
                    {langTerms.length}개 용어
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th>용어</th>
                        <th>번역</th>
                        <th>문맥</th>
                        <th>제품</th>
                        <th style={{ textAlign: 'right' }}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {langTerms.map((term) => (
                        <tr key={term.id}>
                          <td className="font-semibold">{term.term}</td>
                          <td>{term.translation}</td>
                          <td className="text-[#64748B]">{term.context || '-'}</td>
                          <td>
                            {term.product_code ? (
                              <Badge variant="info">{PRODUCTS[term.product_code]}</Badge>
                            ) : (
                              <span className="text-xs text-[#94A3B8]">-</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
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

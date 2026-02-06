'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import ProductTabs from '@/components/ProductTabs';
import TranslationTableV2 from '@/components/translations/TranslationTableV2';
import EmailTemplateModal from '@/components/translations/EmailTemplateModal';
import DeploymentCheckModal from '@/components/translations/DeploymentCheckModal';
import DuplicateEditModal from '@/components/translations/DuplicateEditModal';
import { Translation, TranslationResult, TranslationStatus, LanguageCode, ProductCode, PRODUCTS, TranslationAuditLog, SUPPORTED_LANGUAGES, EmailTemplateType } from '@/types';

interface TranslationWithAudit extends Translation {
  translation_results: TranslationResult[];
  last_audit?: TranslationAuditLog;
}

interface VersionGroup {
  version: string;
  version_updated_at: string | null;
  translations: TranslationWithAudit[];
}

const productOptions = [
  { value: '', label: '제품 선택' },
  ...Object.entries(PRODUCTS).map(([code, name]) => ({
    value: code,
    label: name,
  })),
];

function TranslationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [translations, setTranslations] = useState<TranslationWithAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TranslationStatus | ''>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductCode | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSourceText, setNewSourceText] = useState('');
  const [newContext, setNewContext] = useState('');
  const [newVersion, setNewVersion] = useState('');
  const [newProductCode, setNewProductCode] = useState<ProductCode | ''>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Dashboard statistics
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    reviewed: 0,
    deployed: 0,
  });

  // Email and deployment modals
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailTemplateType, setEmailTemplateType] = useState<EmailTemplateType>('translation_request');
  const [isDeploymentModalOpen, setIsDeploymentModalOpen] = useState(false);
  const [selectedTranslations, setSelectedTranslations] = useState<Translation[]>([]);

  // Glossary modal states
  const [isGlossaryModalOpen, setIsGlossaryModalOpen] = useState(false);
  const [glossaryTerm, setGlossaryTerm] = useState('');
  const [glossaryTranslation, setGlossaryTranslation] = useState('');
  const [glossaryLanguage, setGlossaryLanguage] = useState<LanguageCode>('en');
  const [glossaryContext, setGlossaryContext] = useState('');
  const [glossaryProductCodes, setGlossaryProductCodes] = useState<ProductCode[]>([]);

  // Duplicate edit modal states
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    translationId: string;
    sourceText: string;
    duplicateIds: string[];
    duplicateCount: number;
  } | null>(null);
  const [pendingEdit, setPendingEdit] = useState<{
    field: string;
    fieldName: string;
    value: any;
    updateFn: (id: string, value: any) => Promise<void>;
  } | null>(null);

  const fetchTranslations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (searchTerm) params.set('search', searchTerm);
      if (selectedProduct) params.set('product_code', selectedProduct);
      params.set('page', page.toString());

      const response = await fetch(`/api/translations?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTranslations(data.translations);
        setTotalPages(data.totalPages);

        // Update statistics
        setStats({
          total: data.total || 0,
          pending: data.stats?.pending || 0,
          reviewed: data.stats?.reviewed || 0,
          deployed: data.stats?.deployed || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching translations:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, selectedProduct, page]);

  useEffect(() => {
    fetchTranslations();
  }, [fetchTranslations]);

  // Handle new texts from PDF upload
  useEffect(() => {
    const newTexts = searchParams.get('new');
    const version = searchParams.get('version');
    const product = searchParams.get('product') as ProductCode | null;

    if (newTexts) {
      try {
        const texts = JSON.parse(decodeURIComponent(newTexts));
        if (Array.isArray(texts) && texts.length > 0) {
          handleBulkCreate(texts, version || undefined, product || undefined);
        }
      } catch (e) {
        console.error('Error parsing new texts:', e);
      }
    }

    // Set product filter if coming from PDF upload
    if (product) {
      setSelectedProduct(product);
    }
  }, [searchParams]);

  const handleBulkCreate = async (texts: string[], version?: string, productCode?: ProductCode) => {
    try {
      const response = await fetch('/api/translations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, version, product_code: productCode }),
      });

      if (response.ok) {
        fetchTranslations();
        // Clear URL params
        window.history.replaceState({}, '', '/translations');
      }
    } catch (error) {
      console.error('Error creating translations:', error);
    }
  };

  const handleStatusChange = async (id: string, status: TranslationStatus) => {
    try {
      const response = await fetch(`/api/translations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        fetchTranslations();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleTranslationUpdate = async (
    translationId: string,
    languageCode: LanguageCode,
    text: string
  ) => {
    try {
      const translation = translations.find((t) => t.id === translationId);
      const existingResult = translation?.translation_results?.find(
        (r) => r.language_code === languageCode
      );

      const response = await fetch(`/api/translations/${translationId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language_code: languageCode,
          translated_text: text,
        }),
      });

      if (response.ok) {
        if (existingResult && existingResult.translated_text !== text) {
          await fetch('/api/ai/corrections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              original_text: existingResult.translated_text,
              corrected_text: text,
              source_text: translation?.source_text,
              language_code: languageCode,
            }),
          }).catch((err) => {
            console.error('Error recording correction:', err);
          });
        }

        fetchTranslations();
      }
    } catch (error) {
      console.error('Error updating translation:', error);
    }
  };

  const handleSourceTextUpdate = async (translationId: string, sourceText: string) => {
    try {
      const response = await fetch(`/api/translations/${translationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_text: sourceText }),
      });

      if (response.ok) {
        fetchTranslations();
      }
    } catch (error) {
      console.error('Error updating source text:', error);
    }
  };

  const handleContextUpdate = async (translationId: string, context: string) => {
    try {
      const response = await fetch(`/api/translations/${translationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: context || null }),
      });

      if (response.ok) {
        fetchTranslations();
      }
    } catch (error) {
      console.error('Error updating context:', error);
    }
  };

  const handleScopeUpdate = async (translationId: string, scope: 'SaaS' | 'Solution' | null) => {
    try {
      const response = await fetch(`/api/translations/${translationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      });

      if (response.ok) {
        fetchTranslations();
      }
    } catch (error) {
      console.error('Error updating scope:', error);
    }
  };

  const handleWorkScopeUpdate = async (translationId: string, workScope: string[]) => {
    try {
      const response = await fetch(`/api/translations/${translationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_scope: workScope }),
      });

      if (response.ok) {
        fetchTranslations();
      }
    } catch (error) {
      console.error('Error updating work scope:', error);
    }
  };

  const handleDevCodeUpdate = async (translationId: string, devCode: string) => {
    try {
      const response = await fetch(`/api/translations/${translationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dev_code: devCode || null }),
      });

      if (response.ok) {
        fetchTranslations();
      }
    } catch (error) {
      console.error('Error updating dev code:', error);
    }
  };

  const handleNotesUpdate = async (translationId: string, notes: string) => {
    try {
      const response = await fetch(`/api/translations/${translationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes || null }),
      });

      if (response.ok) {
        fetchTranslations();
      }
    } catch (error) {
      console.error('Error updating notes:', error);
    }
  };

  const handlePlatformCompletionUpdate = async (
    translationId: string,
    platform: string,
    completed: boolean
  ) => {
    try {
      const translation = translations.find((t) => t.id === translationId);
      if (!translation) return;

      const updatedCompletions = {
        ...translation.platform_completions,
        [platform]: {
          completed,
          completed_at: completed ? new Date().toISOString() : undefined,
          completed_by: completed ? 'current_user' : undefined,
        },
      };

      const response = await fetch(`/api/translations/${translationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform_completions: updatedCompletions }),
      });

      if (response.ok) {
        fetchTranslations();
      }
    } catch (error) {
      console.error('Error updating platform completion:', error);
    }
  };

  const handleOpenEmailModal = (templateType: EmailTemplateType) => {
    if (selectedTranslations.length === 0) {
      alert('번역 항목을 선택해주세요.');
      return;
    }
    setEmailTemplateType(templateType);
    setIsEmailModalOpen(true);
  };

  const handleOpenDeploymentModal = () => {
    if (selectedTranslations.length === 0) {
      alert('번역 항목을 선택해주세요.');
      return;
    }
    setIsDeploymentModalOpen(true);
  };

  const handleVersionUpdate = async (translationId: string, version: string) => {
    try {
      const response = await fetch(`/api/translations/${translationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: version.trim() || null,
          version_updated_at: version.trim() ? new Date().toISOString() : null,
        }),
      });

      if (response.ok) {
        fetchTranslations();
      }
    } catch (error) {
      console.error('Error updating version:', error);
    }
  };

  const handleProductsUpdate = async (translationId: string, products: { code: ProductCode; version: string }[]) => {
    try {
      const response = await fetch(`/api/translations/${translationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_codes: products,
        }),
      });

      if (response.ok) {
        fetchTranslations();
      }
    } catch (error) {
      console.error('Error updating products:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/translations/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTranslations((prev) => prev.filter((t) => t.id !== id));
      }
    } catch (error) {
      console.error('Error deleting translation:', error);
    }
  };

  const handleCreate = async () => {
    if (!newSourceText.trim()) return;

    try {
      const response = await fetch('/api/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_text: newSourceText,
          context: newContext || undefined,
          version: newVersion || undefined,
          product_code: newProductCode || undefined,
        }),
      });

      if (response.ok) {
        setIsModalOpen(false);
        setNewSourceText('');
        setNewContext('');
        setNewVersion('');
        setNewProductCode('');
        fetchTranslations();
      }
    } catch (error) {
      console.error('Error creating translation:', error);
    }
  };

  // Open glossary modal with source text
  const handleAddToGlossary = (sourceText: string) => {
    setGlossaryTerm(sourceText);
    setGlossaryTranslation('');
    setGlossaryLanguage('en');
    setGlossaryContext('');
    setGlossaryProductCodes([]);
    setIsGlossaryModalOpen(true);
  };

  // Add term to glossary
  const handleGlossaryCreate = async () => {
    if (!glossaryTerm.trim() || !glossaryTranslation.trim()) {
      alert('용어와 번역은 필수입니다.');
      return;
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
        alert('용어집에 추가되었습니다!');
      } else {
        const data = await response.json();
        alert(data.error || '용어 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error creating glossary term:', error);
      alert('용어 추가 중 오류가 발생했습니다.');
    }
  };

  // Toggle product selection for glossary
  const toggleGlossaryProduct = (productCode: ProductCode) => {
    setGlossaryProductCodes((prev) =>
      prev.includes(productCode)
        ? prev.filter((p) => p !== productCode)
        : [...prev, productCode]
    );
  };

  // Check for duplicates before editing
  const checkDuplicatesAndEdit = async (
    translationId: string,
    sourceText: string,
    field: string,
    fieldName: string,
    value: any,
    updateFn: (id: string, value: any) => Promise<void>
  ) => {
    try {
      const response = await fetch(
        `/api/translations/update-duplicates?sourceText=${encodeURIComponent(sourceText)}&excludeId=${translationId}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.count > 0) {
          // Show duplicate modal
          setDuplicateInfo({
            translationId,
            sourceText,
            duplicateIds: data.duplicates.map((d: any) => d.id),
            duplicateCount: data.count,
          });
          setPendingEdit({ field, fieldName, value, updateFn });
          setIsDuplicateModalOpen(true);
          return;
        }
      }

      // No duplicates, just update
      await updateFn(translationId, value);
    } catch (error) {
      console.error('Error checking duplicates:', error);
      // Fall back to regular update
      await updateFn(translationId, value);
    }
  };

  // Handle duplicate edit confirmation
  const handleDuplicateEditConfirm = async (updateAll: boolean) => {
    if (!duplicateInfo || !pendingEdit) return;

    try {
      // Update the current translation
      await pendingEdit.updateFn(duplicateInfo.translationId, pendingEdit.value);

      if (updateAll && duplicateInfo.duplicateIds.length > 0) {
        // Update all duplicates
        await fetch('/api/translations/update-duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceText: duplicateInfo.sourceText,
            field: pendingEdit.field,
            value: pendingEdit.value,
            excludeId: duplicateInfo.translationId,
          }),
        });
      }

      fetchTranslations();
    } catch (error) {
      console.error('Error updating duplicates:', error);
    } finally {
      setIsDuplicateModalOpen(false);
      setDuplicateInfo(null);
      setPendingEdit(null);
    }
  };

  // Wrapped update functions that check for duplicates
  const handleVersionUpdateWithDuplicateCheck = async (translationId: string, version: string) => {
    const translation = translations.find(t => t.id === translationId);
    if (!translation) return;

    await checkDuplicatesAndEdit(
      translationId,
      translation.source_text,
      'version',
      '버전',
      version.trim() || null,
      async (id, val) => {
        const response = await fetch(`/api/translations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: val,
            version_updated_at: val ? new Date().toISOString() : null,
          }),
        });
        if (response.ok) fetchTranslations();
      }
    );
  };

  const handleNotesUpdateWithDuplicateCheck = async (translationId: string, notes: string) => {
    const translation = translations.find(t => t.id === translationId);
    if (!translation) return;

    await checkDuplicatesAndEdit(
      translationId,
      translation.source_text,
      'notes',
      '비고',
      notes || null,
      async (id, val) => {
        const response = await fetch(`/api/translations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: val }),
        });
        if (response.ok) fetchTranslations();
      }
    );
  };

  const handleDevCodeUpdateWithDuplicateCheck = async (translationId: string, devCode: string) => {
    const translation = translations.find(t => t.id === translationId);
    if (!translation) return;

    await checkDuplicatesAndEdit(
      translationId,
      translation.source_text,
      'dev_code',
      '개발코드',
      devCode || null,
      async (id, val) => {
        const response = await fetch(`/api/translations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dev_code: val }),
        });
        if (response.ok) fetchTranslations();
      }
    );
  };

  // Update selected translations when translations change
  useEffect(() => {
    // Keep only translations that still exist
    setSelectedTranslations((prev) =>
      prev.filter((selected) => translations.some((t) => t.id === selected.id))
    );
  }, [translations]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">번역 관리</h1>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => router.push('/glossary')}
            >
              용어집 관리
            </Button>
            <Button onClick={() => setIsModalOpen(true)}>새 번역 추가</Button>
          </div>
        </div>

        {/* Dashboard Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Reviewed</p>
                <p className="text-2xl font-bold text-green-600">{stats.reviewed}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Deployed</p>
                <p className="text-2xl font-bold text-gray-600">{stats.deployed}</p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </Card>
        </div>

        {/* Progress Bar */}
        {stats.total > 0 && (
          <Card>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">번역 진행률</span>
                <span className="text-gray-600">
                  {Math.round(((stats.reviewed + stats.deployed) / stats.total) * 100)}% 완료
                </span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex">
                <div
                  className="bg-gray-400 transition-all duration-300"
                  style={{ width: `${(stats.deployed / stats.total) * 100}%` }}
                  title={`반영 완료: ${stats.deployed}`}
                />
                <div
                  className="bg-green-500 transition-all duration-300"
                  style={{ width: `${(stats.reviewed / stats.total) * 100}%` }}
                  title={`검수 완료: ${stats.reviewed}`}
                />
                <div
                  className="bg-yellow-400 transition-all duration-300"
                  style={{ width: `${(stats.pending / stats.total) * 100}%` }}
                  title={`번역 요청: ${stats.pending}`}
                />
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-yellow-400 rounded" />
                  번역 요청 ({stats.pending})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-green-500 rounded" />
                  검수 완료 ({stats.reviewed})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-gray-400 rounded" />
                  반영 완료 ({stats.deployed})
                </span>
              </div>
            </div>
          </Card>
        )}

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
                placeholder="원문 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TranslationStatus | '')}
                options={[
                  { value: '', label: '모든 상태' },
                  { value: 'pending', label: '번역 요청' },
                  { value: 'reviewed', label: '검수 완료' },
                  { value: 'deployed', label: '반영 완료' },
                ]}
              />
            </div>
          </div>
        </Card>

        {/* Bulk Actions */}
        {selectedTranslations.length > 0 && (
          <Card>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm text-gray-700 font-medium">
                {selectedTranslations.length}개 선택됨
              </span>
              <Button
                size="sm"
                onClick={() => handleOpenEmailModal('translation_request')}
              >
                메일 발송
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleOpenDeploymentModal}
              >
                반영 완료 체크
              </Button>
            </div>
          </Card>
        )}

        {/* Translation Table */}
        <TranslationTableV2
          translations={translations}
          onStatusChange={handleStatusChange}
          onTranslationUpdate={handleTranslationUpdate}
          onSourceTextUpdate={handleSourceTextUpdate}
          onContextUpdate={handleContextUpdate}
          onScopeUpdate={handleScopeUpdate}
          onVersionUpdate={handleVersionUpdateWithDuplicateCheck}
          onWorkScopeUpdate={handleWorkScopeUpdate}
          onDevCodeUpdate={handleDevCodeUpdateWithDuplicateCheck}
          onNotesUpdate={handleNotesUpdateWithDuplicateCheck}
          onPlatformCompletionUpdate={handlePlatformCompletionUpdate}
          onDelete={handleDelete}
          onRefresh={fetchTranslations}
          loading={loading}
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />

        {/* Create Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="새 번역 추가"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="제품"
                value={newProductCode}
                onChange={(e) => setNewProductCode(e.target.value as ProductCode | '')}
                options={productOptions}
              />
              <Input
                label="버전"
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                placeholder="예: 2.0.0"
              />
            </div>
            <Input
              label="원문 *"
              value={newSourceText}
              onChange={(e) => setNewSourceText(e.target.value)}
              placeholder="번역할 텍스트를 입력하세요"
            />
            <Input
              label="문맥/설명"
              value={newContext}
              onChange={(e) => setNewContext(e.target.value)}
              placeholder="이 텍스트가 사용되는 화면이나 상황을 설명하세요"
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                취소
              </Button>
              <Button onClick={handleCreate}>추가</Button>
            </div>
          </div>
        </Modal>

        {/* Glossary Add Modal */}
        <Modal
          isOpen={isGlossaryModalOpen}
          onClose={() => setIsGlossaryModalOpen(false)}
          title="용어집에 추가"
        >
          <div className="space-y-4">
            <Input
              label="용어 (한국어) *"
              value={glossaryTerm}
              onChange={(e) => setGlossaryTerm(e.target.value)}
              placeholder="예: 로그인"
            />
            <Select
              label="번역 언어 *"
              value={glossaryLanguage}
              onChange={(e) => setGlossaryLanguage(e.target.value as LanguageCode)}
              options={Object.entries(SUPPORTED_LANGUAGES)
                .filter(([code]) => code !== 'ko')
                .map(([code, name]) => ({
                  value: code,
                  label: name,
                }))}
            />
            <Input
              label="번역 *"
              value={glossaryTranslation}
              onChange={(e) => setGlossaryTranslation(e.target.value)}
              placeholder="예: Sign in"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                설명/사용 문맥 (선택사항)
              </label>
              <textarea
                value={glossaryContext}
                onChange={(e) => setGlossaryContext(e.target.value)}
                placeholder="이 용어를 어떻게 사용해야 하는지 설명해주세요..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      checked={glossaryProductCodes.includes(code as ProductCode)}
                      onChange={() => toggleGlossaryProduct(code as ProductCode)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      {name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="secondary"
                onClick={() => setIsGlossaryModalOpen(false)}
              >
                취소
              </Button>
              <Button onClick={handleGlossaryCreate}>
                용어집에 추가
              </Button>
            </div>
          </div>
        </Modal>

        {/* Email Template Modal */}
        {isEmailModalOpen && (
          <EmailTemplateModal
            isOpen={isEmailModalOpen}
            onClose={() => setIsEmailModalOpen(false)}
            templateType={emailTemplateType}
            selectedTranslations={selectedTranslations}
          />
        )}

        {/* Deployment Check Modal (Bulk) */}
        {isDeploymentModalOpen && selectedTranslations.length > 0 && (
          <DeploymentCheckModal
            isOpen={isDeploymentModalOpen}
            onClose={() => setIsDeploymentModalOpen(false)}
            translation={selectedTranslations[0]}
            onUpdate={() => {
              fetchTranslations();
              setSelectedTranslations([]);
            }}
          />
        )}

        {/* Duplicate Edit Modal */}
        <DuplicateEditModal
          isOpen={isDuplicateModalOpen}
          onClose={() => {
            setIsDuplicateModalOpen(false);
            setDuplicateInfo(null);
            setPendingEdit(null);
          }}
          duplicateInfo={duplicateInfo}
          fieldName={pendingEdit?.fieldName || ''}
          newValue={String(pendingEdit?.value || '')}
          onConfirm={handleDuplicateEditConfirm}
        />
      </div>
    </DashboardLayout>
  );
}

export default function TranslationsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </DashboardLayout>
    }>
      <TranslationsContent />
    </Suspense>
  );
}

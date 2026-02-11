'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card, { CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import DropdownMenu from '@/components/ui/DropdownMenu';
import { createClient } from '@/lib/supabase/client';
import { SUPPORTED_LANGUAGES } from '@/types';
import { showConfirm, showSuccess, showError } from '@/lib/notifications';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
}

interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  display_order: number;
}

interface Language {
  id: string;
  code: string;
  name: string;
  description: string | null;
  display_order: number;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isRsupportUser, setIsRsupportUser] = useState(false);
  const supabase = createClient();

  // Products management
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);

  // Languages management
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loadingLanguages, setLoadingLanguages] = useState(true);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState<Language | null>(null);
  const [languageCode, setLanguageCode] = useState('');
  const [languageName, setLanguageName] = useState('');
  const [languageDescription, setLanguageDescription] = useState('');
  const [savingLanguage, setSavingLanguage] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      try {
        // Use the same API endpoint as ProfileMenu
        const response = await fetch('/api/auth/me');
        console.log('🔍 /api/auth/me response:', response.ok);

        if (response.ok) {
          const data = await response.json();
          console.log('🔍 /api/auth/me data:', data);

          if (data.user) {
            setUser({
              id: data.user.id,
              email: data.user.email,
              name: data.user.name || null,
            });

            // Check if user is from rsupport.com domain
            const email = data.user.email || '';
            const isRsupport = email.endsWith('@rsupport.com');
            setIsRsupportUser(isRsupport);

            // For @rsupport.com users, check organization API key
            if (isRsupport) {
              const orgResponse = await fetch('/api/organization/settings');
              if (orgResponse.ok) {
                const { settings: orgSettings } = await orgResponse.json();
                if (orgSettings?.openai_api_key) {
                  setHasApiKey(true);
                }
              }
            } else {
              // For other users, check individual API key
              const settingsResponse = await fetch('/api/settings/openai-key');
              if (settingsResponse.ok) {
                const settingsData = await settingsResponse.json();
                if (settingsData?.has_key) {
                  setHasApiKey(true);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  // Fetch products
  useEffect(() => {
    async function fetchProducts() {
      setLoadingProducts(true);
      try {
        const response = await fetch('/api/products');
        if (response.ok) {
          const data = await response.json();
          setProducts(data.products || []);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoadingProducts(false);
      }
    }

    fetchProducts();
  }, []);

  // Fetch languages
  useEffect(() => {
    async function fetchLanguages() {
      setLoadingLanguages(true);
      try {
        const response = await fetch('/api/languages');
        if (response.ok) {
          const data = await response.json();
          if (data.languages && data.languages.length > 0) {
            setLanguages(data.languages);
          } else {
            // Fallback: Use hardcoded languages if API returns empty
            const fallbackLanguages = Object.entries(SUPPORTED_LANGUAGES).map(([code, name], index) => ({
              id: code,
              code,
              name,
              description: null,
              display_order: index + 1,
            }));
            setLanguages(fallbackLanguages);
          }
        } else {
          // Fallback: Use hardcoded languages if API fails
          const fallbackLanguages = Object.entries(SUPPORTED_LANGUAGES).map(([code, name], index) => ({
            id: code,
            code,
            name,
            description: null,
            display_order: index + 1,
          }));
          setLanguages(fallbackLanguages);
        }
      } catch (error) {
        console.error('Error fetching languages:', error);
        // Fallback: Use hardcoded languages on error
        const fallbackLanguages = Object.entries(SUPPORTED_LANGUAGES).map(([code, name], index) => ({
          id: code,
          code,
          name,
          description: null,
          display_order: index + 1,
        }));
        setLanguages(fallbackLanguages);
      } finally {
        setLoadingLanguages(false);
      }
    }

    fetchLanguages();
  }, []);

  const handleSaveApiKey = async () => {
    if (!user) {
      showError('사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
      return;
    }

    setSavingApiKey(true);

    try {
      let response;

      if (isRsupportUser) {
        response = await fetch('/api/organization/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ openai_api_key: openaiApiKey }),
        });
      } else {
        response = await fetch('/api/settings/openai-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: openaiApiKey }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'API 키 저장 실패');
      }

      setHasApiKey(!!openaiApiKey);
      setOpenaiApiKey('');
      const keyType = isRsupportUser ? '조직 공용 OpenAI API 키' : 'OpenAI API 키';
      showSuccess(`${keyType}가 저장되었습니다.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'API 키 저장에 실패했습니다.');
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleDeleteApiKey = async () => {
    if (!user) return;
    const keyType = isRsupportUser ? '조직 공용 OpenAI API 키' : 'OpenAI API 키';
    if (!showConfirm(`${keyType}를 삭제하시겠습니까?${isRsupportUser ? ' (조직 전체에 영향을 미칩니다)' : ''}`)) return;

    setSavingApiKey(true);

    try {
      let response;

      if (isRsupportUser) {
        // @rsupport.com users delete from organization settings
        response = await fetch('/api/organization/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ openai_api_key: null }),
        });
      } else {
        // Other users delete from personal settings
        response = await fetch('/api/settings/openai-key', {
          method: 'DELETE',
        });
      }

      if (!response.ok) {
        throw new Error('API 키 삭제 실패');
      }

      setHasApiKey(false);
      showSuccess(`${keyType}가 삭제되었습니다.`);
    } catch (error) {
      console.error('Error deleting API key:', error);
      showError('API 키 삭제에 실패했습니다.');
    } finally {
      setSavingApiKey(false);
    }
  };

  // Product management functions
  const openProductModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductCode(product.code);
      setProductName(product.name);
      setProductDescription(product.description || '');
    } else {
      setEditingProduct(null);
      setProductCode('');
      setProductName('');
      setProductDescription('');
    }
    setIsProductModalOpen(true);
  };

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    setEditingProduct(null);
    setProductCode('');
    setProductName('');
    setProductDescription('');
  };

  const handleSaveProduct = async () => {
    if (!productCode.trim() || !productName.trim()) {
      showError('제품 코드와 이름은 필수입니다.');
      return;
    }

    setSavingProduct(true);

    try {
      let response;

      if (editingProduct) {
        // Update existing product
        response = await fetch(`/api/products/${editingProduct.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: productCode.trim(),
            name: productName.trim(),
            description: productDescription.trim() || null,
          }),
        });
      } else {
        // Create new product
        response = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: productCode.trim(),
            name: productName.trim(),
            description: productDescription.trim() || null,
            display_order: products.length,
          }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '제품 저장 실패');
      }

      // Refresh products list
      const productsResponse = await fetch('/api/products');
      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        setProducts(productsData.products || []);
      }

      showSuccess(editingProduct ? '제품이 수정되었습니다.' : '제품이 추가되었습니다.');
      closeProductModal();
    } catch (error) {
      showError(error instanceof Error ? error.message : '제품 저장에 실패했습니다.');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!showConfirm(`제품 "${product.name}" (${product.code})을(를) 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '제품 삭제 실패');
      }

      // Refresh products list
      const productsResponse = await fetch('/api/products');
      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        setProducts(productsData.products || []);
      }

      showSuccess('제품이 삭제되었습니다.');
    } catch (error) {
      showError(error instanceof Error ? error.message : '제품 삭제에 실패했습니다.');
    }
  };

  // Language management functions
  const openLanguageModal = (language?: Language) => {
    if (language) {
      setEditingLanguage(language);
      setLanguageCode(language.code);
      setLanguageName(language.name);
      setLanguageDescription(language.description || '');
    } else {
      setEditingLanguage(null);
      setLanguageCode('');
      setLanguageName('');
      setLanguageDescription('');
    }
    setIsLanguageModalOpen(true);
  };

  const closeLanguageModal = () => {
    setIsLanguageModalOpen(false);
    setEditingLanguage(null);
    setLanguageCode('');
    setLanguageName('');
    setLanguageDescription('');
  };

  const handleSaveLanguage = async () => {
    if (!languageCode.trim() || !languageName.trim()) {
      showError('언어 코드와 이름은 필수입니다.');
      return;
    }

    setSavingLanguage(true);

    try {
      let response;

      if (editingLanguage) {
        // Update existing language
        response = await fetch(`/api/languages/${editingLanguage.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: languageCode.trim(),
            name: languageName.trim(),
            description: languageDescription.trim() || null,
          }),
        });
      } else {
        // Create new language
        response = await fetch('/api/languages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: languageCode.trim(),
            name: languageName.trim(),
            description: languageDescription.trim() || null,
            display_order: languages.length,
          }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '언어 저장 실패');
      }

      // Refresh languages list
      const languagesResponse = await fetch('/api/languages');
      if (languagesResponse.ok) {
        const languagesData = await languagesResponse.json();
        setLanguages(languagesData.languages || []);
      }

      showSuccess(editingLanguage ? '언어가 수정되었습니다.' : '언어가 추가되었습니다.');
      closeLanguageModal();
    } catch (error) {
      showError(error instanceof Error ? error.message : '언어 저장에 실패했습니다.');
    } finally {
      setSavingLanguage(false);
    }
  };

  const handleDeleteLanguage = async (language: Language) => {
    if (!showConfirm(`언어 "${language.name}" (${language.code})을(를) 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch(`/api/languages/${language.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '언어 삭제 실패');
      }

      // Refresh languages list
      const languagesResponse = await fetch('/api/languages');
      if (languagesResponse.ok) {
        const languagesData = await languagesResponse.json();
        setLanguages(languagesData.languages || []);
      }

      showSuccess('언어가 삭제되었습니다.');
    } catch (error) {
      showError(error instanceof Error ? error.message : '언어 삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="설정"
      subtitle="계정 및 환경 설정을 관리합니다."
    >
      <div className="max-w-5xl mx-auto space-y-8">
        {/* OpenAI API Key Settings */}
        <Card>
          <CardTitle>
            {isRsupportUser ? '조직 공용 OpenAI API 키' : 'OpenAI API 키'}
            {isRsupportUser && (
              <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 px-2 py-1 rounded">
                조직 전체 공유
              </span>
            )}
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            {isRsupportUser
              ? '@rsupport.com 계정은 조직 전체가 공유하는 API 키를 사용합니다. AI 자동 번역 기능에 사용됩니다.'
              : 'AI 자동 번역 기능을 사용하려면 OpenAI API 키가 필요합니다.'
            }
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-gray-900">현재 상태</p>
                <p className="text-sm text-gray-500">
                  {hasApiKey ?
                    (isRsupportUser ? '조직 API 키가 설정되어 있습니다.' : 'API 키가 설정되어 있습니다.')
                    : (isRsupportUser ? '조직 API 키가 설정되지 않았습니다.' : 'API 키가 설정되지 않았습니다.')
                  }
                </p>
              </div>
              <Badge variant={hasApiKey ? 'success' : 'warning'}>
                {hasApiKey ? '설정됨' : '미설정'}
              </Badge>
            </div>

            <Input
              label={hasApiKey ? '새 API 키 (변경시에만 입력)' : 'API 키 *'}
              type="password"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              placeholder="sk-..."
            />

            <div className="flex gap-2">
              <Button
                onClick={handleSaveApiKey}
                loading={savingApiKey}
                disabled={!openaiApiKey}
              >
                {hasApiKey ? 'API 키 변경' : 'API 키 저장'}
              </Button>
              {hasApiKey && (
                <Button
                  variant="danger"
                  onClick={handleDeleteApiKey}
                  loading={savingApiKey}
                >
                  API 키 삭제
                </Button>
              )}
            </div>

            <p className="text-xs text-gray-400">
              API 키는 암호화되어 안전하게 저장됩니다. OpenAI API 키는{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                OpenAI 대시보드
              </a>
              에서 발급받을 수 있습니다.
            </p>
          </div>
        </Card>

        {/* Product Management */}
        <Card>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>제품 관리</CardTitle>
              <Button size="sm" onClick={() => openProductModal()}>
                제품 추가
              </Button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              번역 관리에 사용되는 제품 목록을 관리합니다.
            </p>
            {loadingProducts ? (
              <div className="text-center py-8 text-gray-500">로딩 중...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="info">{product.code}</Badge>
                        <p className="font-semibold text-gray-900">{product.name}</p>
                      </div>
                      <DropdownMenu
                        items={[
                          {
                            label: '수정',
                            onClick: () => openProductModal(product),
                            icon: (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            ),
                          },
                          {
                            label: '삭제',
                            onClick: () => handleDeleteProduct(product),
                            variant: 'danger' as const,
                            icon: (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            ),
                          },
                        ]}
                      />
                    </div>
                    {product.description && (
                      <p className="text-sm text-gray-600 mt-2">{product.description}</p>
                    )}
                  </div>
                ))}
                {products.length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    등록된 제품이 없습니다.
                  </div>
                )}
              </div>
            )}
          </Card>

        {/* Language Management */}
        <Card>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>언어 관리</CardTitle>
              <Button size="sm" onClick={() => openLanguageModal()}>
                언어 추가
              </Button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              번역 지원 언어 목록을 관리합니다.
            </p>
            {loadingLanguages ? (
              <div className="text-center py-8 text-gray-500">로딩 중...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {languages.map((language) => (
                  <div
                    key={language.id}
                    className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="info">{language.code}</Badge>
                        <p className="font-semibold text-gray-900">{language.name}</p>
                      </div>
                      <DropdownMenu
                        items={[
                          {
                            label: '수정',
                            onClick: () => openLanguageModal(language),
                            icon: (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            ),
                          },
                          {
                            label: '삭제',
                            onClick: () => handleDeleteLanguage(language),
                            variant: 'danger' as const,
                            icon: (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            ),
                          },
                        ]}
                      />
                    </div>
                    {language.description && (
                      <p className="text-sm text-gray-600 mt-2">{language.description}</p>
                    )}
                  </div>
                ))}
                {languages.length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    등록된 언어가 없습니다.
                  </div>
                )}
              </div>
            )}
          </Card>


        {/* Data Management */}
        <Card>
          <CardTitle>데이터 관리</CardTitle>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">번역 Export</p>
                <p className="text-sm text-gray-500">모든 번역 데이터를 CSV로 내보내기</p>
              </div>
              <Button variant="secondary" size="sm" disabled>
                준비 중
              </Button>
            </div>
          </div>
        </Card>

        {/* About */}
        <Card>
          <CardTitle>정보</CardTitle>
          <div className="mt-4 text-sm text-gray-500 space-y-2">
            <p>Translation Resource Manager v1.1.0</p>
            <p>기획서 PDF에서 번역 대상 텍스트를 추출하고, 번역 상태를 관리하는 웹 서비스입니다.</p>
            <p className="text-xs text-gray-400 mt-4">
              Built with Next.js, Supabase, OpenAI, and Tailwind CSS
            </p>
          </div>
        </Card>
      </div>

      {/* Product Modal */}
      {isProductModalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingProduct ? '제품 수정' : '제품 추가'}
              </h3>
              <button
                onClick={closeProductModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <Input
                label="제품 코드 *"
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                placeholder="예: RC, RV, RM"
                disabled={!!editingProduct}
              />
              <Input
                label="제품 이름 *"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="예: RemoteCall"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  설명 (선택)
                </label>
                <textarea
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="제품에 대한 간단한 설명"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#818CF8] focus:border-[#818CF8] transition-colors"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <Button
                variant="secondary"
                onClick={closeProductModal}
                disabled={savingProduct}
              >
                취소
              </Button>
              <Button
                onClick={handleSaveProduct}
                loading={savingProduct}
                disabled={!productCode.trim() || !productName.trim()}
              >
                {editingProduct ? '수정' : '추가'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Language Modal */}
      {isLanguageModalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingLanguage ? '언어 수정' : '언어 추가'}
              </h3>
              <button
                onClick={closeLanguageModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <Input
                label="언어 코드 *"
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                placeholder="예: ko, en, ja, zh-CN"
                disabled={!!editingLanguage}
              />
              <Input
                label="언어 이름 *"
                value={languageName}
                onChange={(e) => setLanguageName(e.target.value)}
                placeholder="예: 한국어, English, 日本語"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  설명 (선택)
                </label>
                <textarea
                  value={languageDescription}
                  onChange={(e) => setLanguageDescription(e.target.value)}
                  placeholder="언어에 대한 간단한 설명"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#818CF8] focus:border-[#818CF8] transition-colors"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <Button
                variant="secondary"
                onClick={closeLanguageModal}
                disabled={savingLanguage}
              >
                취소
              </Button>
              <Button
                onClick={handleSaveLanguage}
                loading={savingLanguage}
                disabled={!languageCode.trim() || !languageName.trim()}
              >
                {editingLanguage ? '수정' : '추가'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

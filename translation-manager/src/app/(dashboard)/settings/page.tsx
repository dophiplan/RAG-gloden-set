'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card, { CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import DropdownMenu from '@/components/ui/DropdownMenu';
import AIProviderManager from '@/components/settings/AIProviderManager';
import { createClient } from '@/lib/supabase/client';
import { SUPPORTED_LANGUAGES } from '@/types';
import { showConfirm, showSuccess, showError } from '@/lib/notifications';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  roles?: string[];
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

interface Platform {
  id: string;
  code: string;
  name: string;
  description: string | null;
  display_order: number;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRsupportUser, setIsRsupportUser] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
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

  // Platforms management
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loadingPlatforms, setLoadingPlatforms] = useState(true);
  const [isPlatformModalOpen, setIsPlatformModalOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);
  const [platformCode, setPlatformCode] = useState('');
  const [platformName, setPlatformName] = useState('');
  const [platformDescription, setPlatformDescription] = useState('');
  const [savingPlatform, setSavingPlatform] = useState(false);

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
              roles: data.user.roles || [],
            });

            // Check if user is from rsupport.com domain or has admin/owner role
            const email = data.user.email || '';
            const roles = data.user.roles || [];
            const isRsupport = email.endsWith('@rsupport.com');
            const hasAdminRole = roles.includes('admin') || roles.includes('owner');

            console.log('🔍 Settings page - User check:', { email, isRsupport, hasAdminRole });

            setIsRsupportUser(isRsupport);
            setIsAdmin(hasAdminRole);
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

  // Fetch platforms
  useEffect(() => {
    async function fetchPlatforms() {
      setLoadingPlatforms(true);
      try {
        const response = await fetch('/api/platforms');
        if (response.ok) {
          const data = await response.json();
          setPlatforms(data.platforms || []);
        }
      } catch (error) {
        console.error('Error fetching platforms:', error);
      } finally {
        setLoadingPlatforms(false);
      }
    }

    fetchPlatforms();
  }, []);

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

  // Platform management functions
  const openPlatformModal = (platform?: Platform) => {
    if (platform) {
      setEditingPlatform(platform);
      setPlatformCode(platform.code);
      setPlatformName(platform.name);
      setPlatformDescription(platform.description || '');
    } else {
      setEditingPlatform(null);
      setPlatformCode('');
      setPlatformName('');
      setPlatformDescription('');
    }
    setIsPlatformModalOpen(true);
  };

  const closePlatformModal = () => {
    setIsPlatformModalOpen(false);
    setEditingPlatform(null);
    setPlatformCode('');
    setPlatformName('');
    setPlatformDescription('');
  };

  const handleSavePlatform = async () => {
    if (!platformCode.trim() || !platformName.trim()) {
      showError('플랫폼 코드와 이름은 필수입니다.');
      return;
    }

    setSavingPlatform(true);

    try {
      let response;

      if (editingPlatform) {
        // Update existing platform
        response = await fetch(`/api/platforms/${editingPlatform.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: platformCode.trim(),
            name: platformName.trim(),
            description: platformDescription.trim() || null,
          }),
        });
      } else {
        // Create new platform
        response = await fetch('/api/platforms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: platformCode.trim(),
            name: platformName.trim(),
            description: platformDescription.trim() || null,
            display_order: platforms.length,
          }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '플랫폼 저장 실패');
      }

      // Refresh platforms list
      const platformsResponse = await fetch('/api/platforms');
      if (platformsResponse.ok) {
        const platformsData = await platformsResponse.json();
        setPlatforms(platformsData.platforms || []);
      }

      showSuccess(editingPlatform ? '플랫폼이 수정되었습니다.' : '플랫폼이 추가되었습니다.');
      closePlatformModal();
    } catch (error) {
      showError(error instanceof Error ? error.message : '플랫폼 저장에 실패했습니다.');
    } finally {
      setSavingPlatform(false);
    }
  };

  const handleDeletePlatform = async (platform: Platform) => {
    if (!showConfirm(`플랫폼 "${platform.name}" (${platform.code})을(를) 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch(`/api/platforms/${platform.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '플랫폼 삭제 실패');
      }

      // Refresh platforms list
      const platformsResponse = await fetch('/api/platforms');
      if (platformsResponse.ok) {
        const platformsData = await platformsResponse.json();
        setPlatforms(platformsData.platforms || []);
      }

      showSuccess('플랫폼이 삭제되었습니다.');
    } catch (error) {
      showError(error instanceof Error ? error.message : '플랫폼 삭제에 실패했습니다.');
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
        {/* AI Provider API Keys - Only visible to admins or rsupport users */}
        {(isAdmin || isRsupportUser) && (
          <>
            {console.log('🔍 Rendering AIProviderManager with:', { isRsupportUser, isAdmin })}
            <AIProviderManager isRsupportUser={isRsupportUser} isAdmin={isAdmin} />
          </>
        )}

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

        {/* Platform Management */}
        <Card>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>플랫폼 관리</CardTitle>
              <Button size="sm" onClick={() => openPlatformModal()}>
                플랫폼 추가
              </Button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              번역이 사용되는 플랫폼 목록을 관리합니다.
            </p>
            {loadingPlatforms ? (
              <div className="text-center py-8 text-gray-500">로딩 중...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {platforms
                  .sort((a, b) => a.code.localeCompare(b.code))
                  .map((platform) => (
                  <div
                    key={platform.id}
                    className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="info">{platform.code}</Badge>
                        <p className="font-semibold text-gray-900">{platform.name}</p>
                      </div>
                      <DropdownMenu
                        items={[
                          {
                            label: '수정',
                            onClick: () => openPlatformModal(platform),
                            icon: (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            ),
                          },
                          {
                            label: '삭제',
                            onClick: () => handleDeletePlatform(platform),
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
                    {platform.description && (
                      <p className="text-sm text-gray-600 mt-2">{platform.description}</p>
                    )}
                  </div>
                ))}
                {platforms.length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    등록된 플랫폼이 없습니다.
                  </div>
                )}
              </div>
            )}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
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

      {/* Platform Modal */}
      {isPlatformModalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingPlatform ? '플랫폼 수정' : '플랫폼 추가'}
              </h3>
              <button
                onClick={closePlatformModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <Input
                label="플랫폼 코드 *"
                value={platformCode}
                onChange={(e) => setPlatformCode(e.target.value)}
                placeholder="예: Front, Back, iOS, Android"
              />
              <Input
                label="플랫폼 이름 *"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                placeholder="예: 프론트엔드, 백엔드"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  설명 (선택)
                </label>
                <textarea
                  value={platformDescription}
                  onChange={(e) => setPlatformDescription(e.target.value)}
                  placeholder="플랫폼에 대한 간단한 설명"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <Button
                variant="secondary"
                onClick={closePlatformModal}
                disabled={savingPlatform}
              >
                취소
              </Button>
              <Button
                onClick={handleSavePlatform}
                loading={savingPlatform}
                disabled={!platformCode.trim() || !platformName.trim()}
              >
                {editingPlatform ? '수정' : '추가'}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
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

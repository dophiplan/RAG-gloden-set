"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import Card, { CardTitle } from "@/components/ui/Card";
import AIProviderManager from "@/components/settings/AIProviderManager";
import { useSettings } from "./hooks/useSettings";
import { SettingSection } from "./components/SettingSection";

/**
 * Settings Page
 * 
 * User settings and system configuration management
 * Composed of modular sections:
 * - User profile info
 * - Products management
 * - Languages management  
 * - Platforms management
 * - AI Provider settings
 * 
 * @see hooks/useSettings.ts - Data management
 * @see components/SettingSection.tsx - Reusable section component
 * @see components/DraggableList.tsx - Drag & drop list
 */
export default function SettingsPage() {
  const {
    user,
    loading,
    isAuthorized,
    isRsupportUser,
    isAdmin,
    products,
    loadingProducts,
    languages,
    loadingLanguages,
    platforms,
    loadingPlatforms,
    refreshProducts,
    refreshLanguages,
    refreshPlatforms,
  } = useSettings();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthorized) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-lg font-medium">접근 권한이 없습니다</p>
            <p className="text-sm">Master 권한이 필요합니다.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">설정</h1>
            <p className="text-gray-500">시스템 설정 및 관리</p>
          </div>
          {user && (
            <div className="text-sm text-gray-500">
              {user.email}
            </div>
          )}
        </div>

        {/* Products Section */}
        <SettingSection
          title="제품 관리"
          description="번역 대상 제품을 관리합니다"
          items={products}
          isLoading={loadingProducts}
          apiEndpoint="/api/products"
          onRefresh={refreshProducts}
          codeLabel="제품 코드"
          nameLabel="제품명"
          emptyMessage="등록된 제품이 없습니다."
        />

        {/* Languages Section */}
        <SettingSection
          title="언어 관리"
          description="지원하는 언어를 관리합니다"
          items={languages}
          isLoading={loadingLanguages}
          apiEndpoint="/api/languages"
          onRefresh={refreshLanguages}
          codeLabel="언어 코드"
          nameLabel="언어명"
          emptyMessage="등록된 언어가 없습니다."
        />

        {/* Platforms Section */}
        <SettingSection
          title="플랫폼 관리"
          description="지원하는 플랫폼을 관리합니다"
          items={platforms}
          isLoading={loadingPlatforms}
          apiEndpoint="/api/platforms"
          onRefresh={refreshPlatforms}
          codeLabel="플랫폼 코드"
          nameLabel="플랫폼명"
          emptyMessage="등록된 플랫폼이 없습니다."
        />

        {/* AI Settings Section */}
        <Card>
          <CardTitle>AI 설정</CardTitle>
          <div className="mt-4">
            <AIProviderManager isRsupportUser={isRsupportUser} isAdmin={isAdmin} />
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

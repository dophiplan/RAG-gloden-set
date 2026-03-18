"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";

import AIProviderManager from "@/components/settings/AIProviderManager";
import { useSettings } from "./hooks/useSettings";
import { ProductsSection } from "./components/ProductsSection";
import { LanguagesSection } from "./components/LanguagesSection";
import { PlatformsSection } from "./components/PlatformsSection";

/**
 * Settings Page
 *
 * User settings and system configuration management
 */
export default function SettingsPage() {
  const {
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
            <svg
              className="w-12 h-12 mx-auto mb-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <p className="text-lg font-medium">접근 권한이 없습니다</p>
            <p className="text-sm">Master 권한이 필요합니다.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="설정">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* AI Settings Section */}
        <AIProviderManager isRsupportUser={isRsupportUser} isAdmin={isAdmin} />

        {/* Products Section */}
        <ProductsSection
          products={products}
          isLoading={loadingProducts}
          onRefresh={refreshProducts}
        />

        {/* Languages Section */}
        <LanguagesSection
          languages={languages}
          isLoading={loadingLanguages}
          onRefresh={refreshLanguages}
        />

        {/* Platforms Section */}
        <PlatformsSection
          platforms={platforms}
          isLoading={loadingPlatforms}
          onRefresh={refreshPlatforms}
        />
      </div>
    </DashboardLayout>
  );
}

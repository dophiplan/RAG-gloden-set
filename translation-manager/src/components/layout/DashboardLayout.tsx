'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import ProfileMenu from './ProfileMenu';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  quickActions?: React.ReactNode;
  headerActions?: React.ReactNode;
}

export default function DashboardLayout({
  children,
  title,
  subtitle,
  quickActions,
  headerActions
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 overflow-auto lg:ml-0">
        {/* Header with Title and Actions */}
        <div className="sticky top-0 z-40 bg-background h-16 border-b border-border-light">
          <div className="h-full px-4 lg:px-8 flex items-center justify-between gap-4 lg:gap-8">
            {/* Hamburger Menu Button (Mobile) */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-text-secondary hover:text-text-main hover:bg-white rounded-xl transition-all"
              aria-label="메뉴 열기"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Left: Page Title */}
            {title && (
              <div className="flex-1">
                <h1 className="text-lg lg:text-xl font-bold text-text-main tracking-tight">{title}</h1>
              </div>
            )}

            {/* Right: Actions and Profile Menu */}
            <div className="flex items-center gap-4">
              {/* Header Actions */}
              {headerActions}

              {/* Divider */}
              {headerActions && (
                <div className="h-6 w-px bg-border-divider"></div>
              )}

              {/* Profile Menu */}
              <ProfileMenu />
            </div>
          </div>
        </div>

        {/* Subtitle Section */}
        {subtitle && (
          <div className="bg-background px-8 py-2 flex items-center justify-between">
            <p className="text-sm text-text-muted">{subtitle}</p>
            {quickActions && (
              <div className="flex items-center gap-2">
                {quickActions}
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="px-8 pt-4 pb-8">
          {children}
        </div>
      </main>
    </div>
  );
}

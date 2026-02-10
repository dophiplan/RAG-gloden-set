'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import ProfileMenu from './ProfileMenu';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  quickActions?: React.ReactNode;
}

export default function DashboardLayout({
  children,
  title,
  subtitle,
  quickActions
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#F1F8F4]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 overflow-auto lg:ml-0">
        {/* Header with Title and Actions */}
        <div className="sticky top-0 z-40 bg-[#F1F8F4] h-16">
          <div className="h-full px-4 lg:px-8 flex items-center justify-between gap-4 lg:gap-8">
            {/* Hamburger Menu Button (Mobile) */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Left: Page Title */}
            {title && (
              <div className="flex-1">
                <h1 className="text-lg lg:text-xl font-bold text-[#1E293B] tracking-tight">{title}</h1>
              </div>
            )}

            {/* Right: Quick Actions and Profile Menu */}
            <div className="flex items-center gap-4">
              {/* Quick Actions */}
              {quickActions}

              {/* Divider */}
              {quickActions && (
                <div className="h-6 w-px bg-[#D4E3FC]"></div>
              )}

              {/* Profile Menu */}
              <ProfileMenu />
            </div>
          </div>
        </div>

        {/* Subtitle Section */}
        {subtitle && (
          <div className="bg-[#F1F8F4] px-8 py-1.5">
            <p className="text-xs text-[#64748B]">{subtitle}</p>
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

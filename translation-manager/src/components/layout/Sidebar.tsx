'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const navigation = [
  {
    name: '대시보드',
    href: '/',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    name: '번역 관리',
    href: '/translations',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
  },
  {
    name: '용어집',
    href: '/glossary',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    name: '번역 요청하기',
    href: '/upload',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    name: '데이터 마이그레이션',
    href: '/settings/migration',
    masterOnly: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    name: '사용자 관리',
    href: '/users',
    masterOnly: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    name: '설정',
    href: '/settings',
    masterOnly: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    // Fetch current user with roles
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user && data.user.roles) {
          setUserRoles(data.user.roles);
        }
      })
      .catch(console.error);
  }, []);

  // Filter navigation based on user role
  const filteredNavigation = navigation.filter(item => {
    if (item.masterOnly) {
      // Show to master and 1st_master users
      return userRoles.includes('master') || userRoles.includes('1st_master');
    }
    return true;
  });

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        flex flex-col w-64 bg-white border-r border-[#E0E7FF] min-h-screen
        fixed lg:static inset-y-0 left-0 z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `} style={{
        boxShadow: '4px 0 16px rgba(99, 102, 241, 0.06)'
      }}>
        {/* Logo */}
        <div className="flex items-center justify-center h-16 px-5 border-b border-[#C7D2FE] bg-gradient-to-br from-[#6366F1] via-[#4F46E5] to-[#818CF8]" style={{
          boxShadow: '0 4px 16px rgba(99, 102, 241, 0.25)'
        }}>
          <h1 className="text-xl font-bold text-white tracking-tight drop-shadow-sm">Language Monster</h1>
          {/* Close button for mobile */}
          {onClose && (
            <button
              onClick={onClose}
              className="ml-auto lg:hidden text-white hover:text-white/80 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 bg-white">
          {filteredNavigation.map((item) => {
            // Exact match for root and translations, prefix match for others
            let isActive;
            if (item.href === '/') {
              isActive = pathname === '/';
            } else if (item.href === '/translations') {
              isActive = pathname === '/translations' || pathname.startsWith('/translations/');
            } else if (item.href === '/settings') {
              // Exact match for settings to avoid matching /settings/migration
              isActive = pathname === '/settings';
            } else {
              isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`
                  flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-300
                  ${isActive
                    ? 'bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white shadow-md'
                    : 'text-[#546E7A] hover:bg-[#E0E7FF] hover:text-[#6366F1]'
                  }
                `}
                style={isActive ? {
                  boxShadow: '0 4px 16px rgba(99, 102, 241, 0.2)'
                } : undefined}
              >
                <span className="mr-3">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useProducts } from '@/hooks/useReferenceData';
import { useTheme } from '@/context/ThemeContext';
import ThemeToggle from '@/components/ui/ThemeToggle';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavigationItem {
  name: string;
  href?: string;
  icon: React.ReactNode;
  masterOnly?: boolean;
  hasSubmenu?: boolean;
  submenuKey?: string;
}

const baseNavigation: NavigationItem[] = [
  {
    name: '대시보드',
    href: '/',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    name: '번역 관리',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
    hasSubmenu: true,
    submenuKey: 'translations',
  },
  {
    name: '용어집',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    hasSubmenu: true,
    submenuKey: 'glossary',
  },
  {
    name: '번역 요청하기',
    href: '/upload',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    name: '데이터 마이그레이션',
    href: '/settings/migration',
    masterOnly: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    name: '사용자 관리',
    href: '/users',
    masterOnly: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    name: '설정',
    href: '/settings',
    masterOnly: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [accountLevel, setAccountLevel] = useState<string>('');
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const { products = [] } = useProducts();

  // Listen for history panel open/close
  useEffect(() => {
    const checkHistoryOpen = () => {
      const isOpen = document.body.hasAttribute('data-history-open');
      setIsHistoryOpen(isOpen);
    };
    
    // Check initially
    checkHistoryOpen();
    
    // Set up mutation observer to detect attribute changes
    const observer = new MutationObserver(checkHistoryOpen);
    observer.observe(document.body, { attributes: true });
    
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Fetch current user with roles and account level
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(result => {
        // Handle standardized API response: { data: { user: {...} } }
        const userData = result.data?.user || result.data || result.user;
        if (userData) {
          if (userData.roles) {
            setUserRoles(userData.roles);
          }
          if (userData.account_level) {
            setAccountLevel(userData.account_level);
          }
        }
      })
      .catch(console.error);
  }, []);

  // Auto-expand accordion if current path matches
  useEffect(() => {
    const newExpanded = new Set(expandedMenus);
    if (pathname.startsWith('/translations')) {
      newExpanded.add('translations');
    }
    if (pathname.startsWith('/glossary')) {
      newExpanded.add('glossary');
    }
    setExpandedMenus(newExpanded);
  }, [pathname]);

  // Check if user is master (master or 1st_master account level)
  const isMaster = accountLevel === 'master' || accountLevel === '1st_master';

  // Filter navigation based on account level
  const filteredNavigation = baseNavigation.filter(item => {
    if (item.masterOnly) {
      // Only show to master and 1st_master account levels
      return isMaster;
    }
    return true;
  });

  const toggleMenu = (menuKey: string) => {
    const newExpanded = new Set(expandedMenus);
    if (newExpanded.has(menuKey)) {
      newExpanded.delete(menuKey);
    } else {
      newExpanded.add(menuKey);
    }
    setExpandedMenus(newExpanded);
  };

  const { theme } = useTheme();

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
      <div 
        className={`
          flex flex-col w-64 min-h-screen
          fixed lg:static inset-y-0 left-0 z-50
          transform transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isHistoryOpen ? 'opacity-30 pointer-events-none' : 'opacity-100 pointer-events-auto'}
        `}
        style={{ 
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)'
        }}
      >
        {/* Logo */}
        <div 
          className="flex items-center justify-center h-16 px-5 border-b"
          style={{ 
            background: theme === 'white' ? '#111827' : '#6366F1',
            borderColor: theme === 'white' ? '#374151' : '#818CF8'
          }}
        >
          <h1 className="text-xl font-bold text-white tracking-tight drop-shadow-sm">Language Monster</h1>
          {/* Close button for mobile */}
          {onClose && (
            <button
              onClick={onClose}
              className="ml-auto lg:hidden text-white hover:text-white/80 transition-colors"
              aria-label="메뉴 닫기"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto" style={{ background: 'var(--surface)' }}>
          {(filteredNavigation || []).map((item) => {
            // For items with submenu
            if (item.hasSubmenu && item.submenuKey) {
              const isExpanded = expandedMenus.has(item.submenuKey);
              const isInSection = pathname.startsWith(`/${item.submenuKey}`);

              return (
                <div key={item.name} className="space-y-1">
                  {/* Accordion Header - Clickable to go to main page */}
                  <div className="relative">
                    <Link
                      href={`/${item.submenuKey}`}
                      onClick={(e) => {
                        // Expand menu when clicking
                        if (!isExpanded) {
                          e.preventDefault();
                          toggleMenu(item.submenuKey!);
                        } else {
                          onClose?.();
                        }
                      }}
                      className={`
                        w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200
                        ${isInSection
                          ? theme === 'white'
                            ? 'bg-gray-900 text-white shadow-sm'
                            : 'bg-gradient-to-r from-[#6366F1] to-[#818CF8] text-white shadow-md'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }
                      `}
                      style={isInSection && theme === 'blue' ? {
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
                      } : undefined}
                    >
                      <div className="flex items-center">
                        <span className="mr-3">{item.icon}</span>
                        {item.name}
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleMenu(item.submenuKey!);
                        }}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                      >
                        <svg
                          className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </Link>
                  </div>

                  {/* Submenu - No "전체" item, only products */}
                  {isExpanded && (
                    <div className="ml-4 space-y-1">
                      {/* Product items */}
                      {products && (products || []).length > 0 && (products || []).map((product) => {
                        const productPath = `/${item.submenuKey}/${product.code}`;
                        const isProductActive = pathname === productPath || pathname.startsWith(productPath + '/');

                        return (
                          <Link
                            key={product.code}
                            href={productPath}
                            onClick={onClose}
                            className={`
                              block px-4 py-2 text-sm rounded-md transition-all duration-150
                              ${isProductActive
                                ? theme === 'white'
                                  ? 'bg-gray-100 text-gray-900 font-medium'
                                  : 'bg-[#E0E7FF] text-[#4F46E5] font-medium'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                              }
                            `}
                          >
                            {product.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Regular navigation items
            let isActive;
            if (item.href === '/') {
              isActive = pathname === '/';
            } else if (item.href === '/settings') {
              // Exact match for settings to avoid matching /settings/migration
              isActive = pathname === '/settings';
            } else if (item.href) {
              isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            } else {
              isActive = false;
            }

            return (
              <Link
                key={item.name}
                href={item.href || '#'}
                onClick={onClose}
                className={`
                  flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200
                  ${isActive
                    ? theme === 'white'
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'bg-gradient-to-r from-[#6366F1] to-[#818CF8] text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
                style={isActive && theme === 'blue' ? {
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
                } : undefined}
              >
                <span className="mr-3">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Theme Toggle */}
        <div className="px-4 py-4 border-t border-[var(--border)]" style={{ background: 'var(--background-secondary)' }}>
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}

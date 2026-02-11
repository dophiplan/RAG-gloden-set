'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { showSuccess, showError } from '@/lib/notifications';

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  roles?: string[];
  permissions?: string[];
  work_products?: string[];
}

export default function ProfileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    // Fetch user profile
    async function fetchUser() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);

    try {
      const response = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '프로필 저장 실패');
      }

      setUser({ ...user, name: editingName });
      setIsProfileModalOpen(false);
      showSuccess('프로필이 저장되었습니다.');
    } catch (error) {
      console.error('Error saving profile:', error);
      showError(error instanceof Error ? error.message : '프로필 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        router.push('/login');
        router.refresh();
      }
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.charAt(0).toUpperCase();
    }
    return email.charAt(0).toUpperCase();
  };

  const getPermissionLabel = (permission: string) => {
    const labels: { [key: string]: string } = {
      master: '마스터',
      translator: '번역가',
      reviewer: '검수가',
      requester: '번역요청자',
      deployer: '번역반영자',
    };
    return labels[permission] || permission;
  };

  if (loading) {
    return (
      <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse"></div>
    );
  }

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-700 text-white font-medium hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
        aria-label="프로필 메뉴"
      >
        {getInitials(user.name, user.email)}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-900">
                {user.name || '이름 미설정'}
              </p>
              {/* Account Level Badge */}
              {user.roles && user.roles.length > 0 && (
                <span
                  className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                    user.roles.includes('1st_master')
                      ? 'bg-red-100 text-red-800'
                      : user.roles.includes('master')
                      ? 'bg-purple-100 text-purple-800'
                      : user.roles.includes('manager')
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {user.roles.includes('1st_master') ? '1st Master' : user.roles.includes('master') ? 'Master' : user.roles.includes('manager') ? 'Manager' : 'User'}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>

            {/* Products and Permissions for non-master users */}
            {user.roles && !user.roles.includes('master') && !user.roles.includes('1st_master') && (
              <div className="mt-3 space-y-2">
                {/* Products */}
                {user.work_products && user.work_products.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">관리 제품</p>
                    <div className="flex flex-wrap gap-1">
                      {user.work_products.map((product) => (
                        <span
                          key={product}
                          className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded"
                        >
                          {product}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Permissions */}
                {user.permissions && user.permissions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">작업 권한</p>
                    <div className="flex flex-wrap gap-1">
                      {user.permissions.map((permission) => (
                        <span
                          key={permission}
                          className="inline-block px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded"
                        >
                          {getPermissionLabel(permission)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={() => {
                setEditingName(user.name || '');
                setIsProfileModalOpen(true);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              설정 변경
            </button>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      )}

      {/* Profile Edit Modal */}
      {isProfileModalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}
        >
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between px-6 py-3 border-b">
              <h3 className="text-base font-semibold text-gray-900">프로필 설정 변경</h3>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="닫기"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일 <span className="text-xs text-gray-400">(수정 불가)</span>
                </label>
                <input
                  type="text"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
                />
              </div>
              <Input
                label="이름 * (최대 5글자)"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value.slice(0, 5))}
                placeholder="이름을 입력하세요"
                maxLength={5}
              />
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-3 border-t bg-gray-50">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsProfileModalOpen(false)}
              >
                취소
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveProfile}
                loading={saving}
              >
                저장
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

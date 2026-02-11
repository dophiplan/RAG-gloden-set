'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card, { CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { showSuccess, showError, showConfirm } from '@/lib/notifications';
import { FIRST_MASTER_EMAIL } from '@/types/users';
import { useProducts } from '@/hooks/useReferenceData';

interface SystemUser {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  permissions: string[];
  work_products: string[];
  translatorLanguages?: string[];
  created_at: string;
}

export default function UsersPage() {
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [currentUserRoles, setCurrentUserRoles] = useState<string[]>([]);

  // Fetch products from DB
  const { products } = useProducts();

  // Filters
  const [filterProduct, setFilterProduct] = useState<string>('');
  const [filterPermission, setFilterPermission] = useState<string>('');
  const [filterAccountLevel, setFilterAccountLevel] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add/Edit user modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Default values for new user
  const defaultModalData = {
    products: [] as string[], // No products selected by default
    name: '',
    email: '@rsupport.com',
    password: '',
    accountLevel: 'user' as '1st_master' | 'master' | 'manager' | 'user',
    permissions: [] as string[], // No permissions selected by default
    translatorLanguages: [] as string[], // Languages for translator
  };

  const [modalData, setModalData] = useState(defaultModalData);

  // Multi-select for deletion
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Filter users based on filters
  const filteredUsers = useMemo(() => {
    return systemUsers.filter(user => {
      // Product filter
      if (filterProduct && !user.work_products?.includes(filterProduct)) {
        return false;
      }

      // Permission filter
      if (filterPermission && !user.permissions?.includes(filterPermission)) {
        return false;
      }

      // Account level filter
      if (filterAccountLevel && !user.roles?.includes(filterAccountLevel)) {
        return false;
      }

      // Search filter (name or email)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = user.name?.toLowerCase().includes(query);
        const matchesEmail = user.email?.toLowerCase().includes(query);
        if (!matchesName && !matchesEmail) {
          return false;
        }
      }

      return true;
    });
  }, [systemUsers, filterProduct, filterPermission, filterAccountLevel, searchQuery]);

  const fetchSystemUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/users');

      if (response.ok) {
        const data = await response.json();
        setSystemUsers(data.users || []);
      } else {
        const error = await response.json();
        showError(error.error || '사용자 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      showError('사용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUsers = async () => {
    if (selectedUserIds.length === 0) return;

    // Check if trying to delete 1st master account
    const selectedUsers = systemUsers.filter(u => selectedUserIds.includes(u.id));
    const hasFirstMaster = selectedUsers.some(u => u.email === FIRST_MASTER_EMAIL);

    if (hasFirstMaster) {
      showError('최고 관리자 계정은 삭제할 수 없습니다.');
      return;
    }

    if (!showConfirm(`선택한 ${selectedUserIds.length}명의 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userIds: selectedUserIds }),
      });

      const data = await response.json();

      if (response.ok) {
        showSuccess(`${data.deleted}명의 사용자가 삭제되었습니다.`);
        setSelectedUserIds([]);
        fetchSystemUsers();
      } else {
        showError(data.error || '사용자 삭제에 실패했습니다.');
      }
    } catch (error) {
      showError('사용자 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleSelectAll = () => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map(u => u.id));
    }
  };

  const handleAddUser = async () => {
    if (!modalData.name || !modalData.email || !modalData.password) {
      showError('모든 필수 항목을 입력해주세요.');
      return;
    }

    // Check if email is just the domain (starts with @)
    if (modalData.email.startsWith('@')) {
      showError('이메일 주소를 입력해주세요.');
      return;
    }

    // Check if email is valid format
    if (!modalData.email.includes('@')) {
      showError('올바른 이메일 형식이 아닙니다.');
      return;
    }

    try {
      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: modalData.email,
          name: modalData.name,
          password: modalData.password,
          products: modalData.products,
          accountLevel: modalData.accountLevel,
          permissions: modalData.permissions,
          translatorLanguages: modalData.translatorLanguages,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showSuccess('사용자가 등록되었습니다.');
        setIsModalOpen(false);
        setEditingUserId(null);
        setModalData(defaultModalData);
        fetchSystemUsers();
      } else {
        showError(data.error || '사용자 등록에 실패했습니다.');
      }
    } catch (error) {
      showError('사용자 등록 중 오류가 발생했습니다.');
    }
  };

  const handleEditUser = async () => {
    if (!modalData.name || !modalData.email) {
      showError('이름과 이메일은 필수 항목입니다.');
      return;
    }

    if (!editingUserId) return;

    try {
      const response = await fetch(`/api/admin/users/${editingUserId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: modalData.name,
          email: modalData.email,
          password: modalData.password || undefined, // Only send if provided
          products: modalData.products,
          accountLevel: modalData.accountLevel,
          permissions: modalData.permissions,
          translatorLanguages: modalData.translatorLanguages,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showSuccess('사용자 정보가 수정되었습니다.');
        setIsModalOpen(false);
        setEditingUserId(null);
        setModalData(defaultModalData);
        fetchSystemUsers();
      } else {
        showError(data.error || '사용자 수정에 실패했습니다.');
      }
    } catch (error) {
      showError('사용자 수정 중 오류가 발생했습니다.');
    }
  };

  const openEditModal = (user: SystemUser) => {
    // Check if trying to edit 1st master account
    const isFirstMaster = user.email === FIRST_MASTER_EMAIL;
    const currentUserIsFirstMaster = currentUserRoles.includes('1st_master');

    if (isFirstMaster && !currentUserIsFirstMaster) {
      showError('최고 관리자 계정은 수정할 수 없습니다.');
      return;
    }

    setEditingUserId(user.id);
    const isMaster = user.roles?.includes('master') || user.roles?.includes('1st_master');
    setModalData({
      products: isMaster ? products.map(p => p.code) : (user.work_products || []),
      name: user.name || '',
      email: user.email,
      password: '', // Don't pre-fill password
      accountLevel: (user.roles?.includes('1st_master') ? '1st_master' : user.roles?.includes('master') ? 'master' : user.roles?.includes('manager') ? 'manager' : 'user') as '1st_master' | 'master' | 'manager' | 'user',
      permissions: isMaster ? ['reviewer', 'requester', 'deployer'] : (user.permissions || []),
      translatorLanguages: user.translatorLanguages || [],
    });
    setIsModalOpen(true);
  };

  const handlePermissionToggle = async (userId: string, permission: string, currentPermissions: string[]) => {
    const newPermissions = currentPermissions.includes(permission)
      ? currentPermissions.filter(p => p !== permission)
      : [...currentPermissions, permission];

    // Optimistic update
    setSystemUsers(prev =>
      prev.map(u => u.id === userId ? { ...u, permissions: newPermissions } : u)
    );

    try {
      const response = await fetch(`/api/admin/users/${userId}/permissions`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permissions: newPermissions }),
      });

      if (response.ok) {
        showSuccess('권한이 업데이트되었습니다.');
      } else {
        // Rollback on error
        setSystemUsers(prev =>
          prev.map(u => u.id === userId ? { ...u, permissions: currentPermissions } : u)
        );
        showError('권한 업데이트에 실패했습니다.');
      }
    } catch (error) {
      // Rollback on error
      setSystemUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, permissions: currentPermissions } : u)
      );
      showError('권한 업데이트 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    fetchSystemUsers();

    // Fetch current user info
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setCurrentUserEmail(data.user.email);
          setCurrentUserRoles(data.user.roles || []);
        }
      })
      .catch(console.error);
  }, []);

  return (
    <DashboardLayout
      title="사용자 관리"
      quickActions={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            window.location.href = '/api/admin/users/template';
          }}
        >
          📥 엑셀 템플릿 다운로드
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">등록된 사용자 ({filteredUsers.length}명)</h1>
          <div className="flex gap-2">
              <input
                type="file"
                accept=".xlsx,.xls"
                id="userExcelUpload"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  try {
                    const formData = new FormData();
                    formData.append('file', file);

                    const response = await fetch('/api/admin/users/import', {
                      method: 'POST',
                      headers: {
                        'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_SECRET || '',
                      },
                      body: formData,
                    });

                    const data = await response.json();

                    if (response.ok) {
                      showSuccess(
                        `사용자 등록 완료: 생성 ${data.summary.created}명, 수정 ${data.summary.updated}명, 실패 ${data.summary.failed}명`
                      );
                      fetchSystemUsers(); // Reload user list
                    } else {
                      showError(data.error || '사용자 등록에 실패했습니다.');
                    }
                  } catch (error) {
                    showError('파일 업로드 중 오류가 발생했습니다.');
                  }

                  // Reset input
                  e.target.value = '';
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  document.getElementById('userExcelUpload')?.click();
                }}
              >
                업로드
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingUserId(null);
                  setModalData(defaultModalData);
                  setIsModalOpen(true);
                }}
              >
                추가하기
              </Button>
            </div>
          </div>

        {/* Filters */}
        <Card>
          <div>
            <div className="grid grid-cols-4 gap-3">
              <Select
                label="계정 권한"
                value={filterAccountLevel}
                onChange={(e) => setFilterAccountLevel(e.target.value)}
                options={[
                  { value: '', label: '전체' },
                  { value: '1st_master', label: '1st Master' },
                  { value: 'master', label: 'Master' },
                  { value: 'manager', label: 'Manager' },
                  { value: 'user', label: 'User' },
                ]}
              />
              <Select
                label="제품"
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
                options={[
                  { value: '', label: '전체' },
                  ...products.map(p => ({
                    value: p.code,
                    label: p.name
                  }))
                ]}
              />
              <Select
                label="작업 권한"
                value={filterPermission}
                onChange={(e) => setFilterPermission(e.target.value)}
                options={[
                  { value: '', label: '전체' },
                  { value: 'translator', label: '번역가' },
                  { value: 'requester', label: '번역요청자' },
                  { value: 'deployer', label: '번역반영자' },
                  { value: 'reviewer', label: '번역검수자' },
                ]}
              />
              <Input
                label="검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="이름 또는 이메일로 검색"
              />
            </div>
          </div>
        </Card>

        {/* User Table */}
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-center" style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">계정 권한</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">제품</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">이름</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">이메일</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">작업 권한</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">번역 언어</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                        로딩 중...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                        {systemUsers.length === 0 ? '등록된 사용자가 없습니다.' : '필터 조건에 맞는 사용자가 없습니다.'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((systemUser) => (
                      <tr
                        key={systemUser.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={(e) => {
                          // Don't open modal if clicking on checkbox or permission checkboxes
                          const target = e.target as HTMLElement;
                          if ((target as HTMLInputElement).type === 'checkbox' || target.closest('input[type="checkbox"]')) {
                            return;
                          }
                          openEditModal(systemUser);
                        }}
                      >
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(systemUser.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUserIds([...selectedUserIds, systemUser.id]);
                              } else {
                                setSelectedUserIds(selectedUserIds.filter(id => id !== systemUser.id));
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {systemUser.roles && systemUser.roles.length > 0 ? (
                              systemUser.roles.map((role) => (
                                <span
                                  key={role}
                                  className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                                    role === '1st_master'
                                      ? 'bg-red-100 text-red-800'
                                      : role === 'master'
                                      ? 'bg-purple-100 text-purple-800'
                                      : role === 'manager'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {role === '1st_master' ? '1st Master' : role === 'master' ? 'Master' : role === 'manager' ? 'Manager' : 'User'}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {systemUser.work_products && systemUser.work_products.length > 0 ? (
                              systemUser.work_products.map((product) => (
                                <span
                                  key={product}
                                  className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded"
                                >
                                  {product}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {systemUser.name || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {systemUser.email}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {['translator', 'requester', 'deployer', 'reviewer'].map((permission) => (
                              <label
                                key={permission}
                                className="flex items-center gap-1.5 cursor-pointer select-none"
                              >
                                <input
                                  type="checkbox"
                                  checked={systemUser.permissions?.includes(permission) || false}
                                  onChange={() =>
                                    handlePermissionToggle(
                                      systemUser.id,
                                      permission,
                                      systemUser.permissions || []
                                    )
                                  }
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs text-gray-700">
                                  {permission === 'translator' && '번역가'}
                                  {permission === 'requester' && '번역요청자'}
                                  {permission === 'deployer' && '번역반영자'}
                                  {permission === 'reviewer' && '번역검수자'}
                                </span>
                              </label>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {systemUser.permissions?.includes('translator') ? (
                              systemUser.translatorLanguages && systemUser.translatorLanguages.length > 0 ? (
                                systemUser.translatorLanguages.map((lang) => (
                                  <span
                                    key={lang}
                                    className="inline-block px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded"
                                  >
                                    {lang.toUpperCase()}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
        </Card>

        {/* 선택 삭제 버튼 */}
        {selectedUserIds.length > 0 && (
          <div className="flex justify-start">
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteUsers}
            >
              🗑️ 선택 삭제 ({selectedUserIds.length})
            </Button>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}
        >
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between px-6 py-3 border-b">
              <h3 className="text-base font-semibold text-gray-900">
                {editingUserId ? '사용자 수정' : '사용자 추가'}
              </h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingUserId(null);
                  setModalData(defaultModalData);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Account Level - First */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  계정 권한 *
                </label>
                <select
                  value={modalData.accountLevel}
                  onChange={(e) => {
                    const level = e.target.value as '1st_master' | 'master' | 'manager' | 'user';
                    if (level === 'master' || level === '1st_master') {
                      // Auto-select all products for master and 1st_master
                      setModalData({
                        ...modalData,
                        accountLevel: level,
                        products: products.map(p => p.code),
                      });
                    } else {
                      setModalData({ ...modalData, accountLevel: level });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="user">사용자</option>
                  <option value="manager">중간 관리자</option>
                  <option value="master">마스터</option>
                  <option value="1st_master">최고 관리자</option>
                </select>
                {(modalData.accountLevel === 'master' || modalData.accountLevel === '1st_master') && (
                  <p className="text-xs text-blue-600 mt-1">
                    ℹ️ {modalData.accountLevel === '1st_master' ? '최고 관리자' : '마스터'}는 모든 제품과 권한에 자동으로 접근할 수 있습니다.
                  </p>
                )}
              </div>

              {/* Products - Multiple Select (disabled for master) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  담당 제품 {modalData.accountLevel !== 'master' && modalData.accountLevel !== '1st_master' && '*'}
                </label>
                <div className={`grid grid-cols-3 gap-2 ${(modalData.accountLevel === 'master' || modalData.accountLevel === '1st_master') ? 'opacity-50 pointer-events-none' : ''}`}>
                  {products.map((product) => (
                    <label
                      key={product.code}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={modalData.products.includes(product.code)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setModalData({ ...modalData, products: [...modalData.products, product.code] });
                          } else {
                            setModalData({ ...modalData, products: modalData.products.filter(p => p !== product.code) });
                          }
                        }}
                        disabled={modalData.accountLevel === 'master' || modalData.accountLevel === '1st_master'}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{product.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  권한 선택
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'translator', label: '번역가' },
                    { value: 'reviewer', label: '검수가' },
                    { value: 'requester', label: '번역요청자' },
                    { value: 'deployer', label: '번역반영자' },
                  ].map((perm) => (
                    <label
                      key={perm.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={modalData.permissions.includes(perm.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setModalData({ ...modalData, permissions: [...modalData.permissions, perm.value] });
                          } else {
                            // Clear translator languages when translator permission is unchecked
                            const newPermissions = modalData.permissions.filter(p => p !== perm.value);
                            const updates: any = { permissions: newPermissions };
                            if (perm.value === 'translator') {
                              updates.translatorLanguages = [];
                            }
                            setModalData({ ...modalData, ...updates });
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Translator Languages - Show only when translator permission is selected */}
              {modalData.permissions.includes('translator') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    번역 가능 언어
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'ja', label: 'JA (일본어)' },
                      { value: 'zh', label: 'CA (중국어)' },
                      { value: 'en', label: 'EN (영어)' },
                    ].map((lang) => (
                      <label
                        key={lang.value}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={modalData.translatorLanguages.includes(lang.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setModalData({
                                ...modalData,
                                translatorLanguages: [...modalData.translatorLanguages, lang.value]
                              });
                            } else {
                              setModalData({
                                ...modalData,
                                translatorLanguages: modalData.translatorLanguages.filter(l => l !== lang.value)
                              });
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{lang.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <Input
                label="이름 *"
                value={modalData.name}
                onChange={(e) => setModalData({ ...modalData, name: e.target.value })}
                placeholder="홍길동"
              />

              <Input
                label="이메일 주소 *"
                type="email"
                value={modalData.email}
                onChange={(e) => setModalData({ ...modalData, email: e.target.value })}
                placeholder="user@rsupport.com"
              />

              <Input
                label={editingUserId ? '비밀번호 (변경 시에만 입력)' : '초기 비밀번호 *'}
                type="password"
                value={modalData.password}
                onChange={(e) => setModalData({ ...modalData, password: e.target.value })}
                placeholder={editingUserId ? '변경하지 않으려면 비워두세요' : '초기 비밀번호 입력'}
              />
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-3 border-t bg-gray-50">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingUserId(null);
                  setModalData(defaultModalData);
                }}
              >
                취소
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={editingUserId ? handleEditUser : handleAddUser}
              >
                {editingUserId ? '수정' : '추가'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

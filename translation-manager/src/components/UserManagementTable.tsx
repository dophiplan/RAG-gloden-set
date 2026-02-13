'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import MultiSelectDropdown, { MultiSelectOption } from '@/components/ui/MultiSelectDropdown';
import { UserRole, ProductCode, USER_WORK_SCOPE_OPTIONS, WORK_LANGUAGE_OPTIONS } from '@/types';
import { useUserManagement } from '@/components/hooks/useUserManagement';
import { useProducts } from '@/hooks/useReferenceData';
import { useResizableColumns } from '@/hooks/useResizableColumns';
import { showConfirm } from '@/lib/notifications';
import UserBulkActionBar from '@/components/users/UserBulkActionBar';

interface UserManagementTableProps {
  onRefresh?: () => void;
}

// Role options
const ROLE_OPTIONS: MultiSelectOption[] = [
  { value: 'master', label: '마스터' },
  { value: 'translator_ja', label: '일본어 번역' },
  { value: 'translator_zh', label: '중국어 번역' },
  { value: 'translator_en', label: '영어 번역' },
  { value: 'requester', label: '요청' },
  { value: 'deployer', label: '반영' },
  { value: 'reviewer_ja', label: '일본어 검수' },
  { value: 'reviewer_zh', label: '중국어 검수' },
  { value: 'reviewer_en', label: '영어 검수' },
];

// Empty - will be populated from hook

// Work scope options
const WORK_SCOPE_OPTIONS: MultiSelectOption[] = USER_WORK_SCOPE_OPTIONS.map((scope) => ({
  value: scope,
  label: scope,
}));

// Language options
const LANGUAGE_OPTIONS: MultiSelectOption[] = WORK_LANGUAGE_OPTIONS.map((lang) => ({
  value: lang,
  label: lang,
}));

export default function UserManagementTable({ onRefresh }: UserManagementTableProps) {
  const { products, productsMap } = useProducts();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const {
    users,
    loading,
    editingId,
    editData,
    setEditData,
    searchTerm,
    setSearchTerm,
    filterWorkProducts,
    setFilterWorkProducts,
    filterWorkScope,
    setFilterWorkScope,
    filterRoles,
    setFilterRoles,
    filterWorkLanguages,
    setFilterWorkLanguages,
    handleEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleDelete,
  } = useUserManagement(onRefresh);

  // Product options from DB
  const PRODUCT_OPTIONS: MultiSelectOption[] = products.map(p => ({
    value: p.code,
    label: p.name,
  }));

  // Resizable columns setup
  const defaultWidths = {
    name: 180,
    email: 220,
    roles: 220,
    workProducts: 180,
    workScope: 180,
    workLanguages: 180,
    actions: 140,
  };

  const minWidths = {
    name: 120,
    email: 150,
    roles: 150,
    workProducts: 120,
    workScope: 120,
    workLanguages: 120,
    actions: 100,
  };

  const { columnWidths, startResize, resize, stopResize } = useResizableColumns({
    defaultWidths,
    minWidths,
    storageKey: 'user-management-table-column-widths',
  });

  // Global mouse handlers for column resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => resize(e.clientX);
    const handleMouseUp = () => stopResize();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resize, stopResize]);

  // Helper to get cell style with width
  const getCellStyle = (columnKey: string) => {
    const width = columnWidths[columnKey];
    return width ? { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` } : {};
  };

  // Selection handlers
  const handleToggleAll = () => {
    if (selectedIds.length === users.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map(u => u.id));
    }
  };

  const handleToggleOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Delete with confirmation
  const handleDeleteWithConfirm = (userId: string, userName: string) => {
    if (showConfirm('정말 삭제하시겠습니까?')) {
      handleDelete(userId, userName);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input
            placeholder="이름 또는 이메일 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <MultiSelectDropdown
            options={PRODUCT_OPTIONS}
            selected={filterWorkProducts}
            onChange={setFilterWorkProducts}
            placeholder="제품 필터"
          />
          <MultiSelectDropdown
            options={WORK_SCOPE_OPTIONS}
            selected={filterWorkScope}
            onChange={setFilterWorkScope}
            placeholder="작업 범위 필터"
          />
          <MultiSelectDropdown
            options={ROLE_OPTIONS}
            selected={filterRoles}
            onChange={setFilterRoles}
            placeholder="권한 필터"
          />
          <MultiSelectDropdown
            options={LANGUAGE_OPTIONS}
            selected={filterWorkLanguages}
            onChange={setFilterWorkLanguages}
            placeholder="언어 필터"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full table-auto">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-2 py-3 text-left w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === users.length && users.length > 0}
                    onChange={handleToggleAll}
                    className="rounded border-gray-300"
                    aria-label="모든 사용자 선택"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 relative group" style={getCellStyle('name')}>
                  이름
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      startResize('name', e.clientX);
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 relative group" style={getCellStyle('email')}>
                  이메일
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      startResize('email', e.clientX);
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 relative group" style={getCellStyle('roles')}>
                  권한
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      startResize('roles', e.clientX);
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 relative group" style={getCellStyle('workProducts')}>
                  제품
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      startResize('workProducts', e.clientX);
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 relative group" style={getCellStyle('workScope')}>
                  작업 범위
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      startResize('workScope', e.clientX);
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 relative group" style={getCellStyle('workLanguages')}>
                  언어
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      startResize('workLanguages', e.clientX);
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 relative group" style={getCellStyle('actions')}>
                  작업
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      startResize('actions', e.clientX);
                    }}
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    사용자가 없습니다.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isEditing = editingId === user.id;
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-2 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(user.id)}
                          onChange={() => handleToggleOne(user.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3" style={getCellStyle('name')}>
                        {isEditing ? (
                          <Input
                            value={editData.name || ''}
                            onChange={(e) =>
                              setEditData({ ...editData, name: e.target.value })
                            }
                            placeholder="이름"
                          />
                        ) : (
                          <span className="text-sm text-gray-900">
                            {user.name || '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3" style={getCellStyle('email')}>
                        <span className="text-sm text-gray-900">{user.email}</span>
                      </td>
                      <td className="px-4 py-3" style={getCellStyle('roles')}>
                        {isEditing ? (
                          <MultiSelectDropdown
                            options={ROLE_OPTIONS}
                            selected={editData.roles || []}
                            onChange={(selected) =>
                              setEditData({ ...editData, roles: selected as UserRole[] })
                            }
                            placeholder="권한 선택"
                          />
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {user.roles?.map((role) => (
                              <span
                                key={role}
                                className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded"
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3" style={getCellStyle('workProducts')}>
                        {isEditing ? (
                          <MultiSelectDropdown
                            options={PRODUCT_OPTIONS}
                            selected={editData.work_products || []}
                            onChange={(selected) =>
                              setEditData({
                                ...editData,
                                work_products: selected as ProductCode[],
                              })
                            }
                            placeholder="제품 선택"
                          />
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {user.work_products?.map((product) => (
                              <span
                                key={product}
                                className="inline-block px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded"
                              >
                                {productsMap[product as ProductCode]?.name || product}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3" style={getCellStyle('workScope')}>
                        {isEditing ? (
                          <MultiSelectDropdown
                            options={WORK_SCOPE_OPTIONS}
                            selected={editData.work_scope || []}
                            onChange={(selected) =>
                              setEditData({ ...editData, work_scope: selected })
                            }
                            placeholder="작업 범위 선택"
                          />
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {user.work_scope?.map((scope) => (
                              <span
                                key={scope}
                                className="inline-block px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded"
                              >
                                {scope}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3" style={getCellStyle('workLanguages')}>
                        {isEditing ? (
                          <MultiSelectDropdown
                            options={LANGUAGE_OPTIONS}
                            selected={editData.work_languages || []}
                            onChange={(selected) =>
                              setEditData({ ...editData, work_languages: selected })
                            }
                            placeholder="언어 선택"
                          />
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {user.work_languages?.map((lang) => (
                              <span
                                key={lang}
                                className="inline-block px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded"
                              >
                                {lang}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" style={getCellStyle('actions')}>
                        {isEditing ? (
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(user.id)}
                            >
                              저장
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={handleCancelEdit}
                            >
                              취소
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleEdit(user)}
                            >
                              수정
                            </Button>
                            <button
                              onClick={() => handleDeleteWithConfirm(user.id, user.name || user.email)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="삭제"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Action Bar */}
      <UserBulkActionBar
        selectedCount={selectedIds.length}
        selectedIds={selectedIds}
        onClearSelection={handleClearSelection}
        onRefresh={onRefresh || (() => {})}
      />
    </div>
  );
}

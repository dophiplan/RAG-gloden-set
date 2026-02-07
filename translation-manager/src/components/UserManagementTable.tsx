'use client';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import MultiSelectDropdown, { MultiSelectOption } from '@/components/ui/MultiSelectDropdown';
import { UserRole, ProductCode, PRODUCTS, USER_WORK_SCOPE_OPTIONS, WORK_LANGUAGE_OPTIONS } from '@/types';
import { useUserManagement } from '@/components/hooks/useUserManagement';

interface UserManageme[기밀마스킹]ableProps {
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

// Product options
const PRODUCT_OPTIONS: MultiSelectOption[] = Object.entries(PRODUCTS).map(([code, name]) => ({
  value: code,
  label: name,
}));

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

export default function UserManageme[기밀마스킹]able({ onRefresh }: UserManageme[기밀마스킹]ableProps) {
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
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 min-w-[150px]">
                  이름
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 min-w-[200px]">
                  이메일
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 min-w-[200px]">
                  권한
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 min-w-[150px]">
                  제품
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 min-w-[150px]">
                  작업 범위
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 min-w-[150px]">
                  언어
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 w-32">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    사용자가 없습니다.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isEditing = editingId === user.id;
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-900">{user.email}</span>
                      </td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3">
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
                                {PRODUCTS[product as ProductCode]}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 text-right">
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
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleDelete(user.id, user.name || user.email)}
                            >
                              삭제
                            </Button>
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
    </div>
  );
}

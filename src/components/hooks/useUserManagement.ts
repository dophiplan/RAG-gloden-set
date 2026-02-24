import { useState, useEffect } from 'react';
import { User, UserRole, ProductCode } from '@/types';
import { showError, showConfirm } from '@/lib/notifications';
import { apiGet, apiPatch, apiDelete } from '@/lib/api-utils';

export function useUserManagement(onRefresh?: () => void) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<User>>({});

  const [searchTerm, setSearchTerm] = useState('');
  const [filterWorkProducts, setFilterWorkProducts] = useState<string[]>([]);
  const [filterWorkScope, setFilterWorkScope] = useState<string[]>([]);
  const [filterRoles, setFilterRoles] = useState<string[]>([]);
  const [filterWorkLanguages, setFilterWorkLanguages] = useState<string[]>([]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm.length >= 1) params.set('search', searchTerm);
      if (filterWorkProducts.length > 0) params.set('work_products', filterWorkProducts.join(','));
      if (filterWorkScope.length > 0) params.set('work_scope', filterWorkScope.join(','));
      if (filterRoles.length > 0) params.set('roles', filterRoles.join(','));
      if (filterWorkLanguages.length > 0) params.set('work_languages', filterWorkLanguages.join(','));

      const data = await apiGet<{ users?: User[] }>(`/api/users?${params}`);
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      showError('사용자 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [searchTerm, filterWorkProducts, filterWorkScope, filterRoles, filterWorkLanguages]);

  const handleEdit = (user: User) => {
    setEditingId(user.id);
    setEditData({
      name: user.name || '',
      roles: user.roles || [],
      work_products: user.work_products || [],
      work_scope: user.work_scope || [],
      work_languages: user.work_languages || [],
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleSaveEdit = async (userId: string) => {
    try {
      await apiPatch(`/api/users/${userId}`, editData);
      setEditingId(null);
      setEditData({});
      fetchUsers();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error updating user:', error);
      showError('사용자 수정 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!showConfirm(`정말 "${userName}" 사용자를 삭제하시겠습니까?`)) return;

    try {
      await apiDelete(`/api/users/${userId}`);
      fetchUsers();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error deleting user:', error);
      showError('사용자 삭제 중 오류가 발생했습니다.');
    }
  };

  return {
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
  };
}

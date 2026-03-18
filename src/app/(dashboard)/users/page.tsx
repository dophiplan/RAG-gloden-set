"use client";

import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Card, { CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import { showSuccess, showError, showConfirm } from "@/lib/notifications";
import { FIRST_MASTER_EMAIL } from "@/types/users";
import {
  useProducts,
  usePlatforms,
  useLanguages,
} from "@/hooks/useReferenceData";
import UserBulkActionBar from "@/components/users/UserBulkActionBar";
import { apiGet, apiPost, apiPatch, apiFetch } from "@/lib/api-utils";

interface SystemUser {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  permissions: string[];
  work_products: string[];
  work_platforms?: string[];
  work_languages?: string[];
  account_level?: string;
  translatorLanguages?: string[];
  created_at: string;
}

export default function UsersPage() {
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [currentUserRoles, setCurrentUserRoles] = useState<string[]>([]);
  const [accountLevel, setAccountLevel] = useState<string>("");
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  // Fetch products and platforms from DB
  const { products } = useProducts();
  const { platforms } = usePlatforms();

  // Filters
  const [filterProduct, setFilterProduct] = useState<string>("");
  const [filterPlatform, setFilterPlatform] = useState<string>("");
  const [filterPermission, setFilterPermission] = useState<string>("");
  const [filterAccountLevel, setFilterAccountLevel] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Add/Edit user modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Default values for new user
  const defaultModalData = {
    products: [] as string[], // No products selected by default
    name: "",
    email: "@rsupport.com",
    password: "",
    accountLevel: "user" as "1st_master" | "master" | "manager" | "user",
    permissions: [] as string[], // No permissions selected by default
    translatorLanguages: [] as string[], // Languages for translator
  };

  const [modalData, setModalData] = useState(defaultModalData);

  // Multi-select for deletion
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Filter users based on filters
  const filteredUsers = useMemo(() => {
    return systemUsers.filter((user) => {
      // Product filter
      if (filterProduct && !user.work_products?.includes(filterProduct)) {
        return false;
      }

      // Platform filter
      if (filterPlatform && !user.work_platforms?.includes(filterPlatform)) {
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
  }, [
    systemUsers,
    filterProduct,
    filterPlatform,
    filterPermission,
    filterAccountLevel,
    searchQuery,
  ]);

  // Check authorization on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((result) => {
        const userData = result.data?.user || result.data || result.user;
        if (userData) {
          setCurrentUserEmail(userData.email || "");
          setCurrentUserRoles(userData.roles || []);
          const level = userData.account_level || "";
          setAccountLevel(level);

          // Only master and 1st_master can access this page
          const isMasterUser = level === "master" || level === "1st_master";
          setIsAuthorized(isMasterUser);

          if (!isMasterUser) {
            showError("접근 권한이 없습니다. 관리자만 접근할 수 있습니다.");
          }
        }
      })
      .catch((error) => {
        console.error("Error fetching current user:", error);
        setIsAuthorized(false);
      });
  }, []);

  const fetchSystemUsers = async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ users?: SystemUser[] }>("/api/admin/users");
      setSystemUsers(data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      showError(
        error instanceof Error
          ? error.message
          : "사용자 목록을 불러오는데 실패했습니다.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUsers = async () => {
    if ((selectedUserIds || []).length === 0) return;

    // Check if trying to delete 1st master account
    const selectedUsers = systemUsers.filter((u) =>
      selectedUserIds.includes(u.id),
    );
    const hasFirstMaster = selectedUsers.some(
      (u) => u.email === FIRST_MASTER_EMAIL,
    );

    if (hasFirstMaster) {
      showError("최고 관리자 계정은 삭제할 수 없습니다.");
      return;
    }

    if (
      !showConfirm(
        `선택한 ${(selectedUserIds || []).length}명의 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
      )
    ) {
      return;
    }

    try {
      const data = await apiPost<{ deleted?: number }>(
        "/api/admin/users/delete",
        { userIds: selectedUserIds },
      );
      showSuccess(`${data.deleted || 0}명의 사용자가 삭제되었습니다.`);
      setSelectedUserIds([]);
      fetchSystemUsers();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "사용자 삭제 중 오류가 발생했습니다.",
      );
    }
  };

  const handleSelectAll = () => {
    if (selectedUserIds.length === (filteredUsers || []).length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds((filteredUsers || []).map((u) => u.id));
    }
  };

  const handleAddUser = async () => {
    if (!modalData.name || !modalData.email || !modalData.password) {
      showError("모든 필수 항목을 입력해주세요.");
      return;
    }

    // Check if email is just the domain (starts with @)
    if (modalData.email.startsWith("@")) {
      showError("이메일 주소를 입력해주세요.");
      return;
    }

    // Check if email is valid format
    if (!modalData.email.includes("@")) {
      showError("올바른 이메일 형식이 아닙니다.");
      return;
    }

    try {
      await apiPost("/api/admin/users/create", {
        email: modalData.email,
        name: modalData.name,
        password: modalData.password,
        products: modalData.products,
        accountLevel: modalData.accountLevel,
        permissions: modalData.permissions,
        translatorLanguages: modalData.translatorLanguages,
      });
      showSuccess("사용자가 등록되었습니다.");
      setIsModalOpen(false);
      setEditingUserId(null);
      setModalData(defaultModalData);
      fetchSystemUsers();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "사용자 등록 중 오류가 발생했습니다.",
      );
    }
  };

  const handleEditUser = async () => {
    if (!modalData.name || !modalData.email) {
      showError("이름과 이메일은 필수 항목입니다.");
      return;
    }

    if (!editingUserId) return;

    try {
      await apiPatch(`/api/admin/users/${editingUserId}`, {
        name: modalData.name,
        email: modalData.email,
        password: modalData.password || undefined, // Only send if provided
        products: modalData.products,
        accountLevel: modalData.accountLevel,
        permissions: modalData.permissions,
        translatorLanguages: modalData.translatorLanguages,
      });
      showSuccess("사용자 정보가 수정되었습니다.");
      setIsModalOpen(false);
      setEditingUserId(null);
      setModalData(defaultModalData);
      fetchSystemUsers();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "사용자 수정 중 오류가 발생했습니다.",
      );
    }
  };

  const openEditModal = (user: SystemUser) => {
    // Check if trying to edit 1st master account
    const isFirstMaster = user.email === FIRST_MASTER_EMAIL;
    const currentUserIsFirstMaster = currentUserRoles.includes("1st_master");

    if (isFirstMaster && !currentUserIsFirstMaster) {
      showError("최고 관리자 계정은 수정할 수 없습니다.");
      return;
    }

    setEditingUserId(user.id);
    const isMaster =
      user.roles?.includes("master") || user.roles?.includes("1st_master");
    setModalData({
      products: isMaster
        ? products.map((p) => p.code)
        : user.work_products || [],
      name: user.name || "",
      email: user.email,
      password: "", // Don't pre-fill password
      accountLevel: (user.roles?.includes("1st_master")
        ? "1st_master"
        : user.roles?.includes("master")
          ? "master"
          : user.roles?.includes("manager")
            ? "manager"
            : "user") as "1st_master" | "master" | "manager" | "user",
      permissions: isMaster
        ? ["reviewer", "requester", "deployer"]
        : user.permissions || [],
      translatorLanguages: user.translatorLanguages || [],
    });
    setIsModalOpen(true);
  };

  const handlePermissionToggle = async (
    userId: string,
    permission: string,
    currentPermissions: string[],
  ) => {
    const newPermissions = currentPermissions.includes(permission)
      ? currentPermissions.filter((p) => p !== permission)
      : [...currentPermissions, permission];

    // Optimistic update
    setSystemUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, permissions: newPermissions } : u,
      ),
    );

    try {
      await apiPatch(`/api/admin/users/${userId}/permissions`, {
        permissions: newPermissions,
      });
      showSuccess("권한이 업데이트되었습니다.");
    } catch (error) {
      // Rollback on error
      setSystemUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, permissions: currentPermissions } : u,
        ),
      );
      showError(
        error instanceof Error
          ? error.message
          : "권한 업데이트 중 오류가 발생했습니다.",
      );
    }
  };

  useEffect(() => {
    fetchSystemUsers();

    // Fetch current user info
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUserEmail(data.user.email);
          setCurrentUserRoles(data.user.roles || []);
        }
      })
      .catch(console.error);
  }, []);

  // Show loading state while checking authorization
  if (isAuthorized === null) {
    return (
      <DashboardLayout title="사용자 관리" subtitle="">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#818CF8]"></div>
        </div>
      </DashboardLayout>
    );
  }

  // Show access denied for non-master users
  if (!isAuthorized) {
    return (
      <DashboardLayout title="접근 불가" subtitle="">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <svg
              className="w-16 h-16 text-red-500 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              접근 권한이 없습니다
            </h2>
            <p className="text-gray-600 mb-6">
              이 페이지는 관리자만 접근할 수 있습니다.
            </p>
            <Button
              variant="primary"
              onClick={() => (window.location.href = "/")}
            >
              대시보드로 돌아가기
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="사용자 관리"
      quickActions={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            window.location.href = "/api/admin/users/template";
          }}
        >
          📥 엑셀 템플릿 다운로드
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            등록된 사용자 ({(filteredUsers || []).length}명)
          </h1>
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
                  formData.append("file", file);

                  const data = await apiFetch<{
                    summary?: {
                      created?: number;
                      updated?: number;
                      failed?: number;
                    };
                  }>("/api/admin/users/import", {
                    method: "POST",
                    body: formData,
                    headers: {
                      "x-admin-secret":
                        process.env.NEXT_PUBLIC_ADMIN_SECRET || "",
                    },
                  });

                  showSuccess(
                    `사용자 등록 완료: 생성 ${data.summary?.created || 0}명, 수정 ${data.summary?.updated || 0}명, 실패 ${data.summary?.failed || 0}명`,
                  );
                  fetchSystemUsers(); // Reload user list
                } catch (error) {
                  showError(
                    error instanceof Error
                      ? error.message
                      : "파일 업로드 중 오류가 발생했습니다.",
                  );
                }

                // Reset input
                e.target.value = "";
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                document.getElementById("userExcelUpload")?.click();
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
            <div className="grid grid-cols-5 gap-3">
              <Select
                label="계정 권한"
                value={filterAccountLevel}
                onChange={(e) => setFilterAccountLevel(e.target.value)}
                options={[
                  { value: "", label: "전체" },
                  { value: "1st_master", label: "1st Master" },
                  { value: "master", label: "Master" },
                  { value: "manager", label: "Manager" },
                  { value: "user", label: "User" },
                ]}
              />
              <Select
                label="제품"
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
                options={[
                  { value: "", label: "전체" },
                  ...products.map((p) => ({
                    value: p.code,
                    label: p.name,
                  })),
                ]}
              />
              <Select
                label="담당 플랫폼"
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value)}
                options={[
                  { value: "", label: "전체" },
                  ...platforms.map((p) => ({
                    value: p.code,
                    label: p.name,
                  })),
                ]}
              />
              <Select
                label="작업 권한"
                value={filterPermission}
                onChange={(e) => setFilterPermission(e.target.value)}
                options={[
                  { value: "", label: "전체" },
                  { value: "translator", label: "번역가" },
                  { value: "requester", label: "번역요청자" },
                  { value: "deployer", label: "번역반영자" },
                  { value: "reviewer", label: "번역검수자" },
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
                  <th
                    className="px-4 py-3 text-center"
                    style={{ width: "40px" }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        (filteredUsers || []).length > 0 &&
                        selectedUserIds.length === (filteredUsers || []).length
                      }
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">
                    계정 권한
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">
                    제품
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">
                    이름
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">
                    이메일
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">
                    담당 플랫폼
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">
                    언어
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">
                    작업 권한
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">
                    번역 언어
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      로딩 중...
                    </td>
                  </tr>
                ) : (filteredUsers || []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      {(systemUsers || []).length === 0
                        ? "등록된 사용자가 없습니다."
                        : "필터 조건에 맞는 사용자가 없습니다."}
                    </td>
                  </tr>
                ) : (
                  (filteredUsers || []).map((systemUser) => (
                    <tr
                      key={systemUser.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={(e) => {
                        // Don't open modal if clicking on checkbox or permission checkboxes
                        const target = e.target as HTMLElement;
                        if (
                          (target as HTMLInputElement).type === "checkbox" ||
                          target.closest('input[type="checkbox"]')
                        ) {
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
                              setSelectedUserIds([
                                ...selectedUserIds,
                                systemUser.id,
                              ]);
                            } else {
                              setSelectedUserIds(
                                (selectedUserIds || []).filter(
                                  (id) => id !== systemUser.id,
                                ),
                              );
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {systemUser.account_level ? (
                            <span
                              className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                                systemUser.account_level === "1st_master"
                                  ? "bg-red-100 text-red-800"
                                  : systemUser.account_level === "master"
                                    ? "bg-purple-100 text-purple-800"
                                    : systemUser.account_level === "manager"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {systemUser.account_level === "1st_master"
                                ? "1st Master"
                                : systemUser.account_level === "master"
                                  ? "Master"
                                  : systemUser.account_level === "manager"
                                    ? "Manager"
                                    : "User"}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {systemUser.work_products &&
                          systemUser.work_products.length > 0 ? (
                            (systemUser.work_products || []).map((product) => (
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
                        {systemUser.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {systemUser.email}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {systemUser.work_platforms &&
                          systemUser.work_platforms.length > 0 ? (
                            (systemUser.work_platforms || []).map(
                              (platform) => (
                                <span
                                  key={platform}
                                  className="inline-block px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-800 rounded"
                                >
                                  {platform}
                                </span>
                              ),
                            )
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {systemUser.work_languages &&
                          systemUser.work_languages.length > 0 ? (
                            (systemUser.work_languages || []).map((lang) => (
                              <span
                                key={lang}
                                className="inline-block px-2 py-0.5 text-xs font-medium bg-teal-100 text-teal-800 rounded"
                              >
                                {lang.toUpperCase()}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {[
                            "translator",
                            "requester",
                            "deployer",
                            "reviewer",
                          ].map((permission) => (
                            <label
                              key={permission}
                              className="flex items-center gap-1.5 cursor-pointer select-none"
                            >
                              <input
                                type="checkbox"
                                checked={
                                  systemUser.permissions?.includes(
                                    permission,
                                  ) || false
                                }
                                onChange={() =>
                                  handlePermissionToggle(
                                    systemUser.id,
                                    permission,
                                    systemUser.permissions || [],
                                  )
                                }
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-700">
                                {permission === "translator" && "번역가"}
                                {permission === "requester" && "번역요청자"}
                                {permission === "deployer" && "번역반영자"}
                                {permission === "reviewer" && "번역검수자"}
                              </span>
                            </label>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {systemUser.permissions?.includes("translator") ? (
                            systemUser.translatorLanguages &&
                            systemUser.translatorLanguages.length > 0 ? (
                              (systemUser.translatorLanguages || []).map(
                                (lang) => (
                                  <span
                                    key={lang}
                                    className="inline-block px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded"
                                  >
                                    {lang.toUpperCase()}
                                  </span>
                                ),
                              )
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
      </div>

      {/* Add User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUserId(null);
          setModalData(defaultModalData);
        }}
        title={editingUserId ? "사용자 수정" : "사용자 추가"}
        size="md"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
          {/* Account Level - First */}
          <div>
            <Select
              label="계정 권한"
              required
              value={modalData.accountLevel}
              onChange={(e) => {
                const level = e.target.value as
                  | "1st_master"
                  | "master"
                  | "manager"
                  | "user";
                if (level === "master" || level === "1st_master") {
                  // Auto-select all products for master and 1st_master
                  setModalData({
                    ...modalData,
                    accountLevel: level,
                    products: products.map((p) => p.code),
                  });
                } else {
                  setModalData({ ...modalData, accountLevel: level });
                }
              }}
              options={[
                { value: "user", label: "사용자" },
                { value: "manager", label: "중간 관리자" },
                { value: "master", label: "마스터" },
                { value: "1st_master", label: "최고 관리자" },
              ]}
            />
            {(modalData.accountLevel === "master" ||
              modalData.accountLevel === "1st_master") && (
              <p className="text-xs text-blue-600 mt-1">
                ℹ️{" "}
                {modalData.accountLevel === "1st_master"
                  ? "최고 관리자"
                  : "마스터"}
                는 모든 제품과 권한에 자동으로 접근할 수 있습니다.
              </p>
            )}
          </div>

          {/* Products - Multiple Select (disabled for master) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              담당 제품{" "}
              {modalData.accountLevel !== "master" &&
                modalData.accountLevel !== "1st_master" &&
                "*"}
            </label>
            <div
              className={`grid grid-cols-3 gap-2 ${modalData.accountLevel === "master" || modalData.accountLevel === "1st_master" ? "opacity-50 pointer-events-none" : ""}`}
            >
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
                        setModalData({
                          ...modalData,
                          products: [...modalData.products, product.code],
                        });
                      } else {
                        setModalData({
                          ...modalData,
                          products: modalData.products.filter(
                            (p) => p !== product.code,
                          ),
                        });
                      }
                    }}
                    disabled={
                      modalData.accountLevel === "master" ||
                      modalData.accountLevel === "1st_master"
                    }
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
                { value: "translator", label: "번역가" },
                { value: "reviewer", label: "검수가" },
                { value: "requester", label: "번역요청자" },
                { value: "deployer", label: "번역반영자" },
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
                        setModalData({
                          ...modalData,
                          permissions: [...modalData.permissions, perm.value],
                        });
                      } else {
                        // Clear translator languages when translator permission is unchecked
                        const newPermissions = modalData.permissions.filter(
                          (p) => p !== perm.value,
                        );
                        const updates: {
                          permissions: string[];
                          translatorLanguages?: string[];
                        } = { permissions: newPermissions };
                        if (perm.value === "translator") {
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
          {modalData.permissions.includes("translator") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                번역 가능 언어
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "ja", label: "JA (일본어)" },
                  { value: "zh", label: "CA (중국어)" },
                  { value: "en", label: "EN (영어)" },
                ].map((lang) => (
                  <label
                    key={lang.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={modalData.translatorLanguages.includes(
                        lang.value,
                      )}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setModalData({
                            ...modalData,
                            translatorLanguages: [
                              ...modalData.translatorLanguages,
                              lang.value,
                            ],
                          });
                        } else {
                          setModalData({
                            ...modalData,
                            translatorLanguages:
                              modalData.translatorLanguages.filter(
                                (l) => l !== lang.value,
                              ),
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
            onChange={(e) =>
              setModalData({ ...modalData, name: e.target.value })
            }
            placeholder="홍길동"
          />

          <Input
            label="이메일 주소 *"
            type="email"
            value={modalData.email}
            onChange={(e) =>
              setModalData({ ...modalData, email: e.target.value })
            }
            placeholder="user@rsupport.com"
          />

          <Input
            label={
              editingUserId ? "비밀번호 (변경 시에만 입력)" : "초기 비밀번호 *"
            }
            type="password"
            value={modalData.password}
            onChange={(e) =>
              setModalData({ ...modalData, password: e.target.value })
            }
            placeholder={
              editingUserId
                ? "변경하지 않으려면 비워두세요"
                : "초기 비밀번호 입력"
            }
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t mt-4">
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
            {editingUserId ? "수정" : "추가"}
          </Button>
        </div>
      </Modal>

      {/* Bulk Action Bar */}
      <UserBulkActionBar
        selectedCount={selectedUserIds.length}
        selectedIds={selectedUserIds}
        onClearSelection={() => setSelectedUserIds([])}
        onRefresh={fetchSystemUsers}
        onDelete={handleDeleteUsers}
      />
    </DashboardLayout>
  );
}

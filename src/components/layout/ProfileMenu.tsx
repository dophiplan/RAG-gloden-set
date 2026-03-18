"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { showSuccess, showError } from "@/lib/notifications";
import { apiGet, apiPost, apiPatch } from "@/lib/api-utils";

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
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    // Fetch user profile
    async function fetchUser() {
      try {
        const result = await apiGet<{
          data?: { user?: UserProfile };
          user?: UserProfile;
        }>("/api/auth/me");
        // Handle standardized API response format: { data: { user: {...} } }
        const userData = result.data?.user || result.user;
        if (userData) setUser(userData);
      } catch (error) {
        console.error("Error fetching user:", error);
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
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);

    try {
      await apiPatch("/api/profile/update", { name: editingName });

      setUser({ ...user, name: editingName });
      setIsProfileModalOpen(false);
      showSuccess("프로필이 저장되었습니다.");
    } catch (error) {
      console.error("Error saving profile:", error);
      showError(
        error instanceof Error ? error.message : "프로필 저장에 실패했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiPost("/api/auth/logout", {});
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // 비밀번호 복잡도 검증 (표준 기준)
  const validatePasswordComplexity = (password: string): string | null => {
    if (password.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
    if (!/[A-Z]/.test(password))
      return "영문 대문자를 1개 이상 포함해야 합니다.";
    if (!/[a-z]/.test(password))
      return "영문 소문자를 1개 이상 포함해야 합니다.";
    if (!/[0-9]/.test(password)) return "숫자를 1개 이상 포함해야 합니다.";
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return "특수문자를 1개 이상 포함해야 합니다.";
    }
    return null;
  };

  const handlePasswordChange = async () => {
    setPasswordError("");

    // Validate passwords
    if (
      !passwordForm.currentPassword ||
      !passwordForm.newPassword ||
      !passwordForm.confirmPassword
    ) {
      setPasswordError("모든 필드를 입력해주세요.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("새 비밀번호와 확인 비밀번호가 일치하지 않습니다.");
      return;
    }

    // Validate password complexity
    const complexityError = validatePasswordComplexity(
      passwordForm.newPassword,
    );
    if (complexityError) {
      setPasswordError(complexityError);
      return;
    }

    setSaving(true);

    try {
      await apiPatch("/api/profile/password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      showSuccess("비밀번호가 성공적으로 변경되었습니다.");
      setIsPasswordModalOpen(false);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error("Error changing password:", error);
      setPasswordError(
        error instanceof Error
          ? error.message
          : "비밀번호 변경에 실패했습니다.",
      );
    } finally {
      setSaving(false);
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
      master: "마스터",
      translator: "번역가",
      reviewer: "검수가",
      requester: "번역요청자",
      deployer: "번역반영자",
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
                {user.name || "이름 미설정"}
              </p>
              {/* Account Level Badge */}
              {user.roles && user.roles.length > 0 && (
                <span
                  className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                    user.roles.includes("1st_master")
                      ? "bg-red-100 text-red-800"
                      : user.roles.includes("master")
                        ? "bg-purple-100 text-purple-800"
                        : user.roles.includes("manager")
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {user.roles.includes("1st_master")
                    ? "1st Master"
                    : user.roles.includes("master")
                      ? "Master"
                      : user.roles.includes("manager")
                        ? "Manager"
                        : "User"}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>

            {/* Products and Permissions for non-master users */}
            {user.roles &&
              !user.roles.includes("master") &&
              !user.roles.includes("1st_master") && (
                <div className="mt-3 space-y-2">
                  {/* Products */}
                  {user.work_products && user.work_products.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">
                        관리 제품
                      </p>
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
                      <p className="text-xs font-medium text-gray-600 mb-1">
                        작업 권한
                      </p>
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
                setEditingName(user.name || "");
                setIsProfileModalOpen(true);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              프로필 변경
            </button>
            <button
              onClick={() => {
                setPasswordForm({
                  currentPassword: "",
                  newPassword: "",
                  confirmPassword: "",
                });
                setPasswordError("");
                setIsPasswordModalOpen(true);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              비밀번호 변경
            </button>
            <div className="border-t border-gray-100 my-1"></div>
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
          style={{ backgroundColor: "rgba(0, 0, 0, 0.05)" }}
        >
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between px-6 py-3 border-b">
              <h3 className="text-base font-semibold text-gray-900">
                프로필 설정 변경
              </h3>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="닫기"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일{" "}
                  <span className="text-xs text-gray-400">(수정 불가)</span>
                </label>
                <input
                  type="text"
                  value={user?.email || ""}
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

      {/* Password Change Modal */}
      {isPasswordModalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.05)" }}
        >
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between px-6 py-3 border-b">
              <h3 className="text-base font-semibold text-gray-900">
                비밀번호 변경
              </h3>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="닫기"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {passwordError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  현재 비밀번호
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      currentPassword: e.target.value,
                    })
                  }
                  placeholder="현재 비밀번호를 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  새 비밀번호
                  <span className="text-xs text-gray-400 block mt-0.5">
                    8자 이상, 영문 대/소문자, 숫자, 특수문자 포함
                  </span>
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      newPassword: e.target.value,
                    })
                  }
                  placeholder="새 비밀번호를 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  새 비밀번호 확인
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  placeholder="새 비밀번호를 다시 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-3 border-t bg-gray-50">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsPasswordModalOpen(false)}
              >
                취소
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handlePasswordChange}
                loading={saving}
              >
                변경하기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { mutate } from "swr";
import Card, { CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import DropdownMenu from "@/components/ui/DropdownMenu";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-utils";
import { showSuccess, showError, showConfirm } from "@/lib/notifications";
import { SettingItem } from "../hooks/useSettings";

interface LanguagesSectionProps {
  languages: SettingItem[];
  isLoading: boolean;
  onRefresh: (languages: SettingItem[]) => void;
}

export function LanguagesSection({
  languages,
  isLoading,
  onRefresh,
}: LanguagesSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState<SettingItem | null>(
    null,
  );
  const [languageCode, setLanguageCode] = useState("");
  const [languageName, setLanguageName] = useState("");
  const [languageDescription, setLanguageDescription] = useState("");
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [draggedLanguage, setDraggedLanguage] = useState<string | null>(null);
  const [dragOverLanguage, setDragOverLanguage] = useState<string | null>(null);

  const openLanguageModal = (language?: SettingItem) => {
    if (language) {
      setEditingLanguage(language);
      setLanguageCode(language.code);
      setLanguageName(language.name);
      setLanguageDescription(language.description || "");
    } else {
      setEditingLanguage(null);
      setLanguageCode("");
      setLanguageName("");
      setLanguageDescription("");
    }
    setIsModalOpen(true);
  };

  const closeLanguageModal = () => {
    setIsModalOpen(false);
    setEditingLanguage(null);
    setLanguageCode("");
    setLanguageName("");
    setLanguageDescription("");
  };

  const handleSaveLanguage = async () => {
    if (!languageCode.trim() || !languageName.trim()) {
      showError("언어 코드와 이름은 필수입니다.");
      return;
    }

    setSavingLanguage(true);
    try {
      if (editingLanguage) {
        await apiPatch(`/api/languages/${editingLanguage.id}`, {
          code: languageCode.trim(),
          name: languageName.trim(),
          description: languageDescription.trim() || null,
        });
        showSuccess("언어가 수정되었습니다.");
      } else {
        await apiPost("/api/languages", {
          code: languageCode.trim(),
          name: languageName.trim(),
          description: languageDescription.trim() || null,
          display_order: (languages || []).length,
        });
        showSuccess("언어가 추가되었습니다.");
      }
      closeLanguageModal();

      const languagesData = await apiGet<{ languages: SettingItem[] }>(
        "/api/languages",
      );
      onRefresh(languagesData.languages || []);
      mutate("/api/languages");
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "언어 저장에 실패했습니다.",
      );
    } finally {
      setSavingLanguage(false);
    }
  };

  const handleDeleteLanguage = async (language: SettingItem) => {
    if (
      !showConfirm(
        `언어 "${language.name}" (${language.code})을(를) 삭제하시겠습니까?`,
      )
    )
      return;

    try {
      await apiDelete(`/api/languages/${language.id}`);
      const languagesData = await apiGet<{ languages: SettingItem[] }>(
        "/api/languages",
      );
      onRefresh(languagesData.languages || []);
      mutate("/api/languages");
      showSuccess("언어가 삭제되었습니다.");
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "언어 삭제에 실패했습니다.",
      );
    }
  };

  const handleLanguageDragStart = (e: React.DragEvent, id: string) => {
    setDraggedLanguage(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleLanguageDragEnd = () => {
    setDraggedLanguage(null);
    setDragOverLanguage(null);
  };

  const handleLanguageDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedLanguage && draggedLanguage !== id) {
      setDragOverLanguage(id);
    }
  };

  const handleLanguageDragLeave = () => {
    setDragOverLanguage(null);
  };

  const handleLanguageDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverLanguage(null);
    if (!draggedLanguage || draggedLanguage === targetId) return;

    const newItems = [...languages];
    const draggedIndex = newItems.findIndex(
      (item) => item.id === draggedLanguage,
    );
    const targetIndex = newItems.findIndex((item) => item.id === targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [removed] = newItems.splice(draggedIndex, 1);
      newItems.splice(targetIndex, 0, removed);

      const updatedItems = newItems.map((item, index) => ({
        ...item,
        display_order: index + 1,
      }));

      onRefresh(updatedItems);

      try {
        await Promise.all(
          updatedItems.map((item) =>
            apiPatch(`/api/languages/${item.id}`, {
              display_order: item.display_order,
            }),
          ),
        );
        showSuccess("순서가 변경되었습니다.");
      } catch (error) {
        showError("순서 변경에 실패했습니다.");
        const languagesData = await apiGet<{ languages: SettingItem[] }>(
          "/api/languages",
        );
        onRefresh(languagesData.languages || []);
      }
    }
    setDraggedLanguage(null);
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <CardTitle className="text-base">언어 관리</CardTitle>
        <button
          onClick={() => openLanguageModal()}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span>추가</span>
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        번역 지원 언어 목록을 관리합니다.
      </p>

      {isLoading ? (
        <div className="text-center py-6 text-gray-500 text-sm">로딩 중...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {(languages || []).map((language) => (
            <div
              key={language.id}
              draggable
              onDragStart={(e) => handleLanguageDragStart(e, language.id)}
              onDragEnd={handleLanguageDragEnd}
              onDragOver={(e) => handleLanguageDragOver(e, language.id)}
              onDragLeave={handleLanguageDragLeave}
              onDrop={(e) => handleLanguageDrop(e, language.id)}
              className={`p-2.5 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow cursor-move ${
                dragOverLanguage === language.id ? "ring-2 ring-blue-400" : ""
              } ${draggedLanguage === language.id ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <svg
                    className="w-3 h-3 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8h16M4 16h16"
                    />
                  </svg>
                  <Badge variant="info" className="text-xs px-1.5 py-0.5">
                    {language.code}
                  </Badge>
                  <p className="font-medium text-sm text-gray-900">
                    {language.name}
                  </p>
                </div>
                <DropdownMenu
                  items={[
                    {
                      label: "수정",
                      onClick: () => openLanguageModal(language),
                      icon: (
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      ),
                    },
                    {
                      label: "삭제",
                      onClick: () => handleDeleteLanguage(language),
                      variant: "danger" as const,
                      icon: (
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      ),
                    },
                  ]}
                />
              </div>
              {language.description && (
                <p className="text-xs text-gray-600 mt-1 truncate">
                  {language.description}
                </p>
              )}
            </div>
          ))}
          {(languages || []).length === 0 && (
            <div className="col-span-full text-center py-6 text-gray-500 text-sm">
              등록된 언어가 없습니다.
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.05)" }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingLanguage ? "언어 수정" : "언어 추가"}
              </h3>
              <button
                onClick={closeLanguageModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
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

            {/* Body */}
            <div className="p-6 space-y-4">
              <Input
                label="언어 코드 *"
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                placeholder="예: ko, en, ja, zh-CN"
              />
              <Input
                label="언어 이름 *"
                value={languageName}
                onChange={(e) => setLanguageName(e.target.value)}
                placeholder="예: 한국어, English, 日本語"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  설명 (선택)
                </label>
                <textarea
                  value={languageDescription}
                  onChange={(e) => setLanguageDescription(e.target.value)}
                  placeholder="언어에 대한 간단한 설명"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  rows={3}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-lg">
              <button
                onClick={closeLanguageModal}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSaveLanguage}
                disabled={
                  savingLanguage || !languageCode.trim() || !languageName.trim()
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {savingLanguage
                  ? "저장 중..."
                  : editingLanguage
                    ? "수정"
                    : "추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

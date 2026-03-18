"use client";

import { useState } from "react";
import { mutate } from "swr";
import Card, { CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-utils";
import { showSuccess, showError, showConfirm } from "@/lib/notifications";
import { SettingItem } from "../hooks/useSettings";

interface LanguagesSectionProps {
  languages: SettingItem[];
  isLoading: boolean;
  onRefresh: (languages: SettingItem[]) => void;
}

export function LanguagesSection({ languages, isLoading, onRefresh }: LanguagesSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState<SettingItem | null>(null);
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
      window.location.reload();
    } catch (error) {
      showError(error instanceof Error ? error.message : "언어 저장에 실패했습니다.");
    } finally {
      setSavingLanguage(false);
    }
  };

  const handleDeleteLanguage = async (language: SettingItem) => {
    if (!showConfirm(`언어 "${language.name}" (${language.code})을(를) 삭제하시겠습니까?`)) return;

    try {
      await apiDelete(`/api/languages/${language.id}`);
      const languagesData = await apiGet<{ languages: SettingItem[] }>("/api/languages");
      onRefresh(languagesData.languages || []);
      mutate("/api/languages");
      showSuccess("언어가 삭제되었습니다.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "언어 삭제에 실패했습니다.");
    }
  };

  const handleLanguageDragStart = (e: React.DragEvent, id: string) => {
    setDraggedLanguage(id);
    e.dataTransfer.effectAllowed = "move";
    const target = e.curre[기밀마스킹]arget as HTMLElement;
    target.style.opacity = "0.5";
  };

  const handleLanguageDragEnd = (e: React.DragEvent) => {
    const target = e.curre[기밀마스킹]arget as HTMLElement;
    target.style.opacity = "1";
    setDraggedLanguage(null);
    setDragOverLanguage(null);
  };

  const handleLanguageDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
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
    const draggedIndex = newItems.findIndex((item) => item.id === draggedLanguage);
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
            })
          )
        );
        showSuccess("순서가 변경되었습니다.");
      } catch (error) {
        showError("순서 변경에 실패했습니다.");
        const languagesData = await apiGet<{ languages: SettingItem[] }>("/api/languages");
        onRefresh(languagesData.languages || []);
      }
    }
    setDraggedLanguage(null);
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <CardTitle>언어 관리</CardTitle>
        <Button onClick={() => openLanguageModal()} size="sm">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          언어 추가
        </Button>
      </div>

      <p className="text-sm text-gray-500 mb-4">지원하는 언어를 관리합니다. 드래그하여 순서를 변경할 수 있습니다.</p>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : languages.length === 0 ? (
        <div className="text-center py-8 text-gray-500">등록된 언어가 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {languages.map((language) => (
            <div
              key={language.id}
              draggable
              onDragStart={(e) => handleLanguageDragStart(e, language.id)}
              onDragEnd={handleLanguageDragEnd}
              onDragOver={(e) => handleLanguageDragOver(e, language.id)}
              onDragLeave={handleLanguageDragLeave}
              onDrop={(e) => handleLanguageDrop(e, language.id)}
              className={`flex items-center justify-between p-3 bg-white border rounded-lg cursor-move transition-all ${
                dragOverLanguage === language.id ? "border-blue-400 bg-blue-50" : "border-gray-200"
              } ${draggedLanguage === language.id ? "opacity-50" : ""}`}
            >
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <div>
                  <div className="font-medium">{language.name}</div>
                  <div className="text-sm text-gray-500">{language.code}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openLanguageModal(language)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteLanguage(language)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {editingLanguage ? "언어 수정" : "언어 추가"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  언어 코드 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={languageCode}
                  onChange={(e) => setLanguageCode(e.target.value)}
                  placeholder="예: ko, en, ja"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  언어명 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={languageName}
                  onChange={(e) => setLanguageName(e.target.value)}
                  placeholder="예: 한국어, English, 日本語"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <Input
                  value={languageDescription}
                  onChange={(e) => setLanguageDescription(e.target.value)}
                  placeholder="언어 설명 (선택사항)"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="secondary" onClick={closeLanguageModal}>
                취소
              </Button>
              <Button onClick={handleSaveLanguage} disabled={savingLanguage}>
                {savingLanguage ? "저장 중..." : editingLanguage ? "수정" : "추가"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

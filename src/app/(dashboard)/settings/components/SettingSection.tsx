"use client";

import { useState } from "react";
import { apiPost, apiPatch, apiDelete } from "@/lib/api-utils";
import { showSuccess, showError, showConfirm } from "@/lib/notifications";
import { SettingItem } from "../hooks/useSettings";
import { DraggableList } from "./DraggableList";

interface SettingSectionProps {
  title: string;
  description: string;
  items: SettingItem[];
  isLoading: boolean;
  apiEndpoint: string;
  onRefresh: () => void;
  codeLabel?: string;
  nameLabel?: string;
  emptyMessage?: string;
}

export function SettingSection({
  title,
  description: sectionDescription,
  items,
  isLoading,
  apiEndpoint,
  onRefresh,
  codeLabel = "코드",
  nameLabel = "이름",
  emptyMessage = "항목이 없습니다.",
}: SettingSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SettingItem | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const openModal = (item?: SettingItem) => {
    if (item) {
      setEditingItem(item);
      setCode(item.code);
      setName(item.name);
      setItemDescription(item.description || "");
    } else {
      setEditingItem(null);
      setCode("");
      setName("");
      setItemDescription("");
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setCode("");
    setName("");
    setItemDescription("");
  };

  const handleSave = async () => {
    if (!code.trim() || !name.trim()) {
      showError(`${codeLabel}와 ${nameLabel}은 필수입니다.`);
      return;
    }

    setIsSaving(true);
    try {
      if (editingItem) {
        await apiPatch(`${apiEndpoint}/${editingItem.id}`, {
          code: code.trim(),
          name: name.trim(),
          description: itemDescription.trim() || null,
        });
        showSuccess("수정되었습니다.");
      } else {
        await apiPost(apiEndpoint, {
          code: code.trim(),
          name: name.trim(),
          description: itemDescription.trim() || null,
          display_order: items.length,
        });
        showSuccess("추가되었습니다.");
      }
      closeModal();
      onRefresh();
    } catch (error) {
      showError(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: SettingItem) => {
    if (!showConfirm(`"${item.name}" (${item.code})을(를) 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await apiDelete(`${apiEndpoint}/${item.id}`);
      showSuccess("삭제되었습니다.");
      onRefresh();
    } catch (error) {
      showError(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  };

  const handleReorder = async (newItems: SettingItem[]) => {
    // Optimistic update
    // In a real implementation, you'd call an API to save the new order
    console.log("Reordered:", newItems);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{sectionDescription}</p>
        </div>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>추가</span>
        </button>
      </div>

      <DraggableList
        items={items}
        onReorder={handleReorder}
        onEdit={openModal}
        onDelete={handleDelete}
        isLoading={isLoading}
        title={title}
        emptyMessage={emptyMessage}
      />

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {editingItem ? `${title} 수정` : `${title} 추가`}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {codeLabel} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder={`${codeLabel}를 입력하세요`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {nameLabel} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={`${nameLabel}을 입력하세요`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명
                </label>
                <textarea
                  value={itemDescription}
                  onChange={e => setItemDescription(e.target.value)}
                  placeholder="설명을 입력하세요 (선택사항)"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 p-4 border-t bg-gray-50 rounded-b-lg">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSaving ? "저장 중..." : editingItem ? "수정" : "추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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

interface PlatformsSectionProps {
  platforms: SettingItem[];
  isLoading: boolean;
  onRefresh: (platforms: SettingItem[]) => void;
}

export function PlatformsSection({ platforms, isLoading, onRefresh }: PlatformsSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<SettingItem | null>(null);
  const [platformCode, setPlatformCode] = useState("");
  const [platformName, setPlatformName] = useState("");
  const [platformDescription, setPlatformDescription] = useState("");
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [draggedPlatform, setDraggedPlatform] = useState<string | null>(null);
  const [dragOverPlatform, setDragOverPlatform] = useState<string | null>(null);

  const openPlatformModal = (platform?: SettingItem) => {
    if (platform) {
      setEditingPlatform(platform);
      setPlatformCode(platform.code);
      setPlatformName(platform.name);
      setPlatformDescription(platform.description || "");
    } else {
      setEditingPlatform(null);
      setPlatformCode("");
      setPlatformName("");
      setPlatformDescription("");
    }
    setIsModalOpen(true);
  };

  const closePlatformModal = () => {
    setIsModalOpen(false);
    setEditingPlatform(null);
    setPlatformCode("");
    setPlatformName("");
    setPlatformDescription("");
  };

  const handleSavePlatform = async () => {
    if (!platformCode.trim() || !platformName.trim()) {
      showError("플랫폼 코드와 이름은 필수입니다.");
      return;
    }

    setSavingPlatform(true);
    try {
      if (editingPlatform) {
        await apiPatch(`/api/platforms/${editingPlatform.id}`, {
          code: platformCode.trim(),
          name: platformName.trim(),
          description: platformDescription.trim() || null,
        });
        showSuccess("플랫폼이 수정되었습니다.");
      } else {
        await apiPost("/api/platforms", {
          code: platformCode.trim(),
          name: platformName.trim(),
          description: platformDescription.trim() || null,
          display_order: (platforms || []).length,
        });
        showSuccess("플랫폼이 추가되었습니다.");
      }
      closePlatformModal();
      
      const platformsData = await apiGet<{ platforms: SettingItem[] }>("/api/platforms");
      onRefresh(platformsData.platforms || []);
      mutate("/api/platforms");
    } catch (error) {
      showError(error instanceof Error ? error.message : "플랫폼 저장에 실패했습니다.");
    } finally {
      setSavingPlatform(false);
    }
  };

  const handleDeletePlatform = async (platform: SettingItem) => {
    if (!showConfirm(`플랫폼 "${platform.name}" (${platform.code})을(를) 삭제하시겠습니까?`)) return;

    try {
      await apiDelete(`/api/platforms/${platform.id}`);
      const platformsData = await apiGet<{ platforms: SettingItem[] }>("/api/platforms");
      onRefresh(platformsData.platforms || []);
      mutate("/api/platforms");
      showSuccess("플랫폼이 삭제되었습니다.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "플랫폼 삭제에 실패했습니다.");
    }
  };

  const handlePlatformDragStart = (e: React.DragEvent, id: string) => {
    setDraggedPlatform(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handlePlatformDragEnd = () => {
    setDraggedPlatform(null);
    setDragOverPlatform(null);
  };

  const handlePlatformDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedPlatform && draggedPlatform !== id) {
      setDragOverPlatform(id);
    }
  };

  const handlePlatformDragLeave = () => {
    setDragOverPlatform(null);
  };

  const handlePlatformDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverPlatform(null);
    if (!draggedPlatform || draggedPlatform === targetId) return;

    const newItems = [...platforms];
    const draggedIndex = newItems.findIndex((item) => item.id === draggedPlatform);
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
            apiPatch(`/api/platforms/${item.id}`, {
              display_order: item.display_order,
            })
          )
        );
        showSuccess("순서가 변경되었습니다.");
      } catch (error) {
        showError("순서 변경에 실패했습니다.");
        const platformsData = await apiGet<{ platforms: SettingItem[] }>("/api/platforms");
        onRefresh(platformsData.platforms || []);
      }
    }
    setDraggedPlatform(null);
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <CardTitle>플랫폼 관리</CardTitle>
        <button
          onClick={() => openPlatformModal()}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>플랫폼 추가</span>
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-2">번역 지원 플랫폼 목록을 관리합니다.</p>
      <p className="text-xs text-blue-500 mb-4 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        드래그하여 순서를 변경할 수 있습니다
      </p>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">로딩 중...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(platforms || []).map((platform) => (
            <div
              key={platform.id}
              draggable
              onDragStart={(e) => handlePlatformDragStart(e, platform.id)}
              onDragEnd={handlePlatformDragEnd}
              onDragOver={(e) => handlePlatformDragOver(e, platform.id)}
              onDragLeave={handlePlatformDragLeave}
              onDrop={(e) => handlePlatformDrop(e, platform.id)}
              className={`p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-move ${
                dragOverPlatform === platform.id ? "ring-2 ring-blue-400" : ""
              } ${draggedPlatform === platform.id ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                  <Badge variant="info">{platform.code}</Badge>
                  <p className="font-semibold text-gray-900">{platform.name}</p>
                </div>
                <DropdownMenu
                  items={[
                    {
                      label: "수정",
                      onClick: () => openPlatformModal(platform),
                      icon: (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      ),
                    },
                    {
                      label: "삭제",
                      onClick: () => handleDeletePlatform(platform),
                      variant: "danger" as const,
                      icon: (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      ),
                    },
                  ]}
                />
              </div>
              {platform.description && (
                <p className="text-sm text-gray-600 mt-2">{platform.description}</p>
              )}
            </div>
          ))}
          {(platforms || []).length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500">
              등록된 플랫폼이 없습니다.
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingPlatform ? "플랫폼 수정" : "플랫폼 추가"}
              </h3>
              <button
                onClick={closePlatformModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <Input
                label="플랫폼 코드 *"
                value={platformCode}
                onChange={(e) => setPlatformCode(e.target.value)}
                placeholder="예: android, ios, web"
              />
              <Input
                label="플랫폼 이름 *"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                placeholder="예: Android, iOS, Web"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  설명 (선택)
                </label>
                <textarea
                  value={platformDescription}
                  onChange={(e) => setPlatformDescription(e.target.value)}
                  placeholder="플랫폼에 대한 간단한 설명"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  rows={3}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-lg">
              <button
                onClick={closePlatformModal}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSavePlatform}
                disabled={savingPlatform || !platformCode.trim() || !platformName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {savingPlatform ? "저장 중..." : editingPlatform ? "수정" : "추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

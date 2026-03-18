"use client";

import { useState } from "react";
import { mutate } from "swr";
import Card, { CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
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
      window.location.reload();
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
    const target = e.curre[기밀마스킹]arget as HTMLElement;
    target.style.opacity = "0.5";
  };

  const handlePlatformDragEnd = (e: React.DragEvent) => {
    const target = e.curre[기밀마스킹]arget as HTMLElement;
    target.style.opacity = "1";
    setDraggedPlatform(null);
    setDragOverPlatform(null);
  };

  const handlePlatformDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
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
        <Button onClick={() => openPlatformModal()} size="sm">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          플랫폼 추가
        </Button>
      </div>

      <p className="text-sm text-gray-500 mb-4">지원하는 플랫폼을 관리합니다. 드래그하여 순서를 변경할 수 있습니다.</p>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : platforms.length === 0 ? (
        <div className="text-center py-8 text-gray-500">등록된 플랫폼이 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {platforms.map((platform) => (
            <div
              key={platform.id}
              draggable
              onDragStart={(e) => handlePlatformDragStart(e, platform.id)}
              onDragEnd={handlePlatformDragEnd}
              onDragOver={(e) => handlePlatformDragOver(e, platform.id)}
              onDragLeave={handlePlatformDragLeave}
              onDrop={(e) => handlePlatformDrop(e, platform.id)}
              className={`flex items-center justify-between p-3 bg-white border rounded-lg cursor-move transition-all ${
                dragOverPlatform === platform.id ? "border-blue-400 bg-blue-50" : "border-gray-200"
              } ${draggedPlatform === platform.id ? "opacity-50" : ""}`}
            >
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <div>
                  <div className="font-medium">{platform.name}</div>
                  <div className="text-sm text-gray-500">{platform.code}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openPlatformModal(platform)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeletePlatform(platform)}
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
              {editingPlatform ? "플랫폼 수정" : "플랫폼 추가"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  플랫폼 코드 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={platformCode}
                  onChange={(e) => setPlatformCode(e.target.value)}
                  placeholder="예: android, ios, web"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  플랫폼명 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  placeholder="예: Android, iOS, Web"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <Input
                  value={platformDescription}
                  onChange={(e) => setPlatformDescription(e.target.value)}
                  placeholder="플랫폼 설명 (선택사항)"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="secondary" onClick={closePlatformModal}>
                취소
              </Button>
              <Button onClick={handleSavePlatform} disabled={savingPlatform}>
                {savingPlatform ? "저장 중..." : editingPlatform ? "수정" : "추가"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

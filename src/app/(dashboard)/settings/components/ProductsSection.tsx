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

interface ProductsSectionProps {
  products: SettingItem[];
  isLoading: boolean;
  onRefresh: (products: SettingItem[]) => void;
}

export function ProductsSection({ products, isLoading, onRefresh }: ProductsSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SettingItem | null>(null);
  const [productCode, setProductCode] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);
  const [draggedProduct, setDraggedProduct] = useState<string | null>(null);
  const [dragOverProduct, setDragOverProduct] = useState<string | null>(null);

  const openProductModal = (product?: SettingItem) => {
    if (product) {
      setEditingProduct(product);
      setProductCode(product.code);
      setProductName(product.name);
      setProductDescription(product.description || "");
    } else {
      setEditingProduct(null);
      setProductCode("");
      setProductName("");
      setProductDescription("");
    }
    setIsModalOpen(true);
  };

  const closeProductModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setProductCode("");
    setProductName("");
    setProductDescription("");
  };

  const handleSaveProduct = async () => {
    if (!productCode.trim() || !productName.trim()) {
      showError("제품 코드와 이름은 필수입니다.");
      return;
    }

    setSavingProduct(true);
    try {
      if (editingProduct) {
        await apiPatch(`/api/products/${editingProduct.id}`, {
          code: productCode.trim(),
          name: productName.trim(),
          description: productDescription.trim() || null,
        });
        showSuccess("제품이 수정되었습니다.");
      } else {
        await apiPost("/api/products", {
          code: productCode.trim(),
          name: productName.trim(),
          description: productDescription.trim() || null,
          display_order: (products || []).length,
        });
        showSuccess("제품이 추가되었습니다.");
      }
      closeProductModal();
      
      // Refresh list
      const productsData = await apiGet<{ products: SettingItem[] }>("/api/products");
      onRefresh(productsData.products || []);
      mutate("/api/products");
    } catch (error) {
      showError(error instanceof Error ? error.message : "제품 저장에 실패했습니다.");
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (product: SettingItem) => {
    if (!showConfirm(`제품 "${product.name}" (${product.code})을(를) 삭제하시겠습니까?`)) return;

    try {
      await apiDelete(`/api/products/${product.id}`);
      const productsData = await apiGet<{ products: SettingItem[] }>("/api/products");
      onRefresh(productsData.products || []);
      mutate("/api/products");
      showSuccess("제품이 삭제되었습니다.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "제품 삭제에 실패했습니다.");
    }
  };

  const handleProductDragStart = (e: React.DragEvent, id: string) => {
    setDraggedProduct(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleProductDragEnd = () => {
    setDraggedProduct(null);
    setDragOverProduct(null);
  };

  const handleProductDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedProduct && draggedProduct !== id) {
      setDragOverProduct(id);
    }
  };

  const handleProductDragLeave = () => {
    setDragOverProduct(null);
  };

  const handleProductDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverProduct(null);
    if (!draggedProduct || draggedProduct === targetId) return;

    const newItems = [...products];
    const draggedIndex = newItems.findIndex((item) => item.id === draggedProduct);
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
            apiPatch(`/api/products/${item.id}`, {
              display_order: item.display_order,
            })
          )
        );
        showSuccess("순서가 변경되었습니다.");
      } catch (error) {
        showError("순서 변경에 실패했습니다.");
        const productsData = await apiGet<{ products: SettingItem[] }>("/api/products");
        onRefresh(productsData.products || []);
      }
    }
    setDraggedProduct(null);
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <CardTitle>제품 관리</CardTitle>
        <button
          onClick={() => openProductModal()}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>제품 추가</span>
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-2">번역 관리에 사용되는 제품 목록을 관리합니다.</p>
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
          {(products || []).map((product) => (
            <div
              key={product.id}
              draggable
              onDragStart={(e) => handleProductDragStart(e, product.id)}
              onDragEnd={handleProductDragEnd}
              onDragOver={(e) => handleProductDragOver(e, product.id)}
              onDragLeave={handleProductDragLeave}
              onDrop={(e) => handleProductDrop(e, product.id)}
              className={`p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-move ${
                dragOverProduct === product.id ? "ring-2 ring-blue-400" : ""
              } ${draggedProduct === product.id ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                  <Badge variant="info">{product.code}</Badge>
                  <p className="font-semibold text-gray-900">{product.name}</p>
                </div>
                <DropdownMenu
                  items={[
                    {
                      label: "수정",
                      onClick: () => openProductModal(product),
                      icon: (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      ),
                    },
                    {
                      label: "삭제",
                      onClick: () => handleDeleteProduct(product),
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
              {product.description && (
                <p className="text-sm text-gray-600 mt-2">{product.description}</p>
              )}
            </div>
          ))}
          {(products || []).length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500">
              등록된 제품이 없습니다.
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
                {editingProduct ? "제품 수정" : "제품 추가"}
              </h3>
              <button
                onClick={closeProductModal}
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
                label="제품 코드 *"
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                placeholder="예: RMS, REMOTEVIEW"
              />
              <Input
                label="제품 이름 *"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="예: RemoteCall, RemoteView"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  설명 (선택)
                </label>
                <textarea
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="제품에 대한 간단한 설명"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  rows={3}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-lg">
              <button
                onClick={closeProductModal}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSaveProduct}
                disabled={savingProduct || !productCode.trim() || !productName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {savingProduct ? "저장 중..." : editingProduct ? "수정" : "추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

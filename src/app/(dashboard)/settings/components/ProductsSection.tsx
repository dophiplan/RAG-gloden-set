"use client";

import { useState } from "react";
import { mutate } from "swr";
import Card, { CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
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
      window.location.reload();
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
    const target = e.curre[기밀마스킹]arget as HTMLElement;
    target.style.opacity = "0.5";
  };

  const handleProductDragEnd = (e: React.DragEvent) => {
    const target = e.curre[기밀마스킹]arget as HTMLElement;
    target.style.opacity = "1";
    setDraggedProduct(null);
    setDragOverProduct(null);
  };

  const handleProductDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
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
        <Button onClick={() => openProductModal()} size="sm">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          제품 추가
        </Button>
      </div>

      <p className="text-sm text-gray-500 mb-4">번역 대상 제품을 관리합니다. 드래그하여 순서를 변경할 수 있습니다.</p>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-8 text-gray-500">등록된 제품이 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {products.map((product) => (
            <div
              key={product.id}
              draggable
              onDragStart={(e) => handleProductDragStart(e, product.id)}
              onDragEnd={handleProductDragEnd}
              onDragOver={(e) => handleProductDragOver(e, product.id)}
              onDragLeave={handleProductDragLeave}
              onDrop={(e) => handleProductDrop(e, product.id)}
              className={`flex items-center justify-between p-3 bg-white border rounded-lg cursor-move transition-all ${
                dragOverProduct === product.id ? "border-blue-400 bg-blue-50" : "border-gray-200"
              } ${draggedProduct === product.id ? "opacity-50" : ""}`}
            >
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <div>
                  <div className="font-medium">{product.name}</div>
                  <div className="text-sm text-gray-500">{product.code}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openProductModal(product)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteProduct(product)}
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
              {editingProduct ? "제품 수정" : "제품 추가"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제품 코드 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  placeholder="예: RMS, REMOTEVIEW"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제품명 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="예: RemoteCall, RemoteView"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <Input
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="제품 설명 (선택사항)"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="secondary" onClick={closeProductModal}>
                취소
              </Button>
              <Button onClick={handleSaveProduct} disabled={savingProduct}>
                {savingProduct ? "저장 중..." : editingProduct ? "수정" : "추가"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

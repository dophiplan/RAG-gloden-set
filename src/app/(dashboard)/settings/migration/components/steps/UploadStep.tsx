'use client';

import React, { useRef, useState, useCallback } from 'react';
import Card from '@/components/ui/Card';
import { useProducts } from '@/hooks/useReferenceData';

interface UploadStepProps {
  file: File | null;
  productCode: string | null;
  parsedData: { columns: string[]; rowCount: number } | null;
  onFileSelect: (file: File) => void;
  onProductSelect: (productCode: string) => void;
  onParse: (file: File) => Promise<void>;
  isLoading: boolean;
}

export default function UploadStep({
  file,
  productCode,
  parsedData,
  onFileSelect,
  onProductSelect,
  onParse,
  isLoading,
}: UploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { products } = useProducts();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate file type and size
  const validateFile = (selectedFile: File): string | null => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['xlsx', 'xls'];
    
    if (!ext || !allowedExtensions.includes(ext)) {
      return 'XLSX, XLS 파일만 업로드 가능합니다.';
    }
    
    // 10MB limit
    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      return '파일 크기는 10MB를 초과할 수 없습니다.';
    }
    
    return null;
  };

  // Handle file selection from input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    onFileSelect(selectedFile);
  };

  // Handle remove file
  const handleRemoveFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onFileSelect(null as unknown as File);
    setError(null);
  };

  // Handle product selection
  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onProductSelect(value);
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;

    const validationError = validateFile(droppedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    onFileSelect(droppedFile);
  }, [onFileSelect]);

  // Trigger file input click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="w-full">
      {/* Card Header with bg-[#818CF8] */}
      <div className="bg-[#818CF8] -mx-5 -mt-5 px-5 py-4 mb-6 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* White circle with "1" */}
            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
              <span className="text-[#818CF8] font-bold text-sm">1</span>
            </div>
            {/* Title */}
            <h3 className="text-lg font-semibold text-white">파일 업로드</h3>
          </div>
          
          {/* File badge on right when selected */}
          {file && (
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <svg 
                className="w-4 h-4 text-white" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                />
              </svg>
              <span className="text-sm text-white font-medium max-w-[150px] truncate">
                {file.name}
              </span>
              <button
                onClick={handleRemoveFile}
                className="ml-1 p-0.5 hover:bg-white/20 rounded-full transition-colors"
                aria-label="파일 제거"
              >
                <svg 
                  className="w-4 h-4 text-white" 
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
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* File Upload Area */}
        <div>
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          
          <div
            onClick={handleUploadClick}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`
              relative flex flex-col items-center justify-center 
              py-8 px-6
              border-2 border-dashed rounded-2xl
              cursor-pointer transition-all duration-200
              ${isDragging 
                ? 'border-[#818CF8] bg-[#818CF8]/5' 
                : 'border-gray-300 bg-gray-50 hover:border-[#818CF8] hover:bg-gray-100'
              }
            `}
          >
            {/* Upload Icon */}
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center mb-4
              ${isDragging ? 'bg-[#818CF8]/10' : 'bg-gray-100'}
              transition-colors duration-200
            `}>
              <svg 
                className={`
                  w-8 h-8 transition-colors duration-200
                  ${isDragging ? 'text-[#818CF8]' : 'text-gray-400'}
                `} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
                />
              </svg>
            </div>
            
            {/* Upload Button */}
            <button
              type="button"
              className="mb-2 px-6 py-2.5 bg-[#818CF8] text-white font-medium rounded-lg hover:bg-[#6366F1] transition-colors shadow-sm"
            >
              Excel 파일 업로드
            </button>
            
            {/* Drag & Drop Text */}
            <p className="text-sm text-gray-500 mb-3">
              또는 드래그 앤 드롭
            </p>
            
            {/* File Limit Info */}
            <p className="text-xs text-gray-400">
              XLSX, XLS 파일 · 파일당 최대 10MB
            </p>

            {/* Drag Overlay */}
            {isDragging && (
              <div className="absolute inset-0 bg-[#818CF8]/5 rounded-2xl flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <svg 
                    className="w-12 h-12 text-[#818CF8] mb-2" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
                    />
                  </svg>
                  <span className="text-[#818CF8] font-medium">파일을 여기에 드롭하세요</span>
                </div>
              </div>
            )}
          </div>

          {/* Error Message - below upload area */}
          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <svg 
                className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {/* File Info Display */}
          {file && parsedData && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <svg 
                      className="w-5 h-5 text-blue-600" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">{file.name}</p>
                    <p className="text-xs text-blue-600">
                      {(file.size / 1024).toFixed(1)} KB · {parsedData.rowCount}행 · {parsedData.columns.length}열
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRemoveFile}
                  className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                  aria-label="파일 제거"
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Product Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            제품 선택
          </label>
          <select
            value={productCode || ''}
            onChange={handleProductChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#818CF8] focus:border-[#818CF8] transition-colors bg-white text-gray-900"
          >
            <option value="">제품을 선택해주세요</option>
            {products.map((product) => (
              <option key={product.code} value={product.code}>
                {product.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Card>
  );
}

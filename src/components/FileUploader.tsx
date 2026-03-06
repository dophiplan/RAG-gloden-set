'use client';

import React, { useState, useRef, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { MAX_FILE_SIZE } from '@/lib/constants';

export interface UploadedFile {
  file: File;
  id: string;
}

export interface FileUploaderProps {
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  className?: string;
}

const ACCEPTED_PDF_TYPES = ['application/pdf'];

export default function FileUploader({
  onFilesChange,
  maxFiles = 5,
  className = '',
}: FileUploaderProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name} 파일이 너무 큽니다. 최대 4.5MB까지 가능합니다.`;
    }

    if (!ACCEPTED_PDF_TYPES.includes(file.type)) {
      return `${file.name}은(는) 지원하지 않는 형식입니다. PDF 파일만 업로드 가능합니다.`;
    }

    return null;
  };

  const processFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(files);
    const newFiles: UploadedFile[] = [];
    const errors: string[] = [];

    let currentCount = (uploadedFiles || []).length;

    for (const file of fileArray) {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(validationError);
        continue;
      }

      if (currentCount >= maxFiles) {
        errors.push(`최대 ${maxFiles}개의 PDF 파일만 업로드할 수 있습니다.`);
        continue;
      }

      const uploadedFile: UploadedFile = {
        file,
        id: `${file.name}-${Date.now()}-${Math.random()}`,
      };

      currentCount++;
      newFiles.push(uploadedFile);
    }

    if ((errors || []).length > 0) {
      setError(errors.join(' '));
    }

    if ((newFiles || []).length > 0) {
      const updatedFiles = [...uploadedFiles, ...newFiles];
      setUploadedFiles(updatedFiles);
      onFilesChange(updatedFiles);
    }
  }, [uploadedFiles, maxFiles, onFilesChange]);

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && (files || []).length > 0) {
      processFiles(files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (id: string) => {
    const updatedFiles = (uploadedFiles || []).filter((f) => f.id !== id);
    setUploadedFiles(updatedFiles);
    onFilesChange(updatedFiles);
    setError(null);
  };

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  return (
    <div className={className}>
      <Card
        padding="lg"
        className={`
          relative border-2 border-dashed transition-colors
          ${isDragging ? 'border-[#818CF8] bg-[#E0E7FF]/50' : 'border-gray-300 hover:border-gray-400'}
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          onChange={handleFileInput}
          className="hidden"
          aria-label="PDF 파일 업로드"
        />

        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <div className="mt-4 flex flex-col items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              PDF 파일 업로드
            </Button>
            <p className="text-sm text-gray-500">또는 드래그 앤 드롭</p>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            PDF 파일 (최대 {maxFiles}개) • 파일당 최대 4.5MB
          </p>
          <p className="mt-1 text-xs text-[#818CF8] font-medium">
            현재: {(uploadedFiles || []).length}/{maxFiles} 개
          </p>
        </div>
      </Card>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {(uploadedFiles || []).length > 0 && (
        <div className="mt-4 space-y-3">
          <h4 className="text-sm font-medium text-text-main">업로드된 파일 ({(uploadedFiles || []).length})</h4>
          <div className="space-y-2">
            {(uploadedFiles || []).map((uploadedFile) => (
              <Card
                key={uploadedFile.id}
                padding="sm"
                className="flex items-center gap-3 border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div className="flex-shrink-0">
                  <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 18h12V6h-4V2H4v16zm-2 1V0h10l4 4v16H2v-1z" />
                    <path d="M6 12h8v1H6v-1zm0 2h8v1H6v-1zm0 2h5v1H6v-1z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-main truncate">
                    {uploadedFile.file.name}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatFileSize(uploadedFile.file.size)} • PDF
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveFile(uploadedFile.id)}
                  className="flex-shrink-0 !p-1"
                  aria-label={`${uploadedFile.file.name} 삭제`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

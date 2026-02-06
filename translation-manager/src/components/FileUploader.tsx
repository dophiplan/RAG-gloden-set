'use client';

import React, { useState, useRef, useCallback } from 'react';

export interface UploadedFile {
  file: File;
  preview?: string;
  id: string;
}

export interface FileUploaderProps {
  onFilesChange: (files: UploadedFile[]) => void;
  maxPdfFiles?: number;
  maxImageFiles?: number;
  className?: string;
}

const ACCEPTED_PDF_TYPES = ['application/pdf'];
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function FileUploader({
  onFilesChange,
  maxPdfFiles = 1,
  maxImageFiles = 5,
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
      return `${file.name} is too large. Maximum size is 10MB.`;
    }

    const isPdf = ACCEPTED_PDF_TYPES.includes(file.type);
    const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);

    if (!isPdf && !isImage) {
      return `${file.name} is not a supported file type. Please upload PDF or image files.`;
    }

    return null;
  };

  const getCurrentCounts = () => {
    const pdfCount = uploadedFiles.filter(f => ACCEPTED_PDF_TYPES.includes(f.file.type)).length;
    const imageCount = uploadedFiles.filter(f => ACCEPTED_IMAGE_TYPES.includes(f.file.type)).length;
    return { pdfCount, imageCount };
  };

  const processFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(files);
    const { pdfCount, imageCount } = getCurrentCounts();
    const newFiles: UploadedFile[] = [];
    const errors: string[] = [];

    let currentPdfCount = pdfCount;
    let currentImageCount = imageCount;

    for (const file of fileArray) {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(validationError);
        continue;
      }

      const isPdf = ACCEPTED_PDF_TYPES.includes(file.type);
      const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);

      if (isPdf && currentPdfCount >= maxPdfFiles) {
        errors.push(`Maximum ${maxPdfFiles} PDF file${maxPdfFiles > 1 ? 's' : ''} allowed.`);
        continue;
      }

      if (isImage && currentImageCount >= maxImageFiles) {
        errors.push(`Maximum ${maxImageFiles} image files allowed.`);
        continue;
      }

      const uploadedFile: UploadedFile = {
        file,
        id: `${file.name}-${Date.now()}-${Math.random()}`,
      };

      // Create preview for images
      if (isImage) {
        try {
          const preview = await createImagePreview(file);
          uploadedFile.preview = preview;
        } catch (err) {
          console.error('Failed to create preview:', err);
        }
        currentImageCount++;
      } else {
        currentPdfCount++;
      }

      newFiles.push(uploadedFile);
    }

    if (errors.length > 0) {
      setError(errors.join(' '));
    }

    if (newFiles.length > 0) {
      const updatedFiles = [...uploadedFiles, ...newFiles];
      setUploadedFiles(updatedFiles);
      onFilesChange(updatedFiles);
    }
  }, [uploadedFiles, maxPdfFiles, maxImageFiles, onFilesChange]);

  const createImagePreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (id: string) => {
    const updatedFiles = uploadedFiles.filter((f) => f.id !== id);
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

  const getFileIcon = (file: File) => {
    if (ACCEPTED_PDF_TYPES.includes(file.type)) {
      return (
        <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M4 18h12V6h-4V2H4v16zm-2 1V0h10l4 4v16H2v-1z" />
          <path d="M6 12h8v1H6v-1zm0 2h8v1H6v-1zm0 2h5v1H6v-1z" />
        </svg>
      );
    }
    return (
      <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
      </svg>
    );
  };

  const { pdfCount, imageCount } = getCurrentCounts();

  return (
    <div className={className}>
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 transition-colors
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
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
          accept={[...ACCEPTED_PDF_TYPES, ...ACCEPTED_IMAGE_TYPES].join(',')}
          onChange={handleFileInput}
          className="hidden"
          aria-label="File upload"
        />

        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="mt-4 flex flex-col items-center text-sm text-gray-600">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline"
            >
              Upload files
            </button>
            <p className="mt-1">or drag and drop</p>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            PDF (max {maxPdfFiles}) or Images (PNG, JPEG, GIF, WEBP - max {maxImageFiles})
          </p>
          <p className="text-xs text-gray-500">Up to 10MB per file</p>
          <p className="mt-2 text-xs text-gray-600">
            Current: {pdfCount}/{maxPdfFiles} PDF, {imageCount}/{maxImageFiles} images
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="mt-4 space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Uploaded Files ({uploadedFiles.length})</h4>
          <div className="space-y-2">
            {uploadedFiles.map((uploadedFile) => {
              const isImage = ACCEPTED_IMAGE_TYPES.includes(uploadedFile.file.type);
              return (
                <div
                  key={uploadedFile.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-shrink-0">
                    {isImage && uploadedFile.preview ? (
                      <img
                        src={uploadedFile.preview}
                        alt={uploadedFile.file.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 flex items-center justify-center">
                        {getFileIcon(uploadedFile.file)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {uploadedFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(uploadedFile.file.size)} • {uploadedFile.file.type.split('/')[1].toUpperCase()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(uploadedFile.id)}
                    className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label={`Remove ${uploadedFile.file.name}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

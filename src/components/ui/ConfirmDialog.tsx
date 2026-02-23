'use client';

import { useState } from 'react';
import Button from './Button';
import Card from './Card';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: '⚠️',
      iconBg: 'bg-red-100',
      confirmButton: 'bg-red-600 hover:bg-red-700',
    },
    warning: {
      icon: '⚡',
      iconBg: 'bg-yellow-100',
      confirmButton: 'bg-yellow-600 hover:bg-yellow-700',
    },
    info: {
      icon: 'ℹ️',
      iconBg: 'bg-blue-100',
      confirmButton: 'bg-blue-600 hover:bg-blue-700',
    },
  };

  const style = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={isLoading ? undefined : onClose}
      />

      {/* Dialog */}
      <Card className="relative z-10 max-w-md w-full mx-4 p-6 space-y-4">
        {/* Icon */}
        <div className="flex justify-center">
          <div className={`${style.iconBg} rounded-full p-3`}>
            <span className="text-3xl">{style.icon}</span>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-center text-gray-900">
          {title}
        </h2>

        {/* Message */}
        <p className="text-sm text-gray-600 text-center whitespace-pre-line">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={onClose}
            variant="secondary"
            disabled={isLoading}
            className="flex-1"
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 ${style.confirmButton} text-white`}
          >
            {isLoading ? '처리 중...' : confirmText}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/**
 * Hook to manage confirm dialog state
 */
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<Omit<ConfirmDialogProps, 'isOpen' | 'onClose' | 'onConfirm'>>({
    title: '',
    message: '',
  });
  const [onConfirmCallback, setOnConfirmCallback] = useState<(() => void) | null>(null);

  const openDialog = (
    dialogConfig: Omit<ConfirmDialogProps, 'isOpen' | 'onClose' | 'onConfirm'>,
    onConfirm: () => void
  ) => {
    setConfig(dialogConfig);
    setOnConfirmCallback(() => onConfirm);
    setIsOpen(true);
  };

  const closeDialog = () => {
    setIsOpen(false);
  };

  const handleConfirm = () => {
    if (onConfirmCallback) {
      onConfirmCallback();
    }
    closeDialog();
  };

  return {
    isOpen,
    openDialog,
    closeDialog,
    handleConfirm,
    config,
  };
}

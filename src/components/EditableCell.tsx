'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface EditableCellProps {
  value: string;
  onSave: (newValue: string) => Promise<void> | void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function EditableCell({
  value,
  onSave,
  placeholder = '더블클릭하여 편집',
  disabled = false,
  className = '',
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      adjustTextareaHeight();
    }
  }, [isEditing]);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleDoubleClick = () => {
    if (disabled) return;
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (isSaving) return;

    const trimmedValue = editValue.trim();
    if (trimmedValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(trimmedValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Don't close if clicking save/cancel buttons
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (containerRef.current?.contains(relatedTarget)) {
      return;
    }
    handleSave();
  };

  if (isEditing) {
    return (
      <div ref={containerRef} className={`relative ${className}`}>
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            adjustTextareaHeight();
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={isSaving}
          className="w-full min-h-[60px] p-2 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder={placeholder}
        />
        <div className="flex gap-1 mt-1 text-xs text-gray-500">
          <span>Enter: 저장</span>
          <span>|</span>
          <span>Esc: 취소</span>
          {isSaving && <span className="ml-2 text-blue-500">저장 중...</span>}
        </div>
      </div>
    );
  }

  // Function to render text with clickable links
  const renderTextWithLinks = (text: string) => {
    // URL regex pattern
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        // Reset regex lastIndex for the test
        urlRegex.lastIndex = 0;
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className={`cursor-pointer min-h-[40px] p-2 rounded hover:bg-gray-50 transition-colors ${className}`}
      title={disabled ? '' : '더블클릭하여 편집'}
    >
      {value ? (
        <span className="text-sm text-gray-900 whitespace-pre-wrap break-words">
          {renderTextWithLinks(value)}
        </span>
      ) : (
        <span className="text-sm text-gray-400 italic">{placeholder}</span>
      )}
    </div>
  );
}

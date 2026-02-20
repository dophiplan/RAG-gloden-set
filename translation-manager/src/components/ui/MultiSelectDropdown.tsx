'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectDropdownProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  openUpward?: boolean;
}

export default function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = 'Select options...',
  disabled = false,
  className = '',
  openUpward = false,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    onChange(newSelected);
  };

  const handleRemoveTag = (value: string, event: React.MouseEvent) => {
    event.stopPropagation();
    onChange(selected.filter((item) => item !== value));
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else if (focusedIndex >= 0 && focusedIndex < options.length) {
          handleSelect(options[focusedIndex].value);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setFocusedIndex(-1);
        buttonRef.current?.focus();
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : prev));
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) {
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        }
        break;
      case 'Tab':
        if (isOpen) {
          setIsOpen(false);
          setFocusedIndex(-1);
        }
        break;
    }
  };

  const getSelectedLabels = () => {
    return options
      .filter((option) => selected.includes(option.value))
      .map((option) => option.label);
  };

  const selectedLabels = getSelectedLabels();

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          block w-full px-3 py-1.5 text-sm text-left bg-white border rounded-lg shadow-sm
          focus:outline-none focus:ring-2 transition-all duration-200
          ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'cursor-pointer'}
          ${isOpen ? 'border-primary ring-2 ring-primary/15' : 'border-border-light'}
          hover:border-border-light
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={placeholder}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 flex flex-wrap gap-1.5 items-center text-text-main">
            {selectedLabels.length > 0 ? (
              <>
                <span className="text-sm">{selectedLabels[0]}</span>
                {selectedLabels.length > 1 && (
                  <span className="text-sm text-gray-600">
                    +{selectedLabels.length - 1}
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm text-text-muted">{placeholder}</span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${
              isOpen ? 'transform rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div
          className={`absolute z-[100] w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto ${
            openUpward ? 'bottom-full mb-1' : 'mt-1'
          }`}
          style={{ minWidth: '200px' }}
          role="listbox"
          aria-multiselectable="true"
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-gray-500 text-sm">No options available</div>
          ) : (
            <ul className="py-1">
              {options.map((option, index) => {
                const isSelected = selected.includes(option.value);
                const isFocused = index === focusedIndex;

                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    className={`
                      px-3 py-2 cursor-pointer transition-colors duration-150
                      ${isFocused ? 'bg-blue-50' : ''}
                      ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                    `}
                    onClick={() => handleSelect(option.value)}
                    onMouseEnter={() => setFocusedIndex(index)}
                  >
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelect(option.value)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        tabIndex={-1}
                      />
                      <span className="text-sm text-gray-900">{option.label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

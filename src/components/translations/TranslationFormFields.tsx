"use client";

import { useMemo } from "react";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import MultiSelectDropdown from "@/components/ui/MultiSelectDropdown";
import { PriorityLevel, LanguageCode, ScopeType } from "@/types";
import { getAllSelectableLanguages } from "@/lib/product-languages";
import {
  useScopes,
  usePriorities,
  useLanguages,
  usePlatforms,
} from "@/hooks/useReferenceData";

export interface TranslationFormFieldsProps {
  // Field values
  priority: PriorityLevel;
  scope: ScopeType;
  selectedLanguages: LanguageCode[];
  completionDate: string;
  selectedPlatforms: string[];
  version: string;

  // Change handlers
  onPriorityChange: (priority: PriorityLevel) => void;
  onScopeChange: (scope: ScopeType) => void;
  onLanguagesChange: (languages: LanguageCode[]) => void;
  onCompletionDateChange: (date: string) => void;
  onPlatformsChange: (platforms: string[]) => void;
  onVersionChange: (version: string) => void;

  // Optional customization
  showDateWarning?: boolean;
  dateWarning?: string;
  isInvalidDate?: boolean;

  // 제품 선택 (해당 제품의 분류만 표시)
  selectedProduct?: string;
}

/**
 * TranslationFormFields - 번역 정보 입력 공통 컴포넌트
 *
 * 새 번역 추가 팝업과 번역 요청하기 페이지에서 공통으로 사용되는 폼 필드들을 관리합니다.
 * 두 곳의 UI/UX를 동일하게 유지하고, 수정 시 한 곳만 변경하면 되도록 합니다.
 *
 * 레이아웃:
 * - 1번째 줄 (4단): 중요도*, 제품*, 제품 분류*, 번역 언어 선택*
 * - 2번째 줄 (3단): 요청 완료일, 플랫폼 선택, 버전
 */
export default function TranslationFormFields({
  priority,
  scope,
  selectedLanguages,
  completionDate,
  selectedPlatforms,
  version,
  onPriorityChange,
  onScopeChange,
  onLanguagesChange,
  onCompletionDateChange,
  onPlatformsChange,
  onVersionChange,
  showDateWarning = false,
  dateWarning = "",
  isInvalidDate = false,
  selectedProduct,
}: TranslationFormFieldsProps) {
  // Fetch reference data from DB
  // 선택된 제품이 있으면 해당 제품의 분류만, 없으면 기본 분류(4개) 조회
  const { scopes } = useScopes(selectedProduct);
  const { priorities } = usePriorities();
  const { languagesMap } = useLanguages();
  const { platforms } = usePlatforms();

  // Generate select options dynamically
  const scopeOptions = useMemo(
    () => [
      { value: "", label: "제품 분류 선택" },
      ...scopes.map((s) => ({ value: s.code, label: s.name })),
    ],
    [scopes],
  );

  const priorityOptions = useMemo(
    () =>
      priorities.map((p) => ({
        value: p.code,
        label: p.label,
      })),
    [priorities],
  );

  // Language options for multi-select
  const languageOptions = useMemo(() => {
    const availableLanguages = getAllSelectableLanguages();
    return availableLanguages.map((lang) => ({
      value: lang,
      label: languagesMap[lang]?.name || lang.toUpperCase(),
    }));
  }, [languagesMap]);

  // Platform options for multi-select
  const platformOptions = useMemo(() => {
    return platforms
      .sort((a, b) => a.display_order - b.display_order)
      .map((p) => ({
        value: p.code,
        label: p.name,
      }));
  }, [platforms]);

  return (
    <div className="space-y-4">
      {/* Row 1: 필수 값 (중요도, 제품 분류, 번역 언어 선택) */}
      <div className="grid grid-cols-3 gap-4">
        <Select
          label="중요도"
          value={priority}
          onChange={(e) => onPriorityChange(e.target.value as PriorityLevel)}
          options={priorityOptions}
          required
        />
        <Select
          label="제품 분류"
          value={scope}
          onChange={(e) => onScopeChange(e.target.value as ScopeType)}
          options={scopeOptions}
          required
        />
        <div>
          <label className="block text-sm font-semibold text-text-main mb-2">
            번역 언어 선택<span className="text-red-500 ml-1">*</span>
          </label>
          <MultiSelectDropdown
            options={languageOptions}
            selected={selectedLanguages}
            onChange={onLanguagesChange}
            placeholder="번역할 언어를 선택하세요"
          />
        </div>
      </div>

      {/* Row 2: 선택 값 (요청 완료일, 플랫폼 선택, 버전) */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Input
            label="요청 완료일"
            type="date"
            value={completionDate}
            onChange={(e) => onCompletionDateChange(e.target.value)}
            className={isInvalidDate ? "border-red-500" : ""}
          />
          {showDateWarning && dateWarning && (
            <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {dateWarning}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-semibold text-text-main mb-2">
            플랫폼 선택
          </label>
          <MultiSelectDropdown
            options={platformOptions}
            selected={selectedPlatforms}
            onChange={onPlatformsChange}
            placeholder="플랫폼을 선택하세요"
          />
        </div>
        <Input
          label="버전"
          value={version}
          onChange={(e) => onVersionChange(e.target.value)}
          placeholder="예: 2.0.0"
        />
      </div>
    </div>
  );
}

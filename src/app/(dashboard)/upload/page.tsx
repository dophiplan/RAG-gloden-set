"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import FileUploader, { UploadedFile } from "@/components/FileUploader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import TranslationFormFields from "@/components/translations/TranslationFormFields";
import { PriorityLevel, LanguageCode, ScopeType } from "@/types";
import { Holiday } from "@/types/api";
import { showError, showSuccess } from "@/lib/notifications";
import {
  calculateDeadline,
  formatDeadline,
} from "@/shared/date_time/holiday_checker";
import { apiGet, apiPost, apiFetch } from "@/lib/api-utils";
import { useProducts } from "@/hooks/useReferenceData";

interface ParseResult {
  success: boolean;
  summary?: {
    total: number;
    successful: number;
    failed: number;
    totalTexts: number;
  };
  results?: Array<{
    fileName: string;
    success: boolean;
    texts?: string[];
    error?: string;
  }>;
  extracted_texts?: string[];
  total_extracted?: number;
  issues_created?: Array<{
    id: string;
    title: string;
    description: string;
  }>;
  error?: string;
}

// Step indicator component
function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: "파일 업로드" },
    { num: 2, label: "정보 입력" },
    { num: 3, label: "텍스트 확인" },
  ];

  return (
    <div className="flex items-center justify-center mb-4">
      {steps.map((step, index) => (
        <div key={step.num} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`
                w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                transition-all duration-200
                ${
                  currentStep >= step.num
                    ? "bg-primary text-white shadow-lg"
                    : "bg-gray-200 text-gray-500"
                }
              `}
            >
              {currentStep > step.num ? (
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                step.num
              )}
            </div>
            <span
              className={`mt-2 text-xs font-medium ${currentStep >= step.num ? "text-primary-active" : "text-gray-500"}`}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`
                w-24 h-1 mx-4 rounded transition-all duration-200
                ${currentStep > step.num ? "bg-primary" : "bg-gray-200"}
              `}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const { products } = useProducts();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [scope, setScope] = useState<ScopeType>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [version, setVersion] = useState("");
  const [priority, setPriority] = useState<PriorityLevel>("medium");
  const [selectedLanguages, setSelectedLanguages] = useState<LanguageCode[]>([
    "en",
    "ja",
  ]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTexts, setSelectedTexts] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_dragCounter, setDragCounter] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [completionDate, setCompletionDate] = useState("");
  const [dateWarning, setDateWarning] = useState("");
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isInvalidDate, setIsInvalidDate] = useState(false);

  // Navigation handlers
  const goToNextStep = () => {
    if (currentStep === 1) {
      if ((uploadedFiles || []).length === 0) {
        showError("파일을 먼저 업로드해주세요.");
        return;
      }
      if (!selectedProduct) {
        showError("제품을 선택해주세요.");
        return;
      }
    }
    if (
      currentStep === 2 &&
      (!priority || !scope || (selectedLanguages || []).length === 0)
    ) {
      showError("필수 정보를 입력해주세요.");
      return;
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canGoNext = () => {
    if (currentStep === 1)
      return (uploadedFiles || []).length > 0 && !!selectedProduct;
    if (currentStep === 2)
      return priority && scope && (selectedLanguages || []).length > 0;
    return false;
  };

  // Fetch Korean and Japanese holidays
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const result = await apiGet<{ data?: Holiday[] }>("/api/holidays");
        if (result.data) setHolidays(result.data);
      } catch (error) {
        console.error("Failed to fetch holidays:", error);
      }
    };
    fetchHolidays();
  }, []);

  // Auto-calculate completion date (today + 3 business days)
  useEffect(() => {
    if ((holidays || []).length > 0 && !completionDate) {
      const today = new Date();
      const defaultDate = calculateDeadline(today, 3, holidays);
      setCompletionDate(formatDeadline(defaultDate));
    }
  }, [holidays, completionDate]);

  const handleFilesChange = (files: UploadedFile[]) => {
    setUploadedFiles(files);
    setParseResult(null);
    setError(null);
    setSelectedTexts(new Set());
  };

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProduct(e.target.value);
  };

  // Auto-select all texts when parse result is available
  useEffect(() => {
    if (parseResult && parseResult.results) {
      const allTexts: string[] = [];
      parseResult.results.forEach((result) => {
        if (result.success && result.texts && Array.isArray(result.texts)) {
          allTexts.push(...result.texts);
        }
      });
      setSelectedTexts(new Set((allTexts || []).map((_, index) => index)));
    }
  }, [parseResult]);

  const handleParse = async () => {
    if ((uploadedFiles || []).length === 0) {
      showError("파일을 업로드해주세요.");
      return;
    }

    if (!scope) {
      showError("제품 분류를 선택해주세요.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setParseResult(null);

    try {
      const formData = new FormData();

      uploadedFiles.forEach((uploadedFile) => {
        formData.append("files", uploadedFile.file);
      });

      if (scope) formData.append("scope", scope);
      if (selectedProduct) formData.append("product", selectedProduct);
      if (version) formData.append("version", version);

      const data = await apiFetch<ParseResult>("/api/files/parse", {
        method: "POST",
        body: formData,
      });

      setParseResult(data);

      const totalTexts = data.summary?.totalTexts || 0;

      if (data.success && totalTexts > 0) {
        showSuccess(`${totalTexts}개의 텍스트가 추출되었습니다.`);
        // Automatically go to step 3 after successful parsing
        setCurrentStep(3);
      } else {
        // 실패 또는 텍스트 없음 처리
        const failedFiles = data.results?.filter((r) => !r.success) || [];
        if (failedFiles.length > 0) {
          const errorMsg =
            failedFiles[0].error || "파일 파싱 중 오류가 발생했습니다.";
          setError(errorMsg);
          showError(errorMsg);
        } else if (totalTexts === 0) {
          const noTextError =
            '파일에서 추출할 수 있는 텍스트가 없습니다. 인용문("...") 또는 태그([TR]...[/TR])가 포함된 파일을 업로드해주세요.';
          setError(noTextError);
          showError(noTextError);
        }
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "오류가 발생했습니다.";
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewIssues = () => {
    router.push("/issues");
  };

  // Page-wide drag and drop handlers with counter pattern
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setDragCounter((prev) => {
        const newCount = prev + 1;
        if (newCount === 1 && e.dataTransfer?.types.includes("Files")) {
          setIsDragging(true);
        }
        return newCount;
      });
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setDragCounter((prev) => {
        const newCount = prev - 1;
        if (newCount <= 0) {
          setIsDragging(false);
          return 0;
        }
        return newCount;
      });
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setDragCounter(0);
      setIsDragging(false);

      const files = Array.from(e.dataTransfer?.files || []);
      if ((files || []).length > 0) {
        const uploadedFileObjects: UploadedFile[] = (files || []).map(
          (file) => ({
            file,
            id: `${file.name}-${Date.now()}-${Math.random()}`,
          }),
        );
        setUploadedFiles(uploadedFileObjects);
        setParseResult(null);
        setError(null);
        setSelectedTexts(new Set());
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDragCounter(0);
        setIsDragging(false);
      }
    };

    // Type-safe event listeners - wrap DragEvent handlers as EventListener
    const dragEnterListener: EventListener = (e) =>
      handleDragEnter(e as DragEvent);
    const dragOverListener: EventListener = (e) =>
      handleDragOver(e as DragEvent);
    const dragLeaveListener: EventListener = (e) =>
      handleDragLeave(e as DragEvent);
    const dropListener: EventListener = (e) => handleDrop(e as DragEvent);

    window.addEventListener("dragenter", dragEnterListener);
    window.addEventListener("dragover", dragOverListener);
    window.addEventListener("dragleave", dragLeaveListener);
    window.addEventListener("drop", dropListener);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("dragenter", dragEnterListener);
      window.removeEventListener("dragover", dragOverListener);
      window.removeEventListener("dragleave", dragLeaveListener);
      window.removeEventListener("drop", dropListener);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleAddTranslations = async () => {
    if (!parseResult) return;

    const allTexts: string[] = [];
    if (parseResult.results && Array.isArray(parseResult.results)) {
      parseResult.results.forEach((result) => {
        if (result.success && result.texts && Array.isArray(result.texts)) {
          allTexts.push(...result.texts);
        }
      });
    }

    const selectedTextsArray = allTexts.filter((_, index) =>
      selectedTexts.has(index),
    );

    if ((selectedTextsArray || []).length === 0) {
      showError("선택된 텍스트가 없습니다.");
      return;
    }

    if (!scope) {
      showError("제품 분류를 선택해주세요.");
      return;
    }

    if ((selectedLanguages || []).length === 0) {
      showError("번역 언어를 최소 1개 이상 선택해주세요.");
      return;
    }

    try {
      const data = await apiPost<{ warning?: string; created?: number }>(
        "/api/translations/bulk",
        {
          texts: selectedTextsArray,
          version: version || undefined,

          scope: scope || undefined,
          priority: priority,
          languages: selectedLanguages,
          platform_codes: selectedPlatforms,
          completion_date: completionDate || undefined,
        },
      );
      console.log("Bulk create success:", data);

      // Show warning if AI translation failed
      if (data.warning) {
        showError(data.warning);
      }

      showSuccess(`${data.created}개의 번역 항목이 추가되었습니다.`);

      router.push("/translations?refresh=" + Date.now());
    } catch (error) {
      console.error("Error adding translations:", error);
      showError("번역 항목 추가 중 오류가 발생했습니다.");
    }
  };

  // Get selected product name for display in header
  const selectedProductName = selectedProduct
    ? products.find((p) => p.code === selectedProduct)?.name || selectedProduct
    : "";

  return (
    <DashboardLayout
      title="번역 요청하기"
      subtitle="PDF 또는 이미지를 업로드하여 번역 요청을 간편하게 생성하세요"
    >
      {/* Page-wide drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-blue-500 bg-opacity-20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-lg shadow-2xl p-8 border-4 border-dashed border-blue-500">
            <div className="flex flex-col items-center gap-4">
              <svg
                className="w-16 h-16 text-blue-500"
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
              <p className="text-xl font-semibold text-gray-900">
                파일을 여기에 드롭하세요
              </p>
              <p className="text-sm text-gray-600">PDF, PNG, JPG 파일 지원</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} />

        {/* Step Container with horizontal layout */}
        <div className="relative overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${(currentStep - 1) * 100}%)` }}
          >
            {/* Step 1: File Upload */}
            <div className="w-full flex-shrink-0 px-4">
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between bg-[#818CF8] -mx-5 -mt-5 px-5 py-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center font-semibold text-[#818CF8] text-sm">
                      1
                    </div>
                    <h3 className="text-lg font-semibold text-white">
                      파일 업로드
                    </h3>
                  </div>
                  {(uploadedFiles.length > 0 || selectedProduct) && (
                    <div className="flex items-center gap-3">
                      {uploadedFiles.length > 0 && (
                        <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
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
                          <span className="text-sm text-white font-medium truncate max-w-[150px]">
                            {uploadedFiles[0].file.name}
                          </span>
                          <button
                            onClick={() => handleFilesChange([])}
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
                      {selectedProductName && (
                        <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
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
                              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                            />
                          </svg>
                          <span className="text-sm text-white font-medium truncate max-w-[150px]">
                            {selectedProductName}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  번역할 텍스트가 포함된 PDF 또는 이미지 파일을 업로드하세요
                </p>
                <FileUploader onFilesChange={handleFilesChange} maxFiles={5} />

                {/* Product Selection */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    제품 선택
                  </label>
                  <select
                    value={selectedProduct}
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
              </Card>
            </div>

            {/* Step 2: Information */}
            <div className="w-full flex-shrink-0 px-4">
              <Card className="overflow-hidden">
                <div className="flex items-center gap-3 bg-[#818CF8] -mx-5 -mt-5 px-5 py-4 mb-6">
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center font-semibold text-[#818CF8] text-sm">
                    2
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    정보 입력
                  </h3>
                </div>
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                      기본 정보
                    </h4>
                    <TranslationFormFields
                      priority={priority}
                      scope={scope}
                      selectedLanguages={selectedLanguages}
                      completionDate={completionDate}
                      selectedPlatforms={selectedPlatforms}
                      version={version}
                      onPriorityChange={setPriority}
                      onScopeChange={setScope}
                      onLanguagesChange={setSelectedLanguages}
                      onCompletionDateChange={(date) => {
                        const selectedDate = new Date(date);
                        setCompletionDate(date);

                        // Check if weekend or holiday
                        const isWeekend =
                          selectedDate.getDay() === 0 ||
                          selectedDate.getDay() === 6;
                        const isHoliday = holidays.some(
                          (h) => h.holiday_date === date,
                        );
                        const invalid = isWeekend || isHoliday;

                        setIsInvalidDate(invalid);

                        if (invalid) {
                          const holidayName = holidays.find(
                            (h) => h.holiday_date === date,
                          )?.name;
                          setDateWarning(
                            isHoliday
                              ? `⚠️ ${holidayName} - 휴일입니다. 완료일로 선택하시겠습니까?`
                              : "⚠️ 주말입니다. 완료일로 선택하시겠습니까?",
                          );
                        } else {
                          setDateWarning("");
                        }
                      }}
                      onPlatformsChange={setSelectedPlatforms}
                      onVersionChange={setVersion}
                      showDateWarning={!!dateWarning}
                      dateWarning={dateWarning}
                      isInvalidDate={isInvalidDate}
                      selectedProduct={selectedProduct}
                    />
                  </div>

                  {/* Action Buttons with Language Counter */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">
                        {(selectedLanguages || []).length}개 언어 선택됨
                      </p>
                      <p className="text-sm text-gray-600">
                        {(selectedPlatforms || []).length}개 플랫폼 선택됨
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={handleParse}
                        loading={isUploading}
                        disabled={
                          isUploading ||
                          !priority ||
                          !scope ||
                          (selectedLanguages || []).length === 0
                        }
                      >
                        {isUploading ? "파싱 중..." : "텍스트 추출하기"}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setUploadedFiles([]);
                          setParseResult(null);
                          setError(null);
                          setSelectedTexts(new Set());
                          setCurrentStep(1);
                        }}
                      >
                        초기화
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Step 3: Parse Results */}
            <div className="w-full flex-shrink-0 px-4">
              {/* Error Display */}
              {error && (
                <Card className="mb-6 border-red-200 bg-red-50">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
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
                    <div className="flex-1">
                      <p className="text-sm text-red-700">{error}</p>
                      {parseResult?.issues_created &&
                        (parseResult.issues_created || []).length > 0 && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={handleViewIssues}
                            className="mt-3"
                          >
                            이슈 확인
                          </Button>
                        )}
                    </div>
                  </div>
                </Card>
              )}

              {/* Step 3: Parse Results - moved inside slider */}
              {parseResult && parseResult.success ? (
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between bg-[#818CF8] -mx-5 -mt-5 px-5 py-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center font-semibold text-[#818CF8] text-sm">
                        3
                      </div>
                      <h3 className="text-lg font-semibold text-white">
                        텍스트 확인
                      </h3>
                    </div>
                    <Badge
                      variant="success"
                      className="bg-white/20 text-white border-0"
                    >
                      완료
                    </Badge>
                  </div>
                  <div className="space-y-6">
                    {/* Issues Created */}
                    {parseResult.issues_created &&
                      (parseResult.issues_created || []).length > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <svg
                              className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-yellow-800 mb-1">
                                파싱 실패 항목이 이슈로 등록되었습니다
                              </h4>
                              <p className="text-sm text-yellow-700 mb-2">
                                {(parseResult.issues_created || []).length}개의
                                이슈가 생성되었습니다.
                              </p>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={handleViewIssues}
                              >
                                이슈 확인
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Extracted Texts */}
                    {(() => {
                      const allTexts: string[] = [];
                      if (
                        parseResult.results &&
                        Array.isArray(parseResult.results)
                      ) {
                        parseResult.results.forEach((result) => {
                          if (
                            result.success &&
                            result.texts &&
                            Array.isArray(result.texts)
                          ) {
                            allTexts.push(...result.texts);
                          }
                        });
                      }

                      const allSelected =
                        (allTexts || []).length > 0 &&
                        selectedTexts.size === (allTexts || []).length;
                      const toggleAll = () => {
                        if (allSelected) {
                          setSelectedTexts(new Set());
                        } else {
                          setSelectedTexts(
                            new Set((allTexts || []).map((_, index) => index)),
                          );
                        }
                      };

                      const toggleText = (index: number) => {
                        const newSelected = new Set(selectedTexts);
                        if (newSelected.has(index)) {
                          newSelected.delete(index);
                        } else {
                          newSelected.add(index);
                        }
                        setSelectedTexts(newSelected);
                      };

                      return (allTexts || []).length > 0 ? (
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-semibold text-gray-700">
                              텍스트 선택 ({selectedTexts.size}/
                              {(allTexts || []).length})
                            </h4>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={toggleAll}
                                className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                              />
                              <span className="text-sm font-medium text-gray-700">
                                총 {allTexts.length}개 텍스트
                              </span>
                            </label>
                          </div>
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {(allTexts || []).map((text, index) => (
                              <div
                                key={index}
                                className="p-4 rounded-lg border border-gray-200 bg-white flex items-start gap-3"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedTexts.has(index)}
                                  onChange={() => toggleText(index)}
                                  className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary mt-0.5"
                                />
                                <p className="text-sm text-gray-900 flex-1">
                                  {text}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-6 border-t">
                      <Button
                        onClick={handleAddTranslations}
                        disabled={selectedTexts.size === 0}
                        className="flex-1"
                      >
                        번역 요청 생성하기 ({selectedTexts.size}개)
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setUploadedFiles([]);
                          setParseResult(null);
                          setError(null);
                          setSelectedTexts(new Set());
                          setCurrentStep(1);
                        }}
                      >
                        새로 시작
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card>
                  <div className="text-center py-12">
                    <p className="text-gray-500">
                      먼저 파일을 업로드하고 텍스트를 추출해주세요
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>

          {/* Navigation Buttons - migration 스타일로 통일 */}
          <div className="flex items-center pt-4">
            {/* Left: 이전 버튼 */}
            <div className="flex-1">
              {currentStep > 1 && (
                <Button variant="secondary" size="lg" onClick={goToPrevStep}>
                  <span className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    이전
                  </span>
                </Button>
              )}
            </div>

            {/* Center: 페이지 인디케이터 */}
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      currentStep === step ? "bg-primary" : "bg-gray-300"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Right: 다음 버튼 */}
            <div className="flex-1 flex justify-end">
              {currentStep < 3 && (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={goToNextStep}
                  disabled={!canGoNext()}
                >
                  <span className="flex items-center gap-2">
                    다음
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

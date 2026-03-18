/**
 * 사용자 엑셀 업로드 모달 컴포넌트
 *
 * 기능:
 * - 드래그앤드롭 파일 업로드
 * - 엑셀 파싱 및 유효성 검사
 * - 업로드 프리뷰
 * - 배치 업로드 (500건 이상 처리)
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import {
  validateUploadData,
  ValidatedUserUpload,
  generateExcelTemplate,
} from "@/lib/validation/userUploadSchema";
import { convertExcelDataToCodes } from "@/lib/validation/userUploadMapping";
import { apiPost } from "@/lib/api-utils";
import { showSuccess, showError } from "@/lib/notifications";

interface ExcelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  maxRows?: number;
  maxFileSize?: number; // bytes
}

interface ParsedRow {
  rowIndex: number;
  success: boolean;
  data?: ValidatedUserUpload;
  errors?: Array<{ path: string; message: string }>;
}

const BATCH_SIZE = 100; // Supabase 한 번에 처리 가능한 건수
const DEFAULT_MAX_ROWS = 500;
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function ExcelUploadModal({
  isOpen,
  onClose,
  onSuccess,
  maxRows = DEFAULT_MAX_ROWS,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
}: ExcelUploadModalProps) {
  const [step, setStep] = useState<"upload" | "preview" | "processing">(
    "upload",
  );
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<{
    success: number;
    failed: number;
    created?: number;
    updated?: number;
    errors: string[];
    failedRows?: Array<{
      rowIndex: number;
      email: string;
      name: string;
      error: string;
    }>;
  } | null>(null);

  // 메모리 누수 방지용 ref
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // 진행 중인 API 요청 취소
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 안전한 상태 업데이트 함수
  const safeSetState = useCallback(
    <T,>(setter: (value: T) => void, value: T) => {
      if (isMountedRef.current) {
        setter(value);
      }
    },
    [],
  );

  // 드래그앤드롭 핸들러
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];

      if (!file) return;

      try {
        // 파일 크기 검사
        if (file.size > maxFileSize) {
          showError(
            `파일 크기는 ${(maxFileSize / 1024 / 1024).toFixed(0)}MB를 초과할 수 없습니다.`,
          );
          return;
        }

        // 파일 타입 검사
        const validTypes = [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
        ];
        if (
          !validTypes.includes(file.type) &&
          !file.name.endsWith(".xlsx") &&
          !file.name.endsWith(".xls")
        ) {
          showError("엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.");
          return;
        }

        // 파일 읽기
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
          raw: false,
        });

        // 행 수 검사
        if (jsonData.length === 0) {
          showError("업로드할 데이터가 없습니다.");
          return;
        }

        if (jsonData.length > maxRows) {
          showError(
            `최대 ${maxRows}걸까지만 업로드 가능합니다. (현재: ${jsonData.length}건)`,
          );
          return;
        }

        // 한글 → 코드 변환
        const convertedData = convertExcelDataToCodes(
          jsonData as Record<string, unknown>[],
        );

        // 데이터 검증
        const validationResult = validateUploadData(convertedData);
        setParsedData(validationResult.rows);
        setStep("preview");
      } catch (error) {
        console.error("엑셀 파싱 오류:", error);
        showError("엑셀 파일을 읽는 중 오류가 발생했습니다.");
      }
    },
    [maxFileSize, maxRows],
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
          ".xlsx",
        ],
        "application/vnd.ms-excel": [".xls"],
      },
      maxFiles: 1,
      maxSize: maxFileSize,
    });

  // 템플릿 다운로드
  const handleDownloadTemplate = async () => {
    let url: string | null = null;
    try {
      const buffer = await generateExcelTemplate();
      const blob = new Blob([buffer as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "사용자_업로드_템플릿.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("템플릿 생성 오류:", error);
      showError("템플릿 생성 중 오류가 발생했습니다.");
    } finally {
      if (url) {
        URL.revokeObjectURL(url);
      }
    }
  };

  // 실패 데이터 다운로드
  const handleDownloadFailedRows = () => {
    if (!uploadResult?.failedRows || uploadResult.failedRows.length === 0)
      return;

    let url: string | null = null;
    try {
      // CSV 형식으로 변환 (CSV 인젝션 방지)
      const headers = ["행번호", "이메일", "이름", "오류내용"];
      const rows = uploadResult.failedRows.map((row) => [
        row.rowIndex,
        row.email,
        row.name,
        row.error,
      ]);

      // CSV 인젝션 방지: 공식으로 시작하는 문자에 탭 추가
      const sanitizeCSV = (value: string): string => {
        const str = String(value).replace(/"/g, '""');
        // 공식 인젝션 방지: =, +, -, @, 탭으로 시작하면 앞에 탭 추가
        if (/^[=+\-@\t]/.test(str)) return `\t${str}`;
        return `"${str}"`;
      };

      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          row.map((cell) => sanitizeCSV(String(cell))).join(","),
        ),
      ].join("\n");

      const blob = new Blob(["\ufeff" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `업로드_실패_목록_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("실패 목록 다운로드 오류:", error);
      showError("실패 목록 다운로드 중 오류가 발생했습니다.");
    } finally {
      if (url) {
        URL.revokeObjectURL(url);
      }
    }
  };

  // API를 통한 배치 업로드
  const handleConfirmUpload = async () => {
    const validRows = parsedData.filter((row) => row.success && row.data);

    if (validRows.length === 0) {
      showError("업로드할 유효한 데이터가 없습니다.");
      return;
    }

    // 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    safeSetState(setIsUploading, true);
    safeSetState(setStep, "processing");
    safeSetState(setUploadProgress, 0);

    const users = validRows.map((row) => row.data!);
    const chunks: ValidatedUserUpload[][] = [];

    // 청크 분할
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      chunks.push(users.slice(i, i + BATCH_SIZE));
    }

    const result = {
      success: 0,
      failed: 0,
      created: 0,
      updated: 0,
      errors: [] as string[],
      failedRows: [] as Array<{
        rowIndex: number;
        email: string;
        name: string;
        error: string;
      }>,
    };

    try {
      for (let i = 0; i < chunks.length; i++) {
        // 컴포넌트가 언마운트되었거나 요청이 취소되었으면 중단
        if (
          !isMountedRef.current ||
          abortControllerRef.current?.signal.aborted
        ) {
          console.log("업로드 중단: 컴포넌트 언마운트 또는 요청 취소");
          return;
        }

        const chunk = chunks[i];

        const response = await apiPost<{
          success: boolean;
          count: number;
          created: number;
          updated: number;
          failed: number;
          errors?: string[];
          failedRows?: Array<{
            rowIndex: number;
            email: string;
            name: string;
            error: string;
          }>;
        }>("/api/bulk/users/upload", {
          users: chunk,
          batchIndex: i,
          totalBatches: chunks.length,
        });

        result.success += response.count;
        result.created += response.created || 0;
        result.updated += response.updated || 0;
        result.failed += response.failed || 0;
        if (response.errors) {
          result.errors.push(...response.errors);
        }
        if (response.failedRows) {
          result.failedRows.push(...response.failedRows);
        }

        // 진행률 업데이트 (안전하게)
        safeSetState(setUploadProgress, ((i + 1) / chunks.length) * 100);
      }

      safeSetState(setUploadResult, result);

      if (result.failed === 0) {
        showSuccess(
          `${result.success}명의 사용자가 성공적으로 처리되었습니다. (신규: ${result.created}, 업데이트: ${result.updated})`,
        );
        onSuccess();
        // 1초 후 모달 닫기
        setTimeout(() => {
          if (isMountedRef.current) {
            handleClose();
          }
        }, 1000);
      } else {
        showError(
          `${result.failed}건 처리에 실패했습니다. 실패 목록을 다운로드하여 확인해주세요.`,
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("업로드 요청이 취소되었습니다.");
        return;
      }
      console.error("업로드 오류:", error);
      showError("업로드 중 오류가 발생했습니다.");
      result.errors.push(
        error instanceof Error ? error.message : "Unknown error",
      );
      safeSetState(setUploadResult, result);
    } finally {
      safeSetState(setIsUploading, false);
      abortControllerRef.current = null;
    }
  };

  // 모달 닫기 및 상태 초기화
  const handleClose = () => {
    setStep("upload");
    setParsedData([]);
    setUploadProgress(0);
    setUploadResult(null);
    onClose();
  };

  const validRows = parsedData.filter((row) => row.success);
  const invalidRows = parsedData.filter((row) => !row.success);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="사용자 일괄 등록"
      size="lg"
    >
      {/* Step 1: 파일 업로드 */}
      {step === "upload" && (
        <div className="space-y-6">
          {/* 템플릿 다운로드 버튼 */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              엑셀 파일을 업로드하여 사용자를 일괄 등록할 수 있습니다.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadTemplate}
            >
              템플릿 다운로드
            </Button>
          </div>

          {/* 드래그앤드롭 영역 */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
              transition-colors duration-200
              ${
                isDragActive
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
              }
            `}
          >
            <input {...getInputProps()} />

            <div className="space-y-4">
              <div className="text-4xl">📊</div>

              {isDragActive ? (
                <p className="text-lg font-medium text-blue-600">
                  파일을 여기에 놓으세요
                </p>
              ) : (
                <>
                  <p className="text-lg font-medium text-gray-700">
                    엑셀 파일을 드래그하거나 클릭하여 업로드
                  </p>
                  <p className="text-sm text-gray-500">
                    최대 {maxRows}건, {(maxFileSize / 1024 / 1024).toFixed(0)}MB
                  </p>
                  <p className="text-xs text-gray-400">
                    지원 형식: .xlsx, .xls
                  </p>
                </>
              )}
            </div>
          </div>

          {/* 파일 거부 오류 표시 */}
          {fileRejections.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-medium text-red-800">
                파일 업로드 오류
              </p>
              <ul className="mt-2 text-sm text-red-600 list-disc list-inside">
                {fileRejections.map(({ file, errors }) => (
                  <li key={file.name}>
                    {file.name}: {errors.map((e) => e.message).join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 업로드 가이드 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              업로드 가이드
            </h4>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>이름과 이메일은 필수 입력 항목입니다.</li>
              <li>이메일은 시스템에서 중복될 수 없습니다.</li>
              <li>
                담당 플랫폼은 설정 &gt; 플랫폼 관리에 등록된 코드를 사용해야
                합니다.
              </li>
              <li>여러 값을 입력할 때는 콤마(,)로 구분합니다.</li>
              <li>최대 500건까지 한 번에 업로드할 수 있습니다.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Step 2: 미리보기 */}
      {step === "preview" && (
        <div className="space-y-4">
          {/* 요약 정보 */}
          <div className="flex gap-4">
            <div className="flex-1 bg-green-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {validRows.length}
              </p>
              <p className="text-sm text-green-700">유효한 데이터</p>
            </div>
            <div className="flex-1 bg-red-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-600">
                {invalidRows.length}
              </p>
              <p className="text-sm text-red-700">오류</p>
            </div>
          </div>

          {/* 오류 목록 */}
          {invalidRows.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-40 overflow-y-auto">
              <h4 className="text-sm font-medium text-red-800 mb-2">
                오류 목록
              </h4>
              <ul className="text-sm text-red-600 space-y-1">
                {invalidRows.slice(0, 10).map((row) => (
                  <li key={row.rowIndex}>
                    {row.rowIndex}행:{" "}
                    {row.errors?.map((e) => e.message).join(", ")}
                  </li>
                ))}
                {invalidRows.length > 10 && (
                  <li className="text-red-500">
                    ... 외 {invalidRows.length - 10}건
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* 미리보기 테이블 */}
          <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">행</th>
                  <th className="px-3 py-2 text-left">이름</th>
                  <th className="px-3 py-2 text-left">이메일</th>
                  <th className="px-3 py-2 text-left">담당 플랫폼</th>
                  <th className="px-3 py-2 text-left">작업권한</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {validRows.slice(0, 20).map((row) => (
                  <tr key={row.rowIndex} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-500">{row.rowIndex}</td>
                    <td className="px-3 py-2 font-medium">{row.data?.name}</td>
                    <td className="px-3 py-2">{row.data?.email}</td>
                    <td className="px-3 py-2">
                      {row.data?.platforms?.join(", ") || "-"}
                    </td>
                    <td className="px-3 py-2">{row.data?.roles?.join(", ")}</td>
                  </tr>
                ))}
                {validRows.length > 20 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-2 text-center text-gray-500"
                    >
                      ... 외 {validRows.length - 20}건
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 액션 버튼 */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setStep("upload")}>
              다시 선택
            </Button>
            <Button
              onClick={handleConfirmUpload}
              disabled={validRows.length === 0}
            >
              {validRows.length}건 업로드
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: 처리 중 / 결과 */}
      {step === "processing" && (
        <div className="space-y-6 py-8">
          {isUploading ? (
            // 진행 중
            <div className="text-center space-y-4">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
              <p className="text-lg font-medium text-gray-700">
                업로드 처리 중...
              </p>
              <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">
                {Math.round(uploadProgress)}% 완료
              </p>
            </div>
          ) : uploadResult ? (
            // 결과 표시
            <div className="space-y-4">
              <div className="text-center">
                {uploadResult.failed === 0 ? (
                  <div className="text-green-600 text-5xl mb-4">✓</div>
                ) : (
                  <div className="text-yellow-600 text-5xl mb-4">!</div>
                )}
                <p className="text-lg font-medium text-gray-700">
                  업로드 {uploadResult.failed === 0 ? "완료" : "일부 완료"}
                </p>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-green-600">
                    {uploadResult.success}
                  </p>
                  <p className="text-xs text-green-700">총 성공</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-blue-600">
                    {uploadResult.created || 0}
                  </p>
                  <p className="text-xs text-blue-700">신규</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-purple-600">
                    {uploadResult.updated || 0}
                  </p>
                  <p className="text-xs text-purple-700">업데이트</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-red-600">
                    {uploadResult.failed}
                  </p>
                  <p className="text-xs text-red-700">실패</p>
                </div>
              </div>

              {/* 실패 목록 테이블 */}
              {uploadResult.failedRows &&
                uploadResult.failedRows.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-red-100 border-b border-red-200 flex justify-between items-center">
                      <h4 className="text-sm font-medium text-red-800">
                        실패 목록 ({uploadResult.failedRows.length}건)
                      </h4>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleDownloadFailedRows}
                      >
                        CSV 다운로드
                      </Button>
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-red-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs text-red-700">
                              행
                            </th>
                            <th className="px-3 py-2 text-left text-xs text-red-700">
                              이메일
                            </th>
                            <th className="px-3 py-2 text-left text-xs text-red-700">
                              이름
                            </th>
                            <th className="px-3 py-2 text-left text-xs text-red-700">
                              오류
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-red-100">
                          {uploadResult.failedRows
                            .slice(0, 10)
                            .map((row, index) => (
                              <tr key={index}>
                                <td className="px-3 py-2 text-red-600">
                                  {row.rowIndex}
                                </td>
                                <td className="px-3 py-2">{row.email}</td>
                                <td className="px-3 py-2">{row.name}</td>
                                <td className="px-3 py-2 text-red-600 text-xs">
                                  {row.error}
                                </td>
                              </tr>
                            ))}
                          {uploadResult.failedRows.length > 10 && (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-3 py-2 text-center text-red-500 text-xs"
                              >
                                ... 외 {uploadResult.failedRows.length - 10}건
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {/* 이전 오류 메시지 (호환성) */}
              {uploadResult.errors.length > 0 &&
                (!uploadResult.failedRows ||
                  uploadResult.failedRows.length === 0) && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-40 overflow-y-auto">
                    <h4 className="text-sm font-medium text-red-800 mb-2">
                      오류 상세
                    </h4>
                    <ul className="text-sm text-red-600 space-y-1 list-disc list-inside">
                      {uploadResult.errors.slice(0, 10).map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                      {uploadResult.errors.length > 10 && (
                        <li>... 외 {uploadResult.errors.length - 10}건</li>
                      )}
                    </ul>
                  </div>
                )}

              <div className="flex justify-center gap-3 pt-4">
                {uploadResult.failed > 0 && (
                  <Button variant="secondary" onClick={() => setStep("upload")}>
                    새 파일 업로드
                  </Button>
                )}
                <Button onClick={handleClose}>닫기</Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

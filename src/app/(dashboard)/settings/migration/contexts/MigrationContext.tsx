'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import * as XLSX from 'xlsx';
import { ProductCode } from '@/types';
import { apiFetch } from '@/lib/api-utils';

// =============================================================================
// Types
// =============================================================================

/** Wizard step types */
export type MigrationStep = 'upload' | 'mapping' | 'previewCommit';

/** Entry action types */
export type EntryAction = 'import' | 'skip' | 'merge' | 'overwrite' | 'glossary';

/** Duplicate status types */
export type DuplicateStatus = 'exact' | 'similar' | 'new';

/** Category types */
export type EntryCategory = 'glossary' | 'translation';

/** Preview entry data */
export interface PreviewEntry {
  id: string;
  source_text: string;
  context?: string;
  translations: Record<string, string>;
  suggested_category: EntryCategory;
  word_count: number;
  duplicate_status: {
    status: DuplicateStatus;
    similarity?: number;
    existing_id?: string;
    existing_translations?: Record<string, string>;
  };
  category?: EntryCategory;
  action?: EntryAction;
  duplicate_action?: 'skip' | 'overwrite' | 'merge';
  // Additional metadata fields
  key?: string;
  product?: string;
  version?: string;
  platform?: string;
  note?: string;
}

/** Migration summary statistics */
export interface MigrationSummary {
  total: number;
  glossary_suggested: number;
  translation_suggested: number;
  exact_matches: number;
  similar_matches: number;
  new_entries: number;
}

/** Sheet data from parsed file */
export interface SheetData {
  name: string;
  columns: string[];
  rowCount: number;
}

/** Field mappings for a version */
export interface VersionMapping {
  source: string | null;
  translations: string[];
  metadata: Record<string, string>;
  customFields: string[];
}

/** All version mappings */
export type VersionMappings = Record<string, VersionMapping>;

/** Version entries storage */
export type VersionEntries = Record<string, PreviewEntry[]>;

/** Toast notification */
export interface ToastMessage {
  message: string;
  type: 'error' | 'success' | 'warning';
}

/** API response for preview */
interface PreviewResponse {
  entries: PreviewEntry[];
  summary: MigrationSummary;
  error?: string;
  details?: string;
}

/** API response for commit */
interface CommitResponse {
  glossary: {
    created: number;
    skipped: number;
  };
  translations: {
    created: number;
    updated: number;
    skipped: number;
  };
}

// =============================================================================
// State
// =============================================================================

/** Migration state interface */
interface MigrationState {
  // Step management
  currentStep: MigrationStep;
  steps: MigrationStep[];

  // File upload
  file: File | null;
  fileName: string;
  fileSize: number;
  fileType: 'excel' | null;

  // Product selection
  productCode: ProductCode | '';
  version: string;

  // Sheet data (from parsed file)
  sheetsData: SheetData[];
  selectedVersion: string;

  // Field mappings
  versionMappings: VersionMappings;
  currentMapping: VersionMapping;

  // Preview data
  entries: PreviewEntry[];
  versionEntries: VersionEntries;
  summary: MigrationSummary | null;

  // UI state
  loading: boolean;
  error: string | null;
  toast: ToastMessage | null;

  // Track completion status of each step
  completedSteps: Record<MigrationStep, boolean>;
}

/** Initial state */
const initialState: MigrationState = {
  currentStep: 'upload',
  steps: ['upload', 'mapping', 'previewCommit'],

  file: null,
  fileName: '',
  fileSize: 0,
  fileType: null,

  productCode: '',
  version: '',

  sheetsData: [],
  selectedVersion: '',

  versionMappings: {},
  currentMapping: {
    source: null,
    translations: [],
    metadata: {},
    customFields: [],
  },

  entries: [],
  versionEntries: {},
  summary: null,

  loading: false,
  error: null,
  toast: null,

  completedSteps: {
    upload: false,
    mapping: false,
    previewCommit: false,
  },
};

// =============================================================================
// Actions
// =============================================================================

type MigrationAction =
  // Navigation
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'GO_TO_STEP'; payload: MigrationStep }
  | { type: 'MARK_STEP_COMPLETED'; payload: MigrationStep }

  // File handling
  | { type: 'SET_FILE'; payload: { file: File; sheetsData: SheetData[] } }
  | { type: 'CLEAR_FILE' }
  | { type: 'PARSE_FILE_START' }
  | { type: 'PARSE_FILE_SUCCESS'; payload: { sheetsData: SheetData[]; fileType: 'excel' } }
  | { type: 'PARSE_FILE_ERROR'; payload: string }

  // Product selection
  | { type: 'SET_PRODUCT_CODE'; payload: ProductCode | '' }
  | { type: 'SET_VERSION'; payload: string }

  // Version selection
  | { type: 'SET_SELECTED_VERSION'; payload: string }
  | { type: 'SAVE_VERSION_MAPPING'; payload: { version: string; mapping: VersionMapping } }
  | { type: 'LOAD_VERSION_MAPPING'; payload: string }
  | { type: 'UPDATE_CURRENT_MAPPING'; payload: VersionMapping }
  | { type: 'UPDATE_ALL_MAPPINGS'; payload: VersionMappings }

  // Preview data
  | { type: 'LOAD_PREVIEW_START' }
  | { type: 'LOAD_PREVIEW_SUCCESS'; payload: { entries: PreviewEntry[]; versionEntries: VersionEntries; summary: MigrationSummary } }
  | { type: 'LOAD_PREVIEW_ERROR'; payload: string }
  | { type: 'UPDATE_ENTRY'; payload: { id: string; updates: Partial<PreviewEntry> } }
  | { type: 'BULK_UPDATE_ENTRIES'; payload: { ids: string[]; updates: Partial<PreviewEntry> } }
  | { type: 'RESET_ENTRIES' }

  // Commit
  | { type: 'COMMIT_START' }
  | { type: 'COMMIT_SUCCESS' }
  | { type: 'COMMIT_ERROR'; payload: string }

  // UI
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SHOW_TOAST'; payload: ToastMessage }
  | { type: 'HIDE_TOAST' }
  | { type: 'RESET_STATE' };

// =============================================================================
// Reducer
// =============================================================================

function migrationReducer(
  state: MigrationState,
  action: MigrationAction
): MigrationState {
  switch (action.type) {
    // Navigation
    case 'NEXT_STEP': {
      const currentIndex = state.steps.indexOf(state.currentStep);
      const nextIndex = Math.min(currentIndex + 1, state.steps.length - 1);
      return {
        ...state,
        currentStep: state.steps[nextIndex],
      };
    }

    case 'PREV_STEP': {
      const currentIndex = state.steps.indexOf(state.currentStep);
      const prevIndex = Math.max(currentIndex - 1, 0);
      return {
        ...state,
        currentStep: state.steps[prevIndex],
      };
    }

    case 'GO_TO_STEP': {
      // Only allow going to steps that are accessible
      const targetIndex = state.steps.indexOf(action.payload);
      const currentIndex = state.steps.indexOf(state.currentStep);

      // Allow going back or to the immediate next step if current is completed
      const canNavigate =
        targetIndex <= currentIndex ||
        (targetIndex === currentIndex + 1 && state.completedSteps[state.currentStep]);

      if (!canNavigate) return state;

      return {
        ...state,
        currentStep: action.payload,
      };
    }

    case 'MARK_STEP_COMPLETED': {
      return {
        ...state,
        completedSteps: {
          ...state.completedSteps,
          [action.payload]: true,
        },
      };
    }

    // File handling
    case 'SET_FILE': {
      const { file, sheetsData } = action.payload;
      const fileType = 'excel';
      const selectedVersion = sheetsData.length > 0 ? sheetsData[0].name : '';

      return {
        ...state,
        file,
        fileName: file.name,
        fileSize: file.size,
        fileType,
        sheetsData,
        selectedVersion,
        error: null,
      };
    }

    case 'CLEAR_FILE': {
      return {
        ...state,
        file: null,
        fileName: '',
        fileSize: 0,
        fileType: null,
        sheetsData: [],
        selectedVersion: '',
        versionMappings: {},
        currentMapping: initialState.currentMapping,
        entries: [],
        versionEntries: {},
        summary: null,
        error: null,
      };
    }

    case 'PARSE_FILE_START': {
      return {
        ...state,
        loading: true,
        error: null,
      };
    }

    case 'PARSE_FILE_SUCCESS': {
      const { sheetsData, fileType } = action.payload;
      return {
        ...state,
        loading: false,
        sheetsData,
        fileType,
        selectedVersion: sheetsData.length > 0 ? sheetsData[0].name : '',
      };
    }

    case 'PARSE_FILE_ERROR': {
      return {
        ...state,
        loading: false,
        error: action.payload,
      };
    }

    // Product selection
    case 'SET_PRODUCT_CODE': {
      return {
        ...state,
        productCode: action.payload,
      };
    }

    case 'SET_VERSION': {
      return {
        ...state,
        version: action.payload,
      };
    }

    // Version selection
    case 'SET_SELECTED_VERSION': {
      return {
        ...state,
        selectedVersion: action.payload,
      };
    }

    case 'SAVE_VERSION_MAPPING': {
      const { version, mapping } = action.payload;
      return {
        ...state,
        versionMappings: {
          ...state.versionMappings,
          [version]: mapping,
        },
      };
    }

    case 'LOAD_VERSION_MAPPING': {
      const version = action.payload;
      const savedMapping = state.versionMappings[version];
      return {
        ...state,
        currentMapping: savedMapping || initialState.currentMapping,
      };
    }

    case 'UPDATE_CURRENT_MAPPING': {
      return {
        ...state,
        currentMapping: action.payload,
      };
    }

    case 'UPDATE_ALL_MAPPINGS': {
      return {
        ...state,
        versionMappings: action.payload,
      };
    }

    // Preview data
    case 'LOAD_PREVIEW_START': {
      return {
        ...state,
        loading: true,
        error: null,
      };
    }

    case 'LOAD_PREVIEW_SUCCESS': {
      return {
        ...state,
        loading: false,
        entries: action.payload.entries,
        versionEntries: action.payload.versionEntries,
        summary: action.payload.summary,
      };
    }

    case 'LOAD_PREVIEW_ERROR': {
      return {
        ...state,
        loading: false,
        error: action.payload,
      };
    }

    case 'UPDATE_ENTRY': {
      const { id, updates } = action.payload;
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === id ? { ...e, ...updates } : e
        ),
        versionEntries: Object.fromEntries(
          Object.entries(state.versionEntries).map(([version, entries]) => [
            version,
            entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
          ])
        ),
      };
    }

    case 'BULK_UPDATE_ENTRIES': {
      const { ids, updates } = action.payload;
      return {
        ...state,
        entries: state.entries.map((e) =>
          ids.includes(e.id) ? { ...e, ...updates } : e
        ),
        versionEntries: Object.fromEntries(
          Object.entries(state.versionEntries).map(([version, entries]) => [
            version,
            entries.map((e) =>
              ids.includes(e.id) ? { ...e, ...updates } : e
            ),
          ])
        ),
      };
    }

    case 'RESET_ENTRIES': {
      return {
        ...state,
        entries: [],
        versionEntries: {},
        summary: null,
      };
    }

    // Commit
    case 'COMMIT_START': {
      return {
        ...state,
        loading: true,
        error: null,
      };
    }

    case 'COMMIT_SUCCESS': {
      return {
        ...state,
        loading: false,
        completedSteps: {
          ...state.completedSteps,
          previewCommit: true,
        },
      };
    }

    case 'COMMIT_ERROR': {
      return {
        ...state,
        loading: false,
        error: action.payload,
      };
    }

    // UI
    case 'SET_LOADING': {
      return {
        ...state,
        loading: action.payload,
      };
    }

    case 'SET_ERROR': {
      return {
        ...state,
        error: action.payload,
      };
    }

    case 'SHOW_TOAST': {
      return {
        ...state,
        toast: action.payload,
      };
    }

    case 'HIDE_TOAST': {
      return {
        ...state,
        toast: null,
      };
    }

    case 'RESET_STATE': {
      return initialState;
    }

    default:
      return state;
  }
}

// =============================================================================
// Context
// =============================================================================

interface MigrationContextType {
  // State
  state: MigrationState;

  // Navigation
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: MigrationStep) => void;
  canGoToStep: (step: MigrationStep) => boolean;
  isStepCompleted: (step: MigrationStep) => boolean;

  // File handling
  parseFile: (file: File) => Promise<void>;
  clearFile: () => void;
  validateFile: (file: File) => { valid: boolean; error?: string };

  // Product selection
  setProductCode: (code: ProductCode | '') => void;

  // Version management
  setSelectedVersion: (version: string) => void;
  saveCurrentMapping: () => void;
  updateCurrentMapping: (mapping: VersionMapping) => void;
  updateAllMappings: (mappings: VersionMappings) => void;

  // Mapping helpers
  getMappedVersions: () => string[];
  hasMappingForVersion: (version: string) => boolean;
  isMappingComplete: (mapping?: VersionMapping) => boolean;

  // Preview data
  loadPreview: () => Promise<void>;
  updateEntry: (id: string, updates: Partial<PreviewEntry>) => void;
  updateEntriesBulk: (ids: string[], updates: Partial<PreviewEntry>) => void;

  // Commit
  commitMigration: () => Promise<CommitResponse>;

  // UI
  showToast: (message: string, type?: ToastMessage['type']) => void;
  hideToast: () => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Reset
  resetState: () => void;

  // Validation helpers
  canProceedToMapping: () => boolean;
  canProceedToPreview: () => boolean;
  canCommit: () => boolean;

  // Computed values
  currentStepIndex: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  progressPercentage: number;
}

const MigrationContext = createContext<MigrationContextType | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface MigrationProviderProps {
  children: ReactNode;
}

export function MigrationProvider({ children }: MigrationProviderProps) {
  const [state, dispatch] = useReducer(migrationReducer, initialState);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ==========================================================================
  // Navigation
  // ==========================================================================

  const nextStep = useCallback(() => {
    dispatch({ type: 'NEXT_STEP' });
  }, []);

  const prevStep = useCallback(() => {
    dispatch({ type: 'PREV_STEP' });
  }, []);

  const goToStep = useCallback((step: MigrationStep) => {
    dispatch({ type: 'GO_TO_STEP', payload: step });
  }, []);

  const canGoToStep = useCallback(
    (step: MigrationStep): boolean => {
      const targetIndex = state.steps.indexOf(step);
      const currentIndex = state.steps.indexOf(state.currentStep);

      // Can always go back
      if (targetIndex <= currentIndex) return true;

      // Can go to immediate next step if current is completed
      if (
        targetIndex === currentIndex + 1 &&
        state.completedSteps[state.currentStep]
      ) {
        return true;
      }

      return false;
    },
    [state.steps, state.currentStep, state.completedSteps]
  );

  const isStepCompleted = useCallback(
    (step: MigrationStep): boolean => {
      return state.completedSteps[step];
    },
    [state.completedSteps]
  );

  // ==========================================================================
  // File Handling
  // ==========================================================================

  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['xlsx', 'xls'];

    if (!ext || !validExtensions.includes(ext)) {
      return {
        valid: false,
        error: '지원하지 않는 파일 형식입니다. XLSX, XLS 파일을 업로드해주세요.',
      };
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        valid: false,
        error: '파일 크기가 10MB를 초과합니다.',
      };
    }

    return { valid: true };
  }, []);

  const parseFile = useCallback(async (file: File) => {
    const validation = validateFile(file);
    if (!validation.valid) {
      dispatch({ type: 'PARSE_FILE_ERROR', payload: validation.error! });
      return;
    }

    dispatch({ type: 'PARSE_FILE_START' });

    try {
      // Excel 파일만 지원
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      const sheetsData: SheetData[] = wb.SheetNames.map((sheetName) => {
        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
        const columns =
          data.length > 0
            ? data[0]
                .map((h) => String(h || '').trim())
                .filter(Boolean)
            : [];
        return {
          name: sheetName,
          columns,
          rowCount: data.length > 0 ? data.length - 1 : 0,
        };
      });

      dispatch({
        type: 'PARSE_FILE_SUCCESS',
        payload: { sheetsData, fileType: 'excel' },
      });

      dispatch({ type: 'SET_FILE', payload: { file, sheetsData } });
      dispatch({ type: 'MARK_STEP_COMPLETED', payload: 'upload' });
    } catch (err) {
      dispatch({
        type: 'PARSE_FILE_ERROR',
        payload: '파일 읽기 오류: ' + (err as Error).message,
      });
    }
  }, [validateFile]);

  const clearFile = useCallback(() => {
    dispatch({ type: 'CLEAR_FILE' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // ==========================================================================
  // Product Selection
  // ==========================================================================

  const setProductCode = useCallback((code: ProductCode | '') => {
    dispatch({ type: 'SET_PRODUCT_CODE', payload: code });
  }, []);

  // ==========================================================================
  // Version Management
  // ==========================================================================

  const setSelectedVersion = useCallback((version: string) => {
    // Save current mapping before switching
    if (state.selectedVersion && state.currentMapping.source) {
      dispatch({
        type: 'SAVE_VERSION_MAPPING',
        payload: { version: state.selectedVersion, mapping: state.currentMapping },
      });
    }

    dispatch({ type: 'SET_SELECTED_VERSION', payload: version });
    dispatch({ type: 'LOAD_VERSION_MAPPING', payload: version });
  }, [state.selectedVersion, state.currentMapping]);

  const saveCurrentMapping = useCallback(() => {
    if (state.selectedVersion) {
      dispatch({
        type: 'SAVE_VERSION_MAPPING',
        payload: { version: state.selectedVersion, mapping: state.currentMapping },
      });
    }
  }, [state.selectedVersion, state.currentMapping]);

  const updateCurrentMapping = useCallback((mapping: VersionMapping) => {
    dispatch({ type: 'UPDATE_CURRENT_MAPPING', payload: mapping });
  }, []);

  const updateAllMappings = useCallback((mappings: VersionMappings) => {
    dispatch({ type: 'UPDATE_ALL_MAPPINGS', payload: mappings });
  }, []);

  const getMappedVersions = useCallback((): string[] => {
    return Object.keys(state.versionMappings).filter(
      (v) => state.versionMappings[v].source
    );
  }, [state.versionMappings]);

  const hasMappingForVersion = useCallback(
    (version: string): boolean => {
      const mapping = state.versionMappings[version];
      return !!(
        mapping &&
        (mapping.source ||
          mapping.translations.length > 0 ||
          Object.keys(mapping.metadata).length > 0)
      );
    },
    [state.versionMappings]
  );

  const isMappingComplete = useCallback((mapping?: VersionMapping): boolean => {
    const m = mapping || state.currentMapping;
    return !!(
      m.source &&
      m.metadata.product_category &&
      m.translations.length > 0
    );
  }, [state.currentMapping]);

  // ==========================================================================
  // Preview Data
  // ==========================================================================

  const loadPreview = useCallback(async () => {
    if (!state.file) {
      dispatch({ type: 'LOAD_PREVIEW_ERROR', payload: '파일을 선택해주세요.' });
      return;
    }

    if (!state.currentMapping.source) {
      dispatch({ type: 'LOAD_PREVIEW_ERROR', payload: '원문을 매칭 시켜주세요' });
      return;
    }

    if (!state.currentMapping.metadata.product_category) {
      dispatch({ type: 'LOAD_PREVIEW_ERROR', payload: '제품분류를 매칭 시켜주세요' });
      return;
    }

    if (state.currentMapping.translations.length === 0) {
      dispatch({ type: 'LOAD_PREVIEW_ERROR', payload: '최소 하나의 번역 언어를 선택해주세요' });
      return;
    }

    // Save current mapping
    const finalVersionMappings = { ...state.versionMappings };
    if (state.selectedVersion) {
      finalVersionMappings[state.selectedVersion] = { ...state.currentMapping };
    }

    dispatch({ type: 'LOAD_PREVIEW_START' });

    try {
      // Get all mapped versions
      const allVersionsToLoad = Object.keys(finalVersionMappings).filter(
        (v) => finalVersionMappings[v].source
      );

      if (state.selectedVersion && !allVersionsToLoad.includes(state.selectedVersion)) {
        allVersionsToLoad.push(state.selectedVersion);
      }

      if (allVersionsToLoad.length === 0) {
        dispatch({ type: 'LOAD_PREVIEW_ERROR', payload: '매핑된 버전이 없습니다.' });
        return;
      }

      const allVersionEntries: VersionEntries = {};
      let totalSummary: MigrationSummary = {
        total: 0,
        glossary_suggested: 0,
        translation_suggested: 0,
        exact_matches: 0,
        similar_matches: 0,
        new_entries: 0,
      };

      // Load preview for each version
      const versionPromises = allVersionsToLoad.map(async (versionName) => {
        const mappings = finalVersionMappings[versionName];
        if (!mappings || !mappings.source || !state.file) return null;

        const fd = new FormData();
        fd.append('file', state.file);
        fd.append('product_code', state.productCode);
        fd.append('version', versionName);
        fd.append('field_mappings', JSON.stringify(mappings));

        try {
          const previewData = await apiFetch<PreviewResponse>(
            '/api/migration/preview',
            {
              method: 'POST',
              body: fd,
            }
          );

          if (previewData.error) {
            console.error(`[Preview API] Error for ${versionName}:`, previewData.error);
            return null;
          }

          if (!previewData.entries || !Array.isArray(previewData.entries)) {
            console.error(`[Preview API] Invalid response for ${versionName}:`, previewData);
            return null;
          }

          const initEntries = previewData.entries.map((e) => ({
            ...e,
            version: versionName,
            action: 'import' as EntryAction,
            duplicate_action:
              e.duplicate_status.status === 'exact'
                ? ('skip' as const)
                : undefined,
          }));

          return {
            versionName,
            entries: initEntries,
            summary: previewData.summary,
          };
        } catch (error) {
          console.error(`[Preview API] Failed for ${versionName}:`, error);
          return null;
        }
      });

      const results = await Promise.all(versionPromises);

      results.forEach((result) => {
        if (result) {
          allVersionEntries[result.versionName] = result.entries;
          totalSummary.total += result.summary.total;
          totalSummary.glossary_suggested += result.summary.glossary_suggested;
          totalSummary.translation_suggested += result.summary.translation_suggested;
          totalSummary.exact_matches += result.summary.exact_matches;
          totalSummary.similar_matches += result.summary.similar_matches;
          totalSummary.new_entries += result.summary.new_entries;
        }
      });

      const allEntries = Object.values(allVersionEntries).flat();

      dispatch({
        type: 'LOAD_PREVIEW_SUCCESS',
        payload: {
          entries: allEntries,
          versionEntries: allVersionEntries,
          summary: totalSummary,
        },
      });

      dispatch({ type: 'MARK_STEP_COMPLETED', payload: 'mapping' });
      dispatch({ type: 'NEXT_STEP' });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '미리보기 데이터를 불러오는데 실패했습니다.';
      dispatch({
        type: 'LOAD_PREVIEW_ERROR',
        payload: errorMessage,
      });
    }
  }, [state.file, state.currentMapping, state.versionMappings, state.selectedVersion, state.productCode]);

  const updateEntry = useCallback((id: string, updates: Partial<PreviewEntry>) => {
    dispatch({ type: 'UPDATE_ENTRY', payload: { id, updates } });
  }, []);

  const updateEntriesBulk = useCallback((ids: string[], updates: Partial<PreviewEntry>) => {
    dispatch({ type: 'BULK_UPDATE_ENTRIES', payload: { ids, updates } });
  }, []);

  // ==========================================================================
  // Commit
  // ==========================================================================

  const commitMigration = useCallback(async (): Promise<CommitResponse> => {
    dispatch({ type: 'COMMIT_START' });

    try {
      const data = await apiFetch<CommitResponse>('/api/migration/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: state.entries.map((e) => ({
            id: e.id,
            source_text: e.source_text,
            context: e.context,
            translations: e.translations,
            category: e.category || e.suggested_category,
            action: e.action || 'import',
          })),
          product_code: state.productCode || undefined,
          version: state.version || null,
        }),
      });

      dispatch({ type: 'COMMIT_SUCCESS' });
      return data;
    } catch (err: any) {
      dispatch({ type: 'COMMIT_ERROR', payload: err.message });
      throw err;
    }
  }, [state.entries, state.productCode, state.version]);

  // ==========================================================================
  // UI
  // ==========================================================================

  const showToast = useCallback(
    (message: string, type: ToastMessage['type'] = 'error') => {
      dispatch({ type: 'SHOW_TOAST', payload: { message, type } });
    },
    []
  );

  const hideToast = useCallback(() => {
    dispatch({ type: 'HIDE_TOAST' });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  // ==========================================================================
  // Reset
  // ==========================================================================

  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // ==========================================================================
  // Validation
  // ==========================================================================

  const canProceedToMapping = useCallback((): boolean => {
    return !!state.file && !!state.productCode;
  }, [state.file, state.productCode]);

  const canProceedToPreview = useCallback((): boolean => {
    return (
      !!state.file &&
      !!state.productCode &&
      isMappingComplete()
    );
  }, [state.file, state.productCode, isMappingComplete]);

  const canCommit = useCallback((): boolean => {
    return state.entries.length > 0 && state.entries.some((e) => e.action !== 'skip');
  }, [state.entries]);

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  const currentStepIndex = state.steps.indexOf(state.currentStep);
  const totalSteps = state.steps.length;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;
  const progressPercentage = ((currentStepIndex + 1) / totalSteps) * 100;

  // ==========================================================================
  // Context Value
  // ==========================================================================

  const value: MigrationContextType = {
    // State
    state,

    // Navigation
    nextStep,
    prevStep,
    goToStep,
    canGoToStep,
    isStepCompleted,

    // File handling
    parseFile,
    clearFile,
    validateFile,

    // Product selection
    setProductCode,

    // Version management
    setSelectedVersion,
    saveCurrentMapping,
    updateCurrentMapping,
    updateAllMappings,

    // Mapping helpers
    getMappedVersions,
    hasMappingForVersion,
    isMappingComplete,

    // Preview data
    loadPreview,
    updateEntry,
    updateEntriesBulk,

    // Commit
    commitMigration,

    // UI
    showToast,
    hideToast,
    setError,
    clearError,

    // Reset
    resetState,

    // Validation helpers
    canProceedToMapping,
    canProceedToPreview,
    canCommit,

    // Computed values
    currentStepIndex,
    totalSteps,
    isFirstStep,
    isLastStep,
    progressPercentage,
  };

  return (
    <MigrationContext.Provider value={value}>
      {children}
    </MigrationContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useMigration(): MigrationContextType {
  const context = useContext(MigrationContext);
  if (!context) {
    throw new Error('useMigration must be used within a MigrationProvider');
  }
  return context;
}

// =============================================================================
// Selectors (for optimized re-renders)
// =============================================================================

/** Hook to get only the current step */
export function useMigrationStep(): MigrationStep {
  const { state } = useMigration();
  return state.currentStep;
}

/** Hook to get only loading state */
export function useMigrationLoading(): boolean {
  const { state } = useMigration();
  return state.loading;
}

/** Hook to get only entries */
export function useMigrationEntries(): PreviewEntry[] {
  const { state } = useMigration();
  return state.entries;
}

/** Hook to get only summary */
export function useMigrationSummary(): MigrationSummary | null {
  const { state } = useMigration();
  return state.summary;
}

/** Hook to get file info */
export function useMigrationFile(): {
  file: File | null;
  fileName: string;
  fileSize: number;
  fileType: 'excel' | null;
} {
  const { state } = useMigration();
  return {
    file: state.file,
    fileName: state.fileName,
    fileSize: state.fileSize,
    fileType: state.fileType,
  };
}

/** Hook to get navigation actions only */
export function useMigrationNavigation() {
  const { nextStep, prevStep, goToStep, canGoToStep, isStepCompleted } = useMigration();
  return {
    nextStep,
    prevStep,
    goToStep,
    canGoToStep,
    isStepCompleted,
  };
}

// Default export
export default MigrationContext;

'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useEffect,
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
  // 중복 상태 필드
  existing_in_glossary: boolean;
  existing_in_translation: boolean;
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
  // 새로운 통계 구조
  duplicate_glossary: number;
  new_glossary_selected: number;
  duplicate_translation: number;
  new_translation: number;
  // 기존 필드 (하위 호환성)
  glossary_suggested?: number;
  translation_suggested?: number;
  exact_matches?: number;
  similar_matches?: number;
  new_entries?: number;
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

  // Selection state
  selectedIds: string[];

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

  selectedIds: [],

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
  // Selection
  | { type: 'TOGGLE_SELECTED'; payload: string }
  | { type: 'SELECT_ALL'; payload: string[] }
  | { type: 'CLEAR_SELECTED' }
  | { type: 'SET_SELECTED'; payload: string[] }
  // Persistence
  | { type: 'RESTORE_STATE'; payload: Partial<MigrationState> }

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
  // New mapping actions for unified API
  | { type: 'SET_MAPPING_FIELD'; payload: { version: string; field: string; value: unknown } }
  | { type: 'CLEAR_MAPPING_FIELD'; payload: { version: string; field: string } }
  | { type: 'SET_VERSION_MAPPING'; payload: { version: string; mapping: VersionMapping } }

  // Preview data
  | { type: 'LOAD_PREVIEW_START' }
  | { type: 'LOAD_PREVIEW_SUCCESS'; payload: { entries: PreviewEntry[]; versionEntries: VersionEntries; summary: MigrationSummary } }
  | { type: 'LOAD_PREVIEW_ERROR'; payload: string }
  | { type: 'UPDATE_ENTRY'; payload: { id: string; updates: Partial<PreviewEntry> } }
  | { type: 'BULK_UPDATE_ENTRIES'; payload: { ids: string[]; updates: Partial<PreviewEntry> } }
  | { type: 'DELETE_ENTRY'; payload: string }
  | { type: 'BULK_DELETE_ENTRIES'; payload: string[] }
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

    // New mapping actions for unified API
    case 'SET_MAPPING_FIELD': {
      const { version, field, value } = action.payload;
      const currentMapping = state.versionMappings[version] || initialState.currentMapping;
      let newMapping = { ...currentMapping };
      
      if (field === 'source') {
        newMapping.source = value as string | null;
      } else if (field === 'translations') {
        newMapping.translations = value as string[];
      } else if (field === 'metadata') {
        newMapping.metadata = value as Record<string, string>;
      } else if (field.startsWith('metadata.')) {
        const metaKey = field.replace('metadata.', '');
        newMapping.metadata = { ...currentMapping.metadata, [metaKey]: value as string };
      }
      
      return {
        ...state,
        versionMappings: {
          ...state.versionMappings,
          [version]: newMapping,
        },
        // Update currentMapping if it's the selected version
        ...(state.selectedVersion === version ? { currentMapping: newMapping } : {}),
      };
    }

    case 'CLEAR_MAPPING_FIELD': {
      const { version, field } = action.payload;
      const currentMapping = state.versionMappings[version] || initialState.currentMapping;
      let newMapping = { ...currentMapping };
      
      if (field === 'source') {
        newMapping.source = null;
      } else if (field === 'translations') {
        newMapping.translations = [];
      } else if (field === 'metadata') {
        newMapping.metadata = {};
      } else if (field.startsWith('metadata.')) {
        const metaKey = field.replace('metadata.', '');
        const newMetadata = { ...currentMapping.metadata };
        delete newMetadata[metaKey];
        newMapping.metadata = newMetadata;
      }
      
      return {
        ...state,
        versionMappings: {
          ...state.versionMappings,
          [version]: newMapping,
        },
        ...(state.selectedVersion === version ? { currentMapping: newMapping } : {}),
      };
    }

    case 'SET_VERSION_MAPPING': {
      const { version, mapping } = action.payload;
      return {
        ...state,
        versionMappings: {
          ...state.versionMappings,
          [version]: mapping,
        },
        ...(state.selectedVersion === version ? { currentMapping: mapping } : {}),
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

    case 'DELETE_ENTRY': {
      const idToDelete = action.payload;
      return {
        ...state,
        entries: state.entries.filter((e) => e.id !== idToDelete),
        versionEntries: Object.fromEntries(
          Object.entries(state.versionEntries).map(([version, entries]) => [
            version,
            entries.filter((e) => e.id !== idToDelete),
          ])
        ),
        selectedIds: state.selectedIds.filter((id) => id !== idToDelete),
      };
    }

    case 'BULK_DELETE_ENTRIES': {
      const idsToDelete = action.payload;
      return {
        ...state,
        entries: state.entries.filter((e) => !idsToDelete.includes(e.id)),
        versionEntries: Object.fromEntries(
          Object.entries(state.versionEntries).map(([version, entries]) => [
            version,
            entries.filter((e) => !idsToDelete.includes(e.id)),
          ])
        ),
        selectedIds: state.selectedIds.filter((id) => !idsToDelete.includes(id)),
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

    case 'RESTORE_STATE': {
      return {
        ...state,
        ...action.payload,
        // Don't restore file (File object can't be serialized)
        file: null,
        // Reset loading and error states
        loading: false,
        error: null,
      };
    }

    // Selection
    case 'TOGGLE_SELECTED': {
      const id = action.payload;
      const exists = state.selectedIds.includes(id);
      const newSelected = exists
        ? state.selectedIds.filter((sid) => sid !== id)
        : [...state.selectedIds, id];
      return { ...state, selectedIds: newSelected };
    }

    case 'SELECT_ALL': {
      return { ...state, selectedIds: action.payload };
    }

    case 'CLEAR_SELECTED': {
      return { ...state, selectedIds: [] };
    }

    case 'SET_SELECTED': {
      return { ...state, selectedIds: action.payload };
    }

    case 'RESET_STATE': {
      // Clear sessionStorage on reset
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('migration_state');
      }
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
  parseFile: (file: File | null) => Promise<void>;
  clearFile: () => void;
  validateFile: (file: File) => { valid: boolean; error?: string };

  // Product selection
  setProductCode: (code: ProductCode | '') => void;

  // Version management
  setSelectedVersion: (version: string) => void;
  saveCurrentMapping: () => void;
  updateCurrentMapping: (mapping: VersionMapping) => void;
  updateAllMappings: (mappings: VersionMappings) => void;
  
  // New unified mapping API (for FieldMapping)
  setMappingField: (version: string, field: string, value: unknown) => void;
  clearMappingField: (version: string, field: string) => void;
  setVersionMapping: (version: string, mapping: VersionMapping) => void;
  getMappingForVersion: (version: string) => VersionMapping;

  // Mapping helpers
  getMappedVersions: () => string[];
  hasMappingForVersion: (version: string) => boolean;
  isMappingComplete: (mapping?: VersionMapping) => boolean;

  // Preview data
  loadPreview: () => Promise<void>;
  updateEntry: (id: string, updates: Partial<PreviewEntry>) => void;
  updateEntriesBulk: (ids: string[], updates: Partial<PreviewEntry>) => void;
  deleteEntry: (id: string) => void;
  deleteEntries: (ids: string[]) => void;

  // Selection
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  clearSelected: () => void;

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

const STORAGE_KEY = 'migration_state';

export function MigrationProvider({ children }: MigrationProviderProps) {
  const [state, dispatch] = useReducer(migrationReducer, initialState);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // FIXED: AbortController ref for cancelling duplicate API calls in loadPreview
  const abortControllerRef = useRef<AbortController | null>(null);

  // ==========================================================================
  // Persistence - Restore from sessionStorage on mount
  // ==========================================================================
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        dispatch({ type: 'RESTORE_STATE', payload: parsed });
      }
    } catch (e) {
      console.error('Failed to restore migration state:', e);
    }
  }, []);

  // ==========================================================================
  // Persistence - Save to sessionStorage on state change
  // ==========================================================================
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      // Don't save file (can't be serialized) and transient states
      const { file, loading, error, toast, ...persistableState } = state;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistableState));
    } catch (e) {
      console.error('Failed to save migration state:', e);
    }
  }, [state]);

  // ==========================================================================
  // Warn before leaving page with unsaved progress
  // ==========================================================================
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Warn if user has made progress (completed upload step)
      if (state.completedSteps.upload && !state.completedSteps.previewCommit) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.completedSteps]);

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

  const parseFile = useCallback(async (file: File | null) => {
    // null이면 파일 제거
    if (!file) {
      dispatch({ type: 'CLEAR_FILE' });
      return;
    }

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

  // ==========================================================================
  // New Unified Mapping API (for FieldMapping)
  // ==========================================================================

  const setMappingField = useCallback((version: string, field: string, value: unknown) => {
    dispatch({ type: 'SET_MAPPING_FIELD', payload: { version, field, value } });
  }, []);

  const clearMappingField = useCallback((version: string, field: string) => {
    dispatch({ type: 'CLEAR_MAPPING_FIELD', payload: { version, field } });
  }, []);

  const setVersionMapping = useCallback((version: string, mapping: VersionMapping) => {
    dispatch({ type: 'SET_VERSION_MAPPING', payload: { version, mapping } });
  }, []);

  const getMappingForVersion = useCallback((version: string): VersionMapping => {
    return state.versionMappings[version] || initialState.currentMapping;
  }, [state.versionMappings]);

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
    // versionMappings에서 현재 선택된 버전의 매핑을 가져옴
    const selectedVersion = state.selectedVersion;
    const versionMapping = selectedVersion ? state.versionMappings[selectedVersion] : null;
    const m = mapping || versionMapping || state.currentMapping;
    
    const hasSource = !!m.source;
    const hasProductCategory = !!m.metadata.product_category;
    // 번역은 필수가 아님 - 원문과 제품분류만 필수
    
    console.log('[isMappingComplete] Checking:', {
      selectedVersion,
      hasSource,
      hasProductCategory,
      source: m.source,
      metadata: m.metadata,
      product_category: m.metadata.product_category,
      versionMapping,
      currentMapping: state.currentMapping,
    });
    
    return hasSource && hasProductCategory;
  }, [state.currentMapping, state.selectedVersion, state.versionMappings]);

  // ==========================================================================
  // Preview Data
  // ==========================================================================

  const loadPreview = useCallback(async () => {
    // FIXED: Cancel previous API call if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

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
        duplicate_glossary: 0,
        new_glossary_selected: 0,
        duplicate_translation: 0,
        new_translation: 0,
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

          console.log(`[loadPreview] ${versionName} - entries count:`, previewData.entries.length);
          console.log(`[loadPreview] ${versionName} - first entry:`, previewData.entries[0]);
          console.log(`[loadPreview] ${versionName} - first entry translations:`, previewData.entries[0]?.translations);

          const initEntries = previewData.entries.map((e) => ({
            ...e,
            version: versionName,
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

      // FIXED: Check if all API calls failed and show error
      const successfulResults = results.filter((r): r is NonNullable<typeof r> => r !== null);
      if (successfulResults.length === 0) {
        dispatch({ 
          type: 'LOAD_PREVIEW_ERROR', 
          payload: '모든 버전의 미리보기 데이터를 불러오는데 실패했습니다.' 
        });
        return;
      }

      results.forEach((result) => {
        if (result) {
          allVersionEntries[result.versionName] = result.entries;
          totalSummary.total += result.summary.total;
          // 새 필드가 있으면 사용, 없으면 기존 필드에서 변환
          totalSummary.duplicate_glossary += result.summary.duplicate_glossary ?? 0;
          totalSummary.new_glossary_selected += result.summary.new_glossary_selected ?? 0;
          totalSummary.duplicate_translation += result.summary.duplicate_translation ?? 0;
          totalSummary.new_translation += result.summary.new_translation ?? 0;
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

  const deleteEntry = useCallback((id: string) => {
    dispatch({ type: 'DELETE_ENTRY', payload: id });
  }, []);

  const deleteEntries = useCallback((ids: string[]) => {
    dispatch({ type: 'BULK_DELETE_ENTRIES', payload: ids });
  }, []);

  // ==========================================================================
  // Selection
  // ==========================================================================

  const toggleSelected = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_SELECTED', payload: id });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = state.entries.map((e) => e.id);
    dispatch({ type: 'SELECT_ALL', payload: allIds });
  }, [state.entries]);

  const clearSelected = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTED' });
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
    const hasFile = !!state.file;
    const hasProduct = !!state.productCode;
    
    // versionMappings에서 현재 선택된 버전의 매핑을 직접 확인
    const selectedVersion = state.selectedVersion;
    const versionMapping = selectedVersion ? state.versionMappings[selectedVersion] : null;
    const m = versionMapping || state.currentMapping;
    
    const hasSource = !!m.source;
    const hasProductCategory = !!m.metadata.product_category;
    // 번역은 필수가 아님 - 원문과 제품분류만 필수
    const mappingComplete = hasSource && hasProductCategory;
    
    // 디버깅: 어떤 필드가 누락되었는지 확인
    if (!mappingComplete && hasFile && hasProduct) {
      const missing = [];
      if (!hasSource) missing.push('원문(source)');
      if (!hasProductCategory) missing.push('제품분류(product_category)');
      console.log('[canProceedToPreview] 매핑 누락:', missing.join(', '));
      console.log('[canProceedToPreview] selectedVersion:', selectedVersion);
      console.log('[canProceedToPreview] versionMapping:', versionMapping);
      console.log('[canProceedToPreview] currentMapping:', state.currentMapping);
    }
    
    return hasFile && hasProduct && mappingComplete;
  }, [state.file, state.productCode, state.selectedVersion, state.versionMappings, state.currentMapping]);

  const canCommit = useCallback((): boolean => {
    return state.entries.length > 0;
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
    
    // New unified mapping API
    setMappingField,
    clearMappingField,
    setVersionMapping,
    getMappingForVersion,

    // Mapping helpers
    getMappedVersions,
    hasMappingForVersion,
    isMappingComplete,

    // Preview data
    loadPreview,
    updateEntry,
    updateEntriesBulk,
    deleteEntry,
    deleteEntries,

    // Selection
    toggleSelected,
    selectAll,
    clearSelected,

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

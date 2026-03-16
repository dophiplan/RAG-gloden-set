/**
 * Configuration Module
 * 
 * 중앙화된 설정 관리 모듈
 */

// Feature Flag System
export {
  // Types
  type FeatureFlag,
  type FeatureFlagConfig,
  
  // Constants
  FEATURE_FLAGS,
  
  // Core Functions
  isEnabled,
  isEnabledForUser,
  getAllFlags,
  
  // Admin Functions
  setFlag,
  resetFlag,
  resetAllFlags,
  getLastStateChangeAt,
  getRuntimeFlags,
  
  // Safety Functions
  areAllFlagsDisabled,
  getEnabledFlags,
  isValidFlag,
  
  // Client Functions
  fetchFeatureFlags,
} from './feature_flags';

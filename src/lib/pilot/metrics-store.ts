/**
 * Pilot Metrics Store
 * 
 * Shadow Mode와 Dark Launch 메트릭을 저장하는 인메모리 저장소
 */

export interface ShadowModeMetric {
  match: boolean;
  error: boolean;
  timestamp?: number;
}

export interface DarkLaunchMetric {
  match: boolean;
  legacyDuration?: number;
  providerDuration?: number;
  providerError?: boolean;
  timestamp?: number;
}

export interface DualWriteMetric {
  legacySuccess: boolean;
  providerSuccess: boolean;
  requiresRecovery: boolean;
  duration: number;
  timestamp?: number;
}

export interface PilotMetrics {
  timestamp: string;
  shadowMode: {
    totalOperations: number;
    matchCount: number;
    mismatchCount: number;
    errorCount: number;
  };
  darkLaunch: {
    totalOperations: number;
    matchCount: number;
    mismatchCount: number;
    errorCount: number;
    avgLegacyDuration: number;
    avgProviderDuration: number;
  };
  dualWrite: {
    totalOperations: number;
    legacySuccessCount: number;
    providerSuccessCount: number;
    recoveryRequiredCount: number;
    avgDuration: number;
  };
  fullCutover?: {
    fallbackCount: number;
  };
}

// 인메모리 메트릭 저장소
const metricsStore: {
  shadowMode: {
    totalOperations: number;
    matchCount: number;
    mismatchCount: number;
    errorCount: number;
  };
  darkLaunch: {
    totalOperations: number;
    matchCount: number;
    mismatchCount: number;
    errorCount: number;
    legacyDurations: number[];
    providerDurations: number[];
  };
  dualWrite: {
    totalOperations: number;
    legacySuccessCount: number;
    providerSuccessCount: number;
    recoveryRequiredCount: number;
    totalDuration: number;
  };
} = {
  shadowMode: {
    totalOperations: 0,
    matchCount: 0,
    mismatchCount: 0,
    errorCount: 0,
  },
  darkLaunch: {
    totalOperations: 0,
    matchCount: 0,
    mismatchCount: 0,
    errorCount: 0,
    legacyDurations: [],
    providerDurations: [],
  },
  dualWrite: {
    totalOperations: 0,
    legacySuccessCount: 0,
    providerSuccessCount: 0,
    recoveryRequiredCount: 0,
    totalDuration: 0,
  },
};

/**
 * Shadow Mode 메트릭 기록
 */
export function recordShadowModeMetric(metric: ShadowModeMetric): void {
  metricsStore.shadowMode.totalOperations++;
  
  if (metric.error) {
    metricsStore.shadowMode.errorCount++;
  } else if (metric.match) {
    metricsStore.shadowMode.matchCount++;
  } else {
    metricsStore.shadowMode.mismatchCount++;
  }
}

/**
 * Dark Launch 메트릭 기록
 */
export function recordDarkLaunchMetric(metric: DarkLaunchMetric): void {
  metricsStore.darkLaunch.totalOperations++;
  
  if (metric.providerError) {
    metricsStore.darkLaunch.errorCount++;
  } else if (metric.match) {
    metricsStore.darkLaunch.matchCount++;
  } else {
    metricsStore.darkLaunch.mismatchCount++;
  }
  
  if (metric.legacyDuration !== undefined) {
    metricsStore.darkLaunch.legacyDurations.push(metric.legacyDuration);
    // 최근 100개만 유지
    if (metricsStore.darkLaunch.legacyDurations.length > 100) {
      metricsStore.darkLaunch.legacyDurations.shift();
    }
  }
  
  if (metric.providerDuration !== undefined) {
    metricsStore.darkLaunch.providerDurations.push(metric.providerDuration);
    // 최근 100개만 유지
    if (metricsStore.darkLaunch.providerDurations.length > 100) {
      metricsStore.darkLaunch.providerDurations.shift();
    }
  }
}

/**
 * 평균 계산
 */
function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Dual Write 메트릭 기록
 */
export function recordDualWriteMetric(metric: DualWriteMetric): void {
  metricsStore.dualWrite.totalOperations++;
  metricsStore.dualWrite.totalDuration += metric.duration;
  
  if (metric.legacySuccess) {
    metricsStore.dualWrite.legacySuccessCount++;
  }
  if (metric.providerSuccess) {
    metricsStore.dualWrite.providerSuccessCount++;
  }
  if (metric.requiresRecovery) {
    metricsStore.dualWrite.recoveryRequiredCount++;
  }
}

/**
 * 메트릭 조회
 */
export function getMetrics(): PilotMetrics {
  return {
    timestamp: new Date().toISOString(),
    shadowMode: {
      totalOperations: metricsStore.shadowMode.totalOperations,
      matchCount: metricsStore.shadowMode.matchCount,
      mismatchCount: metricsStore.shadowMode.mismatchCount,
      errorCount: metricsStore.shadowMode.errorCount,
    },
    darkLaunch: {
      totalOperations: metricsStore.darkLaunch.totalOperations,
      matchCount: metricsStore.darkLaunch.matchCount,
      mismatchCount: metricsStore.darkLaunch.mismatchCount,
      errorCount: metricsStore.darkLaunch.errorCount,
      avgLegacyDuration: calculateAverage(metricsStore.darkLaunch.legacyDurations),
      avgProviderDuration: calculateAverage(metricsStore.darkLaunch.providerDurations),
    },
    dualWrite: {
      totalOperations: metricsStore.dualWrite.totalOperations,
      legacySuccessCount: metricsStore.dualWrite.legacySuccessCount,
      providerSuccessCount: metricsStore.dualWrite.providerSuccessCount,
      recoveryRequiredCount: metricsStore.dualWrite.recoveryRequiredCount,
      avgDuration: metricsStore.dualWrite.totalOperations > 0 
        ? Math.round(metricsStore.dualWrite.totalDuration / metricsStore.dualWrite.totalOperations)
        : 0,
    },
  };
}

/**
 * 메트릭 초기화
 */
export function resetMetrics(): void {
  metricsStore.shadowMode = {
    totalOperations: 0,
    matchCount: 0,
    mismatchCount: 0,
    errorCount: 0,
  };
  metricsStore.darkLaunch = {
    totalOperations: 0,
    matchCount: 0,
    mismatchCount: 0,
    errorCount: 0,
    legacyDurations: [],
    providerDurations: [],
  };
  metricsStore.dualWrite = {
    totalOperations: 0,
    legacySuccessCount: 0,
    providerSuccessCount: 0,
    recoveryRequiredCount: 0,
    totalDuration: 0,
  };
}

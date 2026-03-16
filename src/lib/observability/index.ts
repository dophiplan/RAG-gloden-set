/**
 * Observability Module
 * 
 * 로깅, 메트릭, 트레이싱을 통합 제공하는 모듈
 * 
 * @example
 * ```typescript
 * import { logger, metrics, withMetrics, getContextLogger } from '@/lib/observability';
 * ```
 */

// Logger
export {
  StructuredLogger,
  logger,
  runWithRequestContext,
  getRequestContext,
  getContextLogger,
  generateRequestId,
  extractContextFromRequest,
  type LogContext,
  type LogEntry,
  type LogLevel,
  type LoggerOptions,
} from './logger';

// Metrics
export {
  MetricsCollector,
  metrics,
  timed,
  counted,
  type MetricValue,
  type CounterMetric,
  type HistogramMetric,
  type GaugeMetric,
} from './metrics';

// Repository Wrapper
export {
  withMetrics,
  withMetricsAdvanced,
  withBatchMetrics,
  createInstrumentedRepository,
  instrumentQuery,
  type RepositoryMetricsOptions,
  type RepositoryConstructor,
} from './repository_wrapper';

// API Helpers
export {
  withApiInstrumentation,
  createRepository,
  measure,
  getPerformanceReport,
  trackError,
  getErrorReport,
  type ApiInstrumentationOptions,
  type ApiHandler,
} from './api_helpers';

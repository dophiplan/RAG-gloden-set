/**
 * Metrics Collector
 * 
 * Prometheus 형식의 메트릭 수집 및 노출
 * 
 * @example
 * ```typescript
 * const metrics = new MetricsCollector();
 * metrics.recordApiLatency('/api/translations', 'GET', 150, 200);
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface CounterMetric {
  type: 'counter';
  name: string;
  help: string;
  values: Map<string, number>; // key: labels hash, value: count
  labelNames: string[];
}

export interface HistogramMetric {
  type: 'histogram';
  name: string;
  help: string;
  buckets: number[];
  values: Map<string, { count: number; sum: number; buckets: number[] }>;
  labelNames: string[];
}

export interface GaugeMetric {
  type: 'gauge';
  name: string;
  help: string;
  values: Map<string, number>;
  labelNames: string[];
}

type Metric = CounterMetric | HistogramMetric | GaugeMetric;

// ============================================================================
// Default Buckets (Prometheus 기본값과 유사)
// ============================================================================

const DEFAULT_LATENCY_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

// ============================================================================
// Metrics Collector
// ============================================================================

export class MetricsCollector {
  private metrics: Map<string, Metric> = new Map();
  private enabled: boolean;

  constructor() {
    this.enabled = process.env.ENABLE_METRICS !== 'false';
    this.initializeDefaultMetrics();
  }

  /**
   * 메트릭 수집 활성화 여부
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 기본 메트릭 초기화
   */
  private initializeDefaultMetrics(): void {
    // DB 쿼리 지연 시간
    this.registerHistogram('db_query_duration_ms', 'Database query duration in milliseconds', ['provider', 'table', 'operation'], DEFAULT_LATENCY_BUCKETS);
    
    // DB 쿼리 에러
    this.registerCounter('db_query_errors_total', 'Total number of database query errors', ['provider', 'table', 'error']);
    
    // API 지연 시간
    this.registerHistogram('api_latency_ms', 'API endpoint latency in milliseconds', ['path', 'method', 'status_code'], DEFAULT_LATENCY_BUCKETS);
    
    // API 요청 수
    this.registerCounter('api_requests_total', 'Total number of API requests', ['path', 'method', 'status_code']);
    
    // 비즈니스 메트릭: 번역 생성
    this.registerCounter('translations_created_total', 'Total number of translations created', ['source']);
    
    // 비즈니스 메트릭: 용어집 히트
    this.registerCounter('glossary_hits_total', 'Total number of glossary term hits', []);
    
    // 비즈니스 메트릭: 용어집 생성
    this.registerCounter('glossary_created_total', 'Total number of glossary entries created', []);
    
    // 비즈니스 메트릭: AI 번역
    this.registerCounter('ai_translations_total', 'Total number of AI translations', ['provider', 'status']);
    
    // 활성 세션 (게이지)
    this.registerGauge('active_sessions', 'Number of active user sessions', []);
    
    // 에러율
    this.registerCounter('errors_total', 'Total number of errors', ['type', 'component']);
  }

  /**
   * 레이블 해시 생성
   */
  private hashLabels(labels: Record<string, string>): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }

  /**
   * Counter 등록
   */
  registerCounter(name: string, help: string, labelNames: string[]): CounterMetric {
    const metric: CounterMetric = {
      type: 'counter',
      name,
      help,
      values: new Map(),
      labelNames,
    };
    this.metrics.set(name, metric);
    return metric;
  }

  /**
   * Histogram 등록
   */
  registerHistogram(name: string, help: string, labelNames: string[], buckets: number[] = DEFAULT_LATENCY_BUCKETS): HistogramMetric {
    const metric: HistogramMetric = {
      type: 'histogram',
      name,
      help,
      buckets,
      values: new Map(),
      labelNames,
    };
    this.metrics.set(name, metric);
    return metric;
  }

  /**
   * Gauge 등록
   */
  registerGauge(name: string, help: string, labelNames: string[]): GaugeMetric {
    const metric: GaugeMetric = {
      type: 'gauge',
      name,
      help,
      values: new Map(),
      labelNames,
    };
    this.metrics.set(name, metric);
    return metric;
  }

  /**
   * Counter 증가
   */
  increment(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    if (!this.enabled) return;

    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'counter') {
      console.warn(`Counter metric '${name}' not found`);
      return;
    }

    const key = this.hashLabels(labels);
    const current = metric.values.get(key) || 0;
    metric.values.set(key, current + value);
  }

  /**
   * Histogram 관찰값 기록
   */
  observe(name: string, labels: Record<string, string> = {}, value: number): void {
    if (!this.enabled) return;

    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'histogram') {
      console.warn(`Histogram metric '${name}' not found`);
      return;
    }

    const key = this.hashLabels(labels);
    let current = metric.values.get(key);

    if (!current) {
      current = {
        count: 0,
        sum: 0,
        buckets: new Array(metric.buckets.length).fill(0),
      };
      metric.values.set(key, current);
    }

    current.count += 1;
    current.sum += value;

    // 버킷 카운트 증가
    for (let i = 0; i < metric.buckets.length; i++) {
      if (value <= metric.buckets[i]) {
        current.buckets[i] += 1;
      }
    }
  }

  /**
   * Gauge 값 설정
   */
  setGauge(name: string, labels: Record<string, string> = {}, value: number): void {
    if (!this.enabled) return;

    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') {
      console.warn(`Gauge metric '${name}' not found`);
      return;
    }

    const key = this.hashLabels(labels);
    metric.values.set(key, value);
  }

  /**
   * Gauge 값 증가
   */
  incrementGauge(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    if (!this.enabled) return;

    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') {
      console.warn(`Gauge metric '${name}' not found`);
      return;
    }

    const key = this.hashLabels(labels);
    const current = metric.values.get(key) || 0;
    metric.values.set(key, current + value);
  }

  /**
   * Gauge 값 감소
   */
  decrementGauge(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    this.incrementGauge(name, labels, -value);
  }

  // ============================================================================
  // Predefined Metric Methods
  // ============================================================================

  /**
   * DB 쿼리 지연 시간 기록
   */
  recordQueryDuration(provider: string, table: string, duration: number, operation: string = 'query'): void {
    this.observe('db_query_duration_ms', { provider, table, operation }, duration);
  }

  /**
   * DB 쿼리 에러 기록
   */
  recordQueryError(provider: string, table: string, error: string): void {
    this.increment('db_query_errors_total', { provider, table, error: error.substring(0, 50) });
  }

  /**
   * API 지연 시간 기록
   */
  recordApiLatency(path: string, method: string, duration: number, statusCode: number): void {
    const statusBucket = Math.floor(statusCode / 100) + 'xx';
    this.observe('api_latency_ms', { path, method, status_code: String(statusCode) }, duration);
    this.increment('api_requests_total', { path, method, status_code: statusBucket });
  }

  /**
   * 번역 생성 기록
   */
  recordTranslationCreated(count: number = 1, source: string = 'manual'): void {
    this.increment('translations_created_total', { source }, count);
  }

  /**
   * 용어집 히트 기록
   */
  recordGlossaryHit(count: number = 1): void {
    this.increment('glossary_hits_total', {}, count);
  }

  /**
   * 용어집 생성 기록
   */
  recordGlossaryCreated(count: number = 1): void {
    this.increment('glossary_created_total', {}, count);
  }

  /**
   * AI 번역 기록
   */
  recordAiTranslation(provider: string, success: boolean): void {
    this.increment('ai_translations_total', { 
      provider, 
      status: success ? 'success' : 'error' 
    });
  }

  /**
   * 에러 기록
   */
  recordError(type: string, component: string): void {
    this.increment('errors_total', { type, component });
  }

  // ============================================================================
  // Prometheus Format Export
  // ============================================================================

  /**
   * Prometheus 형식으로 메트릭 내보내기
   */
  toPrometheusFormat(): string {
    const lines: string[] = [];
    const timestamp = Date.now();

    for (const metric of this.metrics.values()) {
      // Help line
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      // Type line
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      if (metric.type === 'counter') {
        for (const [labels, value] of metric.values) {
          const labelStr = labels ? `{${labels}}` : '';
          lines.push(`${metric.name}${labelStr} ${value} ${timestamp}`);
        }
      } else if (metric.type === 'gauge') {
        for (const [labels, value] of metric.values) {
          const labelStr = labels ? `{${labels}}` : '';
          lines.push(`${metric.name}${labelStr} ${value} ${timestamp}`);
        }
      } else if (metric.type === 'histogram') {
        for (const [labels, data] of metric.values) {
          const labelPrefix = labels ? `${labels},` : '';
          
          // 버킷 카운트
          for (let i = 0; i < metric.buckets.length; i++) {
            lines.push(`${metric.name}_bucket{${labelPrefix}le="${metric.buckets[i]}"} ${data.buckets[i]} ${timestamp}`);
          }
          // +Inf 버킷
          lines.push(`${metric.name}_bucket{${labelPrefix}le="+Inf"} ${data.count} ${timestamp}`);
          // 합계
          lines.push(`${metric.name}_sum{${labels ? `{${labels}}` : ''}} ${data.sum} ${timestamp}`);
          // 카운트
          lines.push(`${metric.name}_count{${labels ? `{${labels}}` : ''}} ${data.count} ${timestamp}`);
        }
      }

      lines.push(''); // 빈 줄
    }

    return lines.join('\n');
  }

  /**
   * JSON 형식으로 메트릭 내보내기
   */
  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [name, metric] of this.metrics) {
      if (metric.type === 'counter' || metric.type === 'gauge') {
        result[name] = Object.fromEntries(metric.values);
      } else if (metric.type === 'histogram') {
        result[name] = Object.fromEntries(
          Array.from(metric.values).map(([k, v]) => [k, v])
        );
      }
    }

    return result;
  }

  /**
   * 메트릭 초기화 (테스트용)
   */
  reset(): void {
    this.metrics.clear();
    this.initializeDefaultMetrics();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const metrics = new MetricsCollector();

// ============================================================================
// Decorator for Automatic Metrics Collection
// ============================================================================

/**
 * 메서드 실행 시간 측정 데코레이터
 * 
 * @example
 * ```typescript
 * class MyService {
 *   @timed('my_operation')
 *   async doSomething() {
 *     // ...
 *   }
 * }
 * ```
 */
export function timed(metricName: string, labels?: Record<string, string | ((...args: unknown[]) => string)>) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const start = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        return result;
      } finally {
        const duration = Date.now() - start;
        
        // 동적 라벨 처리
        const resolvedLabels: Record<string, string> = {};
        if (labels) {
          for (const [key, value] of Object.entries(labels)) {
            resolvedLabels[key] = typeof value === 'function' ? value(...args) : value;
          }
        }
        
        metrics.observe(metricName, resolvedLabels, duration);
      }
    };

    return descriptor;
  };
}

/**
 * 카운터 증가 데코레이터
 * 
 * @example
 * ```typescript
 * class MyService {
 *   @counted('operations_total')
 *   async doSomething() {
 *     // ...
 *   }
 * }
 * ```
 */
export function counted(metricName: string, labels?: Record<string, string>) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      metrics.increment(metricName, labels);
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

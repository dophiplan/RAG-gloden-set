/**
 * Structured Logging System
 * 
 * 개발: 콘솔 pretty print
 * 프로덕션: JSON (Vercel Logs, Datadog 등 연동)
 * 
 * @example
 * ```typescript
 * const logger = new StructuredLogger({ component: 'TranslationService' });
 * logger.info('Translation created', { requestId: '123', userId: 'user-1', path: '/api/translations' });
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  /** 요청 ID (추적용) */
  requestId?: string;
  /** 사용자 ID */
  userId?: string;
  /** 요청 경로 */
  path?: string;
  /** HTTP 메서드 */
  method?: string;
  /** 실행 시간 (ms) */
  duration?: number;
  /** 상태 코드 */
  statusCode?: number;
  /** 추가 컨텍스트 */
  [key: string]: unknown;
}

export interface LogEntry {
  /** 타임스탬프 (ISO 8601) */
  timestamp: string;
  /** 로그 레벨 */
  level: LogLevel;
  /** 로그 메시지 */
  message: string;
  /** 컴포넌트/서비스 이름 */
  component?: string;
  /** 컨텍스트 정보 */
  context?: LogContext;
  /** 에러 정보 */
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string | number;
  };
  /** 환경 정보 */
  environment?: {
    nodeEnv: string;
    version: string;
  };
}

export interface LoggerOptions {
  /** 컴포넌트/서비스 이름 */
  component?: string;
  /** 최소 로그 레벨 */
  minLevel?: LogLevel;
  /** 컨텍스트 추가 (모든 로그에 포함) */
  baseContext?: Partial<LogContext>;
}

// ============================================================================
// Configuration
// ============================================================================

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const getMinLogLevel = (): LogLevel => {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
  if (envLevel && LOG_LEVEL_PRIORITY[envLevel] !== undefined) {
    return envLevel;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
};

const isDevelopment = (): boolean => {
  return process.env.NODE_ENV !== 'production';
};

// ============================================================================
// Pretty Print Formatter (Development)
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: COLORS.cyan,
  info: COLORS.green,
  warn: COLORS.yellow,
  error: COLORS.red,
};

function formatPretty(entry: LogEntry): string {
  const timestamp = new Date(entry.timestamp).toLocaleTimeString('ko-KR', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const levelColor = LEVEL_COLORS[entry.level];
  const levelStr = entry.level.toUpperCase().padStart(5);

  let output = `${COLORS.dim}[${timestamp}]${COLORS.reset} ${levelColor}${levelStr}${COLORS.reset}`;

  if (entry.component) {
    output += ` ${COLORS.magenta}[${entry.component}]${COLORS.reset}`;
  }

  output += ` ${entry.message}`;

  // Context
  if (entry.context && Object.keys(entry.context).length > 0) {
    const ctx = { ...entry.context };
    const parts: string[] = [];

    if (ctx.requestId) {
      parts.push(`${COLORS.dim}req=${ctx.requestId}${COLORS.reset}`);
      delete ctx.requestId;
    }
    if (ctx.userId) {
      parts.push(`${COLORS.dim}user=${ctx.userId}${COLORS.reset}`);
      delete ctx.userId;
    }
    if (ctx.duration !== undefined) {
      const durationColor = ctx.duration > 1000 ? COLORS.yellow : COLORS.dim;
      parts.push(`${durationColor}${ctx.duration}ms${COLORS.reset}`);
      delete ctx.duration;
    }
    if (ctx.statusCode) {
      const statusColor = ctx.statusCode >= 400 ? COLORS.red : COLORS.green;
      parts.push(`${statusColor}${ctx.statusCode}${COLORS.reset}`);
      delete ctx.statusCode;
    }

    // 남은 컨텍스트
    const remainingKeys = Object.keys(ctx);
    if (remainingKeys.length > 0) {
      parts.push(
        COLORS.dim +
        remainingKeys.map((k) => `${k}=${JSON.stringify(ctx[k])}`).join(' ') +
        COLORS.reset
      );
    }

    if (parts.length > 0) {
      output += ' ' + parts.join(' ');
    }
  }

  // Error
  if (entry.error) {
    output += `\n  ${COLORS.red}→ ${entry.error.name}: ${entry.error.message}${COLORS.reset}`;
    if (entry.error.stack && isDevelopment()) {
      const stackLines = entry.error.stack.split('\n').slice(1, 4);
      output += '\n' + stackLines.map((line) => `    ${COLORS.dim}${line.trim()}${COLORS.reset}`).join('\n');
    }
  }

  return output;
}

// ============================================================================
// Structured Logger
// ============================================================================

export class StructuredLogger {
  private component?: string;
  private minLevel: LogLevel;
  private baseContext: Partial<LogContext>;

  constructor(options: LoggerOptions = {}) {
    this.component = options.component;
    this.minLevel = options.minLevel || getMinLogLevel();
    this.baseContext = options.baseContext || {};
  }

  /**
   * 자식 로거 생성 (컴포넌트 상속)
   */
  child(additionalContext: Partial<LogContext>): StructuredLogger {
    return new StructuredLogger({
      component: this.component,
      minLevel: this.minLevel,
      baseContext: { ...this.baseContext, ...additionalContext },
    });
  }

  /**
   * 로그 레벨 확인
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  /**
   * 로그 출력
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component: this.component,
      context: { ...this.baseContext, ...context },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || 'unknown',
      },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    if (isDevelopment()) {
      // 개발: Pretty print
      const output = formatPretty(entry);
      const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      consoleMethod(output);
    } else {
      // 프로덕션: JSON
      console.log(JSON.stringify(entry));
    }
  }

  /**
   * Debug 로그
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Info 로그
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Warning 로그
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Error 로그
   */
  error(message: string, error: Error, context?: LogContext): void {
    this.log('error', message, context, error);
  }

  /**
   * 요청 시작 로그
   */
  logRequest(method: string, path: string, context?: LogContext): void {
    this.info('Request started', {
      method,
      path,
      ...context,
    });
  }

  /**
   * 요청 완료 로그
   */
  logResponse(method: string, path: string, statusCode: number, duration: number, context?: LogContext): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this.log(level, 'Request completed', {
      method,
      path,
      statusCode,
      duration,
      ...context,
    });
  }

  /**
   * DB 쿼리 로그
   */
  logQuery(operation: string, table: string, duration: number, context?: LogContext): void {
    this.debug('Database query', {
      operation,
      table,
      duration,
      ...context,
    });
  }

  /**
   * DB 쿼리 에러 로그
   */
  logQueryError(operation: string, table: string, error: Error, context?: LogContext): void {
    this.error('Database query failed', error, {
      operation,
      table,
      ...context,
    });
  }
}

// ============================================================================
// Default Logger Instance
// ============================================================================

export const logger = new StructuredLogger({ component: 'App' });

// ============================================================================
// Request Context Logger (AsyncLocalStorage 기반)
// ============================================================================

import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  requestId: string;
  userId?: string;
  path?: string;
  method?: string;
  startTime: number;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * 요청 컨텍스트 설정
 */
export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  return asyncLocalStorage.run(context, callback);
}

/**
 * 현재 요청 컨텍스트 가져오기
 */
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * 요청 컨텍스트가 포함된 로거 가져오기
 */
export function getContextLogger(component?: string): StructuredLogger {
  const context = getRequestContext();
  const baseContext: Partial<LogContext> = context
    ? {
        requestId: context.requestId,
        userId: context.userId,
        path: context.path,
        method: context.method,
      }
    : {};

  return new StructuredLogger({
    component,
    baseContext,
  });
}

// ============================================================================
// Express/Next.js Middleware Helper
// ============================================================================

import { NextRequest } from 'next/server';

/**
 * 요청 ID 생성
 */
export function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Next.js Request에서 컨텍스트 추출
 */
export function extractContextFromRequest(request: NextRequest): Partial<LogContext> {
  return {
    path: request.nextUrl.pathname,
    method: request.method,
    requestId: request.headers.get('x-request-id') || generateRequestId(),
    userId: request.headers.get('x-user-id') || undefined,
  };
}

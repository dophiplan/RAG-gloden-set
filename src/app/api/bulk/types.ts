import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Bulk API 공통 타입 정의
 */

export interface User {
  id: string;
  email: string;
}

export type BulkHandler = (
  request: NextRequest,
  user: User,
  adminClient: SupabaseClient
) => Promise<NextResponse>;

export type HandlerRegistry = Record<string, BulkHandler>;

export interface BulkRequest<T = unknown> {
  ids: string[];
  data?: T;
  [key: string]: unknown;
}

export interface BulkResponse {
  success: boolean;
  message: string;
  [key: string]: unknown;
}

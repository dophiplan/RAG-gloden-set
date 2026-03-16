import { NextRequest, NextResponse } from 'next/server';
import { getMetrics } from '@/lib/pilot/metrics-store';

/**
 * GET /api/admin/pilot-metrics
 * 
 * Shadow Mode와 Dark Launch 메트릭 조회
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const storeMetrics = getMetrics();

    // 진행 상황 (고정값 - migration-progress.json 기반)
    const progress = {
      totalEndpoints: 5,
      migrated: 1,      // POST /api/users (Shadow Mode)
      darkLaunched: 3,  // GET endpoints
      pending: 1,       // PUT /api/users/:id
    };

    const metrics = {
      timestamp: storeMetrics.timestamp,
      
      shadowMode: {
        enabled: process.env.FF_USERS_SHADOW_MODE === 'true',
        ...storeMetrics.shadowMode,
      },
      
      darkLaunch: {
        enabled: process.env.FF_USERS_DARK_LAUNCH === 'true',
        ...storeMetrics.darkLaunch,
      },
      
      dualWrite: {
        enabled: process.env.FF_USERS_DUAL_WRITE === 'true',
        ...storeMetrics.dualWrite,
      },
      
      fullCutover: {
        enabled: process.env.FF_USERS_FULL_CUTOVER === 'true',
        fallbackCount: storeMetrics.fullCutover?.fallbackCount || 0,
      },
      
      progress,
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('[PilotMetrics] Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pilot metrics' },
      { status: 500 }
    );
  }
}

import { createClient } from '@/lib/supabase/server';

export interface RateLimitConfig {
  requests: number; // Max requests allowed
  window: number; // Time window in seconds
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Timestamp when the limit resets
}

// Rate limit configurations by action type
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // AI translation limits (expensive operations)
  ai_translation: { requests: 100, window: 3600 }, // 100 per hour
  ai_translation_bulk: { requests: 50, window: 3600 }, // 50 per hour

  // Bulk operations
  bulk_create: { requests: 50, window: 3600 }, // 50 per hour
  bulk_update: { requests: 100, window: 3600 }, // 100 per hour

  // API operations
  api_create: { requests: 200, window: 3600 }, // 200 per hour
  api_update: { requests: 300, window: 3600 }, // 300 per hour

  // Glossary operations
  glossary_create: { requests: 100, window: 3600 }, // 100 per hour
  glossary_bulk: { requests: 50, window: 3600 }, // 50 per hour
};

/**
 * Check rate limit for a user action using database-backed tracking
 * This ensures rate limits work across multiple server instances
 */
export async function checkRateLimit(
  userId: string,
  action: string,
  config?: RateLimitConfig
): Promise<RateLimitResult> {
  const limit = config || RATE_LIMITS[action];

  if (!limit) {
    // No rate limit configured for this action
    return {
      allowed: true,
      limit: Infinity,
      remaining: Infinity,
      reset: 0,
    };
  }

  try {
    const supabase = await createClient();
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - limit.window;

    // Check if rate_limits table exists, create if not
    const { error: tableError } = await supabase
      .from('rate_limits')
      .select('id')
      .limit(1);

    // If table doesn't exist, allow request (table will be created by migration)
    if (tableError?.code === '42P01') {
      console.warn('Rate limits table not found, allowing request');
      return {
        allowed: true,
        limit: limit.requests,
        remaining: limit.requests - 1,
        reset: now + limit.window,
      };
    }

    // Clean up old entries for this user and action
    await supabase
      .from('rate_limits')
      .delete()
      .eq('user_id', userId)
      .eq('action', action)
      .lt('timestamp', windowStart);

    // Count recent requests
    const { data: recentRequests, error: countError } = await supabase
      .from('rate_limits')
      .select('id, timestamp')
      .eq('user_id', userId)
      .eq('action', action)
      .gte('timestamp', windowStart)
      .order('timestamp', { ascending: true });

    if (countError) {
      console.error('Rate limit check error:', countError);
      // On error, allow request but log the issue
      return {
        allowed: true,
        limit: limit.requests,
        remaining: limit.requests - 1,
        reset: now + limit.window,
      };
    }

    const requestCount = recentRequests?.length || 0;
    const remaining = Math.max(0, limit.requests - requestCount - 1);

    // Calculate reset time (when oldest request in window expires)
    const oldestTimestamp = recentRequests?.[0]?.timestamp || now;
    const reset = oldestTimestamp + limit.window;

    if (requestCount >= limit.requests) {
      return {
        allowed: false,
        limit: limit.requests,
        remaining: 0,
        reset,
      };
    }

    // Log this request
    await supabase.from('rate_limits').insert({
      user_id: userId,
      action,
      timestamp: now,
    });

    return {
      allowed: true,
      limit: limit.requests,
      remaining,
      reset,
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    // On error, allow the request to avoid blocking legitimate users
    return {
      allowed: true,
      limit: limit.requests,
      remaining: limit.requests - 1,
      reset: Math.floor(Date.now() / 1000) + limit.window,
    };
  }
}

/**
 * Middleware helper for rate limiting
 * Returns null if allowed, or a NextResponse with 429 status if rate limited
 */
export async function enforceRateLimit(
  userId: string,
  action: string,
  config?: RateLimitConfig
): Promise<{ allowed: true } | { allowed: false; response: Response }> {
  const result = await checkRateLimit(userId, action, config);

  if (!result.allowed) {
    const resetDate = new Date(result.reset * 1000).toISOString();
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          error: '요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.',
          limit: result.limit,
          remaining: result.remaining,
          reset: resetDate,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.reset.toString(),
            'Retry-After': (result.reset - Math.floor(Date.now() / 1000)).toString(),
          },
        }
      ),
    };
  }

  return { allowed: true };
}

/**
 * Get rate limit status without consuming a request
 */
export async function getRateLimitStatus(
  userId: string,
  action: string,
  config?: RateLimitConfig
): Promise<RateLimitResult> {
  const limit = config || RATE_LIMITS[action];

  if (!limit) {
    return {
      allowed: true,
      limit: Infinity,
      remaining: Infinity,
      reset: 0,
    };
  }

  try {
    const supabase = await createClient();
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - limit.window;

    const { data: recentRequests, error } = await supabase
      .from('rate_limits')
      .select('timestamp')
      .eq('user_id', userId)
      .eq('action', action)
      .gte('timestamp', windowStart)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Rate limit status check error:', error);
      return {
        allowed: true,
        limit: limit.requests,
        remaining: limit.requests,
        reset: now + limit.window,
      };
    }

    const requestCount = recentRequests?.length || 0;
    const remaining = Math.max(0, limit.requests - requestCount);
    const oldestTimestamp = recentRequests?.[0]?.timestamp || now;
    const reset = oldestTimestamp + limit.window;

    return {
      allowed: requestCount < limit.requests,
      limit: limit.requests,
      remaining,
      reset,
    };
  } catch (error) {
    console.error('Rate limit status error:', error);
    return {
      allowed: true,
      limit: limit.requests,
      remaining: limit.requests,
      reset: Math.floor(Date.now() / 1000) + limit.window,
    };
  }
}

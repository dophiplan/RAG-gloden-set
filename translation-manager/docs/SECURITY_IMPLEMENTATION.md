# Security Implementation Guide

This guide explains how security features are implemented in the Translation Manager application.

## Overview

The security implementation includes:
1. Input validation and sanitization
2. Rate limiting for API endpoints
3. API key security audit
4. SQL injection prevention
5. XSS protection

## Installation

Security dependencies have been added to the project:

```bash
npm install zod isomorphic-dompurify
```

## File Structure

```
src/
├── lib/
│   ├── validation/
│   │   └── schemas.ts          # Validation schemas and sanitization
│   └── api/
│       └── rate-limiter.ts     # Rate limiting implementation
├── app/
│   └── api/
│       ├── translations/
│       │   ├── route.ts        # ✅ Secured
│       │   └── bulk/
│       │       └── route.ts    # ✅ Secured
│       ├── glossary/
│       │   ├── route.ts        # ✅ Secured
│       │   └── bulk/
│       │       └── route.ts    # ✅ Secured
│       └── ai/
│           └── translate/
│               └── route.ts    # ✅ Secured
supabase/
└── migrations/
    └── 029_add_rate_limiting.sql  # Database schema for rate limits
```

## Usage Examples

### 1. Input Validation

```typescript
import { translationCreateSchema, validateAndSanitize } from '@/lib/validation/schemas';

// In your API route
const rawBody = await request.json();
const validation = validateAndSanitize(translationCreateSchema, rawBody);

if (!validation.success) {
  return NextResponse.json(
    { error: validation.error },
    { status: 400 }
  );
}

const body = validation.data; // Type-safe and validated
```

### 2. Text Sanitization

```typescript
import { sanitizeText } from '@/lib/validation/schemas';

// Sanitize before database insertion
const sanitizedText = sanitizeText(userInput);

// Use sanitized text in database queries
await supabase.from('translations').insert({
  source_text: sanitizedText,
  context: sanitizeText(body.context || ''),
});
```

### 3. Rate Limiting

```typescript
import { enforceRateLimit } from '@/lib/api/rate-limiter';

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser();

  // Check rate limit before processing
  const rateLimitResult = await enforceRateLimit(user.id, 'ai_translation');
  if (!rateLimitResult.allowed) {
    return rateLimitResult.response; // Returns 429 with headers
  }

  // Process request...
}
```

### 4. Custom Rate Limits

```typescript
import { enforceRateLimit } from '@/lib/api/rate-limiter';

// Use custom rate limit configuration
const customLimit = { requests: 10, window: 60 }; // 10 per minute
const result = await enforceRateLimit(user.id, 'custom_action', customLimit);
```

### 5. Check Rate Limit Status

```typescript
import { getRateLimitStatus } from '@/lib/api/rate-limiter';

// Get status without consuming a request
const status = await getRateLimitStatus(user.id, 'ai_translation');

console.log(`Remaining: ${status.remaining}/${status.limit}`);
console.log(`Resets at: ${new Date(status.reset * 1000)}`);
```

## Validation Schemas

### Available Schemas

1. **translationCreateSchema**: Single translation creation
2. **bulkCreateSchema**: Bulk translations (max 100)
3. **bulkUpdateSchema**: Bulk status updates (max 100)
4. **glossaryCreateSchema**: Glossary term creation
5. **glossaryBulkApproveSchema**: Bulk glossary approval
6. **aiTranslateSchema**: AI translation requests
7. **openaiKeySchema**: OpenAI API key validation

### Field Limits

```typescript
const MAX_TEXT_LENGTH = 5000;      // Source/translated text
const MAX_CONTEXT_LENGTH = 1000;   // Context fields
const MAX_VERSION_LENGTH = 50;     // Version strings
const MAX_TERM_LENGTH = 500;       // Glossary terms
```

## Rate Limit Configuration

| Action | Limit | Window | Use Case |
|--------|-------|--------|----------|
| `ai_translation` | 100/hour | 3600s | Individual AI translations |
| `ai_translation_bulk` | 50/hour | 3600s | Bulk AI translations |
| `bulk_create` | 50/hour | 3600s | Bulk creation operations |
| `bulk_update` | 100/hour | 3600s | Bulk updates |
| `api_create` | 200/hour | 3600s | Single item creation |
| `api_update` | 300/hour | 3600s | Single item updates |
| `glossary_create` | 100/hour | 3600s | Glossary creation |
| `glossary_bulk` | 50/hour | 3600s | Bulk glossary operations |

## Database Migration

Run the rate limiting migration:

```bash
# Using Supabase CLI
supabase migration up

# Or run the SQL directly in Supabase Dashboard
# File: supabase/migrations/029_add_rate_limiting.sql
```

The migration creates:
- `rate_limits` table with indexes
- RLS policies for user access
- `cleanup_old_rate_limits()` function

## Testing

### Test Input Validation

```typescript
// Test with invalid input
const invalidData = {
  source_text: 'a'.repeat(6000), // Too long
  context: null,
};

const result = validateAndSanitize(translationCreateSchema, invalidData);
// result.success === false
// result.error === "텍스트는 최대 5000자까지 입력할 수 있습니다."
```

### Test Rate Limiting

```typescript
// Make multiple requests to hit rate limit
for (let i = 0; i < 101; i++) {
  const response = await fetch('/api/ai/translate', {
    method: 'POST',
    body: JSON.stringify({ sourceText: 'test', targetLanguages: ['en'] }),
  });

  if (i === 100) {
    // Should get 429 status
    expect(response.status).toBe(429);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
  }
}
```

### Test Sanitization

```typescript
const maliciousInput = "Hello\x00World\x1B[31m";
const sanitized = sanitizeText(maliciousInput);
// sanitized === "HelloWorld[31m"
```

## Security Best Practices

### DO ✅

1. **Always validate inputs**
   ```typescript
   const validation = validateAndSanitize(schema, data);
   if (!validation.success) return error;
   ```

2. **Sanitize before storing**
   ```typescript
   const clean = sanitizeText(userInput);
   await db.insert({ text: clean });
   ```

3. **Check rate limits on expensive operations**
   ```typescript
   const limit = await enforceRateLimit(userId, 'ai_translation');
   if (!limit.allowed) return limit.response;
   ```

4. **Use type-safe validated data**
   ```typescript
   const { data } = validateAndSanitize(schema, input);
   // data is fully typed and validated
   ```

### DON'T ❌

1. **Don't skip validation**
   ```typescript
   // ❌ BAD
   const body = await request.json();
   await db.insert(body); // No validation!
   ```

2. **Don't trust user input**
   ```typescript
   // ❌ BAD
   const userText = body.text;
   await db.insert({ text: userText }); // Not sanitized!
   ```

3. **Don't log sensitive data**
   ```typescript
   // ❌ BAD
   console.log('API Key:', apiKey);

   // ✅ GOOD
   console.log('API Key configured:', !!apiKey);
   ```

4. **Don't expose internal errors**
   ```typescript
   // ❌ BAD
   return NextResponse.json({ error: error.stack }, { status: 500 });

   // ✅ GOOD
   console.error('Internal error:', error);
   return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
   ```

## Monitoring

### Check Rate Limit Usage

```sql
-- View recent rate limit activity
SELECT
  user_id,
  action,
  COUNT(*) as request_count,
  MAX(timestamp) as last_request
FROM rate_limits
WHERE timestamp > EXTRACT(EPOCH FROM NOW() - INTERVAL '1 hour')
GROUP BY user_id, action
ORDER BY request_count DESC;
```

### Cleanup Old Entries

```sql
-- Manually clean up old rate limit entries
SELECT cleanup_old_rate_limits();

-- Or set up a cron job
```

### Monitor Failed Validations

Add logging to track validation failures:

```typescript
if (!validation.success) {
  console.warn('Validation failed:', {
    endpoint: request.url,
    error: validation.error,
    userId: user.id,
  });
  return NextResponse.json({ error: validation.error }, { status: 400 });
}
```

## Troubleshooting

### Rate Limit Issues

**Problem**: Users getting rate limited too quickly

**Solution**: Adjust rate limits in `/src/lib/api/rate-limiter.ts`

```typescript
export const RATE_LIMITS = {
  ai_translation: { requests: 200, window: 3600 }, // Increased from 100
};
```

### Validation Errors

**Problem**: Valid inputs being rejected

**Solution**: Check schema definitions in `/src/lib/validation/schemas.ts`

```typescript
// Make field optional if needed
context: z.string().max(1000).optional(),
```

### Migration Errors

**Problem**: Rate limits table not found

**Solution**: Run the migration

```bash
supabase migration up
```

## Performance Considerations

### Rate Limiting
- Database-backed (works across instances)
- Automatic cleanup of old entries
- Indexed for fast lookups
- Minimal overhead (~10ms per check)

### Validation
- Zod is fast (<1ms for typical schemas)
- Schemas are reusable and cached
- No runtime overhead after validation

### Sanitization
- Simple regex operations
- Minimal string manipulation
- No DOM parsing needed

## Future Enhancements

1. **IP-based rate limiting**: Add IP address tracking
2. **Redis caching**: Cache rate limit counts in Redis
3. **Advanced sanitization**: Use DOMPurify for HTML content
4. **CAPTCHA**: Add CAPTCHA for high-risk operations
5. **Anomaly detection**: Detect unusual usage patterns
6. **Webhook signatures**: Verify webhook authenticity

## API Key Security Audit Results

### Current Implementation

✅ **API keys are encrypted at rest** (Supabase database encryption)
✅ **API keys are transmitted over HTTPS/SSL**
✅ **API keys have RLS policies** (users can only access their own)
✅ **API keys are validated** (format checked before storage)
✅ **API keys are not logged** (never included in logs)
✅ **Audit trail exists** (usage tracked without key values)

### Recommendations

1. **Short-term** (Implemented):
   - Input validation ✅
   - Rate limiting ✅
   - Format validation ✅

2. **Medium-term** (Future):
   - Application-level encryption
   - Key rotation policy
   - Usage anomaly detection

3. **Long-term** (Future):
   - Dedicated secrets management service
   - Multi-factor authentication
   - Advanced threat detection

## Support

For questions or issues:
1. Check the [SECURITY.md](../SECURITY.md) documentation
2. Review the code examples above
3. Check the troubleshooting section

---

**Implementation Date**: 2026-02-11
**Version**: 1.0.0

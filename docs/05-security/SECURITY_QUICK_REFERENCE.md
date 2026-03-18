# Security Quick Reference Guide

A quick reference for developers working with the Translation Manager security features.

## Quick Start

### 1. Validate Input (Required for All API Routes)

```typescript
import { [SCHEMA_NAME], validateAndSanitize } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  // Parse and validate
  const rawBody = await request.json();
  const validation = validateAndSanitize([SCHEMA_NAME], rawBody);

  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const body = validation.data; // Use validated data
}
```

### 2. Apply Rate Limiting (Required for Expensive Operations)

```typescript
import { enforceRateLimit } from '@/lib/api/rate-limiter';

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser();

  // Check rate limit
  const rateLimitResult = await enforceRateLimit(user.id, '[ACTION_NAME]');
  if (!rateLimitResult.allowed) {
    return rateLimitResult.response;
  }

  // Process request
}
```

### 3. Sanitize Text (Before Database Insertion)

```typescript
import { sanitizeText } from '@/lib/validation/schemas';

const cleanText = sanitizeText(userInput);
await db.insert({ text: cleanText });
```

## Available Schemas

| Schema | Use Case | Max Items |
|--------|----------|-----------|
| `translationCreateSchema` | Single translation | - |
| `bulkCreateSchema` | Bulk translations | 100 |
| `bulkUpdateSchema` | Bulk updates | 100 |
| `glossaryCreateSchema` | Glossary term | - |
| `glossaryBulkApproveSchema` | Bulk glossary approval | 100 |
| `aiTranslateSchema` | AI translation | 20 langs |
| `openaiKeySchema` | API key validation | - |
| `userProfileUpdateSchema` | User profile | - |

## Rate Limit Actions

| Action | Limit | When to Use |
|--------|-------|-------------|
| `ai_translation` | 100/hour | AI translate single |
| `ai_translation_bulk` | 50/hour | AI translate bulk |
| `bulk_create` | 50/hour | Bulk create operations |
| `bulk_update` | 100/hour | Bulk update operations |
| `api_create` | 200/hour | Single item create |
| `api_update` | 300/hour | Single item update |
| `glossary_create` | 100/hour | Glossary term create |
| `glossary_bulk` | 50/hour | Bulk glossary ops |

## Complete API Route Template

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import { [SCHEMA_NAME], validateAndSanitize, sanitizeText } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/api/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Rate Limiting (for expensive operations)
    const rateLimitResult = await enforceRateLimit(user.id, '[ACTION_NAME]');
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // 3. Input Validation
    const rawBody = await request.json();
    const validation = validateAndSanitize([SCHEMA_NAME], rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const body = validation.data;

    // 4. Sanitization (for text fields)
    const sanitizedText = sanitizeText(body.text);

    // 5. Database Operations
    const { data, error } = await supabase
      .from('table_name')
      .insert({ text: sanitizedText })
      .select();

    if (error) throw error;

    // 6. Success Response
    return NextResponse.json(data, { status: 201 });

  } catch (error) {
    // 7. Error Handling (no sensitive data)
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
```

## Common Patterns

### Multiple Text Fields
```typescript
const body = validation.data;
const sanitizedFields = {
  title: sanitizeText(body.title),
  description: sanitizeText(body.description || ''),
  context: body.context ? sanitizeText(body.context) : null,
};
```

### Array of Texts
```typescript
const cleanTexts = body.texts.map(text => sanitizeText(text));
```

### Optional Fields
```typescript
const sanitizedContext = body.context ? sanitizeText(body.context) : null;
```

### Check Rate Limit Status (No Consumption)
```typescript
import { getRateLimitStatus } from '@/lib/api/rate-limiter';

const status = await getRateLimitStatus(user.id, 'ai_translation');
console.log(`${status.remaining}/${status.limit} requests remaining`);
```

## Field Length Limits

```typescript
MAX_TEXT_LENGTH = 5000      // Source/translated text
MAX_CONTEXT_LENGTH = 1000   // Context fields
MAX_VERSION_LENGTH = 50     // Version strings
MAX_TERM_LENGTH = 500       // Glossary terms
```

## Error Responses

### Validation Error (400)
```typescript
{
  "error": "텍스트는 최대 5000자까지 입력할 수 있습니다."
}
```

### Rate Limit Error (429)
```typescript
{
  "error": "요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.",
  "limit": 100,
  "remaining": 0,
  "reset": "2026-02-11T15:00:00.000Z"
}
```

## Custom Validation Schema

```typescript
import { z } from 'zod';

const customSchema = z.object({
  field: z.string()
    .trim()
    .min(1, 'Field is required')
    .max(100, 'Maximum 100 characters'),
  optional: z.string().optional(),
});

const validation = validateAndSanitize(customSchema, data);
```

## Custom Rate Limit

```typescript
const customLimit = {
  requests: 10,  // 10 requests
  window: 60     // per 60 seconds
};

const result = await enforceRateLimit(
  user.id,
  'custom_action',
  customLimit
);
```

## Security Checklist for New API Routes

- [ ] Import necessary security utilities
- [ ] Add authentication check
- [ ] Apply rate limiting (if expensive)
- [ ] Validate input with schema
- [ ] Sanitize text fields
- [ ] Use parameterized queries (Supabase client)
- [ ] Log errors without sensitive data
- [ ] Return generic error messages
- [ ] Test with invalid inputs
- [ ] Test rate limiting behavior

## Common Mistakes to Avoid

### Don't Skip Validation
```typescript
// ❌ BAD
const body = await request.json();
await db.insert(body);

// ✅ GOOD
const validation = validateAndSanitize(schema, await request.json());
if (!validation.success) return error;
await db.insert(validation.data);
```

### Don't Trust User Input
```typescript
// ❌ BAD
await db.insert({ text: body.text });

// ✅ GOOD
await db.insert({ text: sanitizeText(body.text) });
```

### Don't Expose Errors
```typescript
// ❌ BAD
return NextResponse.json({ error: error.stack }, { status: 500 });

// ✅ GOOD
console.error('Error:', error);
return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
```

### Don't Log Sensitive Data
```typescript
// ❌ BAD
console.log('API Key:', apiKey);

// ✅ GOOD
console.log('API Key configured:', !!apiKey);
```

## Testing Security Features

### Test Input Validation
```typescript
// Test with invalid data
const invalid = { text: 'a'.repeat(6000) }; // Too long
const result = validateAndSanitize(schema, invalid);
expect(result.success).toBe(false);
```

### Test Rate Limiting
```typescript
// Make requests until rate limited
for (let i = 0; i < 101; i++) {
  const res = await fetch('/api/endpoint', { method: 'POST', body: data });
  if (i === 100) expect(res.status).toBe(429);
}
```

### Test Sanitization
```typescript
const malicious = "Hello\x00World\x1B";
const clean = sanitizeText(malicious);
expect(clean).toBe("HelloWorld");
```

## Debugging

### Check Validation Issues
```typescript
const validation = validateAndSanitize(schema, data);
if (!validation.success) {
  console.log('Validation error:', validation.error);
}
```

### Check Rate Limit Status
```typescript
const status = await getRateLimitStatus(userId, action);
console.log('Rate limit:', status);
```

### Enable Verbose Logging
```typescript
console.log('Input:', JSON.stringify(rawBody, null, 2));
console.log('Validated:', JSON.stringify(validation.data, null, 2));
```

## Support

- Full docs: `/docs/SECURITY_IMPLEMENTATION.md`
- Security policies: `/SECURITY.md`
- Code: `/src/lib/validation/` and `/src/lib/api/`

---

**Last Updated**: 2026-02-11

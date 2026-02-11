# Security Documentation

This document outlines the security measures implemented in the Translation Manager application.

## 1. Input Validation and Sanitization

### Validation Library
- **Zod**: Used for schema-based validation of all API inputs
- **Location**: `/src/lib/validation/schemas.ts`

### Validation Schemas
All API endpoints validate inputs using strict schemas:

- `translationCreateSchema`: Validates single translation creation
- `bulkCreateSchema`: Validates bulk translation operations (max 100 items)
- `bulkUpdateSchema`: Validates bulk status updates
- `glossaryCreateSchema`: Validates glossary term creation
- `aiTranslateSchema`: Validates AI translation requests
- `openaiKeySchema`: Validates OpenAI API key format

### Input Sanitization
- **Function**: `sanitizeText()` in `/src/lib/validation/schemas.ts`
- Removes null bytes and control characters
- Trims whitespace
- Applied to all text inputs before database insertion

### Maximum Length Limits
- Text fields: 5,000 characters
- Context fields: 1,000 characters
- Version fields: 50 characters
- Terms: 500 characters

### Protected Endpoints
All API endpoints that accept user input now include:
1. Input validation with Zod schemas
2. Text sanitization for XSS prevention
3. Type checking and format validation

**Endpoints secured:**
- `/api/translations` (POST)
- `/api/translations/bulk` (POST, PATCH)
- `/api/glossary` (POST)
- `/api/glossary/bulk` (PATCH)
- `/api/ai/translate` (POST)

## 2. Rate Limiting

### Implementation
- **Location**: `/src/lib/api/rate-limiter.ts`
- **Storage**: Database-backed (`rate_limits` table)
- **Multi-instance safe**: Works across multiple server instances

### Rate Limit Configuration

| Action | Limit | Window | Purpose |
|--------|-------|--------|---------|
| `ai_translation` | 100 requests | 1 hour | AI translation calls (expensive) |
| `ai_translation_bulk` | 50 requests | 1 hour | Bulk AI translations |
| `bulk_create` | 50 requests | 1 hour | Bulk creation operations |
| `bulk_update` | 100 requests | 1 hour | Bulk update operations |
| `api_create` | 200 requests | 1 hour | Single item creation |
| `api_update` | 300 requests | 1 hour | Single item updates |
| `glossary_create` | 100 requests | 1 hour | Glossary term creation |
| `glossary_bulk` | 50 requests | 1 hour | Bulk glossary operations |

### Rate Limit Headers
When rate limited, responses include:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when limit resets
- `Retry-After`: Seconds to wait before retrying

### Database Schema
```sql
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Cleanup
- Old entries (>24 hours) can be cleaned with `cleanup_old_rate_limits()` function
- Cleanup happens automatically during rate limit checks

## 3. API Key Security

### Storage
- **Organization keys**: Stored in `organization_settings` table
- **User keys**: Stored in `user_settings` table
- **Environment keys**: Stored in environment variables

### Key Priority
1. Organization API key (for @rsupport.com users)
2. Individual user API key
3. Environment variable (`OPENAI_API_KEY`)

### Key Format Validation
- Must start with `sk-` (OpenAI format)
- Maximum 200 characters
- Validated using `openaiKeySchema`

### Security Measures
- Keys are never logged in application code
- Keys are not returned in API responses
- Keys are only accessible by:
  - The user who owns them (user keys)
  - Organization members (org keys)
  - Service role (for processing)

### Audit Trail
- API usage is tracked in `translation_audit_logs`
- User actions are logged with user ID, name, and email
- API key values are never included in audit logs

### Encryption Status
**Current Implementation:**
- Keys are stored in Supabase database with RLS policies
- Database-level encryption at rest (Supabase default)
- SSL/TLS in transit

**Recommendations for Production:**
1. Implement application-level encryption for API keys
2. Use a dedicated secrets management service (e.g., Vault, AWS Secrets Manager)
3. Rotate keys periodically
4. Monitor for unusual API usage patterns

## 4. SQL Injection Prevention

### Protection Layers
1. **Supabase Client**: All queries use parameterized statements
2. **Row Level Security (RLS)**: Enforced at database level
3. **Input Validation**: Strict type checking before queries
4. **UUID Validation**: IDs validated as proper UUIDs

### Example
```typescript
// Safe: Uses parameterized query
const { data } = await supabase
  .from('translations')
  .select('*')
  .eq('id', validatedId);

// Never used: String concatenation
// ❌ BAD: .raw(`SELECT * FROM translations WHERE id = '${id}'`)
```

## 5. Cross-Site Scripting (XSS) Prevention

### Measures
1. **Text Sanitization**: All text inputs sanitized before storage
2. **No HTML Rendering**: Application doesn't render user HTML
3. **Content Security Policy**: Set via Next.js headers
4. **React Auto-escaping**: React automatically escapes rendered text

### Sanitization Function
```typescript
export function sanitizeText(text: string): string {
  return text
    .replace(/\0/g, '')  // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // Remove control chars
    .trim();
}
```

## 6. Authentication and Authorization

### Authentication
- Supabase Auth with email/password
- Session-based authentication
- Token expiration and refresh

### Authorization
- Row Level Security (RLS) policies on all tables
- User ID validation on all authenticated endpoints
- Admin-only routes protected by role checks

### Session Security
- HTTPOnly cookies (when applicable)
- Secure flag in production
- SameSite attribute set

## 7. Monitoring and Logging

### What's Logged
- API errors (without sensitive data)
- Authentication attempts
- Rate limit violations
- Audit trail for all data modifications

### What's NOT Logged
- API keys
- Passwords
- Personal user data
- Full request/response bodies

## 8. Best Practices

### For Developers
1. Always validate inputs with Zod schemas
2. Sanitize text before database insertion
3. Use rate limiting on expensive operations
4. Never log sensitive information
5. Use prepared statements (via Supabase client)
6. Implement proper error handling

### For Deployment
1. Enable HTTPS in production
2. Set secure environment variables
3. Run database migrations in order
4. Monitor rate limit violations
5. Set up proper CORS policies
6. Enable database backups

### For Users
1. Use strong passwords
2. Don't share API keys
3. Report suspicious activity
4. Review audit logs regularly

## 9. Security Checklist

- [x] Input validation on all API endpoints
- [x] Text sanitization for XSS prevention
- [x] Rate limiting on expensive operations
- [x] SQL injection prevention via parameterized queries
- [x] API key format validation
- [x] Audit logging for data modifications
- [x] Row Level Security (RLS) policies
- [x] Authentication required for all API routes
- [x] Maximum length limits on text fields
- [x] Proper error handling (no sensitive data leaks)

## 10. Known Limitations and Future Improvements

### Current Limitations
1. API keys stored in database (encrypted at rest by Supabase)
2. Rate limiting based on user ID (not IP address)
3. No API key rotation policy
4. No anomaly detection for unusual usage

### Future Improvements
1. Implement application-level encryption for API keys
2. Add IP-based rate limiting as backup
3. Implement automatic API key rotation
4. Add anomaly detection and alerting
5. Implement CAPTCHA for public endpoints
6. Add webhook signature verification
7. Implement data retention policies

## 11. Incident Response

### In Case of Security Incident
1. Rotate all API keys immediately
2. Review audit logs for affected period
3. Notify affected users
4. Apply patches/fixes
5. Document incident and lessons learned

### Contact
For security concerns, please contact: [security contact]

## 12. Compliance Notes

### Data Protection
- Personal data stored with consent
- User data deletable upon request
- Audit trail for compliance
- Data minimization principles applied

### Access Control
- Role-based access control (RBAC)
- Principle of least privilege
- Regular access reviews recommended

---

**Last Updated**: 2026-02-11
**Version**: 1.0.0

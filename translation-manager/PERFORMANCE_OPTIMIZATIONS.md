# Performance Optimizations - February 2026

This document outlines the critical performance optimizations implemented to fix N+1 query patterns and add batch updates.

## Summary of Changes

### 1. Batch Glossary Hit Count Updates (N+1 Query Fix)
**Problem**: In bulk translation operations, the system was making individual database calls for each glossary term match, creating an N+1 query pattern.

**Solution**:
- Created a new database function `batch_increment_glossary_hit_count` that processes multiple hit count updates in a single transaction
- Modified the bulk translation route to collect all hit count updates and process them in one batch call

**Files Changed**:
- `supabase/migrations/028_add_batch_increment_hit_count.sql` (NEW)
- `src/app/api/translations/bulk/route.ts`

**Performance Impact**:
- Before: N individual database calls (where N = number of glossary matches)
- After: 1 database call regardless of number of matches
- For 100 glossary matches: 100 queries → 1 query (99% reduction)

### 2. Batch Translation Results Updates (Sequential Update Fix)
**Problem**: Translation results were being updated sequentially in a loop, waiting for each update to complete before starting the next.

**Solution**:
- Replaced sequential UPDATE statements with a single batch UPSERT operation
- Added fallback to sequential updates if batch operation fails (for robustness)

**Files Changed**:
- `src/app/api/translations/bulk/route.ts` (2 locations: glossary translations and AI translations)

**Performance Impact**:
- Before: N sequential UPDATE queries (where N = number of translation results)
- After: 1 UPSERT query for all results
- For 50 translation results: 50 sequential queries → 1 batch query

### 3. Memoization of Glossary Grouping Operations
**Problem**: Expensive array reduction operations for grouping glossary terms were running on every component render without memoization.

**Solution**:
- Wrapped `groupedTerms` and `groupedByTerm` computations in `useMemo` hooks
- Computations now only re-run when the `terms` array changes

**Files Changed**:
- `src/app/(dashboard)/glossary/hooks/useGlossaryData.ts`

**Performance Impact**:
- Before: O(n) operations on every render (n = number of terms)
- After: O(n) operations only when terms change
- For a page with 1000 terms re-rendering 10 times: 10,000 operations → 1,000 operations (90% reduction)

## Implementation Details

### Database Migration: `028_add_batch_increment_hit_count.sql`

```sql
CREATE OR REPLACE FUNCTION batch_increment_glossary_hit_count(
  p_updates JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_update JSONB;
BEGIN
  -- p_updates format: [{"term": "...", "language_code": "..."}]
  FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    UPDATE public.glossary
    SET hit_count = hit_count + 1
    WHERE term = (v_update->>'term')
      AND language_code = (v_update->>'language_code');
  END LOOP;
END;
$$;
```

### Bulk Route Changes

**Before (N+1 Pattern)**:
```typescript
if (matchedTranslation) {
  updates.push({...});

  // N individual calls
  void db.rpc('increment_glossary_hit_count', {
    p_term: koText,
    p_language_code: lang
  });
}
```

**After (Batch Pattern)**:
```typescript
// Collect updates
const hitCountUpdates: Array<{ term: string; language_code: string }> = [];

if (matchedTranslation) {
  updates.push({...});
  hitCountUpdates.push({ term: koText, language_code: lang });
}

// Single batch call
if (hitCountUpdates.length > 0) {
  await db.rpc('batch_increment_glossary_hit_count', {
    p_updates: hitCountUpdates
  });
}
```

**Before (Sequential Updates)**:
```typescript
for (const update of updates) {
  await db
    .from('translation_results')
    .update({...})
    .eq('translation_id', update.translation_id)
    .eq('language_code', update.language_code);
}
```

**After (Batch Upsert)**:
```typescript
await db
  .from('translation_results')
  .upsert(updates, {
    onConflict: 'translation_id,language_code',
    ignoreDuplicates: false
  });
```

### React Hook Memoization

**Before**:
```typescript
const groupedTerms = terms.reduce<Record<string, GlossaryTerm[]>>((acc, term) => {
  // expensive operation on every render
}, {});
```

**After**:
```typescript
const groupedTerms = useMemo(() => {
  return terms.reduce<Record<string, GlossaryTerm[]>>((acc, term) => {
    // only runs when terms change
  }, {});
}, [terms]);
```

## Testing Recommendations

1. **Batch Hit Count Updates**:
   - Create 100 translations with glossary matches
   - Verify hit counts are correctly incremented
   - Check database logs to confirm single RPC call

2. **Batch Translation Results**:
   - Create bulk translations with multiple languages
   - Verify all translations are saved correctly
   - Check for any race conditions or data loss

3. **Memoization**:
   - Open glossary page with 1000+ terms
   - Monitor React DevTools Profiler
   - Verify grouping operations don't re-run on unrelated state changes

## Migration Instructions

### To Apply These Changes:

1. **Database Migration**:
   ```bash
   # If using Supabase CLI locally
   npx supabase db push

   # Or manually run the SQL migration on production
   # File: supabase/migrations/028_add_batch_increment_hit_count.sql
   ```

2. **Application Code**:
   - The TypeScript changes are already in the codebase
   - Build and deploy as normal
   ```bash
   npm run build
   npm run deploy  # or your deployment command
   ```

3. **Verification**:
   - Test bulk translation creation
   - Monitor database query logs
   - Check application performance metrics

## Backward Compatibility

All changes are backward compatible:
- The new batch function is additive (doesn't remove old function)
- Upsert operation produces same results as sequential updates
- Memoization doesn't change component behavior, only performance

## Performance Metrics to Monitor

After deployment, monitor these metrics:

1. **Database**:
   - Number of queries per bulk translation operation
   - Average query execution time
   - Database connection pool usage

2. **Application**:
   - Bulk translation API response time
   - Glossary page render time
   - Memory usage in React DevTools

3. **User Experience**:
   - Time to create 100 translations
   - Glossary page responsiveness
   - API timeout errors (should decrease)

## Future Optimizations

Consider these additional improvements:

1. **Pagination**: Add pagination to glossary terms to handle thousands of entries
2. **Virtual Scrolling**: Implement virtual scrolling for large glossary tables
3. **Caching**: Add Redis caching for frequently accessed glossary terms
4. **Indexes**: Review database indexes on `glossary` table for term and language_code columns
5. **Connection Pooling**: Optimize database connection pool settings for bulk operations

## Rollback Plan

If issues arise:

1. **Database**: The old `increment_glossary_hit_count` function still exists and works
2. **Application**: Revert to previous git commit
3. **Quick Fix**: The fallback sequential update code is still in place if batch upsert fails

## Contributors

- Optimization implemented: February 11, 2026
- Based on performance analysis of N+1 queries and sequential updates

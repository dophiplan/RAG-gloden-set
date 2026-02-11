# Performance Optimization Test Plan

## Overview
This document provides step-by-step instructions to test the performance optimizations implemented to fix N+1 queries and add batch updates.

## Prerequisites
- Access to the application with admin/master role
- At least 50 approved glossary terms in the system
- OpenAI API key configured (for AI translation tests)

## Test 1: Batch Hit Count Updates

### Objective
Verify that glossary hit counts are updated in a single batch call instead of N individual calls.

### Steps
1. **Setup**:
   - Ensure you have at least 10 approved glossary terms
   - Note the current hit counts for these terms

2. **Execute Bulk Translation**:
   - Navigate to the bulk translation page
   - Enter 10 Korean texts that match your glossary terms
   - Select multiple target languages (e.g., EN, JA, ZH)
   - Click "Create Translations"

3. **Verification**:
   - Check database logs for RPC calls:
     ```sql
     -- Should see ONE call to batch_increment_glossary_hit_count
     -- instead of multiple increment_glossary_hit_count calls
     ```
   - Verify hit counts increased correctly:
     ```sql
     SELECT term, language_code, hit_count
     FROM glossary
     WHERE term IN ('your', 'test', 'terms')
     ORDER BY term, language_code;
     ```

### Expected Results
- ✅ All hit counts should be incremented correctly
- ✅ Database logs show 1 batch RPC call
- ✅ No errors in application logs

---

## Test 2: Batch Translation Results Upsert

### Objective
Verify that translation results are saved in a single batch operation instead of sequential updates.

### Steps
1. **Create Bulk Translations**:
   - Navigate to bulk translation page
   - Enter 20 new texts
   - Select 5 languages
   - Click "Create Translations"
   - This should create 100 translation results (20 texts × 5 languages)

2. **Monitor Database**:
   - Check database query logs
   - Look for UPSERT operations on translation_results table

3. **Verify Data Integrity**:
   ```sql
   SELECT
     t.id,
     COUNT(tr.id) as result_count,
     STRING_AGG(tr.language_code, ', ' ORDER BY tr.language_code) as languages
   FROM translations t
   LEFT JOIN translation_results tr ON tr.translation_id = t.id
   WHERE t.request_id = 'YOUR_REQUEST_ID'
   GROUP BY t.id
   HAVING COUNT(tr.id) != 5;
   ```
   - Query should return 0 rows (all translations have exactly 5 results)

### Expected Results
- ✅ All translation results saved correctly
- ✅ Database logs show batch UPSERT operation
- ✅ Response time is faster than before (baseline comparison)

---

## Test 3: React Memoization

### Objective
Verify that glossary grouping operations don't re-run unnecessarily.

### Steps
1. **Setup React DevTools**:
   - Install React DevTools Chrome extension
   - Open the Profiler tab

2. **Test Glossary Page**:
   - Navigate to the glossary page with 100+ terms
   - Open React DevTools Profiler
   - Click "Start Profiling"
   - Perform the following actions:
     - Change a filter (not the search/language filter)
     - Open and close a modal
     - Click a button that doesn't change terms
   - Click "Stop Profiling"

3. **Analyze Results**:
   - Look for the `useGlossaryData` hook
   - Check if `groupedTerms` and `groupedByTerm` computations ran
   - They should NOT run unless the `terms` array changed

4. **Test With Term Changes**:
   - Start profiling again
   - Change the language filter or search term (changes terms)
   - Stop profiling
   - Verify computations DID run this time

### Expected Results
- ✅ Grouping operations don't run on unrelated state changes
- ✅ Grouping operations DO run when terms change
- ✅ Render time is reduced (check Profiler flame graph)

---

## Test 4: End-to-End Performance Test

### Objective
Measure overall performance improvement in a realistic scenario.

### Steps
1. **Baseline Measurement** (if you have old version):
   - Create 100 translations with glossary matches
   - Measure total time from API request to completion
   - Note: Time = API response time

2. **Current Performance**:
   - Clear cache and restart
   - Create 100 translations with glossary matches
   - Measure total time from API request to completion

3. **Compare Results**:
   ```
   Baseline: ___ seconds
   Optimized: ___ seconds
   Improvement: ___% faster
   ```

### Expected Results
- ✅ At least 30% improvement in bulk translation creation time
- ✅ No data loss or corruption
- ✅ No increase in error rate

---

## Test 5: Error Handling and Fallbacks

### Objective
Verify that fallback mechanisms work correctly if batch operations fail.

### Steps
1. **Test Batch RPC Failure**:
   - Temporarily break the batch_increment_glossary_hit_count function
   - Create bulk translations
   - Verify operation completes (logs error but doesn't crash)

2. **Test Batch Upsert Failure**:
   - The code has fallback to sequential updates
   - Simulate upsert failure (e.g., constraint violation)
   - Verify fallback executes correctly

3. **Test Partial Success**:
   - Create 50 translations
   - Some with glossary matches, some without
   - Verify all translations are created regardless

### Expected Results
- ✅ Application doesn't crash on batch operation failures
- ✅ Fallback mechanisms execute correctly
- ✅ Error messages are logged appropriately
- ✅ User sees appropriate error messages (not raw errors)

---

## Test 6: Concurrent Operations

### Objective
Verify that batch operations handle concurrent requests correctly.

### Steps
1. **Simulate Concurrent Requests**:
   - Use a tool like Apache Bench or Postman
   - Send 5 simultaneous bulk translation requests
   - Each request creates 20 translations

2. **Verify Data Integrity**:
   ```sql
   -- Check for duplicate translations
   SELECT source_text, COUNT(*)
   FROM translations
   WHERE created_at > NOW() - INTERVAL '5 minutes'
   GROUP BY source_text
   HAVING COUNT(*) > 1;
   ```

3. **Verify Hit Counts**:
   ```sql
   -- Verify hit counts are consistent
   SELECT term, language_code, hit_count
   FROM glossary
   WHERE updated_at > NOW() - INTERVAL '5 minutes'
   ORDER BY term;
   ```

### Expected Results
- ✅ No race conditions
- ✅ Hit counts are accurate
- ✅ No deadlocks or timeout errors

---

## Performance Benchmarks

### Target Metrics
- **Bulk Translation Creation** (100 items):
  - Before: ~15-30 seconds
  - After: <10 seconds
  - Target improvement: >40%

- **Database Queries** (100 glossary matches):
  - Before: 100+ individual queries
  - After: 1-2 batch queries
  - Target improvement: >95%

- **Glossary Page Render** (1000 terms):
  - Before: Multiple grouping operations per render
  - After: Grouping operations only when data changes
  - Target improvement: 50-70% fewer computations

### Monitoring Queries

**Check database query count**:
```sql
-- Monitor query patterns
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%glossary%'
  OR query LIKE '%translation_results%'
ORDER BY calls DESC
LIMIT 20;
```

**Check application performance**:
```javascript
// Add to browser console
performance.mark('start');
// Perform operation
performance.mark('end');
performance.measure('operation', 'start', 'end');
console.log(performance.getEntriesByType('measure'));
```

---

## Troubleshooting

### Issue: Batch RPC function not found
**Solution**: Run the migration file manually:
```bash
psql $DATABASE_URL < supabase/migrations/028_add_batch_increment_hit_count.sql
```

### Issue: Upsert fails with constraint violation
**Solution**: Check that `translation_results` table has correct unique constraint:
```sql
ALTER TABLE translation_results
ADD CONSTRAINT translation_results_pkey
PRIMARY KEY (translation_id, language_code);
```

### Issue: Hit counts not incrementing
**Solution**: Verify the function exists and has correct permissions:
```sql
SELECT proname, proowner, proacl
FROM pg_proc
WHERE proname = 'batch_increment_glossary_hit_count';
```

---

## Rollback Instructions

If critical issues are found:

1. **Database Rollback**:
   ```sql
   DROP FUNCTION IF EXISTS batch_increment_glossary_hit_count(JSONB);
   ```

2. **Application Rollback**:
   ```bash
   git revert <commit-hash>
   npm run build
   npm run deploy
   ```

3. **Verify System Stability**:
   - Test bulk translation creation
   - Check glossary functionality
   - Monitor error logs

---

## Success Criteria

The optimization is considered successful if:

- ✅ All 6 tests pass without errors
- ✅ Performance improvements meet or exceed targets
- ✅ No data integrity issues
- ✅ No increase in error rates
- ✅ User experience is noticeably faster
- ✅ Database query count is significantly reduced

---

## Sign-off

**Tested By**: _______________
**Date**: _______________
**Result**: [ ] Pass [ ] Fail
**Notes**:
```
